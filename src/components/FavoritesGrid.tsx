"use client";

import { useState } from "react";
import type { FeedItemDTO } from "@/lib/types";
import { NewsCard } from "./NewsCard";

/** Saved-stories grid; unsaving a card removes it from view immediately. */
export function FavoritesGrid({ initialItems }: { initialItems: FeedItemDTO[] }) {
  const [items, setItems] = useState(initialItems);

  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-12 text-center text-sm text-muted">
        Nothing saved yet — tap the star on any story to keep it here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <NewsCard
          key={item.id}
          item={{ ...item, isFavorite: true }}
          onFavoriteChange={(favorited) => {
            if (!favorited) setItems((prev) => prev.filter((i) => i.id !== item.id));
          }}
        />
      ))}
    </div>
  );
}
