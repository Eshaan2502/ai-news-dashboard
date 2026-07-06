import type { Topic } from "../topics";

/**
 * Registered ingestion sources — one entry per RSS/Atom feed, spanning the
 * 8 Spectrum topics. `topic` is the source's default: items inherit it unless
 * AI enrichment files the article under a different taxonomy category (world
 * and all-content desks carry plenty of off-topic stories). The final item
 * topic decides the homepage row the story appears in.
 *
 * Feed URLs are public RSS/Atom endpoints. The fetcher is resilient: any
 * source that 404s / rate-limits / changes format is skipped and recorded in
 * `sources.last_status` — the rest of the run still succeeds.
 *
 * A few sources publish **no reliable public RSS feed** (Anthropic, Meta AI,
 * Stability AI, Papers with Code) — registered but `active: false`. Some noisy
 * research/community feeds are also parked inactive to keep topic volumes
 * balanced now that the registry covers general news.
 *
 * category: Company | Research | Media | Community  (provenance only)
 * weight:   biases the impact score (primary sources rank higher than aggregators)
 */
export type SourceSeed = {
  name: string;
  url: string;
  siteUrl: string;
  type: "rss";
  category: "Company" | "Research" | "Media" | "Community";
  topic: Topic;
  weight: number;
  active?: boolean;
};

