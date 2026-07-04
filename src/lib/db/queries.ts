import { and, asc, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { newsItems, sources, favorites, broadcastLogs } from "./schema";
import type { SortOption } from "../constants";
import type { FeedItemDTO, SourceDTO, Stats } from "../types";

export type { FeedItemDTO, SourceDTO, Stats };

export type FeedParams = {
  userId: number;
  q?: string;
  sourceId?: number;
  topic?: string;
  category?: string;
  sort?: SortOption;
  includeDuplicates?: boolean;
  favoritesOnly?: boolean;
  limit?: number;
  offset?: number;
  days?: number;
};

/** Main feed query — powers both the Feed and Favorites pages. */
export async function getFeed(p: FeedParams): Promise<FeedItemDTO[]> {
  const conds: SQL[] = [];
  if (!p.includeDuplicates) conds.push(eq(newsItems.isDuplicate, false));
  if (p.sourceId) conds.push(eq(newsItems.sourceId, p.sourceId));
  if (p.topic) conds.push(eq(newsItems.topic, p.topic));
  if (p.category) conds.push(eq(sources.category, p.category));
  if (p.days) conds.push(gt(newsItems.fetchedAt, new Date(Date.now() - p.days * 86_400_000)));
  if (p.q) {
    const like = `%${p.q}%`;
    conds.push(or(ilike(newsItems.title, like), ilike(newsItems.summary, like))!);
  }

  const orderBy =
    p.sort === "impact"
      ? [desc(newsItems.impactScore), desc(newsItems.publishedAt)]
      : p.sort === "source"
        ? [asc(sources.name), desc(newsItems.publishedAt)]
        : [desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`)];

  let qb = db
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
      clusterSize: sql<number>`(
        select count(*)::int from news_items ni where ni.cluster_id = ${newsItems.clusterId}
      )`,
      sourceName: sources.name,
      sourceCategory: sources.category,
      siteUrl: sources.siteUrl,
      isFavorite: sql<boolean>`${favorites.id} is not null`,
    })
    .from(newsItems)
    .leftJoin(sources, eq(newsItems.sourceId, sources.id))
    .$dynamic();

  const favJoin = and(eq(favorites.newsItemId, newsItems.id), eq(favorites.userId, p.userId));
  qb = p.favoritesOnly ? qb.innerJoin(favorites, favJoin) : qb.leftJoin(favorites, favJoin);

  const rows = await qb
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(p.limit ?? 60)
    .offset(p.offset ?? 0);

  return rows.map((r) => ({
    ...r,
    entities: (r.entities as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    fetchedAt: new Date(r.fetchedAt).toISOString(),
    clusterSize: Number(r.clusterSize ?? 1),
  }));
}

/** Sources with item counts — for the filter bar and admin view. */
export async function getSources(): Promise<SourceDTO[]> {
  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      category: sources.category,
      active: sources.active,
      lastStatus: sources.lastStatus,
      lastFetchedAt: sources.lastFetchedAt,
      itemCount: sql<number>`(
        select count(*)::int from news_items ni where ni.source_id = ${sources.id} and ni.is_duplicate = false
      )`,
    })
    .from(sources)
    .orderBy(asc(sources.name));
  return rows.map((r) => ({
    ...r,
    lastFetchedAt: r.lastFetchedAt ? new Date(r.lastFetchedAt).toISOString() : null,
    itemCount: Number(r.itemCount ?? 0),
  }));
}

/** Distinct topics present in the feed (for the topic filter). */
export async function getTopics(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ topic: newsItems.topic })
    .from(newsItems)
    .where(and(eq(newsItems.isDuplicate, false), sql`${newsItems.topic} is not null`));
  return rows.map((r) => r.topic!).filter(Boolean).sort();
}

/** Aggregate metrics for the dashboard header + charts (the "Creativity" points). */
export async function getStats(): Promise<Stats> {
  const [totalsRow] = await db
    .select({
      items: sql<number>`count(*) filter (where is_duplicate = false)::int`,
      duplicates: sql<number>`count(*) filter (where is_duplicate = true)::int`,
      avgImpact: sql<number>`coalesce(avg(impact_score) filter (where is_duplicate = false), 0)`,
    })
    .from(newsItems);

  const [srcCount] = await db
    .select({ n: sql<number>`count(*) filter (where active = true)::int` })
    .from(sources);
  const [favCount] = await db.select({ n: sql<number>`count(*)::int` }).from(favorites);
  const [bcCount] = await db.select({ n: sql<number>`count(*)::int` }).from(broadcastLogs);

  const bySource = await db.execute(sql`
    select s.name as name, count(*)::int as count
    from news_items ni join sources s on s.id = ni.source_id
    where ni.is_duplicate = false
    group by s.name order by count desc limit 8
  `);

  const byTopic = await db.execute(sql`
    select coalesce(topic, 'General') as topic, count(*)::int as count
    from news_items where is_duplicate = false
    group by topic order by count desc limit 8
  `);

  const byCategory = await db.execute(sql`
    select s.category as category, count(*)::int as count
    from news_items ni join sources s on s.id = ni.source_id
    where ni.is_duplicate = false
    group by s.category order by count desc
  `);

  const byDay = await db.execute(sql`
    select to_char(date_trunc('day', coalesce(published_at, fetched_at)), 'YYYY-MM-DD') as day,
           count(*)::int as count
    from news_items
    where is_duplicate = false and coalesce(published_at, fetched_at) > now() - interval '14 days'
    group by day order by day asc
  `);

  const items = Number(totalsRow?.items ?? 0);
  const duplicates = Number(totalsRow?.duplicates ?? 0);
  const denom = items + duplicates;

  return {
    totals: {
      items,
      sources: Number(srcCount?.n ?? 0),
      favorites: Number(favCount?.n ?? 0),
      broadcasts: Number(bcCount?.n ?? 0),
      duplicates,
    },
    dedupRate: denom ? Number((duplicates / denom).toFixed(3)) : 0,
    avgImpact: Math.round(Number(totalsRow?.avgImpact ?? 0)),
    bySource: (bySource as unknown as { name: string; count: number }[]).map((r) => ({
      name: r.name,
      count: Number(r.count),
    })),
    byTopic: (byTopic as unknown as { topic: string; count: number }[]).map((r) => ({
      topic: r.topic,
      count: Number(r.count),
    })),
    byCategory: (byCategory as unknown as { category: string; count: number }[]).map((r) => ({
      category: r.category,
      count: Number(r.count),
    })),
    byDay: (byDay as unknown as { day: string; count: number }[]).map((r) => ({
      day: r.day,
      count: Number(r.count),
    })),
  };
}
