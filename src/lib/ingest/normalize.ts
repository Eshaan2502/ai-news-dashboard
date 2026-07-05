import { canonicalizeUrl, stripHtml, truncate } from "../utils";
import { htmlToBlocks, isFullBody } from "../blocks";
import type { ArticleBlock } from "../types";
import type { FeedItem } from "./fetcher";

export type NormalizedItem = {
  title: string;
  url: string;
  canonicalUrl: string;
  author: string | null;
  publishedAt: Date | null;
  rawContent: string;
  /** Full article body when the feed ships it (content:encoded) — pre-fills the reader. */
  fullBlocks: ArticleBlock[] | null;
  imageUrl: string | null;
};

/**
 * Coerce any feed field to a string. RSS/Atom parsers return fields as strings,
 * arrays, or `{ _, $ }` objects depending on the feed, so we normalize defensively
 * (never call `.toString()` on an unknown shape).
 */
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o._ === "string") return o._; // xml text node
    if (typeof o.href === "string") return o.href; // atom link
    if (typeof o.name === "string") return o.name; // {name: ...} authors
    const attrs = o.$ as Record<string, unknown> | undefined;
    if (attrs && typeof attrs.href === "string") return attrs.href; // <link href="…"/>
    return "";
  }
  return "";
}

/** Parse a feed item into our normalized shape, or null if it's unusable. */
export function normalizeItem(item: FeedItem): NormalizedItem | null {
  const title = asText(item.title).trim();
  const url = (asText(item.link) || asText(item.guid)).trim();
  if (!title || !url || !/^https?:\/\//i.test(url)) return null;

  const authorRaw = (
    asText(item.creator) || asText((item as { "dc:creator"?: unknown })["dc:creator"])
  ).trim();
  const author = authorRaw ? truncate(authorRaw, 200) : null;

  const publishedAt = parseDate(asText(item.isoDate) || asText(item.pubDate));
  const rawHtml =
    asText(item.contentEncoded) ||
    asText(item.content) ||
    asText(item.summary) ||
    asText(item.contentSnippet);
  const rawContent = truncate(stripHtml(rawHtml), 4000);

  return {
    title: truncate(title, 500),
    url,
    canonicalUrl: canonicalizeUrl(url),
    author,
    publishedAt,
    rawContent,
    fullBlocks: extractFeedBody(asText(item.contentEncoded) || asText(item.content)),
    imageUrl: extractImage(item, rawHtml),
  };
}

/**
 * Many feeds (WordPress, The Verge, Ars, company blogs) ship the whole article
 * in content:encoded. When it clearly is one — not a teaser — parse it into
 * reader blocks now, so the article page needs no scraping at all.
 */
function extractFeedBody(html: string): ArticleBlock[] | null {
  if (html.length < 2000) return null; // too short to be a full article — skip the parse
  try {
    const blocks = htmlToBlocks(html);
    return isFullBody(blocks) ? blocks : null;
  } catch {
    return null;
  }
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractImage(item: FeedItem, rawHtml: string): string | null {
  const media = item.mediaContent?.find((m) => m?.$?.url)?.$?.url;
  if (media) return media;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url) return item.enclosure.url;
  const match = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}
