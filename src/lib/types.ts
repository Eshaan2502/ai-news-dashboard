/**
 * Shared DTO types with NO server imports, so client components can import them
 * without pulling database code into the browser bundle.
 */

/** One block of extracted article text — rendered as plain React elements. */
export type ArticleBlock = {
  type: "p" | "h2" | "h3" | "li" | "blockquote";
  text: string;
};

export type FeedItemDTO = {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  topic: string | null;
  entities: string[];
  tags: string[];
  impactScore: number;
  isDuplicate: boolean;
  clusterId: string | null;
  sourceName: string | null;
  sourceCategory: string | null;
  sourceTopic: string | null;
  siteUrl: string | null;
  isFavorite: boolean;
};

/** Everything the in-site reader needs for one article. */
export type ArticleDTO = FeedItemDTO & {
  rawContent: string | null;
  extractedContent: ArticleBlock[] | null;
  extractionStatus: string | null;
  extractedAt: string | null;
  spectrum: SpectrumAnalysis | null;
  spectrumAt: string | null;
};

/* ---------- Reading insights ---------- */

/** One recently opened story, for the Insights page list. */
export type RecentReadDTO = {
  id: number;
  title: string;
  topic: string | null;
  sourceName: string | null;
  lastReadAt: string;
};

/** Everything the Insights page charts render from — one user's aggregates. */
export type InsightsDTO = {
  /** Distinct stories opened. */
  storiesRead: number;
  /** Total opens, counting re-reads. */
  totalOpens: number;
  /** Distinct stories first opened in the last 7 days. */
  readsThisWeek: number;
  /** When tracking started for this user (first recorded read). */
  firstReadAt: string | null;
  /** Distinct stories read per topic, most-read first. */
  topics: { topic: string; count: number }[];
  /** Distinct stories read per source category (Company/Research/Media/Community). */
  categories: { category: string; count: number }[];
  /** Most-read outlets, most-read first. */
  sources: { source: string; count: number }[];
  /** Stories first read per day, oldest → newest, zero-filled. */
  daily: { day: string; count: number }[];
  /** Latest opens, most recent first. */
  recent: RecentReadDTO[];
};

/* ---------- Full Spectrum (multi-outlet perspectives) ---------- */

/** One outlet's take on the story, with an AI-assigned framing label. */
export type SpectrumPerspective = {
  newsItemId: number;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
  /** Short lens label, e.g. "Local livelihoods" — empty when AI is off. */
  label: string;
  /** One sentence on what this outlet emphasizes or how its framing differs. */
  angle: string;
};

/** Cached result of the Full Spectrum analysis for one article. */
export type SpectrumAnalysis = {
  /** What the coverage broadly agrees on (null when AI is off / no coverage). */
  overview: string | null;
  /** Where outlets diverge in emphasis or conclusions (null if none found). */
  divergence: string | null;
  perspectives: SpectrumPerspective[];
  aiGenerated: boolean;
  generatedAt: string;
};
