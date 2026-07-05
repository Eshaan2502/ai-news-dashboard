import OpenAI from "openai";
import { z } from "zod";
import { estimateNewsworthiness } from "../ingest/heuristics";
import { truncate } from "../utils";

/**
 * Thin OpenAI wrapper with graceful degradation.
 * If OPENAI_API_KEY is unset (or a call fails), every function falls back to a
 * deterministic, offline result so the whole app keeps working without a key.
 */

export const AI_ENABLED = Boolean(process.env.OPENAI_API_KEY);
export const EMBED_DIMS = 1536;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

let _client: OpenAI | null = null;
function client(): OpenAI | null {
  if (!AI_ENABLED) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

/* ─────────────────────────── Embeddings ─────────────────────────── */

/** Embed one text → 1536-dim vector, or null when AI is disabled / errors. */
export async function embed(text: string): Promise<number[] | null> {
  const c = client();
  if (!c || !text.trim()) return null;
  try {
    const res = await c.embeddings.create({ model: EMBED_MODEL, input: truncate(text, 8000) });
    return res.data[0]?.embedding ?? null;
  } catch (e) {
    console.warn("embed() failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/* ─────────────────────────── Enrichment ─────────────────────────── */

const EnrichSchema = z.object({
  summary: z.string().default(""),
  entities: z.array(z.string()).default([]),
  topic: z.string().default("General"),
  impact: z.number().min(0).max(100).default(50),
});
export type Enrichment = z.infer<typeof EnrichSchema>;

export type EnrichInput = { title: string; content: string; sourceName: string };

/**
 * Summarize + extract entities/topic + rate newsworthiness (0–100).
 * Fallback: first ~2 sentences of the content and a neutral impact.
 */
export async function enrich(input: EnrichInput): Promise<Enrichment> {
  const c = client();
  if (!c) return fallbackEnrichment(input);

  try {
    const res = await c.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a news editor. Given an article, respond ONLY with JSON: " +
            '{ "summary": string (1-2 neutral sentences, <=45 words), ' +
            '"entities": string[] (companies, people, places, products; max 6), ' +
            '"topic": string (short label e.g. "Elections", "Markets", "Research", "Transfers"), ' +
            '"impact": number (0-100 newsworthiness for a general news reader; calibrate: ' +
            "80-100 major breaking story, 55-79 notable development, 30-54 routine or incremental, " +
            "0-29 promotional/listicle/filler) }.",
        },
        {
          role: "user",
          content: `Source: ${input.sourceName}\nTitle: ${input.title}\n\nContent:\n${truncate(
            input.content,
            3000,
          )}`,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = EnrichSchema.parse(JSON.parse(raw));
    // Guard against an empty summary from the model.
    if (!parsed.summary) parsed.summary = fallbackSummary(input);
    parsed.entities = parsed.entities.slice(0, 6);
    return parsed;
  } catch (e) {
    console.warn("enrich() failed, using fallback:", e instanceof Error ? e.message : e);
    return fallbackEnrichment(input);
  }
}

/* ─────────────────────────── LinkedIn post ─────────────────────────── */

export type LinkedInPostInput = {
  title: string;
  summary: string | null;
  content: string;
  sourceName: string;
  topic: string | null;
  /** When set, revise `draft` per `instruction` instead of writing from scratch. */
  revision?: { draft: string; instruction: string };
};

export type LinkedInPost = { post: string; aiGenerated: boolean };

const LINKEDIN_WRITER =
  "You write LinkedIn posts for a professional audience. The post analyzes a news article: " +
  "a one-line hook, 2-3 short paragraphs on what happened and why it matters, a closing " +
  "takeaway or question that invites discussion, then 3-5 relevant hashtags on the final line. " +
  "Plain text only — no markdown, at most one emoji. Under 1300 characters. " +
  "Write in first person as a professional sharing their take. " +
  "Do NOT include any URL — the article link is appended separately.";

/**
 * Draft (or revise) a LinkedIn post that analyzes the article. With
 * `revision` set, the model applies the reader's requested changes to their
 * current draft, staying grounded in the article. Fallback without an API
 * key: a deterministic draft, or the unchanged draft for revisions — the
 * caller detects the no-op via `aiGenerated`.
 */
export async function generateLinkedInPost(input: LinkedInPostInput): Promise<LinkedInPost> {
  const c = client();
  if (!c) {
    return input.revision
      ? { post: input.revision.draft, aiGenerated: false }
      : { post: fallbackLinkedInPost(input), aiGenerated: false };
  }

  const articleContext =
    `Source: ${input.sourceName}\nTopic: ${input.topic ?? "General"}\nTitle: ${input.title}\n` +
    `Summary: ${input.summary ?? ""}\n\nContent:\n${truncate(input.content, 3500)}`;

  const messages = input.revision
    ? [
        {
          role: "system" as const,
          content:
            LINKEDIN_WRITER +
            " You are revising the reader's existing draft: apply their requested changes, " +
            "keep everything factually grounded in the article, and respond with ONLY the " +
            "revised post text. Follow the requested changes even when they bend the format " +
            "rules above (e.g. no hashtags, different length).",
        },
        {
          role: "user" as const,
          content:
            `${articleContext}\n\nCurrent draft:\n${input.revision.draft}\n\n` +
            `Requested changes: ${input.revision.instruction}`,
        },
      ]
    : [
        { role: "system" as const, content: LINKEDIN_WRITER },
        { role: "user" as const, content: articleContext },
      ];

  try {
    const res = await c.chat.completions.create({ model: MODEL, temperature: 0.7, messages });
    const post = res.choices[0]?.message?.content?.trim();
    if (!post) throw new Error("empty completion");
    return { post: truncate(post, 2800), aiGenerated: true };
  } catch (e) {
    console.warn("generateLinkedInPost() failed, using fallback:", e instanceof Error ? e.message : e);
    return input.revision
      ? { post: input.revision.draft, aiGenerated: false }
      : { post: fallbackLinkedInPost(input), aiGenerated: false };
  }
}

function fallbackLinkedInPost(input: LinkedInPostInput): string {
  const topicTag = (input.topic ?? "News").replace(/[^\p{L}\p{N}]/gu, "");
  const parts = [
    `Worth a read: "${input.title}" (via ${input.sourceName}).`,
    input.summary?.trim() ?? "",
    "Sharing for anyone following this space — curious what others make of it.",
    `#News${topicTag && topicTag !== "News" ? ` #${topicTag}` : ""}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

function fallbackSummary(input: EnrichInput): string {
  const text = input.content?.trim() || input.title;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length) return truncate(sentences.slice(0, 2).join(" ").trim(), 280);
  return truncate(text, 200);
}

/** Deterministic enrichment with no API call — used when AI is off or over budget. */
export function fallbackEnrichment(input: EnrichInput): Enrichment {
  return {
    summary: fallbackSummary(input),
    entities: [],
    topic: "General",
    impact: estimateNewsworthiness(input.title, input.content),
  };
}
