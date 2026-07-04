import { canonicalizeUrl, stripHtml, truncate } from "../utils";
import type { FeedItem } from "./fetcher";

export type NormalizedItem = {
  title: string;
  url: string;
  canonicalUrl: string;
  author: string | null;
  publishedAt: Date | null;
  rawContent: string;
  imageUrl: string | null;
};

/** Parse a feed item into our normalized shape, or null if it's unusable. */
export function normalizeItem(item: FeedItem): NormalizedItem | null {
  const title = item.title?.trim();
  const url = (item.link || item.guid || "").trim();
  if (!title || !url || !/^https?:\/\//i.test(url)) return null;

  const author =
    (item.creator || (item as { "dc:creator"?: string })["dc:creator"] || "")
      .toString()
      .trim() || null;

  const publishedAt = parseDate(item.isoDate || item.pubDate);
  const rawHtml = item.contentEncoded || item.content || item.summary || item.contentSnippet || "";
  const rawContent = truncate(stripHtml(rawHtml), 4000);

  return {
    title: truncate(title, 500),
    url,
    canonicalUrl: canonicalizeUrl(url),
    author: author ? truncate(author, 200) : null,
    publishedAt,
    rawContent,
    imageUrl: extractImage(item, rawHtml),
  };
}

function parseDate(value?: string): Date | null {
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
