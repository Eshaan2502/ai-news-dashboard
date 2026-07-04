import { Newspaper, Radio, Star, Layers, Gauge, Megaphone } from "lucide-react";
import type { Stats } from "@/lib/types";

/**
 * KPI row. Per the dataviz "is it even a chart?" rule, single headline numbers
 * are stat tiles, not charts.
 */
export function StatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    { label: "Curated items", value: stats.totals.items, icon: Newspaper, hint: "after dedup" },
    { label: "Sources online", value: stats.totals.sources, icon: Radio, hint: "ingesting" },
    { label: "Favorites", value: stats.totals.favorites, icon: Star, hint: "saved" },
    { label: "Broadcasts", value: stats.totals.broadcasts, icon: Megaphone, hint: "sent" },
    {
      label: "Dedup rate",
      value: `${Math.round(stats.dedupRate * 100)}%`,
      icon: Layers,
      hint: `${stats.totals.duplicates} merged`,
    },
    { label: "Avg impact", value: stats.avgImpact, icon: Gauge, hint: "0–100" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-border-strong"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{t.label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{t.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
