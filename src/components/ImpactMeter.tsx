import { impactColor } from "@/lib/ui";

/** Compact 0–100 impact indicator (bar + number). */
export function ImpactMeter({ score }: { score: number }) {
  const color = impactColor(score);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Impact score ${score}/100 — blends model newsworthiness, source authority and recency`}
    >
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-border">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(4, score)}%`, background: color }}
        />
      </span>
      <span className="text-xs tabular-nums text-muted">{score}</span>
    </span>
  );
}
