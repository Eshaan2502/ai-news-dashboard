import Parser from "rss-parser";

/**
 * Feed fetching. We fetch the raw XML ourselves (so we control User-Agent,
 * timeout, and redirects — Reddit/YouTube reject the default agent) and then
 * hand the text to rss-parser.
 */

const UA =
  "Mozilla/5.0 (compatible; AINewsDashboard/1.0; +https://github.com/ai-news-dashboard)";

type FeedItem = Parser.Item & {
  contentEncoded?: string;
  mediaContent?: { $?: { url?: string } }[];
  mediaThumbnail?: { $?: { url?: string } };
  enclosure?: { url?: string };
};

const parser: Parser<object, FeedItem> = new Parser({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

export type FetchResult =
  | { ok: true; items: FeedItem[] }
  | { ok: false; error: string };

/** Fetch and parse a single feed. Never throws — returns a tagged result. */
export async function fetchFeed(url: string, timeoutMs = 15000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    const feed = await parser.parseString(text);
    return { ok: true, items: feed.items ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export type { FeedItem };
