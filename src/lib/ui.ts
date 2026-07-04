import type { BroadcastPlatform } from "./constants";

/** Fixed category → validated categorical color (identity, not rank). */
export const CATEGORY_COLOR: Record<string, string> = {
  Company: "var(--color-cat-1)",
  Research: "var(--color-cat-5)",
  Media: "var(--color-cat-3)",
  Community: "var(--color-cat-6)",
};

export function categoryColor(category?: string | null): string {
  return (category && CATEGORY_COLOR[category]) || "var(--color-muted)";
}

/** Chart series colors, in fixed order (never cycled beyond the list). */
export const CHART_COLORS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
];

export const PLATFORM_LABEL: Record<BroadcastPlatform, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  blog: "Blog",
  newsletter: "Newsletter",
};

/** Impact score → semantic color band. */
export function impactColor(score: number): string {
  if (score >= 80) return "var(--color-cat-4)"; // hot
  if (score >= 60) return "var(--color-cat-3)"; // notable
  if (score >= 40) return "var(--color-cat-1)"; // standard
  return "var(--color-muted-foreground)";
}
