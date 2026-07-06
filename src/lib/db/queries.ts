import { and, asc, desc, eq, gt, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { newsItems, sources, favorites, reads } from "./schema";
import type { SortOption } from "../constants";
import type { ArticleDTO, FeedItemDTO, InsightsDTO } from "../types";
import { AI_ENABLED, embed } from "../ai/openai";
import { decodeEntities } from "../utils";

export type { FeedItemDTO, ArticleDTO };

export type FeedParams = {
  userId: number;
  q?: string;
  sourceId?: number;
  topic?: string;
  sort?: SortOption;
  includeDuplicates?: boolean;
  favoritesOnly?: boolean;
  limit?: number;
  offset?: number;
  days?: number;
  /** Hide stories with impactScore below this; 0 disables the gate. */
  minImpact?: number;
};

/** Importance floor for browsing views (home rows, topic feeds). */
const DEFAULT_MIN_IMPACT = Number(process.env.MIN_IMPACT_SCORE ?? 45);

/**
 * Max cosine distance (0 = identical … 2 = opposite) for a semantic search hit.
 * Tuned against the live corpus: topical queries ("cricket", "formula 1") land
 * ≤ 0.70 against relevant stories, while unrelated noise starts ~0.69+. This is
 * what lets a search for a word that appears in no article still find the
 * stories that are *about* it.
 */
const SEARCH_MAX_DISTANCE = Number(process.env.SEARCH_MAX_DISTANCE ?? 0.7);

/** Main feed query — powers the trending row, topic rows, and Favorites. */
export async function getFeed(p: FeedParams): Promise<FeedItemDTO[]> {
  const conds: SQL[] = [];
  if (!p.includeDuplicates) conds.push(eq(newsItems.isDuplicate, false));
  // Importance gate: on by default when browsing, off when the user explicitly
  // asked for something (search, a specific source, their own favorites).
  const explicitLookup = Boolean(p.q || p.sourceId || p.favoritesOnly);
  const minImpact = p.minImpact ?? (explicitLookup ? 0 : DEFAULT_MIN_IMPACT);
  if (minImpact > 0) conds.push(gte(newsItems.impactScore, minImpact));
  if (p.sourceId) conds.push(eq(newsItems.sourceId, p.sourceId));
  if (p.topic) conds.push(eq(newsItems.topic, p.topic));
  if (p.days) conds.push(gt(newsItems.fetchedAt, new Date(Date.now() - p.days * 86_400_000)));
  // Free-text search: hybrid keyword + semantic. Keyword matches title, summary,
  // and the enriched entities/tags; semantic matching embeds the query and pulls
  // items within SEARCH_MAX_DISTANCE cosine distance — that's what lets "Cricket"
  // surface "T20 World Cup" stories that never contain the literal word. While a
  // query is active, relevance ordering overrides the browse sort.
  let searchOrder: SQL[] | null = null;
  if (p.q) {
    const like = `%${p.q}%`;
    const keyword = or(
      ilike(newsItems.title, like),
      ilike(newsItems.summary, like),
      sql`${newsItems.entities}::text ilike ${like}`,
      sql`${newsItems.tags}::text ilike ${like}`,
    )!;

    const qEmbedding = AI_ENABLED ? await embed(p.q) : null;
    if (qEmbedding) {
      const vec = `[${qEmbedding.join(",")}]`;
      const distance = sql<number>`(${newsItems.embedding} <=> ${vec}::vector)`;
      conds.push(
        or(
          keyword,
          sql`${newsItems.embedding} is not null and ${distance} < ${SEARCH_MAX_DISTANCE}`,
        )!,
      );
      // Keyword hits first, then closest meaning, then recency.
      searchOrder = [
        sql`case when ${keyword} then 0 else 1 end`,
        sql`${distance} asc nulls last`,
        desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`),
      ];
    } else {
      // AI disabled or the embedding call failed — degrade to keyword-only.
      conds.push(keyword);
      searchOrder = [desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`)];
    }
  }

  const orderBy =
    searchOrder ??
    (p.sort === "impact"
      ? [desc(newsItems.impactScore), desc(newsItems.publishedAt)]
      : p.sort === "source"
        ? [asc(sources.name), desc(newsItems.publishedAt)]
        : [desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`)]);

  const rows = await feedQuery(p.userId, p.favoritesOnly)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(p.limit ?? 60)
    .offset(p.offset ?? 0);

  return rows.map(toFeedItem);
}

/**
 * Trending — the most talked-about stories right now. A story trends when
 * multiple outlets land articles in its dedup cluster during the window,
 * not merely when the model scored one article highly. Canonical items
 * whose cluster saw any activity in the window qualify (the canonical row
 * itself may predate the window while follow-up coverage keeps arriving);
 * they rank by distinct covering sources, then impact, then recency.
 */
export async function getTrending(p: {
  userId: number;
  days?: number;
  limit?: number;
}): Promise<FeedItemDTO[]> {
  const cutoff = new Date(Date.now() - (p.days ?? 2) * 86_400_000);
  // Raw-SQL params skip drizzle's column type mapping, so bind the cutoff as
  // an ISO string and cast — a bare Date binds in an unparseable format.
  const cutoffTs = sql`${cutoff.toISOString()}::timestamptz`;
  // Distinct outlets that fed this story's cluster inside the window.
  // Rows without a cluster (web-search ingests) count as their own voice.
  const coverage = sql<number>`greatest(1, (
    select count(distinct cm.source_id) from ${newsItems} as cm
    where cm.cluster_id = ${newsItems.clusterId} and cm.fetched_at > ${cutoffTs}
  ))`;
  const clusterActive = or(
    gt(newsItems.fetchedAt, cutoff),
    sql`exists (
      select 1 from ${newsItems} as cm
      where cm.cluster_id = ${newsItems.clusterId} and cm.fetched_at > ${cutoffTs}
    )`,
  )!;

  const rows = await feedQuery(p.userId)
    .where(
      and(
        eq(newsItems.isDuplicate, false),
        clusterActive,
        // Multi-outlet coverage is importance evidence in its own right, so
        // it bypasses the impact floor that gates single-article stories.
        or(gte(newsItems.impactScore, DEFAULT_MIN_IMPACT), sql`${coverage} >= 2`)!,
      ),
    )
    .orderBy(
      desc(coverage),
      desc(newsItems.impactScore),
      desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`),
    )
    .limit(p.limit ?? 12);

  const items = rows.map(toFeedItem);

  // Attach each story's coverage so the UI can say why it's trending.
  const clusterIds = [...new Set(items.map((i) => i.clusterId).filter((c): c is string => !!c))];
  const counts = clusterIds.length
    ? await db
        .select({
          clusterId: newsItems.clusterId,
          n: sql<number>`count(distinct ${newsItems.sourceId})::int`,
        })
        .from(newsItems)
        .where(and(inArray(newsItems.clusterId, clusterIds), gt(newsItems.fetchedAt, cutoff)))
        .groupBy(newsItems.clusterId)
    : [];
  const byCluster = new Map(counts.map((c) => [c.clusterId, c.n]));
  return items.map((i) => ({
    ...i,
    coverage: Math.max(1, (i.clusterId && byCluster.get(i.clusterId)) || 1),
  }));
}

