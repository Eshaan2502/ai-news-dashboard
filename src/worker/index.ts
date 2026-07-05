import "dotenv/config";
import { runIngestion } from "../lib/ingest/run";

/**
 * Scheduled ingestion worker (BRD §4 "Scheduled fetchers", <15m latency).
 * Runs a pass immediately, then every INGEST_INTERVAL_MINUTES. Deploy as a
 * long-running Railway service, or use Railway Cron to POST /api/ingest instead.
 */
const intervalMin = Number(process.env.INGEST_INTERVAL_MINUTES ?? 15);
let running = false;

async function tick() {
  if (running) return; // never overlap runs
  running = true;
  try {
    const s = await runIngestion();
    console.log(
      `[worker] ${new Date().toISOString()} · +${s.inserted} items · ` +
        `${s.sourcesOk}/${s.sourcesTotal} sources ok · ${s.duplicates} deduped · ` +
        `${s.filteredJunk} junk dropped · ${(s.durationMs / 1000).toFixed(1)}s`,
    );
  } catch (e) {
    console.error("[worker] run failed:", e);
  } finally {
    running = false;
  }
}

console.log(`[worker] starting — ingesting every ${intervalMin} minute(s)`);
void tick();
setInterval(tick, intervalMin * 60_000);
