import "dotenv/config";
import { startIngestionLoop } from "../lib/ingest/scheduler";

/**
 * Standalone scheduled-ingestion worker. The deployed web app already
 * self-schedules ingestion in-process (src/instrumentation.ts); run this only
 * in a split deployment — a dedicated Railway service with start command
 * `npm run worker` — and set INGEST_INTERVAL_MINUTES=0 on the web service so
 * both don't ingest (double runs are harmless thanks to the canonical-URL
 * guard, just wasteful).
 */
const intervalMin = Number(process.env.INGEST_INTERVAL_MINUTES ?? 15);
if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
  console.error("[worker] INGEST_INTERVAL_MINUTES must be a positive number");
  process.exit(1);
}

startIngestionLoop(intervalMin, "worker");
// Keep the process alive: the loop's timer is unref'd by design (the web app
// must be able to shut down cleanly), so the worker holds its own handle.
setInterval(() => {}, 1 << 30);