/**
 * Feed items by explicit id list, returned in the list's order. Used for
 * web-search fallback results, whose relevance order comes from the search
 * engine rather than a SQL sort.
 */
export async function getFeedByIds(ids: number[], userId: number): Promise<FeedItemDTO[]> {
  if (!ids.length) return [];
  const rows = await feedQuery(userId).where(inArray(newsItems.id, ids));
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.map(toFeedItem).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/** Shared select + joins behind every feed-shaped query. */
function feedQuery(userId: number, favoritesOnly = false) {
  const qb = db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      url: newsItems.url,
      imageUrl: newsItems.imageUrl,
      author: newsItems.author,
      publishedAt: newsItems.publishedAt,
      fetchedAt: newsItems.fetchedAt,
      topic: newsItems.topic,
      entities: newsItems.entities,
      tags: newsItems.tags,
      impactScore: newsItems.impactScore,
      isDuplicate: newsItems.isDuplicate,
      clusterId: newsItems.clusterId,
      sourceName: sources.name,
      sourceCategory: sources.category,
      sourceTopic: sources.topic,
      siteUrl: sources.siteUrl,
      isFavorite: sql<boolean>`${favorites.id} is not null`,
    })
    .from(newsItems)
    .leftJoin(sources, eq(newsItems.sourceId, sources.id))
    .$dynamic();

  const favJoin = and(eq(favorites.newsItemId, newsItems.id), eq(favorites.userId, userId));
  return favoritesOnly ? qb.innerJoin(favorites, favJoin) : qb.leftJoin(favorites, favJoin);
}

