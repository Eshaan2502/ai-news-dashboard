/**
 * Shared DTO types with NO server imports, so client components can import them
 * without pulling database code into the browser bundle.
 */

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
  clusterSize: number;
  sourceName: string | null;
  sourceCategory: string | null;
  siteUrl: string | null;
  isFavorite: boolean;
};

export type SourceDTO = {
  id: number;
  name: string;
  category: string;
  active: boolean;
  lastStatus: string | null;
  lastFetchedAt: string | null;
  itemCount: number;
};

export type Stats = {
  totals: { items: number; sources: number; favorites: number; broadcasts: number; duplicates: number };
  dedupRate: number;
  avgImpact: number;
  bySource: { name: string; count: number }[];
  byTopic: { topic: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byDay: { day: string; count: number }[];
};

export type BroadcastLogDTO = {
  id: number;
  platform: string;
  status: string;
  content: string | null;
  createdAt: string;
  title: string | null;
  url: string | null;
};
