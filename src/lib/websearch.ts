import { fetchFeed } from "./ingest/fetcher";
import type { WebResultDTO } from "./types";

/**
 * Live web fallback for search: when the corpus has no hits for a query, ask
 * Google News' public RSS search endpoint (free, no API key) for matching
 * stories. Results are display-only — they are not ingested, have no reader
 * page, and link straight out to the publisher.
 */

const GOOGLE_NEWS_SEARCH = "https://news.google.com/rss/search";

/** Interactive path — fail fast rather than hang the search UI. */
const TIMEOUT_MS = 8000;

export async function searchWebNews(q: string, limit = 12): Promise<WebResultDTO[]> {
  const url = `${GOOGLE_NEWS_SEARCH}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchFeed(url, TIMEOUT_MS);
  if (!res.ok) {
    console.warn(`searchWebNews(${JSON.stringify(q)}) failed:`, res.error);
    return [];
  }

  const out: WebResultDTO[] = [];
  for (const item of res.items) {
    if (out.length >= limit) break;
    const link = item.link?.trim();
    let title = item.title?.trim();
    if (!link || !title) continue;

    const src = item.sourceInfo;
    const sourceName =
      (typeof src === "string" ? src : src?._)?.trim() || publisherFromTitle(title) || "Web";
    // Google appends " - Publisher" to every headline; drop it for display.
    if (title.toLowerCase().endsWith(` - ${sourceName.toLowerCase()}`)) {
      title = title.slice(0, title.length - sourceName.length - 3).trim();
    }

    out.push({ title, url: link, sourceName, publishedAt: toIso(item.isoDate ?? item.pubDate) });
  }
  return out;
}

function publisherFromTitle(title: string): string | null {
  const idx = title.lastIndexOf(" - ");
  return idx > 0 ? title.slice(idx + 3).trim() || null : null;
}

function toIso(s: string | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
