"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Newspaper, Star } from "lucide-react";
import type { FeedItemDTO, SourceDTO } from "@/lib/types";
import { FilterBar, type Filters } from "./FilterBar";
import { NewsCard } from "./NewsCard";
import { BroadcastModal } from "./BroadcastModal";
import { useToast } from "./ui/Toast";
import { fetchNews, addFavorite, removeFavorite } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: Filters = {
  query: "",
  sourceId: "",
  topic: "",
  sort: "date",
  includeDuplicates: false,
};

function isDefault(f: Filters): boolean {
  return !f.query && !f.sourceId && !f.topic && f.sort === "date" && !f.includeDuplicates;
}

export function FeedView({
  initialItems,
  sources,
  topics,
  favoritesOnly = false,
}: {
  initialItems: FeedItemDTO[];
  sources: SourceDTO[];
  topics: string[];
  favoritesOnly?: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [broadcastItem, setBroadcastItem] = useState<FeedItemDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const firstRender = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (f: Filters) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const data = await fetchNews(
          {
            q: f.query || undefined,
            sourceId: f.sourceId || undefined,
            topic: f.topic || undefined,
            sort: f.sort,
            includeDuplicates: f.includeDuplicates,
            favoritesOnly,
          },
          ctrl.signal,
        );
        setItems(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast({ title: "Failed to load", variant: "error" });
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [favoritesOnly, toast],
  );

  // Debounced reload when filters change (skip the very first render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => load(filters), 250);
    return () => clearTimeout(t);
  }, [filters, load]);

  // Re-sync when the server sends fresh data (e.g. after the global Refresh).
  useEffect(() => {
    if (isDefault(filters)) setItems(initialItems);
    else load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems]);

  const onFilterChange = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  async function toggleFavorite(item: FeedItemDTO) {
    setBusyId(item.id);
    const nextFav = !item.isFavorite;
    setItems((prev) =>
      favoritesOnly && !nextFav
        ? prev.filter((i) => i.id !== item.id)
        : prev.map((i) => (i.id === item.id ? { ...i, isFavorite: nextFav } : i)),
    );
    try {
      if (nextFav) await addFavorite(item.id);
      else await removeFavorite(item.id);
      toast({
        title: nextFav ? "Added to favorites" : "Removed from favorites",
        variant: "success",
      });
    } catch {
      // Roll back on failure.
      setItems((prev) =>
        favoritesOnly && !nextFav
          ? [item, ...prev]
          : prev.map((i) => (i.id === item.id ? { ...i, isFavorite: item.isFavorite } : i)),
      );
      toast({ title: "Update failed", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  function openBroadcast(item: FeedItemDTO) {
    setBroadcastItem(item);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filters}
        onChange={onFilterChange}
        sources={sources}
        topics={topics}
        count={items.length}
        loading={loading}
      />

      {items.length === 0 && !loading ? (
        <EmptyState favoritesOnly={favoritesOnly} />
      ) : (
        <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {items.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              onToggleFavorite={toggleFavorite}
              onBroadcast={openBroadcast}
              busy={busyId === item.id}
            />
          ))}
        </div>
      )}

      <BroadcastModal
        item={broadcastItem}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

function EmptyState({ favoritesOnly }: { favoritesOnly: boolean }) {
  const Icon = favoritesOnly ? Star : Newspaper;
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border bg-card/40 py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {favoritesOnly ? "No favorites yet" : "No news matches your filters"}
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted">
        {favoritesOnly
          ? "Star items from the Feed to save them here, then broadcast them in a couple of clicks."
          : "Try clearing filters, or hit Refresh to fetch the latest AI news."}
      </p>
    </div>
  );
}
