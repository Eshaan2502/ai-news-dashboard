import { randomUUID } from "node:crypto";
import { eq, gt } from "drizzle-orm";
import { db } from "../db";
import { sources, newsItems, type Source } from "../db/schema";
import { fetchFeed } from "./fetcher";
import { normalizeItem, type NormalizedItem } from "./normalize";
import { Deduper, type IndexItem } from "./dedup";
import { classifyJunk } from "./heuristics";
import { computeImpact } from "./score";
import { AI_ENABLED, embed, enrich, fallbackEnrichment } from "../ai/openai";
import { normalizeTopic } from "../topics";
import { mapWithConcurrency, truncate } from "../utils";

export type PerSourceStat = { name: string; status: string; fetched: number; inserted: number };

export type IngestStats = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  aiEnabled: boolean;
  sourcesTotal: number;
  sourcesOk: number;
  sourcesFailed: number;
  fetched: number;
  skippedExisting: number;
  filteredJunk: number;
  inserted: number;
  duplicates: number;
  enriched: number;
  perSource: PerSourceStat[];
};

const FETCH_CONCURRENCY = 6;
const EMBED_CONCURRENCY = 8;
const ENRICH_CONCURRENCY = 4;
const RECENT_WINDOW_DAYS = 14;

/**
 * Full ingestion pass: fetch → normalize → embed → dedup/cluster → enrich → store.
 * Resilient by design — a single failing source never aborts the run.
 */
