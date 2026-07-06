import { JSDOM, VirtualConsole } from "jsdom";
import { decodeEntities } from "./utils";
import type { ArticleBlock } from "./types";

/**
 * Conversion of untrusted HTML/markdown into plain-text ArticleBlocks — the
 * only shape the reader renders. Shared by read-time extraction (extract.ts)
 * and ingest-time feed full-text (ingest/normalize.ts). No db imports here so
 * the ingest pipeline can use it without pulling in the reader stack.
 *
 * ── How a piece of extracted text is classified ──────────────────────────
 * Every candidate line runs through the same decision ladder:
 *
 *  1. DROP if it isn't article prose (see isNoise below):
 *     site chrome, cross-promo links, image captions/credits, bylines and
 *     timestamps that leaked out of the header, newsletter CTAs, copyright
 *     footers, syndication credits. Length guards keep these filters from
 *     ever touching a real paragraph.
 *  2. PROMOTE things that are headings in disguise:
 *     <p><strong>…</strong></p> (WordPress section heads), h4–h6, and short
 *     title-cased lines without sentence punctuation → h3.
 *  3. SPLIT wall-of-text paragraphs (feeds that collapse the whole article
 *     into one <p>) at sentence boundaries into readable chunks.
 *  4. Everything else keeps its semantic type: p, h2, h3, li, blockquote —
 *     which is exactly the set the reader knows how to typeset.
 */

const MAX_BLOCKS = 250;

/**
 * Short-line filters only apply below this length — a genuine paragraph is
 * longer than any caption/byline/CTA, so real prose can never be dropped.
 */
const NOISE_MAX_LEN = 160;

// Site chrome and cross-promo lines that Readability sometimes lets through
// (nav links, ad slots, "Read more:"/"Related:" link rows, app banners).
const BOILERPLATE =
  /^(skip to (main )?content|skip to navigation|advertisement$|sponsored( content)?|sign (in|up)\b|subscribe (now|today)\b|share (this|on)\b|follow us\b|listen to this (article|story)|(this )?story continues below|scroll to continue|continue reading|click here\b|download (the |our )?app\b|open in app$|(read|see) (more|also|next)\s*[:|–—-]|also read\s*[:|–—-]|related\s*[:|]|related (articles|stories|news|videos?)\b|recommended for you|trending (now|topics)|watch\s*[:|]|watch now\b|comments?$)/i;

// Orphaned image captions and photo credits — the reader strips images, so
// these lines describe pictures the user can't see (TechCrunch's
// "Image Credits: …", wire-photo "(Photo: Reuters)" tails, etc.).
const CREDIT_LINE =
  /^(photo|image|picture|video|file photo|representational image|illustration|graphic|screenshot|screengrab|video grab)s?\s*(credits?\s*)?[:|]|^(credits?|courtesy)\s*[:|]|^(photo|image)s? (by|courtesy of)\b/i;
const TRAILING_CREDIT =
  /[([](photo|image|file|source|credits?|via|reuters|afp|ap photo|getty( images)?|bloomberg|shutterstock|istock|unsplash|pixabay)[^)\]]{0,60}[)\]]\.?$/i;

// Bylines, timestamps and reading-time chips that escape the page header.
const META_LINE =
  /^(by [A-Z][\w.'’-]+( [A-Z][\w.'’-]+){0,3}$|(published|updated|last updated|first published|posted|edited by|written by|reported by|curated by)\b[^.]{0,80}$|\d+ min(ute)?s? read$|reading time\s*[:\s])/i;

// Legal footers.
const COPYRIGHT = /^(©|copyright\s+©?\s*\d{4}|all rights reserved)/i;

// Newsletter/subscription CTAs mid-article (VentureBeat, TechCrunch, …).
const NEWSLETTER_CTA =
  /(sign up|subscribe|register) (for|to) (our |the )?(daily |weekly |free )?(newsletter|briefing|digest)/i;

// Syndication credit footers (WordPress republish plugins) — the page footer
// already credits the publisher with a link, so these are pure noise.
const SYNDICATION =
  /^(the post .{0,200}appeared first on|this (article|story|post) (first appeared|originally appeared|was (first|originally) published))\b/i;

/** True when a cleaned line is site furniture rather than article prose. */
function isNoise(text: string): boolean {
  if (SYNDICATION.test(text)) return true;
  if (text.length >= NOISE_MAX_LEN) return false;
  return (
    BOILERPLATE.test(text) ||
    CREDIT_LINE.test(text) ||
    TRAILING_CREDIT.test(text) ||
    META_LINE.test(text) ||
    COPYRIGHT.test(text) ||
    NEWSLETTER_CTA.test(text)
  );
}

