/** Single-user MVP: the app operates as this seeded demo user. */
export const DEMO_USER = {
  name: "Demo User",
  email: process.env.CURRENT_USER_EMAIL || "demo@ainews.local",
  role: "admin",
} as const;

export const BROADCAST_PLATFORMS = ["email", "linkedin", "whatsapp", "blog", "newsletter"] as const;
export type BroadcastPlatform = (typeof BROADCAST_PLATFORMS)[number];

export const SORT_OPTIONS = [
  { value: "date", label: "Newest" },
  { value: "impact", label: "Impact" },
  { value: "source", label: "Source" },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]["value"];
