/** Typed fetch helpers for client components. */

import type { SpectrumAnalysis } from "./types";

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

/** Slow on first call for an article — it may run a live web search + AI pass. */
export async function fetchSpectrum(newsItemId: number): Promise<SpectrumAnalysis> {
  const res = await fetch(`/api/spectrum/${newsItemId}`);
  if (!res.ok) throw new Error("Failed to load the spectrum");
  return res.json();
}

export async function generateLinkedInPost(
  newsItemId: number,
  revision?: { draft: string; instruction: string },
): Promise<{ post: string; aiGenerated: boolean }> {
  const res = await fetch(`/api/share/linkedin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newsItemId, ...revision }),
  });
  if (!res.ok) throw new Error("Failed to generate LinkedIn post");
  return res.json();
}
