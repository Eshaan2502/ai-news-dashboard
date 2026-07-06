import Link from "next/link";
import { ChartPie } from "lucide-react";
import { getReadingInsights } from "@/lib/db/queries";
import { requireOnboardedUser } from "@/lib/db/user";
import { SetupNotice } from "@/components/SetupNotice";
import { BarList, DailyBars, SplitBar, TopicDonut, type Slice } from "@/components/InsightsCharts";
import { topicColor } from "@/lib/ui";
import { timeAgo } from "@/lib/utils";
import type { InsightsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Editorial ink per source category (a different axis than the topic colors). */
const CATEGORY_COLOR: Record<string, string> = {
  Media: "#9a3b26", // oxblood
  Company: "#1f6f8b", // teal ink
  Research: "#5b4a8a", // plum
  Community: "#b3541e", // burnt orange
  Other: "#988b71", // faded ink
};

export default async function InsightsPage() {
  const user = await requireOnboardedUser();

  let insights: InsightsDTO;
  try {
    insights = await getReadingInsights(user.id);
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }

  if (insights.storiesRead === 0) {
    return (
      <div className="mx-auto max-w-md animate-fade-in rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <ChartPie className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-4 font-serif text-2xl font-black text-foreground">Reading insights</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Open any story and Spectrum starts charting what you gravitate to — topics, outlets, and
          how your reading diet balances out.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Browse today&rsquo;s stories
        </Link>
      </div>
    );
  }

  const topicSlices: Slice[] = insights.topics.map((t) => ({
    label: t.topic,
    count: t.count,
    color: topicColor(t.topic),
  }));
  const categoryParts: Slice[] = insights.categories.map((c) => ({
    label: c.category,
    count: c.count,
    color: CATEGORY_COLOR[c.category] ?? CATEGORY_COLOR.Other,
  }));

  const trackedSince = insights.firstReadAt
    ? new Date(insights.firstReadAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="animate-fade-in space-y-8">
      <header className="text-center">
        <h1 className="font-serif text-3xl font-black tracking-tight text-foreground">
          Reading insights
        </h1>
        <p className="mt-2 text-sm text-muted">
          What you actually read — not what you meant to.
          {trackedSince ? ` Tracked since ${trackedSince}.` : ""}
        </p>
      </header>

      {/* Stat band — hairline-divided, almanac style. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-sm sm:grid-cols-4">
        <Stat label="Stories read" value={insights.storiesRead} />
        <Stat label="This week" value={insights.readsThisWeek} />
        <Stat
          label="Top topic"
          value={insights.topics[0]?.topic ?? "—"}
          accent={topicColor(insights.topics[0]?.topic)}
        />
        <Stat label="Total opens" value={insights.totalOpens} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* What you lean toward — the centerpiece. */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            What you lean toward
          </h2>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <TopicDonut slices={topicSlices} total={insights.storiesRead} />
            <ul className="w-full space-y-2">
              {topicSlices.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate font-medium text-foreground">{s.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {s.count} · {Math.round((s.count / insights.storiesRead) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 border-t border-border pt-3 font-serif text-sm italic leading-relaxed text-muted">
            {editorialNote(insights, user.preferredTopics ?? [])}
          </p>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Last 14 days
            </h2>
            <div className="mt-4">
              <DailyBars days={insights.daily} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Where your news comes from
            </h2>
            <div className="mt-4">
              <SplitBar parts={categoryParts} />
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Most-read outlets
          </h2>
          <div className="mt-4">
            <BarList rows={insights.sources.map((s) => ({ label: s.source, count: s.count }))} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Recently read
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {insights.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/article/${r.id}`} className="group flex items-center gap-2.5 py-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: topicColor(r.topic) }}
                    title={r.topic ?? "General"}
                  />
                  <span className="min-w-0">
                    <span className="clamp-2 font-serif text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                      {r.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {r.sourceName ?? "Unknown source"} · {timeAgo(r.lastReadAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card p-4 text-center">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd
        className="mt-1 truncate font-serif text-2xl font-black text-foreground"
        style={accent ? { color: accent } : undefined}
        title={String(value)}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * One italic line under the donut, in Spectrum's editorial voice — flags
 * tunnel vision (the tagline's whole point) or blesses a broad diet, and
 * notes when actual reading has drifted from the topics the user picked.
 */
function editorialNote(insights: InsightsDTO, preferred: string[]): string {
  const top = insights.topics[0];
  if (!top) return "Keep reading — patterns take a few stories to show.";
  const share = Math.round((top.count / insights.storiesRead) * 100);

  const drift =
    !preferred.includes(top.topic) && top.topic !== "General"
      ? ` You never picked ${top.topic} in your Topics, yet it leads your reading — maybe make it official.`
      : "";

  if (share >= 60) {
    return `${share}% of your reading is ${top.topic} — that's tunnel-vision territory. Wander a little.${drift}`;
  }
  if (insights.topics.length >= 5) {
    return `A broad diet: ${insights.topics.length} topics and counting, led by ${top.topic} at ${share}%. No tunnel vision here.${drift}`;
  }
  return `${top.topic} leads your reading at ${share}%, across ${insights.topics.length} ${insights.topics.length === 1 ? "topic" : "topics"} so far.${drift}`;
}