export async function runIngestion(): Promise<IngestStats> {
  const start = Date.now();
  const itemsPerSource = Number(process.env.INGEST_ITEMS_PER_SOURCE ?? 15);
  const enrichLimit = Number(process.env.ENRICH_LIMIT ?? 80);

  const activeSources = await db.select().from(sources).where(eq(sources.active, true));

  // Skip-set: canonical URLs we already have (avoids re-embedding/re-enriching).
  const existingUrls = new Set(
    (await db.select({ c: newsItems.canonicalUrl }).from(newsItems)).map((r) => r.c),
  );

  // Seed the deduper from recent rows (id, clusterId, title, embedding).
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000);
  const recentRows = await db
    .select({
      id: newsItems.id,
      clusterId: newsItems.clusterId,
      title: newsItems.title,
      embedding: newsItems.embedding,
    })
    .from(newsItems)
    .where(gt(newsItems.fetchedAt, since));
  const deduper = new Deduper(
    recentRows.map<IndexItem>((r) => ({
      id: r.id,
      clusterId: r.clusterId ?? randomUUID(),
      title: r.title,
      embedding: r.embedding ?? null,
    })),
  );

  // ── 1. Fetch every source (bounded concurrency) ────────────────────────
  const fetched = await mapWithConcurrency(activeSources, FETCH_CONCURRENCY, async (src) => ({
    src,
    result: await fetchFeed(src.url),
  }));

  // ── 2. Normalize + filter to novel candidates ──────────────────────────
  type Candidate = {
    src: Source;
    item: NormalizedItem;
    embedding: number[] | null;
    isDuplicate: boolean;
    clusterId: string;
    enriched: boolean;
    summary: string;
    entities: string[];
    topic: string; // model taxonomy category when valid, else inherited from the source
    modelLabel: string; // the model's free-form topic label (kept in tags)
    impact: number;
  };
  const candidates: Candidate[] = [];
  const perSource: PerSourceStat[] = [];
  const insertedBySource = new Map<number, number>();
  const seenThisRun = new Set<string>();
  let fetchedCount = 0;
  let skippedExisting = 0;
  let filteredJunk = 0;
  let sourcesOk = 0;
  let sourcesFailed = 0;

  for (const { src, result } of fetched) {
    if (!result.ok) {
      sourcesFailed++;
      perSource.push({ name: src.name, status: `error: ${result.error}`, fetched: 0, inserted: 0 });
      await db
        .update(sources)
        .set({ lastFetchedAt: new Date(), lastStatus: `error: ${result.error}` })
        .where(eq(sources.id, src.id));
      continue;
    }
    sourcesOk++;
    const normalized = result.items
      .slice(0, itemsPerSource)
      .map(normalizeItem)
      .filter((x): x is NormalizedItem => x !== null);
    fetchedCount += normalized.length;

    for (const item of normalized) {
      if (existingUrls.has(item.canonicalUrl) || seenThisRun.has(item.canonicalUrl)) {
        skippedExisting++;
        continue;
      }
      // Junk gate: drop obvious non-news before spending on embed/enrich/insert.
      if (classifyJunk(item.title, item.rawContent)) {
        filteredJunk++;
        continue;
      }
      seenThisRun.add(item.canonicalUrl);
      candidates.push({
        src,
        item,
        embedding: null,
        isDuplicate: false,
        clusterId: "",
        enriched: false,
        summary: "",
        entities: [],
        topic: src.topic,
        modelLabel: "",
        impact: 50,
      });
    }
    perSource.push({ name: src.name, status: "ok", fetched: normalized.length, inserted: 0 });
    await db
      .update(sources)
      .set({ lastFetchedAt: new Date(), lastStatus: "ok" })
      .where(eq(sources.id, src.id));
  }

  // ── 3. Embed candidates (cheap; enables semantic dedup) ────────────────
  if (AI_ENABLED) {
    await mapWithConcurrency(candidates, EMBED_CONCURRENCY, async (c) => {
      c.embedding = await embed(`${c.item.title}\n\n${truncate(c.item.rawContent, 1000)}`);
    });
  }

  // ── 4. Classify/cluster sequentially (fast, in-memory) ─────────────────
  for (const c of candidates) {
    const verdict = deduper.classify({ title: c.item.title, embedding: c.embedding });
    c.isDuplicate = verdict.isDuplicate;
    c.clusterId = verdict.clusterId;
    // Register immediately so intra-run duplicates cluster against this one.
    deduper.add({ id: null, clusterId: c.clusterId, title: c.item.title, embedding: c.embedding });
  }

  // ── 5. Enrich: canonical items first, up to ENRICH_LIMIT ───────────────
  const enrichTargets = candidates
    .filter((c) => !c.isDuplicate)
    .sort(
      (a, b) =>
        b.src.weight - a.src.weight ||
        (b.item.publishedAt?.getTime() ?? 0) - (a.item.publishedAt?.getTime() ?? 0),
    )
    .slice(0, enrichLimit);
  const enrichSet = new Set(enrichTargets);

  await mapWithConcurrency(candidates, ENRICH_CONCURRENCY, async (c) => {
    const input = { title: c.item.title, content: c.item.rawContent, sourceName: c.src.name };
    const useAI = AI_ENABLED && enrichSet.has(c);
    const result = useAI ? await enrich(input) : fallbackEnrichment(input);
    c.summary = result.summary;
    c.entities = result.entities;
    c.modelLabel = result.topic;
    // General-desk feeds (world news, all-content) carry plenty of off-topic
    // stories, so the model's taxonomy category wins over the source topic
    // whenever it maps to one of the 8 Spectrum topics.
    c.topic = normalizeTopic(result.category) ?? c.src.topic;
    c.impact = result.impact;
    c.enriched = useAI;
  });

  // ── 6. Persist (bulk insert in chunks to minimize round-trips) ──────────
  let inserted = 0;
  let duplicates = 0;
  let enrichedCount = 0;

  const rows = candidates.map((c) => ({
    sourceId: c.src.id,
    title: c.item.title,
    summary: c.summary,
    rawContent: c.item.rawContent,
    author: c.item.author,
    url: c.item.url,
    canonicalUrl: c.item.canonicalUrl,
    imageUrl: c.item.imageUrl,
    publishedAt: c.item.publishedAt,
    tags: [...new Set([c.topic, c.modelLabel].filter((t) => t && t !== "General"))],
    entities: c.entities,
    topic: c.topic,
    impactScore: computeImpact(c.impact, c.src.weight, c.item.publishedAt),
    clusterId: c.clusterId,
    isDuplicate: c.isDuplicate,
    embedding: c.embedding,
    enriched: c.enriched,
    // Feed-provided full text pre-fills the reader cache — no scrape needed.
    extractedContent: c.item.fullBlocks,
    extractionStatus: c.item.fullBlocks ? "feed" : null,
    extractedAt: c.item.fullBlocks ? new Date() : null,
  }));

  const insertedUrls = new Set<string>();
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await db
      .insert(newsItems)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoNothing({ target: newsItems.canonicalUrl })
      .returning({ canonicalUrl: newsItems.canonicalUrl });
    for (const r of res) insertedUrls.add(r.canonicalUrl);
  }

  for (const c of candidates) {
    if (!insertedUrls.has(c.item.canonicalUrl)) continue;
    inserted++;
    if (c.isDuplicate) duplicates++;
    if (c.enriched) enrichedCount++;
    insertedBySource.set(c.src.id, (insertedBySource.get(c.src.id) ?? 0) + 1);
  }

  // Fill per-source inserted counts.
  for (const ps of perSource) {
    const src = activeSources.find((s) => s.name === ps.name);
    if (src) ps.inserted = insertedBySource.get(src.id) ?? 0;
  }

  const finished = Date.now();
  return {
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - start,
    aiEnabled: AI_ENABLED,
    sourcesTotal: activeSources.length,
    sourcesOk,
    sourcesFailed,
    fetched: fetchedCount,
    skippedExisting,
    filteredJunk,
    inserted,
    duplicates,
    enriched: enrichedCount,
    perSource,
  };
}
