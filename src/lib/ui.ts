import { TOPIC_COLOR, isTopic } from "./topics";

/** Topic → warm editorial accent color (falls back to muted ink). */
export function topicColor(topic?: string | null): string {
  return topic && isTopic(topic) ? TOPIC_COLOR[topic] : "var(--color-muted)";
}
