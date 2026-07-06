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
