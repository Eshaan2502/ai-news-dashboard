/**
 * Registered ingestion sources (BRD §3A — "at least 20 high-signal sources").
 *
 * Feed URLs are public RSS/Atom endpoints, verified to parse. The fetcher is
 * resilient: any source that 404s / rate-limits / changes format is skipped and
 * recorded in `sources.last_status` — the rest of the run still succeeds.
 *
 * A few sources named in the BRD (Anthropic, Meta AI, Stability AI, Papers with
 * Code) publish **no reliable public RSS feed**, so they are registered but marked
 * `active: false` (kept for provenance / demo attribution, not fetched). They can
 * be re-enabled the moment a feed becomes available — the registry is the only
 * place to change.
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
  active?: boolean;
};

export const SOURCES: SourceSeed[] = [
  // ── Company / Lab blogs (primary sources) ──────────────────────────────
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", siteUrl: "https://openai.com/news", type: "rss", category: "Company", weight: 1.6 },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", siteUrl: "https://blog.google/technology/ai/", type: "rss", category: "Company", weight: 1.4 },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", siteUrl: "https://deepmind.google/discover/blog/", type: "rss", category: "Company", weight: 1.4 },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", siteUrl: "https://huggingface.co/blog", type: "rss", category: "Company", weight: 1.3 },
  { name: "NVIDIA AI", url: "https://blogs.nvidia.com/feed/", siteUrl: "https://blogs.nvidia.com/", type: "rss", category: "Company", weight: 1.2 },
  { name: "Microsoft", url: "https://news.microsoft.com/source/feed/", siteUrl: "https://news.microsoft.com/source/", type: "rss", category: "Company", weight: 1.1 },
  { name: "AWS Machine Learning", url: "https://aws.amazon.com/blogs/machine-learning/feed/", siteUrl: "https://aws.amazon.com/blogs/machine-learning/", type: "rss", category: "Company", weight: 1.1 },
  { name: "Y Combinator", url: "https://www.ycombinator.com/blog/rss/", siteUrl: "https://www.ycombinator.com/blog", type: "rss", category: "Company", weight: 1.0 },

  // Registered but no public RSS feed — kept inactive (see file header).
  { name: "Anthropic", url: "https://www.anthropic.com/rss.xml", siteUrl: "https://www.anthropic.com/news", type: "rss", category: "Company", weight: 1.5, active: false },
  { name: "Meta AI", url: "https://ai.meta.com/blog/rss/", siteUrl: "https://ai.meta.com/blog/", type: "rss", category: "Company", weight: 1.3, active: false },
  { name: "Stability AI", url: "https://stability.ai/news?format=rss", siteUrl: "https://stability.ai/news", type: "rss", category: "Company", weight: 1.1, active: false },

  // ── Research ───────────────────────────────────────────────────────────
  { name: "arXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI", siteUrl: "https://arxiv.org/list/cs.AI/recent", type: "rss", category: "Research", weight: 1.3 },
  { name: "arXiv cs.CL", url: "https://rss.arxiv.org/rss/cs.CL", siteUrl: "https://arxiv.org/list/cs.CL/recent", type: "rss", category: "Research", weight: 1.2 },
  { name: "arXiv cs.LG", url: "https://rss.arxiv.org/rss/cs.LG", siteUrl: "https://arxiv.org/list/cs.LG/recent", type: "rss", category: "Research", weight: 1.2 },
  { name: "Berkeley BAIR", url: "https://bair.berkeley.edu/blog/feed.xml", siteUrl: "https://bair.berkeley.edu/blog/", type: "rss", category: "Research", weight: 1.2 },
  { name: "Papers with Code", url: "https://paperswithcode.com/latest?format=rss", siteUrl: "https://paperswithcode.com", type: "rss", category: "Research", weight: 1.1, active: false },

  // ── Media ──────────────────────────────────────────────────────────────
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", siteUrl: "https://techcrunch.com/category/artificial-intelligence/", type: "rss", category: "Media", weight: 1.2 },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", siteUrl: "https://venturebeat.com/category/ai/", type: "rss", category: "Media", weight: 1.1 },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", siteUrl: "https://www.technologyreview.com/", type: "rss", category: "Media", weight: 1.2 },
  { name: "Ars Technica", url: "https://arstechnica.com/ai/feed/", siteUrl: "https://arstechnica.com/ai/", type: "rss", category: "Media", weight: 1.0 },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com/", type: "rss", category: "Media", weight: 1.0 },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", siteUrl: "https://www.wired.com/tag/artificial-intelligence/", type: "rss", category: "Media", weight: 1.0 },

  // ── Community / Aggregators ────────────────────────────────────────────
  { name: "Hacker News (AI)", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+%22machine+learning%22&count=40", siteUrl: "https://news.ycombinator.com/", type: "rss", category: "Community", weight: 0.9 },
  { name: "Product Hunt (AI)", url: "https://www.producthunt.com/feed?category=artificial-intelligence", siteUrl: "https://www.producthunt.com/topics/artificial-intelligence", type: "rss", category: "Community", weight: 0.8 },
  { name: "Reddit r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss", siteUrl: "https://www.reddit.com/r/MachineLearning/", type: "rss", category: "Community", weight: 0.9 },
  { name: "YouTube — Two Minute Papers", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", siteUrl: "https://www.youtube.com/@TwoMinutePapers", type: "rss", category: "Community", weight: 0.8 },
];