export const SOURCES: SourceSeed[] = [
  // ── AI ──────────────────────────────────────────────────────────────────
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", siteUrl: "https://openai.com/news", type: "rss", category: "Company", topic: "AI", weight: 1.6 },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", siteUrl: "https://blog.google/technology/ai/", type: "rss", category: "Company", topic: "AI", weight: 1.4 },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", siteUrl: "https://deepmind.google/discover/blog/", type: "rss", category: "Company", topic: "AI", weight: 1.4 },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", siteUrl: "https://huggingface.co/blog", type: "rss", category: "Company", topic: "AI", weight: 1.3 },
  { name: "NVIDIA AI", url: "https://blogs.nvidia.com/feed/", siteUrl: "https://blogs.nvidia.com/", type: "rss", category: "Company", topic: "AI", weight: 1.2 },
  { name: "AWS Machine Learning", url: "https://aws.amazon.com/blogs/machine-learning/feed/", siteUrl: "https://aws.amazon.com/blogs/machine-learning/", type: "rss", category: "Company", topic: "AI", weight: 1.1 },
  { name: "arXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI", siteUrl: "https://arxiv.org/list/cs.AI/recent", type: "rss", category: "Research", topic: "AI", weight: 1.3 },
  { name: "Berkeley BAIR", url: "https://bair.berkeley.edu/blog/feed.xml", siteUrl: "https://bair.berkeley.edu/blog/", type: "rss", category: "Research", topic: "AI", weight: 1.2 },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", siteUrl: "https://techcrunch.com/category/artificial-intelligence/", type: "rss", category: "Media", topic: "AI", weight: 1.2 },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", siteUrl: "https://venturebeat.com/category/ai/", type: "rss", category: "Media", topic: "AI", weight: 1.1 },
  { name: "Wired AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", siteUrl: "https://www.wired.com/tag/artificial-intelligence/", type: "rss", category: "Media", topic: "AI", weight: 1.0 },
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/", siteUrl: "https://arstechnica.com/ai/", type: "rss", category: "Media", topic: "AI", weight: 1.0 },
  { name: "Hacker News (AI)", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+%22machine+learning%22&count=40", siteUrl: "https://news.ycombinator.com/", type: "rss", category: "Community", topic: "AI", weight: 0.9 },
  { name: "Reddit r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss", siteUrl: "https://www.reddit.com/r/MachineLearning/", type: "rss", category: "Community", topic: "AI", weight: 0.9 },
  { name: "YouTube — Two Minute Papers", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", siteUrl: "https://www.youtube.com/@TwoMinutePapers", type: "rss", category: "Community", topic: "AI", weight: 0.8 },
  { name: "Google Research", url: "https://research.google/blog/rss/", siteUrl: "https://research.google/blog/", type: "rss", category: "Company", topic: "AI", weight: 1.4 },
  { name: "MIT News AI", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", siteUrl: "https://news.mit.edu/topic/artificial-intelligence2", type: "rss", category: "Research", topic: "AI", weight: 1.3 },
  { name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", siteUrl: "https://www.microsoft.com/en-us/research/blog/", type: "rss", category: "Research", topic: "AI", weight: 1.3 },

  // No public RSS feed — kept inactive (see file header).
  { name: "Anthropic", url: "https://www.anthropic.com/rss.xml", siteUrl: "https://www.anthropic.com/news", type: "rss", category: "Company", topic: "AI", weight: 1.5, active: false },
  { name: "Meta AI", url: "https://ai.meta.com/blog/rss/", siteUrl: "https://ai.meta.com/blog/", type: "rss", category: "Company", topic: "AI", weight: 1.3, active: false },
  { name: "Stability AI", url: "https://stability.ai/news?format=rss", siteUrl: "https://stability.ai/news", type: "rss", category: "Company", topic: "AI", weight: 1.1, active: false },
  { name: "Papers with Code", url: "https://paperswithcode.com/latest?format=rss", siteUrl: "https://paperswithcode.com", type: "rss", category: "Research", topic: "AI", weight: 1.1, active: false },
  // Parked to balance topic volume (paper firehoses / product listings).
  { name: "arXiv cs.CL", url: "https://rss.arxiv.org/rss/cs.CL", siteUrl: "https://arxiv.org/list/cs.CL/recent", type: "rss", category: "Research", topic: "AI", weight: 1.2, active: false },
  { name: "arXiv cs.LG", url: "https://rss.arxiv.org/rss/cs.LG", siteUrl: "https://arxiv.org/list/cs.LG/recent", type: "rss", category: "Research", topic: "AI", weight: 1.2, active: false },
  { name: "Product Hunt (AI)", url: "https://www.producthunt.com/feed?category=artificial-intelligence", siteUrl: "https://www.producthunt.com/topics/artificial-intelligence", type: "rss", category: "Community", topic: "AI", weight: 0.8, active: false },

  // ── Technology ──────────────────────────────────────────────────────────
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", siteUrl: "https://www.theverge.com/", type: "rss", category: "Media", topic: "Technology", weight: 1.1 },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", siteUrl: "https://www.technologyreview.com/", type: "rss", category: "Media", topic: "Technology", weight: 1.2 },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", siteUrl: "https://arstechnica.com/", type: "rss", category: "Media", topic: "Technology", weight: 1.1 },
  { name: "Engadget", url: "https://www.engadget.com/rss.xml", siteUrl: "https://www.engadget.com/", type: "rss", category: "Media", topic: "Technology", weight: 1.0 },
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", siteUrl: "https://www.bbc.com/news/technology", type: "rss", category: "Media", topic: "Technology", weight: 1.2 },
  { name: "Microsoft", url: "https://news.microsoft.com/source/feed/", siteUrl: "https://news.microsoft.com/source/", type: "rss", category: "Company", topic: "Technology", weight: 1.1 },
  { name: "Y Combinator", url: "https://www.ycombinator.com/blog/rss/", siteUrl: "https://www.ycombinator.com/blog", type: "rss", category: "Company", topic: "Technology", weight: 1.0 },
  { name: "NYT Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", siteUrl: "https://www.nytimes.com/section/technology", type: "rss", category: "Media", topic: "Technology", weight: 1.3 },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", siteUrl: "https://spectrum.ieee.org/", type: "rss", category: "Media", topic: "Technology", weight: 1.3 },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom", siteUrl: "https://www.theregister.com/", type: "rss", category: "Media", topic: "Technology", weight: 1.0 },

  // ── Politics ────────────────────────────────────────────────────────────
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", siteUrl: "https://www.bbc.com/news/world", type: "rss", category: "Media", topic: "Politics", weight: 1.3 },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", siteUrl: "https://www.nytimes.com/section/world", type: "rss", category: "Media", topic: "Politics", weight: 1.3 },
  { name: "Washington Post World", url: "https://feeds.washingtonpost.com/rss/world", siteUrl: "https://www.washingtonpost.com/world/", type: "rss", category: "Media", topic: "Politics", weight: 1.3 },
  { name: "The Economist", url: "https://www.economist.com/international/rss.xml", siteUrl: "https://www.economist.com/international/", type: "rss", category: "Media", topic: "Politics", weight: 1.3 },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", siteUrl: "https://www.aljazeera.com/", type: "rss", category: "Media", topic: "Politics", weight: 1.2 },
  { name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml", siteUrl: "https://www.npr.org/", type: "rss", category: "Media", topic: "Politics", weight: 1.2 },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", siteUrl: "https://www.theguardian.com/world", type: "rss", category: "Media", topic: "Politics", weight: 1.2 },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-all", siteUrl: "https://www.dw.com/en/", type: "rss", category: "Media", topic: "Politics", weight: 1.2 },
  { name: "Politico", url: "https://rss.politico.com/politics-news.xml", siteUrl: "https://www.politico.com/", type: "rss", category: "Media", topic: "Politics", weight: 1.1 },

  // ── Business & Finance ──────────────────────────────────────────────────
  { name: "Financial Times", url: "https://www.ft.com/rss/home", siteUrl: "https://www.ft.com/", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.3 },
  { name: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", siteUrl: "https://www.nytimes.com/section/business", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.3 },
  { name: "The Economist Finance", url: "https://www.economist.com/finance-and-economics/rss.xml", siteUrl: "https://www.economist.com/finance-and-economics/", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.3 },
  { name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", siteUrl: "https://www.cnbc.com/", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.2 },
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", siteUrl: "https://www.marketwatch.com/", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.1 },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", siteUrl: "https://www.bbc.com/news/business", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.2 },
  { name: "The Guardian Business", url: "https://www.theguardian.com/uk/business/rss", siteUrl: "https://www.theguardian.com/business", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.1 },
  { name: "Fortune", url: "https://fortune.com/feed/", siteUrl: "https://fortune.com/", type: "rss", category: "Media", topic: "Business & Finance", weight: 1.1 },

  // ── Science ─────────────────────────────────────────────────────────────
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml", siteUrl: "https://www.sciencedaily.com/", type: "rss", category: "Media", topic: "Science", weight: 1.1 },
  { name: "Nature", url: "https://www.nature.com/nature.rss", siteUrl: "https://www.nature.com/", type: "rss", category: "Research", topic: "Science", weight: 1.3 },
  { name: "Science (AAAS)", url: "https://www.science.org/rss/news_current.xml", siteUrl: "https://www.science.org/news", type: "rss", category: "Research", topic: "Science", weight: 1.3 },
  { name: "Scientific American", url: "http://rss.sciam.com/ScientificAmerican-Global", siteUrl: "https://www.scientificamerican.com/", type: "rss", category: "Media", topic: "Science", weight: 1.2 },
  { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", siteUrl: "https://www.quantamagazine.org/", type: "rss", category: "Media", topic: "Science", weight: 1.2 },
  { name: "New Scientist", url: "https://www.newscientist.com/feed/home/", siteUrl: "https://www.newscientist.com/", type: "rss", category: "Media", topic: "Science", weight: 1.1 },
  { name: "Phys.org", url: "https://phys.org/rss-feed/", siteUrl: "https://phys.org/", type: "rss", category: "Media", topic: "Science", weight: 1.0 },
  { name: "NASA", url: "https://www.nasa.gov/feed/", siteUrl: "https://www.nasa.gov/", type: "rss", category: "Company", topic: "Science", weight: 1.3 },

  // ── Sports ──────────────────────────────────────────────────────────────
  { name: "ESPN", url: "https://www.espn.com/espn/rss/news", siteUrl: "https://www.espn.com/", type: "rss", category: "Media", topic: "Sports", weight: 1.2 },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", siteUrl: "https://www.bbc.com/sport", type: "rss", category: "Media", topic: "Sports", weight: 1.2 },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/12040", siteUrl: "https://www.skysports.com/", type: "rss", category: "Media", topic: "Sports", weight: 1.0 },
  { name: "The Guardian Sport", url: "https://www.theguardian.com/sport/rss", siteUrl: "https://www.theguardian.com/sport", type: "rss", category: "Media", topic: "Sports", weight: 1.1 },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/", siteUrl: "https://www.cbssports.com/", type: "rss", category: "Media", topic: "Sports", weight: 1.0 },

  // ── Entertainment ───────────────────────────────────────────────────────
  { name: "Variety", url: "https://variety.com/feed/", siteUrl: "https://variety.com/", type: "rss", category: "Media", topic: "Entertainment", weight: 1.1 },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", siteUrl: "https://www.hollywoodreporter.com/", type: "rss", category: "Media", topic: "Entertainment", weight: 1.1 },
  { name: "Deadline", url: "https://deadline.com/feed/", siteUrl: "https://deadline.com/", type: "rss", category: "Media", topic: "Entertainment", weight: 1.1 },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", siteUrl: "https://www.rollingstone.com/", type: "rss", category: "Media", topic: "Entertainment", weight: 1.0 },
  { name: "Billboard", url: "https://www.billboard.com/feed/", siteUrl: "https://www.billboard.com/", type: "rss", category: "Media", topic: "Entertainment", weight: 1.0 },
  { name: "BBC Entertainment", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", siteUrl: "https://www.bbc.com/news/entertainment_and_arts", type: "rss", category: "Media", topic: "Entertainment", weight: 1.1 },

  // ── Health ──────────────────────────────────────────────────────────────
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", siteUrl: "https://www.who.int/news", type: "rss", category: "Company", topic: "Health", weight: 1.4 },
  { name: "STAT News", url: "https://www.statnews.com/feed/", siteUrl: "https://www.statnews.com/", type: "rss", category: "Media", topic: "Health", weight: 1.2 },
  { name: "NYT Health", url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", siteUrl: "https://www.nytimes.com/section/health", type: "rss", category: "Media", topic: "Health", weight: 1.2 },
  { name: "KFF Health News", url: "https://kffhealthnews.org/feed/", siteUrl: "https://kffhealthnews.org/", type: "rss", category: "Media", topic: "Health", weight: 1.2 },
  { name: "NPR Health", url: "https://feeds.npr.org/1128/rss.xml", siteUrl: "https://www.npr.org/sections/health/", type: "rss", category: "Media", topic: "Health", weight: 1.1 },
  { name: "ScienceDaily Health", url: "https://www.sciencedaily.com/rss/health_medicine.xml", siteUrl: "https://www.sciencedaily.com/news/health_medicine/", type: "rss", category: "Media", topic: "Health", weight: 1.0 },
  // Feed blocks non-browser fetches — parked until a reliable endpoint exists.
  { name: "Medical News Today", url: "https://rss.medicalnewstoday.com/featurednews.xml", siteUrl: "https://www.medicalnewstoday.com/", type: "rss", category: "Media", topic: "Health", weight: 1.0, active: false },
];