type FeedRow = Awaited<ReturnType<ReturnType<typeof feedQuery>["execute"]>>[number];

function toFeedItem(r: FeedRow): FeedItemDTO {
  return {
    ...r,
    // Rows ingested before entity decoding may hold raw &#8217;-style entities.
    title: decodeEntities(r.title),
    summary: r.summary ? decodeEntities(r.summary) : r.summary,
    entities: (r.entities as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    fetchedAt: new Date(r.fetchedAt).toISOString(),
  };
}

/* ---------- Reading history & insights ---------- */

/**
 * Record that a user opened a story. The first open inserts a row; re-opens
 * bump `readCount`/`lastReadAt`. Errors are swallowed on purpose — tracking
 * must never break the reader.
 */
export async function recordRead(userId: number, newsItemId: number): Promise<void> {
  try {
    await db
      .insert(reads)
      .values({ userId, newsItemId })
      .onConflictDoUpdate({
        target: [reads.userId, reads.newsItemId],
        set: {
          readCount: sql`${reads.readCount} + 1`,
          lastReadAt: sql`now()`,
        },
      });
  } catch (err) {
    console.warn(`[reads] failed to record read of item ${newsItemId}:`, err);
  }
}

/** Days of history shown in the Insights activity chart. */
const INSIGHTS_DAYS = 14;

/** Aggregate one user's reading history for the Insights page. */
export async function getReadingInsights(userId: number): Promise<InsightsDTO> {
  const mine = eq(reads.userId, userId);
  const count = sql<number>`count(*)::int`;
  const topicExpr = sql<string>`coalesce(${newsItems.topic}, 'General')`;
  const categoryExpr = sql<string>`coalesce(${sources.category}, 'Other')`;
  const dayExpr = sql<string>`to_char(${reads.createdAt} at time zone 'utc', 'YYYY-MM-DD')`;

  const [totals, topics, categories, topSources, daily, recent] = await Promise.all([
    db
      .select({
        storiesRead: count,
        totalOpens: sql<number>`coalesce(sum(${reads.readCount}), 0)::int`,
        readsThisWeek: sql<number>`(count(*) filter (where ${reads.createdAt} > now() - interval '7 days'))::int`,
        firstReadAt: sql<Date | null>`min(${reads.createdAt})`,
      })
      .from(reads)
      .where(mine),
    db
      .select({ topic: topicExpr, count })
      .from(reads)
      .innerJoin(newsItems, eq(reads.newsItemId, newsItems.id))
      .where(mine)
      .groupBy(topicExpr)
      .orderBy(desc(count)),
    db
      .select({ category: categoryExpr, count })
      .from(reads)
      .innerJoin(newsItems, eq(reads.newsItemId, newsItems.id))
      .leftJoin(sources, eq(newsItems.sourceId, sources.id))
      .where(mine)
      .groupBy(categoryExpr)
      .orderBy(desc(count)),
    db
      .select({ source: sources.name, count })
      .from(reads)
      .innerJoin(newsItems, eq(reads.newsItemId, newsItems.id))
      .innerJoin(sources, eq(newsItems.sourceId, sources.id))
      .where(mine)
      .groupBy(sources.name)
      .orderBy(desc(count))
      .limit(6),
    db
      .select({ day: dayExpr, count })
      .from(reads)
      .where(and(mine, gt(reads.createdAt, new Date(Date.now() - INSIGHTS_DAYS * 86_400_000))))
      .groupBy(dayExpr),
    db
      .select({
        id: newsItems.id,
        title: newsItems.title,
        topic: newsItems.topic,
        sourceName: sources.name,
        lastReadAt: reads.lastReadAt,
      })
      .from(reads)
      .innerJoin(newsItems, eq(reads.newsItemId, newsItems.id))
      .leftJoin(sources, eq(newsItems.sourceId, sources.id))
      .where(mine)
      .orderBy(desc(reads.lastReadAt))
      .limit(6),
  ]);

  // Zero-fill the activity window so the chart shows quiet days too.
  const byDay = new Map(daily.map((d) => [d.day, d.count]));
  const days: { day: string; count: number }[] = [];
  for (let i = INSIGHTS_DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day, count: byDay.get(day) ?? 0 });
  }

  const t = totals[0];
  return {
    storiesRead: t?.storiesRead ?? 0,
    totalOpens: t?.totalOpens ?? 0,
    readsThisWeek: t?.readsThisWeek ?? 0,
    firstReadAt: t?.firstReadAt ? new Date(t.firstReadAt).toISOString() : null,
    topics,
    categories,
    sources: topSources,
    daily: days,
    recent: recent.map((r) => ({
      ...r,
      title: decodeEntities(r.title),
      lastReadAt: new Date(r.lastReadAt).toISOString(),
    })),
  };
}

