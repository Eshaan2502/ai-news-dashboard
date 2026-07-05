import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-friendly relative time, e.g. "3h ago". Falls back to a date string. */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "unknown";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Canonicalize a URL for deduplication:
 * lowercase host, drop tracking params, strip trailing slash & fragment.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.host = u.host.toLowerCase();
    const drop = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "ref_src", "fbclid", "gclid", "mc_cid", "mc_eid", "source",
    ];
    drop.forEach((p) => u.searchParams.delete(p));
    // Sort remaining params for stable output.
    u.searchParams.sort();
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return raw.trim();
  }
}

/** Normalize a title to a comparable token signature (lowercase, alnum only). */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard similarity over word tokens — cheap fuzzy title match, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

/**
 * Strip HTML tags from feed content. Block-level closes become blank lines so
 * the excerpt keeps its paragraph structure (the reader splits on them).
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|section|article)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

/** Truncate text to a max length on a word boundary. */
export function truncate(text: string, max = 280): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

/** Format a vector as a pgvector literal string, e.g. "[0.1,0.2]". */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Cosine similarity between two equal-length vectors, 0..1 (assumes non-zero). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Run an async mapper over items with bounded concurrency, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
