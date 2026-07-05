"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { FeedItemDTO } from "@/lib/types";
import { HorizontalRow } from "./HorizontalRow";
import { NewsCard } from "./NewsCard";

/**
 * Front-page search: a bar above the fold, and — while a query is active —
 * a results row styled like any topic row rendered right below it, pushing
 * Trending and the topic rows down. Clearing the query removes the row.
 */
export function SearchSection() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FeedItemDTO[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const q = query.trim();

  /** Single entry point for query edits so status stays in sync with `q`. */
  const handleChange = (value: string) => {
    setQuery(value);
    const next = value.trim();
    if (!next) {
      setItems([]);
      setStatus("idle");
    } else if (next !== q) {
      setStatus("loading");
    }
  };

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(q)}&limit=12`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as { items: FeedItemDTO[] };
        setItems(data.items);
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && handleChange("")}
          placeholder="Search the news…"
          aria-label="Search news"
          className="w-full rounded-lg border border-border bg-card py-3 pl-11 pr-11 font-serif text-base text-foreground shadow-sm outline-none transition-all placeholder:italic placeholder:text-muted focus:border-border-strong focus:shadow-md [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            onClick={() => handleChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {q && (
        <section className="animate-fade-in">
          <div className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
            <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary">
              <Search className="h-5 w-5" />
              <span>Results for &ldquo;{q}&rdquo;</span>
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {status === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Searching" />
              ) : status === "done" && items.length ? (
                `${items.length} ${items.length === 1 ? "story" : "stories"}`
              ) : (
                ""
              )}
            </span>
          </div>
          {items.length ? (
            <HorizontalRow>
              {items.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </HorizontalRow>
          ) : status === "loading" ? (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </p>
          ) : status === "error" ? (
            <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted">
              Something went wrong while searching — try again.
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted">
              No stories match &ldquo;{q}&rdquo; — try a different keyword.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
