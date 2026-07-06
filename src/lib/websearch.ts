import Parser from "rss-parser";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { newsItems, sources } from "./db/schema";
import { AI_ENABLED, embed, enrich, fallbackEnrichment } from "./ai/openai";
import { normalizeTopic } from "./topics";
import { canonicalizeUrl, mapWithConcurrency, truncate } from "./utils";

/**
 * Live web fallback for search: when the corpus has no hits for a query, ask
 * Bing News' public RSS search endpoint (free, no API key) for matching
 * stories, then ingest them through the regular pipeline (embed + enrich +
 * insert) so they become first-class articles — reader page, favorites,
 * sharing — exactly like feed-ingested ones. Bing over Google News because
 * its links carry the real publisher URL (Google's redirect tokens can't be
 * resolved server-side), which the in-site reader needs for extraction.
 */

const BING_NEWS_SEARCH = "https://www.bing.com/news/search";

/** Bing 307s bot-like agents; a browser UA gets the plain RSS. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Interactive path — fail fast rather than hang the search UI. */
const TIMEOUT_MS = 8000;

const INGEST_CONCURRENCY = 4;

export type WebNewsHit = {
  title: string;
  url: string;
  sourceName: string;
  summary: string | null;
  publishedAt: Date | null;
};

type BingItem = Parser.Item & { newsSource?: string };

const parser: Parser<object, BingItem> = new Parser({
  customFields: { item: [["News:Source", "newsSource"]] },
});

/** Search Bing News for `q`. Never throws — returns [] on any failure. */
export async function searchWebNews(q: string, limit = 10): Promise<WebNewsHit[]> {
  const url = `${BING_NEWS_SEARCH}?q=${encodeURIComponent(q)}&format=rss`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feed = await parser.parseString(await res.text());

    const out: WebNewsHit[] = [];
    for (const item of feed.items ?? []) {
      if (out.length >= limit) break;
      const title = item.title?.trim();
      const realUrl = resolveBingLink(item.link);
      if (!title || !realUrl) continue;
      out.push({
        title,
        url: realUrl,
        sourceName: item.newsSource?.trim() || prettyHost(realUrl),
        summary: item.contentSnippet?.trim() || null,
        publishedAt: toDate(item.isoDate ?? item.pubDate),
      });
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e);
    console.warn(`searchWebNews(${JSON.stringify(q)}) failed:`, msg);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ingest web search hits as regular news items and return their ids in the
 * hits' (relevance) order. Hits whose URL is already in the corpus reuse the
 * existing row. Each publisher gets an inert `web:<host>` source row
 * (active=false, so the feed scheduler never touches it) purely so cards and
 * the reader can show the publisher name through the normal sources join.
 */
export async function ingestWebResults(hits: WebNewsHit[]): Promise<number[]> {
  if (!hits.length) return [];

  // Dedupe within the batch by canonical URL, keeping best (first) rank.
  const byCanonical = new Map<string, WebNewsHit>();
  for (const h of hits) {
    const key = canonicalizeUrl(h.url);
    if (!byCanonical.has(key)) byCanonical.set(key, h);
  }
  const canonicals = [...byCanonical.keys()];

  const idByCanonical = new Map<string, number>();
  const existing = await db
    .select({ id: newsItems.id, canonicalUrl: newsItems.canonicalUrl })
    .from(newsItems)
    .where(inArray(newsItems.canonicalUrl, canonicals));
  for (const r of existing) idByCanonical.set(r.canonicalUrl, r.id);

  const fresh = canonicals.filter((c) => !idByCanonical.has(c));
  if (fresh.length) {
    const sourceIdByHost = await ensureWebSources(fresh.map((c) => byCanonical.get(c)!));

    const rows = await mapWithConcurrency(fresh, INGEST_CONCURRENCY, async (canonical) => {
      const hit = byCanonical.get(canonical)!;
      const input = { title: hit.title, content: hit.summary ?? "", sourceName: hit.sourceName };
      const [embedding, enrichment] = await Promise.all([
        AI_ENABLED ? embed(`${hit.title}\n\n${truncate(hit.summary ?? "", 1000)}`) : null,
        AI_ENABLED ? enrich(input) : fallbackEnrichment(input),
      ]);
      return {
        sourceId: sourceIdByHost.get(host(hit.url)) ?? null,
        title: hit.title,
        summary: enrichment.summary,
        rawContent: hit.summary,
        url: hit.url,
        canonicalUrl: canonical,
        publishedAt: hit.publishedAt,
        tags: enrichment.topic && enrichment.topic !== "General" ? [enrichment.topic] : [],
        entities: enrichment.entities,
        // Keep item topics inside the fixed taxonomy — free-form labels like
        // "Crime" would render as rows/filters the UI doesn't know about.
        topic: normalizeTopic(enrichment.category) ?? normalizeTopic(enrichment.topic) ?? "General",
        impactScore: enrichment.impact,
        isDuplicate: false,
        embedding,
        enriched: AI_ENABLED,
      };
    });

    const inserted = await db
      .insert(newsItems)
      .values(rows)
      .onConflictDoNothing({ target: newsItems.canonicalUrl })
      .returning({ id: newsItems.id, canonicalUrl: newsItems.canonicalUrl });
    for (const r of inserted) idByCanonical.set(r.canonicalUrl, r.id);

    // A concurrent identical search can win the insert race — pick up its rows.
    const lost = fresh.filter((c) => !idByCanonical.has(c));
    if (lost.length) {
      const rescued = await db
        .select({ id: newsItems.id, canonicalUrl: newsItems.canonicalUrl })
        .from(newsItems)
        .where(inArray(newsItems.canonicalUrl, lost));
      for (const r of rescued) idByCanonical.set(r.canonicalUrl, r.id);
    }
  }

  return canonicals.map((c) => idByCanonical.get(c)).filter((id): id is number => id != null);
}

/** Get-or-create an inert source row per publisher host; returns host → id. */
async function ensureWebSources(hits: WebNewsHit[]): Promise<Map<string, number>> {
  const byHost = new Map<string, WebNewsHit>();
  for (const h of hits) {
    const key = host(h.url);
    if (key && !byHost.has(key)) byHost.set(key, h);
  }
  const keys = [...byHost.keys()].map((h) => `web:${h}`);
  if (!keys.length) return new Map();

  await db
    .insert(sources)
    .values(
      [...byHost.entries()].map(([h, hit]) => ({
        name: hit.sourceName,
        url: `web:${h}`,
        siteUrl: origin(hit.url),
        type: "web",
        category: "Web",
        topic: "General",
        weight: 1,
        active: false,
      })),
    )
    .onConflictDoNothing({ target: sources.url });

  const rows = await db
    .select({ id: sources.id, url: sources.url })
    .from(sources)
    .where(inArray(sources.url, keys));
  return new Map(rows.map((r) => [r.url.slice("web:".length), r.id]));
}

/** Bing links go through apiclick.aspx with the real URL in the `url` param. */
function resolveBingLink(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    const real = u.searchParams.get("url");
    if (real && /^https?:\/\//i.test(real)) return real;
    return u.hostname.endsWith("bing.com") ? null : u.toString();
  } catch {
    return null;
  }
}

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function origin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** "www.sheknows.com" → "Sheknows" — fallback when Bing omits News:Source. */
function prettyHost(url: string): string {
  const h = host(url).replace(/^www\./, "");
  const name = h.split(".")[0] ?? h;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Web";
}

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
