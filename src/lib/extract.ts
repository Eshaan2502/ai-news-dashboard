import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { newsItems } from "./db/schema";
import { hasBody, htmlToBlocks, markdownToBlocks } from "./blocks";
import type { ArticleBlock, ArticleDTO } from "./types";

/**
 * On-demand full-text extraction for the in-site reader. Strategies, in order:
 *   1. Fetch the original page and run Mozilla Readability.
 *   2. If that yields no body, try the page's AMP version (publisher-provided
 *      static HTML — parses where the canonical page is script-rendered).
 *   3. Last resort: the r.jina.ai reader proxy, which renders JS-only pages
 *      and returns markdown. Set READER_PROXY=off to keep fetches first-party.
 * Everything is flattened into plain-text blocks — no HTML ever reaches the
 * client, so there is no sanitizer needed and no XSS surface. Results
 * (including failures) are cached on the news_items row.
 */

// A browser-like UA: article pages block obvious bots far more than feeds do.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;
const PROXY_TIMEOUT_MS = 25_000; // the proxy renders JS, so it's slower
const MAX_HTML_BYTES = 3_000_000;
const RETRY_FAILED_AFTER_MS = 24 * 60 * 60 * 1000;
const READER_PROXY_ENABLED = process.env.READER_PROXY !== "off";

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml/.test(type)) return null;
    const html = await res.text();
    return html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readabilityBlocks(html: string, url: string): ArticleBlock[] | null {
  try {
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, { url, virtualConsole });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;
    const blocks = htmlToBlocks(article.content);
    return hasBody(blocks) ? blocks : null;
  } catch {
    return null;
  }
}

function findAmpUrl(html: string, baseUrl: string): string | null {
  const tag = html.match(/<link[^>]+rel=["']amphtml["'][^>]*>/i)?.[0];
  const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
  if (!href) return null;
  try {
    const amp = new URL(href, baseUrl).toString();
    return amp === baseUrl ? null : amp;
  } catch {
    return null;
  }
}

async function fetchReaderMarkdown(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "X-Return-Format": "markdown" };
    // Optional key raises the proxy's rate limits; it works keyless too.
    if (process.env.JINA_API_KEY) headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`;
    const res = await fetch(`https://r.jina.ai/${url}`, { signal: controller.signal, headers });
    if (!res.ok) return null;
    const text = await res.text();
    // Without X-Return-Format support the proxy wraps output in an envelope.
    const marker = text.indexOf("Markdown Content:");
    return marker >= 0 ? text.slice(marker + "Markdown Content:".length) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractArticle(url: string): Promise<ArticleBlock[] | null> {
  const html = await fetchHtml(url);
  if (html) {
    const blocks = readabilityBlocks(html, url);
    if (blocks) return blocks;

    const ampUrl = findAmpUrl(html, url);
    if (ampUrl) {
      const ampHtml = await fetchHtml(ampUrl);
      const ampBlocks = ampHtml ? readabilityBlocks(ampHtml, ampUrl) : null;
      if (ampBlocks) return ampBlocks;
    }
  }

  if (READER_PROXY_ENABLED) {
    const md = await fetchReaderMarkdown(url);
    if (md) {
      const blocks = markdownToBlocks(md);
      if (hasBody(blocks)) return blocks;
    }
  }
  return null;
}

/**
 * Cache-through accessor used by the reader: returns extracted blocks,
 * extracting and persisting on first view. Rows ingested with full text from
 * the feed itself (status "feed") are served as-is. Failures are cached too
 * (retried after a day) so a hard-blocking site doesn't get hammered per view.
 */
export async function getOrExtractContent(article: ArticleDTO): Promise<ArticleBlock[] | null> {
  if (
    (article.extractionStatus === "ok" || article.extractionStatus === "feed") &&
    article.extractedContent?.length
  ) {
    return article.extractedContent;
  }
  if (
    article.extractionStatus === "failed" &&
    article.extractedAt &&
    Date.now() - new Date(article.extractedAt).getTime() < RETRY_FAILED_AFTER_MS
  ) {
    return null;
  }

  const blocks = await extractArticle(article.url);
  await db
    .update(newsItems)
    .set({
      extractedContent: blocks,
      extractedAt: new Date(),
      extractionStatus: blocks ? "ok" : "failed",
    })
    .where(eq(newsItems.id, article.id));
  return blocks;
}
