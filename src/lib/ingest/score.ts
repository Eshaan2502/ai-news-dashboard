function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Recency bonus (0–20): fresher stories rank higher. */
function recencyBonus(publishedAt: Date | null): number {
  const hours = publishedAt ? (Date.now() - publishedAt.getTime()) / 3_600_000 : 72;
  if (hours <= 6) return 20;
  if (hours <= 24) return 14;
  if (hours <= 72) return 8;
  if (hours <= 168) return 4;
  return 2;
}

/**
 * Blend the model's newsworthiness estimate with source authority and recency
 * into a 0–100 impact score used for sorting and the dashboard's charts.
 */
export function computeImpact(enrichImpact: number, weight: number, publishedAt: Date | null): number {
  const base = 0.6 * clamp(enrichImpact, 0, 100); // 0–60
  const authority = clamp(((weight - 0.8) / (1.6 - 0.8)) * 20, 0, 20); // 0–20
  const recency = recencyBonus(publishedAt); // 0–20
  return Math.round(clamp(base + authority + recency, 0, 100));
}