/**
 * Some feeds double-escape their markup, so entity decoding leaves literal
 * tags (`<a href=…>`) inside what should be plain text. Every block passes
 * through here on its way in — and again at render time via polishBlocks.
 */
function cleanText(text: string): string {
  return decodeEntities(text)
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushBlock(
  blocks: ArticleBlock[],
  seen: Set<string>,
  type: ArticleBlock["type"],
  rawText: string,
) {
  const text = cleanText(rawText);
  const minLen = type === "h2" || type === "h3" ? 3 : 25;
  if (text.length < minLen || seen.has(text) || blocks.length >= MAX_BLOCKS) return;
  if (isNoise(text)) return;
  seen.add(text);
  blocks.push({ type, text });
}

/** Flatten an HTML fragment into plain-text blocks — no HTML reaches the client. */
export function htmlToBlocks(html: string): ArticleBlock[] {
  // Silence jsdom's noisy CSS/script warnings from arbitrary markup.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { virtualConsole });
  const nodes = dom.window.document.querySelectorAll("p, h2, h3, h4, h5, h6, li, blockquote");
  const blocks: ArticleBlock[] = [];
  const seen = new Set<string>();
  for (const el of nodes) {
    // Skip nested matches (a <p> inside a <blockquote>, nested <li>s, …) —
    // the outer block's textContent already contains their text.
    if (el.parentElement?.closest("p, li, blockquote")) continue;
    const tag = el.tagName.toLowerCase();
    const text = el.textContent ?? "";
    if (tag === "p" && isBoldOnlyParagraph(el)) {
      // WordPress-style section heading written as <p><strong>…</strong></p>.
      pushBlock(blocks, seen, "h3", text);
    } else if (tag === "h4" || tag === "h5" || tag === "h6") {
      pushBlock(blocks, seen, "h3", text);
    } else {
      pushBlock(blocks, seen, tag as ArticleBlock["type"], text);
    }
  }
  return blocks;
}

/** A <p> whose entire visible text lives in a single <strong>/<b> child. */
function isBoldOnlyParagraph(el: Element): boolean {
  if (el.children.length !== 1) return false;
  const only = el.children[0];
  if (!/^(strong|b)$/i.test(only.tagName)) return false;
  const inner = (only.textContent ?? "").trim();
  const outer = (el.textContent ?? "").trim();
  return inner.length > 0 && inner.length <= 90 && inner === outer;
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

/**
 * Feeds often flatten mid-article section headings into paragraphs. A short
 * title-cased line with no sentence-ending punctuation is one of those, not
 * body text.
 */
function looksLikeHeading(text: string): boolean {
  if (text.length > 70) return false;
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 9) return false;
  if (/[.!,;:…]["'”’]?$/.test(text)) return false; // ends like a sentence
  const capitalized = words.filter((w) => /^["'“‘(]*[A-Z0-9]/.test(w)).length;
  return capitalized / words.length >= 0.6;
}

/**
 * Feeds sometimes collapse an entire article into one wall-of-text paragraph.
 * Past this length, split at sentence boundaries into readable chunks.
 */
const LONG_PARAGRAPH = 700;
const TARGET_CHUNK = 450;

// Sentence boundary: terminal punctuation (plus closing quotes/parens),
// not after a title/abbreviation or a single-initial ("Dr.", "U.S."),
// followed by whitespace and something that starts a sentence.
const SENTENCE_BREAK =
  /(?<=[.!?…]["'”’)]*)(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|St|Sen|Rep|Gov|Gen|Jr|Sr|vs|etc|Inc|Ltd|Co|No|Fig|approx)\.)(?<!\b[A-Z]\.)\s+(?=["'“‘(]*[A-Z0-9])/;

function splitParagraph(text: string): string[] {
  const sentences = text.split(SENTENCE_BREAK);
  if (sentences.length < 2) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > TARGET_CHUNK) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Render-time cleanup. Rows stored before the current extraction rules keep
 * whatever artifacts they were saved with (escaped markup, syndication
 * footers, headings flattened to paragraphs, collapsed paragraphs), so the
 * reader re-applies the ingest filters on the way out and drops a leading
 * headline duplicate — the page header already shows the title.
 */
export function polishBlocks(blocks: ArticleBlock[], title?: string | null): ArticleBlock[] {
  const out: ArticleBlock[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const text = cleanText(block.text);
    const type = block.type === "p" && looksLikeHeading(text) ? "h3" : block.type;
    if (type === "p" && text.length > LONG_PARAGRAPH) {
      for (const part of splitParagraph(text)) pushBlock(out, seen, "p", part);
    } else {
      pushBlock(out, seen, type, text);
    }
  }
  if (title && out.length && comparableKey(out[0].text) === comparableKey(title)) out.shift();
  return out;
}

function comparableKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
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
