import Link from "next/link";
import type { FeedItemDTO } from "@/lib/types";
import { topicColor } from "@/lib/ui";
import { timeAgo } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";

/**
 * One story card, per the sketch:
 *   Source (Topic)
 *   Title
 *   Author (Date)
 *   AI-generated short summary
 * The whole card links to the in-site reader — never to the external page.
 */
export function NewsCard({
  item,
  onFavoriteChange,
}: {
  item: FeedItemDTO;
  onFavoriteChange?: (favorited: boolean) => void;
}) {
  return (
    <article className="group relative h-full animate-fade-in">
      <Link
        href={`/article/${item.id}`}
        className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:bg-card-hover hover:shadow-md"
      >
        <p className="pr-8 text-[11px] font-medium uppercase tracking-wider text-muted">
          {item.sourceName ?? "Unknown"}
          <span className="mx-1.5 text-border-strong">·</span>
          <span style={{ color: topicColor(item.topic) }}>{item.topic ?? "General"}</span>
        </p>
        <h3 className="clamp-2 font-serif text-lg font-bold leading-snug text-foreground group-hover:text-primary">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {item.author ? `${item.author} · ` : ""}
          <time dateTime={item.publishedAt ?? item.fetchedAt}>
            {timeAgo(item.publishedAt ?? item.fetchedAt)}
          </time>
          {(item.coverage ?? 0) > 1 && (
            <span style={{ color: "var(--color-primary)" }}> · {item.coverage} sources</span>
          )}
        </p>
        {item.summary && <p className="clamp-3 text-sm leading-relaxed text-muted">{item.summary}</p>}
      </Link>
      <FavoriteButton
        newsItemId={item.id}
        initialFavorite={item.isFavorite}
        className="absolute right-2 top-2"
        onChange={onFavoriteChange}
      />
    </article>
  );
}
