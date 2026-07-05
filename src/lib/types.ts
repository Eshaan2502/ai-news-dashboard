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

/**
 * A search hit fetched live from the web when the corpus has no matches.
 * Not ingested — no reader page, no favorites; the card links straight out.
 */
export type WebResultDTO = {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
};

/** Everything the in-site reader needs for one article. */
export type ArticleDTO = FeedItemDTO & {
  rawContent: string | null;
  extractedContent: ArticleBlock[] | null;
  extractionStatus: string | null;
  extractedAt: string | null;
};
