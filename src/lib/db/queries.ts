import { and, asc, desc, eq, gt, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "./index";
import { newsItems, sources, favorites } from "./schema";
import type { SortOption } from "../constants";
import type { ArticleDTO, FeedItemDTO } from "../types";

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
      sourceName: sources.name,
      sourceCategory: sources.category,
      sourceTopic: sources.topic,
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
  }));
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
    entities: (r.entities as string[]) ?? [],
    tags: (r.tags as string[]) ?? [],
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    fetchedAt: new Date(r.fetchedAt).toISOString(),
    extractedAt: r.extractedAt ? new Date(r.extractedAt).toISOString() : null,
  };
}
