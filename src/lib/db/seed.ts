import "dotenv/config";
import { notInArray, sql } from "drizzle-orm";
import { db, client } from "./index";
import { sources } from "./schema";
import { SOURCES } from "../ingest/sources";

/**
 * Idempotent seed:
 *   • upserts the registered sources (with their Spectrum topic)
 *   • backfills news_items.topic from each item's source
 *
 * Articles are never seeded — every story comes from real ingestion. After
 * seeding sources, populate the feed with `npm run ingest` (or `npm run worker`).
 *
 * Run with: npm run db:seed
 */
async function seed() {
  console.log("→ Seeding sources…");
  for (const s of SOURCES) {
    await db
      .insert(sources)
      .values(s)
      .onConflictDoUpdate({
        target: sources.url,
        set: {
          name: s.name,
          siteUrl: s.siteUrl,
          category: s.category,
          topic: s.topic,
          weight: s.weight,
          active: s.active ?? true,
        },
      });
  }
  // Reconcile: drop sources no longer in the registry (e.g. changed feed URLs).
  await db.delete(sources).where(notInArray(sources.url, SOURCES.map((s) => s.url)));
  console.log(`  ✓ ${SOURCES.length} sources`);

  // Source topic is authoritative — align every item with its source's topic.
  console.log("→ Backfilling item topics from sources…");
  await db.execute(sql`
    UPDATE news_items ni SET topic = s.topic
    FROM sources s
    WHERE ni.source_id = s.id AND ni.topic IS DISTINCT FROM s.topic
  `);

  console.log("✓ Seed complete.");
  await client.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("✗ Seed failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
