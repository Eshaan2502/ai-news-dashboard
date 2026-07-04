"use client";

import { Star, Megaphone, ExternalLink, Layers } from "lucide-react";
import type { FeedItemDTO } from "@/lib/types";
import { SourceTag } from "./SourceTag";
import { EntityChip } from "./EntityChip";
import { ImpactMeter } from "./ImpactMeter";
import { Button } from "./ui/Button";
import { timeAgo, cn } from "@/lib/utils";

export function NewsCard({
  item,
  onToggleFavorite,
  onBroadcast,
  busy,
}: {
  item: FeedItemDTO;
  onToggleFavorite: (item: FeedItemDTO) => void;
  onBroadcast: (item: FeedItemDTO) => void;
  busy?: boolean;
}) {
  return (
    <article className="flex animate-fade-in flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between gap-2">
        <SourceTag name={item.sourceName} category={item.sourceCategory} />
        <time className="text-xs text-muted-foreground" dateTime={item.publishedAt ?? item.fetchedAt}>
          {timeAgo(item.publishedAt ?? item.fetchedAt)}
        </time>
      </div>

      <div className="flex gap-3">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from arbitrary source domains
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="hidden h-16 w-16 shrink-0 rounded-md border border-border object-cover sm:block"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 font-medium leading-snug text-foreground transition-colors hover:text-primary"
          >
            {item.title}
          </a>
          {item.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{item.summary}</p>}
        </div>
      </div>

      {item.entities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.entities.slice(0, 4).map((e) => (
            <EntityChip key={e} label={e} />
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <ImpactMeter score={item.impactScore} />
          {item.topic && <span className="truncate text-xs text-muted">{item.topic}</span>}
          {item.clusterSize > 1 && (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title={`${item.clusterSize} sources reported this story (deduplicated)`}
            >
              <Layers className="h-3 w-3" />
              {item.clusterSize}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleFavorite(item)}
            disabled={busy}
            aria-label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={cn("h-4 w-4", item.isFavorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onBroadcast(item)}
            aria-label="Broadcast this item"
            title="Broadcast"
          >
            <Megaphone className="h-4 w-4" />
          </Button>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            aria-label="Open original article"
            title="Open article"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
