/**
 * The fixed Spectrum topic taxonomy. The display strings below are the
 * canonical stored values — they appear verbatim in `sources.topic`,
 * `news_items.topic`, and `users.preferred_topics` (no slug indirection).
 */
export const TOPICS = [
  "AI",
  "Technology",
  "Politics",
  "Business & Finance",
  "Science",
  "Sports",
  "Entertainment",
  "Health",
] as const;

export type Topic = (typeof TOPICS)[number];

export function isTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}

/**
 * Labels the enrichment model (and older ingests) commonly use for our
 * canonical topics. Keys are compared lowercase. Deliberately conservative:
 * anything not clearly one of the 8 stays unmapped so callers can fall back
 * (to the source topic, or "General").
 */
const TOPIC_ALIASES: Record<string, Topic> = {
  "artificial intelligence": "AI",
  "machine learning": "AI",
  tech: "Technology",
  gadgets: "Technology",
  software: "Technology",
  cybersecurity: "Technology",
  world: "Politics",
  "world news": "Politics",
  "world affairs": "Politics",
  geopolitics: "Politics",
  government: "Politics",
  policy: "Politics",
  elections: "Politics",
  election: "Politics",
  diplomacy: "Politics",
  "international relations": "Politics",
  business: "Business & Finance",
  finance: "Business & Finance",
  markets: "Business & Finance",
  economy: "Business & Finance",
  economics: "Business & Finance",
  "business and finance": "Business & Finance",
  space: "Science",
  environment: "Science",
  climate: "Science",
  sport: "Sports",
  culture: "Entertainment",
  arts: "Entertainment",
  film: "Entertainment",
  movies: "Entertainment",
  music: "Entertainment",
  television: "Entertainment",
  tv: "Entertainment",
  celebrity: "Entertainment",
  medicine: "Health",
  medical: "Health",
  wellness: "Health",
  "public health": "Health",
};

/** Coerce a free-form topic label to a canonical Topic, or null if none fits. */
export function normalizeTopic(value: string | null | undefined): Topic | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isTopic(trimmed)) return trimmed;
  return TOPIC_ALIASES[trimmed.toLowerCase()] ?? null;
}

/** Warm editorial accent per topic (text color on the cream theme). */
export const TOPIC_COLOR: Record<Topic, string> = {
  AI: "#9a3b26", // oxblood
  Technology: "#1f6f8b", // teal ink
  Politics: "#5b4a8a", // plum
  "Business & Finance": "#3d6b35", // moss
  Science: "#2d5f7a", // slate blue
  Sports: "#b3541e", // burnt orange
  Entertainment: "#a03d63", // raspberry
  Health: "#4a7862", // sage
};

/** One-line flavor text shown on topic picker cards. */
export const TOPIC_BLURB: Record<Topic, string> = {
  AI: "Models, research labs, and the people building them",
  Technology: "Gadgets, software, and the industry at large",
  Politics: "Global affairs, elections, and policy",
  "Business & Finance": "Markets, companies, and the economy",
  Science: "Discoveries from the lab to deep space",
  Sports: "Scores, transfers, and the stories behind them",
  Entertainment: "Film, music, TV, and culture",
  Health: "Medicine, wellness, and public health",
};
