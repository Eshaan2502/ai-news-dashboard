"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import type { Stats } from "@/lib/types";
import { categoryColor } from "@/lib/ui";

const AXIS = { fill: "var(--color-muted)", fontSize: 11 } as const;
const GRID = "var(--color-border)";

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* Dark, minimal tooltip shared by every chart. */
function DarkTooltip({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted">
        {payload[0].value}
        {unit} items
      </p>
    </div>
  );
}

function shortDay(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InsightsPanel({ stats }: { stats: Stats }) {
  const volume = stats.byDay.map((d) => ({ label: shortDay(d.day), count: d.count }));
  const topSources = stats.bySource.slice(0, 7);
  const categories = stats.byCategory;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 1 — volume over time: single series → no legend, title names it */}
      <ChartCard title="Ingestion volume" subtitle="New items · last 14 days">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={volume} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-cat-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-cat-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
            <Tooltip content={<DarkTooltip />} cursor={{ stroke: GRID }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--color-cat-1)"
              strokeWidth={2}
              fill="url(#vol)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 2 — top sources: horizontal bars, single hue, direct value labels */}
      <ChartCard title="Top sources" subtitle="Items contributed">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={topSources}
            margin={{ top: 0, right: 22, left: 6, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={104}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "var(--color-card-hover)" }} />
            <Bar dataKey="count" fill="var(--color-cat-1)" radius={[0, 4, 4, 0]} barSize={13}>
              <LabelList dataKey="count" position="right" fill="var(--color-muted)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3 — category mix: color follows the category (identity), not rank */}
      <ChartCard title="By category" subtitle="Source mix">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={categories}
            margin={{ top: 0, right: 22, left: 6, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={82}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "var(--color-card-hover)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
              {categories.map((c) => (
                <Cell key={c.category} fill={categoryColor(c.category)} />
              ))}
              <LabelList dataKey="count" position="right" fill="var(--color-muted)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