/** Single article for the in-site reader (includes extraction cache fields). */
export async function getArticle(id: number, userId: number): Promise<ArticleDTO | null> {
  const rows = await db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      url: newsItems.url,
      imageUrl: newsItems.imageUrl,
      author: newsItems.author,
      publishedAt: newsItems.publishedAt,
      fetchedAt: newsItems.fetchedAt,
      topic: newsItems.topic,
      entities: newsItems.entities,
      tags: newsItems.tags,
      impactScore: newsItems.impactScore,
      isDuplicate: newsItems.isDuplicate,
      clusterId: newsItems.clusterId,
      sourceName: sources.name,
      sourceCategory: sources.category,
      sourceTopic: sources.topic,
      siteUrl: sources.siteUrl,
      isFavorite: sql<boolean>`${favorites.id} is not null`,
      rawContent: newsItems.rawContent,
      extractedContent: newsItems.extractedContent,
      extractionStatus: newsItems.extractionStatus,
      extractedAt: newsItems.extractedAt,
      spectrum: newsItems.spectrum,
      spectrumAt: newsItems.spectrumAt,
    })
    .from(newsItems)
    .leftJoin(sources, eq(newsItems.sourceId, sources.id))
    .leftJoin(favorites, and(eq(favorites.newsItemId, newsItems.id), eq(favorites.userId, userId)))
    .where(eq(newsItems.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    // Rows ingested before entity decoding may hold raw &#8217;-style entities.
    title: decodeEntities(r.title),
    summary: r.summary ? decodeEntities(r.summary) : r.summary,
    rawContent: r.rawContent ? decodeEntities(r.rawContent) : r.rawContent,
    entities: (r.entities as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    fetchedAt: new Date(r.fetchedAt).toISOString(),
    extractedAt: r.extractedAt ? new Date(r.extractedAt).toISOString() : null,
    spectrumAt: r.spectrumAt ? new Date(r.spectrumAt).toISOString() : null,
  };
}
