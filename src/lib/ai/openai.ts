import OpenAI from "openai";
import { z } from "zod";
import { truncate } from "../utils";
import type { BroadcastPlatform } from "../constants";

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
            "You are an AI-news editor. Given an article, respond ONLY with JSON: " +
            '{ "summary": string (1-2 neutral sentences, <=45 words), ' +
            '"entities": string[] (companies, models, people, products; max 6), ' +
            '"topic": string (short label e.g. "Model Releases", "Funding", "Research", "Policy"), ' +
            '"impact": number (0-100 newsworthiness for an AI professional) }.',
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

function fallbackSummary(input: EnrichInput): string {
  const text = input.content?.trim() || input.title;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length) return truncate(sentences.slice(0, 2).join(" ").trim(), 280);
  return truncate(text, 200);
}

/** Deterministic enrichment with no API call — used when AI is off or over budget. */
export function fallbackEnrichment(input: EnrichInput): Enrichment {
  return { summary: fallbackSummary(input), entities: [], topic: "General", impact: 50 };
}

/* ─────────────────────── Broadcast content ─────────────────────── */

export type BroadcastItem = {
  title: string;
  summary: string | null;
  url: string;
  sourceName: string | null;
  entities?: string[] | null;
};

/**
 * Generate platform-tailored share content. Fallback: clean templates so the
 * broadcast flow is always demonstrable, key or not.
 */
export async function generateBroadcastContent(
  platform: BroadcastPlatform,
  item: BroadcastItem,
): Promise<string> {
  const c = client();
  if (!c) return fallbackBroadcast(platform, item);

  const styleByPlatform: Record<BroadcastPlatform, string> = {
    linkedin:
      "Write an engaging LinkedIn post (≈90 words): a strong first-line hook, one insight on why it matters, then 3-4 relevant hashtags. Professional, no emoji spam.",
    email:
      "Write a concise newsletter blurb: a one-line subject prefixed 'Subject: ', a blank line, then 2-3 sentences of why it matters.",
    whatsapp:
      "Write a short, punchy WhatsApp share message (≤45 words) with 1-2 tasteful emoji and a clear reason to click.",
    blog: "Write a 2-3 sentence blog intro paragraph that frames the story and invites reading more.",
    newsletter:
      "Write a single newsletter bullet: a bold-style lead phrase followed by one sentence of context.",
  };

  try {
    const res = await c.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You craft share-ready copy for AI news. ${styleByPlatform[platform]} Always end with the URL on its own line. Do not invent facts beyond the summary.`,
        },
        {
          role: "user",
          content: `Title: ${item.title}\nSource: ${item.sourceName ?? "AI News"}\nSummary: ${
            item.summary ?? ""
          }\nURL: ${item.url}`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || fallbackBroadcast(platform, item);
  } catch (e) {
    console.warn("generateBroadcastContent() failed, using fallback:", e instanceof Error ? e.message : e);
    return fallbackBroadcast(platform, item);
  }
}

function fallbackBroadcast(platform: BroadcastPlatform, item: BroadcastItem): string {
  const src = item.sourceName ?? "AI News";
  const summary = item.summary ?? "";
  const tags = (item.entities ?? [])
    .slice(0, 3)
    .map((e) => "#" + e.replace(/[^A-Za-z0-9]/g, ""))
    .join(" ");
  switch (platform) {
    case "linkedin":
      return `🚀 ${item.title}\n\n${summary}\n\n(via ${src})\n${tags} #AI #MachineLearning\n${item.url}`;
    case "email":
      return `Subject: ${item.title}\n\n${summary}\n\nRead more (${src}): ${item.url}`;
    case "whatsapp":
      return `📰 *${item.title}*\n${summary}\n👉 ${item.url}`;
    case "blog":
      return `${item.title}\n\n${summary}\n\nOriginal report from ${src}: ${item.url}`;
    case "newsletter":
      return `• ${item.title} — ${summary} (${src}) ${item.url}`;
    default:
      return `${item.title}\n${item.url}`;
  }
}
