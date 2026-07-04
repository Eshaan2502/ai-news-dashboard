import "dotenv/config";
import { client } from "../db";
import { runIngestion } from "./run";

/**
 * Run a single ingestion pass from the terminal: npm run ingest
 */
async function main() {
  console.log("→ Starting ingestion…");
  const stats = await runIngestion();
  console.log("\n──────── Ingestion summary ────────");
  console.log(`AI enrichment : ${stats.aiEnabled ? "on" : "off (fallback)"}`);
  console.log(`Sources       : ${stats.sourcesOk}/${stats.sourcesTotal} ok, ${stats.sourcesFailed} failed`);
  console.log(`Fetched       : ${stats.fetched}`);
  console.log(`Skipped (seen): ${stats.skippedExisting}`);
  console.log(`Inserted      : ${stats.inserted} (${stats.duplicates} clustered as duplicates)`);
  console.log(`AI-enriched   : ${stats.enriched}`);
  console.log(`Duration      : ${(stats.durationMs / 1000).toFixed(1)}s`);
  console.log("\nPer source:");
  for (const s of stats.perSource) {
    const flag = s.status === "ok" ? "✓" : "✗";
    console.log(`  ${flag} ${s.name.padEnd(26)} fetched ${String(s.fetched).padStart(3)}  +${s.inserted}  ${s.status === "ok" ? "" : s.status}`);
  }
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ Ingestion failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
