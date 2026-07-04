"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { SourceDTO } from "@/lib/types";
import type { SortOption } from "@/lib/constants";
import { SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const selectCls =
  "h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

export type Filters = {
  query: string;
  sourceId: number | "";
  topic: string;
  sort: SortOption;
  includeDuplicates: boolean;
};

export function FilterBar({
  filters,
  onChange,
  sources,
  topics,
  count,
  loading,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  sources: SourceDTO[];
  topics: string[];
  count: number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Search titles & summaries…"
            className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          className={selectCls}
          value={filters.sourceId}
          onChange={(e) => onChange({ sourceId: e.target.value ? Number(e.target.value) : "" })}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.itemCount})
            </option>
          ))}
        </select>

        <select
          className={selectCls}
          value={filters.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          aria-label="Filter by topic"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className={selectCls}
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortOption })}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={filters.includeDuplicates}
            onChange={(e) => onChange({ includeDuplicates: e.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--color-primary)]"
          />
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Show near-duplicates
        </label>
        <span className={cn("tabular-nums", loading && "opacity-50")}>
          {loading ? "Loading…" : `${count} item${count === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
