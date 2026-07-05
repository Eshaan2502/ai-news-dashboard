import { JSDOM, VirtualConsole } from "jsdom";
import type { ArticleBlock } from "./types";

/**
 * Conversion of untrusted HTML/markdown into plain-text ArticleBlocks — the
 * only shape the reader renders. Shared by read-time extraction (extract.ts)
 * and ingest-time feed full-text (ingest/normalize.ts). No db imports here so
 * the ingest pipeline can use it without pulling in the reader stack.
 */

const MAX_BLOCKS = 250;

// Site chrome that Readability sometimes lets through (nav links, ad slots).
const BOILERPLATE =
  /^(skip to (main )?content|skip to navigation|advertisement|sponsored( content)?|sign (in|up)|subscribe (now|today)|share this|follow us)\b/i;

function pushBlock(
  blocks: ArticleBlock[],
  seen: Set<string>,
  type: ArticleBlock["type"],
  text: string,
) {
  const minLen = type === "h2" || type === "h3" ? 3 : 25;
  if (text.length < minLen || seen.has(text) || blocks.length >= MAX_BLOCKS) return;
  if (text.length < 120 && BOILERPLATE.test(text)) return;
  seen.add(text);
  blocks.push({ type, text });
}

/** Flatten an HTML fragment into plain-text blocks — no HTML reaches the client. */
export function htmlToBlocks(html: string): ArticleBlock[] {
  // Silence jsdom's noisy CSS/script warnings from arbitrary markup.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { virtualConsole });
  const nodes = dom.window.document.querySelectorAll("p, h2, h3, li, blockquote");
  const blocks: ArticleBlock[] = [];
  const seen = new Set<string>();
  for (const el of nodes) {
    // Skip nested matches (a <p> inside a <blockquote>, nested <li>s, …) —
    // the outer block's textContent already contains their text.
    if (el.parentElement?.closest("p, li, blockquote")) continue;
    const type = el.tagName.toLowerCase() as ArticleBlock["type"];
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    pushBlock(blocks, seen, type, text);
  }
  return blocks;
}

/** Flatten reader-proxy markdown into the same block shape. */
export function markdownToBlocks(md: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const seen = new Set<string>();
  const clean = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
      .replace(/[*_`]{1,3}/g, "")
      .replace(/\s+/g, " ")
      .trim();

  for (const chunk of md.split(/\r?\n\s*\r?\n/)) {
    const lines = chunk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    // Tables and horizontal rules are noise in a text-only reader.
    if (lines.every((l) => l.startsWith("|") || /^[-=*_\s]+$/.test(l))) continue;

    if (lines.every((l) => /^([-*+]|\d+[.)])\s/.test(l))) {
      for (const l of lines) pushBlock(blocks, seen, "li", clean(l.replace(/^([-*+]|\d+[.)])\s+/, "")));
    } else if (lines.every((l) => l.startsWith(">"))) {
      pushBlock(blocks, seen, "blockquote", clean(lines.map((l) => l.replace(/^>\s?/, "")).join(" ")));
    } else if (lines.length === 1 && /^#{1,6}\s/.test(lines[0])) {
      const level = lines[0].match(/^#+/)![0].length;
      pushBlock(blocks, seen, level <= 2 ? "h2" : "h3", clean(lines[0].replace(/^#+\s*/, "")));
    } else {
      pushBlock(blocks, seen, "p", clean(lines.join(" ")));
    }
  }
  return blocks;
}

// Bot walls and consent screens that extract as if they were the article.
const BLOCK_PAGE =
  /blocked by network security|access( to this page has been)? denied|are you a robot|verify (that )?you are (a )?human|enable (javascript|cookies)|attention required|unusual traffic|complete the security check|captcha/i;

/**
 * A real article body: enough paragraphs of enough text, and not a
 * bot-wall/consent page masquerading as one.
 */
export function hasBody(blocks: ArticleBlock[] | null): blocks is ArticleBlock[] {
  if (!blocks) return false;
  const paragraphs = blocks.filter((b) => b.type === "p");
  const chars = paragraphs.reduce((n, b) => n + b.text.length, 0);
  if (paragraphs.length < 3 || chars < 400) return false;
  return !blocks.slice(0, 5).some((b) => BLOCK_PAGE.test(b.text));
}

/**
 * Stricter test for feed-provided content: only treat it as the full article
 * (skipping live extraction entirely) when it clearly isn't a teaser.
 */
export function isFullBody(blocks: ArticleBlock[] | null): blocks is ArticleBlock[] {
  if (!hasBody(blocks)) return false;
  const paragraphs = blocks.filter((b) => b.type === "p");
  const chars = paragraphs.reduce((n, b) => n + b.text.length, 0);
  return paragraphs.length >= 5 && chars >= 1500;
}
