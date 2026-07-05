import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { newsItems } from "./db/schema";
import type { ArticleBlock, ArticleDTO } from "./types";

/**
 * On-demand full-text extraction for the in-site reader.
 * Fetches the original page, runs Mozilla Readability, and flattens the
 * result into plain-text blocks — no HTML ever reaches the client, so there
 * is no sanitizer needed and no XSS surface. Results (including failures)
 * are cached on the news_items row.
 */

// A browser-like UA: article pages block obvious bots far more than feeds do.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 3_000_000;
const MAX_BLOCKS = 250;
const RETRY_FAILED_AFTER_MS = 24 * 60 * 60 * 1000;

export async function extractArticle(url: string): Promise<ArticleBlock[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
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
    html = await res.text();
    if (html.length > MAX_HTML_BYTES) html = html.slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  try {
    // Silence jsdom's noisy CSS/script warnings from arbitrary pages.
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, { url, virtualConsole });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;

    const bodyDom = new JSDOM(article.content, { virtualConsole });
    const nodes = bodyDom.window.document.querySelectorAll("p, h2, h3, li, blockquote");
    const blocks: ArticleBlock[] = [];
    const seen = new Set<string>();
    for (const el of nodes) {
      // Skip nested matches (a <p> inside a <blockquote>, nested <li>s, …) —
      // the outer block's textContent already contains their text.
      if (el.parentElement?.closest("p, li, blockquote")) continue;
      const type = el.tagName.toLowerCase() as ArticleBlock["type"];
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      const minLen = type === "h2" || type === "h3" ? 3 : 25;
      if (text.length < minLen || seen.has(text)) continue;
      seen.add(text);
      blocks.push({ type, text });
      if (blocks.length >= MAX_BLOCKS) break;
    }
    // A real article body, not just a cookie banner or teaser.
    return blocks.filter((b) => b.type === "p").length >= 2 ? blocks : null;
  } catch {
    return null;
  }
}

/**
 * Cache-through accessor used by the reader: returns extracted blocks,
 * extracting and persisting on first view. Failures are cached too (retried
 * after a day) so a hard-blocking site doesn't get hammered per page view.
 */
export async function getOrExtractContent(article: ArticleDTO): Promise<ArticleBlock[] | null> {
  if (article.extractionStatus === "ok" && article.extractedContent?.length) {
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
