import { Sparkles } from "lucide-react";
import { getFeed, getStats, getSources, getTopics } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/db/user";
import { AI_ENABLED } from "@/lib/ai/openai";
import { StatTiles } from "@/components/StatTiles";
import { InsightsPanel } from "@/components/InsightsPanel";
import { FeedView } from "@/components/FeedView";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  try {
    const userId = await getCurrentUserId();
    const [items, stats, sources, topics] = await Promise.all([
      getFeed({ userId, sort: "date", limit: 60 }),
      getStats(),
      getSources(),
      getTopics(),
    ]);

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              AI news, deduped &amp; ready to broadcast
            </h1>
            <p className="mt-1 text-sm text-muted">
              Aggregated from {stats.totals.sources} sources · clustered &amp; ranked by impact
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted"
            title={AI_ENABLED ? "OpenAI enrichment active" : "Running in fallback mode (no API key)"}
          >
            <Sparkles
              className={AI_ENABLED ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 text-muted-foreground"}
            />
            {AI_ENABLED ? "AI enrichment on" : "AI fallback mode"}
          </span>
        </header>

        <StatTiles stats={stats} />
        <InsightsPanel stats={stats} />

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Latest AI news</h2>
          <FeedView initialItems={items} sources={sources} topics={topics} />
        </section>
      </div>
    );
  } catch (err) {
    return <SetupNotice error={err instanceof Error ? err.message : String(err)} />;
  }
}
