import "dotenv/config";
import { randomUUID } from "node:crypto";
import { notInArray, sql } from "drizzle-orm";
import { db, client } from "./index";
import { sources, newsItems } from "./schema";
import { SOURCES } from "../ingest/sources";
import { DEMO_ITEMS } from "./demo-data";
import { canonicalizeUrl } from "../utils";

/**
 * Idempotent seed:
 *   • upserts the registered sources (with their Spectrum topic)
 *   • inserts demo articles (skip with `--no-demo`) so the UI is populated offline
 *   • backfills news_items.topic from each item's source
 *
 * Run with: npm run db:seed   (or: npm run db:seed -- --no-demo)
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

  const skipDemo = process.argv.includes("--no-demo");
  if (!skipDemo) {
    console.log("→ Seeding demo articles…");
    const allSources = await db.select().from(sources);
    const idByName = new Map(allSources.map((s) => [s.name, s.id]));

    // Assign a shared clusterId to demo items with the same clusterKey.
    const clusterIds = new Map<string, string>();
    let inserted = 0;
    for (const d of DEMO_ITEMS) {
      let clusterId: string = randomUUID(); // canonical items get their own cluster
      let isDuplicate = false;
      if (d.clusterKey) {
        if (!clusterIds.has(d.clusterKey)) clusterIds.set(d.clusterKey, clusterId);
        clusterId = clusterIds.get(d.clusterKey)!;
        // first item in a cluster is canonical, the rest are marked duplicates
        isDuplicate =
          DEMO_ITEMS.findIndex((x) => x.clusterKey === d.clusterKey) !== DEMO_ITEMS.indexOf(d);
      }
      const res = await db
        .insert(newsItems)
        .values({
          sourceId: idByName.get(d.sourceName) ?? null,
          title: d.title,
          summary: d.summary,
          author: d.author,
          url: d.url,
          canonicalUrl: canonicalizeUrl(d.url),
          imageUrl: d.imageUrl ?? null,
          publishedAt: new Date(Date.now() - d.hoursAgo * 3_600_000),
          tags: d.tags,
          entities: d.entities,
          topic: d.topic,
          impactScore: d.impactScore,
          clusterId,
          isDuplicate,
          enriched: true,
        })
        .onConflictDoNothing({ target: newsItems.canonicalUrl })
        .returning({ id: newsItems.id });
      if (res.length) inserted++;
    }
    console.log(`  ✓ ${inserted} demo articles inserted (${DEMO_ITEMS.length - inserted} already existed)`);
  }

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
