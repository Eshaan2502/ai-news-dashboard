import "dotenv/config";
import { client } from "../db";
import { runIngestion } from "./run";

/**
 * Run a single ingestion pass from the terminal: npm run ingest
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runWithRetry(attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await runIngestion();
    } catch (e) {
      const code = (e as { cause?: { code?: string } })?.cause?.code ?? "";
      const transient = /ETIMEDOUT|CONNECT_TIMEOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(
        code + String(e),
      );
      if (i < attempts && transient) {
        console.warn(`  ⚠ attempt ${i} failed (${code || "network"}); retrying in 5s…`);
        await sleep(5000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

async function main() {
  console.log("→ Starting ingestion…");
  const stats = await runWithRetry();
  console.log("\n──────── Ingestion summary ────────");
  console.log(`AI enrichment : ${stats.aiEnabled ? "on" : "off (fallback)"}`);
  console.log(`Sources       : ${stats.sourcesOk}/${stats.sourcesTotal} ok, ${stats.sourcesFailed} failed`);
  console.log(`Fetched       : ${stats.fetched}`);
  console.log(`Skipped (seen): ${stats.skippedExisting}`);
  console.log(`Filtered (junk): ${stats.filteredJunk}`);
  console.log(`Inserted      : ${stats.inserted} (${stats.duplicates} clustered as duplicates)`);
  console.log(`AI-enriched   : ${stats.enriched}`);
  console.log(`Duration      : ${(stats.durationMs / 1000).toFixed(1)}s`);
  console.log("\nPer source:");
  for (const s of stats.perSource) {
    const flag = s.status === "ok" ? "✓" : "✗";
    console.log(
      `  ${flag} ${s.name.padEnd(26)} fetched ${String(s.fetched).padStart(3)}  +${s.inserted}  ${s.status === "ok" ? "" : s.status}`,
    );
  }
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("✗ Ingestion failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
