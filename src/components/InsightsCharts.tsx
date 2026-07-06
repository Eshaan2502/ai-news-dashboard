/**
 * Server-rendered chart primitives for the Insights page. Pure SVG/CSS in the
 * newspaper palette — no charting library, no client JS.
 */

export type Slice = { label: string; count: number; color: string };

/** Radius that makes the circle's circumference exactly 100 (dash math in %). */
const DONUT_R = 15.9155;

/** Share-by-topic donut with the total set in the middle. */
export function TopicDonut({ slices, total }: { slices: Slice[]; total: number }) {
  // Each slice is a dash of `pct` on a 100-unit circle. Offset 25 starts the
  // first slice at 12 o'clock; subtracting the shares drawn before it rotates
  // each next slice into place (dashoffset is periodic, so negatives are fine).
  const safeTotal = Math.max(total, 1);
  const pctOf = (s: Slice) => (s.count / safeTotal) * 100;
  const arcs = slices.map((s, i) => {
    const pct = pctOf(s);
    const before = slices.slice(0, i).reduce((sum, prev) => sum + pctOf(prev), 0);
    return (
      <circle
        key={s.label}
        cx="21"
        cy="21"
        r={DONUT_R}
        fill="none"
        stroke={s.color}
        strokeWidth="5"
        strokeDasharray={`${pct} ${100 - pct}`}
        strokeDashoffset={25 - before}
      />
    );
  });

  return (
    <svg viewBox="0 0 42 42" role="img" aria-label="Reading share by topic" className="h-44 w-44 shrink-0">
      <circle cx="21" cy="21" r={DONUT_R} fill="none" stroke="var(--color-surface)" strokeWidth="5" />
      {arcs}
      <text
        x="21"
        y="20.5"
        textAnchor="middle"
        fontSize="8"
        fontWeight="800"
        className="fill-foreground font-serif"
      >
        {total}
      </text>
      <text x="21" y="25.5" textAnchor="middle" fontSize="2.4" letterSpacing="0.5" className="fill-muted">
        STORIES READ
      </text>
    </svg>
  );
}

/** Horizontal bar list — e.g. most-read sources. */
export function BarList({ rows }: { rows: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {r.count} {r.count === 1 ? "story" : "stories"}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.count / max) * 100}%`,
                backgroundColor: r.color ?? "var(--color-accent)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Day-by-day activity columns (already zero-filled, oldest → newest). */
export function DailyBars({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const fmt = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${fmt(d.day)}: ${d.count} ${d.count === 1 ? "story" : "stories"}`}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${d.count > 0 ? Math.max((d.count / max) * 100, 8) : 3}%`,
              backgroundColor: d.count > 0 ? "var(--color-primary)" : "var(--color-border)",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(days[0].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** One stacked proportion bar with a legend — e.g. source-category mix. */
export function SplitBar({ parts }: { parts: Slice[] }) {
  const total = parts.reduce((s, p) => s + p.count, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.count / total) * 100}%`, backgroundColor: p.color }} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.label}
            <span className="text-muted-foreground">{Math.round((p.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
