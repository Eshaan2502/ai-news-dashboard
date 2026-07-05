import { runIngestion } from "./run";

/**
 * Shared scheduled-ingestion loop: run a pass immediately, then every
 * `intervalMin` minutes, never overlapping. Used by both the in-app
 * scheduler (src/instrumentation.ts) and the standalone worker
 * (src/worker/index.ts) so the two deployments can't drift apart.
 */
export function startIngestionLoop(intervalMin: number, tag: string): void {
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const s = await runIngestion();
      console.log(
        `[${tag}] ${new Date().toISOString()} · +${s.inserted} items · ` +
          `${s.sourcesOk}/${s.sourcesTotal} sources ok · ${s.duplicates} deduped · ` +
          `${s.filteredJunk} junk dropped · ${(s.durationMs / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      console.error(`[${tag}] run failed:`, e);
    } finally {
      running = false;
    }
  };

  console.log(`[${tag}] starting — ingesting every ${intervalMin} minute(s)`);
  void tick();
  // unref: a pending timer must not keep the process alive during shutdown.
  setInterval(tick, intervalMin * 60_000).unref();
}
