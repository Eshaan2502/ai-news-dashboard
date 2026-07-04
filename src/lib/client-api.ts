import type { FeedItemDTO, Stats, SourceDTO, BroadcastLogDTO } from "./types";
import type { BroadcastPlatform, SortOption } from "./constants";

/** Typed fetch helpers for client components. */

export type FeedQuery = {
  q?: string;
  sourceId?: number;
  topic?: string;
  category?: string;
  sort?: SortOption;
  favoritesOnly?: boolean;
  includeDuplicates?: boolean;
  days?: number;
};

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false || v === null) continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

export async function fetchNews(params: FeedQuery, signal?: AbortSignal): Promise<FeedItemDTO[]> {
  const res = await fetch(`/api/news?${toQuery(params)}`, { signal });
  if (!res.ok) throw new Error("Failed to load news");
  return (await res.json()).items as FeedItemDTO[];
}

export async function addFavorite(newsItemId: number) {
  const res = await fetch(`/api/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newsItemId }),
  });
  if (!res.ok) throw new Error("Failed to add favorite");
  return res.json();
}

export async function removeFavorite(newsItemId: number) {
  const res = await fetch(`/api/favorites/${newsItemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove favorite");
  return res.json();
}

export type BroadcastBody = {
  newsItemId: number;
  platform: BroadcastPlatform;
  recipient?: string;
  content?: string;
};

export type BroadcastResponse = {
  ok: boolean;
  content: string;
  result: { platform: BroadcastPlatform; status: string; shareUrl: string | null; detail: string };
};

export async function broadcast(body: BroadcastBody): Promise<BroadcastResponse> {
  const res = await fetch(`/api/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Broadcast failed");
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`/api/stats`);
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchSourcesAndTopics(): Promise<{ sources: SourceDTO[]; topics: string[] }> {
  const res = await fetch(`/api/sources`);
  if (!res.ok) throw new Error("Failed to load sources");
  return res.json();
}

export async function fetchBroadcastLogs(limit = 10): Promise<BroadcastLogDTO[]> {
  const res = await fetch(`/api/broadcast?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load logs");
  return (await res.json()).logs as BroadcastLogDTO[];
}
