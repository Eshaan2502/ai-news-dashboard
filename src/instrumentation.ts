/**
 * Next.js instrumentation — runs once when the server boots.
 *
 * Starts the in-process ingestion scheduler (BRD §4 "Scheduled fetchers",
 * <15m latency) so the deployed web service keeps the feed fresh on its own —
 * no separate worker or cron required. The docker entrypoint has already run
 * migrations + seed by the time this fires, so the DB is ready.
 *
 * Scope guards:
 *   • production only — dev servers don't silently spend OpenAI credits;
 *     locally use `npm run ingest` (one pass) or `npm run worker`.
 *   • Node runtime only (never the edge/client bundles).
 *   • INGEST_INTERVAL_MINUTES=0 disables it — set that when running the
 *     standalone worker service so the two don't both ingest.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const intervalMin = Number(process.env.INGEST_INTERVAL_MINUTES ?? 15);
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
    console.log("[ingest] in-app scheduler disabled (INGEST_INTERVAL_MINUTES=0)");
    return;
  }

  // Dynamic import keeps the ingestion stack (DB, OpenAI, jsdom) out of
  // bundles that merely reference this file.
  const { startIngestionLoop } = await import("./lib/ingest/scheduler");
  startIngestionLoop(intervalMin, "ingest");
}
