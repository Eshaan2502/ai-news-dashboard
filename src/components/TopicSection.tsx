import { Flame } from "lucide-react";
import type { FeedItemDTO } from "@/lib/types";
import { topicColor } from "@/lib/ui";
import { HorizontalRow } from "./HorizontalRow";
import { NewsCard } from "./NewsCard";

/**
 * One homepage row: a serif heading over a rule, then a horizontally
 * scrolling strip of story cards. `trending` gets the accent treatment.
 */
export function TopicSection({
  title,
  items,
  trending = false,
}: {
  title: string;
  items: FeedItemDTO[];
  trending?: boolean;
}) {
  return (
    <section className="animate-fade-in">
      <div className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-foreground">
          {trending && <Flame className="h-5 w-5 text-primary" />}
          <span style={trending ? { color: "var(--color-primary)" } : undefined}>{title}</span>
        </h2>
        {!trending && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: topicColor(title) }}
            aria-hidden
          />
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {items.length ? `${items.length} stories` : ""}
        </span>
      </div>
      {items.length ? (
        <HorizontalRow>
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </HorizontalRow>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted">
          No stories here yet — hit Refresh in the top bar to pull the latest.
        </p>
      )}
    </section>
  );
}
