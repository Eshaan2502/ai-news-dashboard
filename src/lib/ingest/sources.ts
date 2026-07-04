/**
 * Registered ingestion sources (BRD §3A — "at least 20 high-signal sources").
 *
 * Feed URLs are best-effort public RSS/Atom endpoints. The fetcher is resilient:
 * any source that 404s / rate-limits / changes format is skipped and recorded in
 * `sources.last_status` — the rest of the run still succeeds (BRD: ≥90% uptime).
 *
 * category: Company | Research | Media | Community
 * weight:   biases the impact score (primary sources rank higher than aggregators)
 */
export type SourceSeed = {
  name: string;
  url: string;
  siteUrl: string;
  type: "rss";
  category: "Company" | "Research" | "Media" | "Community";
  weight: number;
};

export const SOURCES: SourceSeed[] = [
  // ── Company / Lab blogs (primary sources) ──────────────────────────────
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", siteUrl: "https://openai.com/news", type: "rss", category: "Company", weight: 1.6 },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", siteUrl: "https://blog.google/technology/ai/", type: "rss", category: "Company", weight: 1.4 },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", siteUrl: "https://deepmind.google/discover/blog/", type: "rss", category: "Company", weight: 1.4 },
  { name: "Anthropic", url: "https://www.anthropic.com/rss.xml", siteUrl: "https://www.anthropic.com/news", type: "rss", category: "Company", weight: 1.5 },
  { name: "Meta AI", url: "https://ai.meta.com/blog/rss/", siteUrl: "https://ai.meta.com/blog/", type: "rss", category: "Company", weight: 1.3 },
  { name: "Microsoft AI", url: "https://blogs.microsoft.com/ai/feed/", siteUrl: "https://blogs.microsoft.com/ai/", type: "rss", category: "Company", weight: 1.2 },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", siteUrl: "https://huggingface.co/blog", type: "rss", category: "Company", weight: 1.3 },
  { name: "Stability AI", url: "https://stability.ai/news?format=rss", siteUrl: "https://stability.ai/news", type: "rss", category: "Company", weight: 1.1 },
  { name: "Y Combinator", url: "https://www.ycombinator.com/blog/rss/", siteUrl: "https://www.ycombinator.com/blog", type: "rss", category: "Company", weight: 1.0 },

  // ── Research ───────────────────────────────────────────────────────────
  { name: "arXiv cs.AI", url: "https://export.arxiv.org/rss/cs.AI", siteUrl: "https://arxiv.org/list/cs.AI/recent", type: "rss", category: "Research", weight: 1.3 },
  { name: "arXiv cs.CL", url: "https://export.arxiv.org/rss/cs.CL", siteUrl: "https://arxiv.org/list/cs.CL/recent", type: "rss", category: "Research", weight: 1.2 },
  { name: "arXiv cs.LG", url: "https://export.arxiv.org/rss/cs.LG", siteUrl: "https://arxiv.org/list/cs.LG/recent", type: "rss", category: "Research", weight: 1.2 },
  { name: "Papers with Code", url: "https://paperswithcode.com/latest?format=rss", siteUrl: "https://paperswithcode.com", type: "rss", category: "Research", weight: 1.1 },

  // ── Media ──────────────────────────────────────────────────────────────
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", siteUrl: "https://techcrunch.com/category/artificial-intelligence/", type: "rss", category: "Media", weight: 1.2 },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", siteUrl: "https://venturebeat.com/category/ai/", type: "rss", category: "Media", weight: 1.1 },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com/", type: "rss", category: "Media", weight: 1.0 },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", siteUrl: "https://www.wired.com/tag/artificial-intelligence/", type: "rss", category: "Media", weight: 1.0 },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", siteUrl: "https://www.technologyreview.com/", type: "rss", category: "Media", weight: 1.2 },

  // ── Community / Aggregators ────────────────────────────────────────────
  { name: "Hacker News (AI)", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+%22machine+learning%22&count=40", siteUrl: "https://news.ycombinator.com/", type: "rss", category: "Community", weight: 0.9 },
  { name: "Product Hunt (AI)", url: "https://www.producthunt.com/feed?category=artificial-intelligence", siteUrl: "https://www.producthunt.com/topics/artificial-intelligence", type: "rss", category: "Community", weight: 0.8 },
  { name: "Reddit r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss", siteUrl: "https://www.reddit.com/r/MachineLearning/", type: "rss", category: "Community", weight: 0.9 },
  { name: "YouTube — Two Minute Papers", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", siteUrl: "https://www.youtube.com/@TwoMinutePapers", type: "rss", category: "Community", weight: 0.8 },
];
