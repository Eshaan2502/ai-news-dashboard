import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { newsItems, sources } from "./db/schema";
import { analyzeSpectrum, type SpectrumCoverageItem } from "./ai/openai";
import { ingestWebResults, searchWebNews } from "./websearch";
import { canonicalizeUrl, decodeEntities, toVectorLiteral } from "./utils";
import type { ArticleDTO, SpectrumAnalysis, SpectrumPerspective } from "./types";

/**
 * Full Spectrum — "news without the tunnel vision" made literal. For one
 * article, gather coverage of the same story from other outlets and let the
 * AI label the lens each one views it through. Candidates come from two
 * places, cheapest first:
 *
 *   1. The corpus: dedup cluster mates (near-duplicates from other feeds are
 *      by definition the same story) plus pgvector nearest neighbors.
 *   2. The live web: the same Bing News search + ingest pipeline the search
 *      fallback uses, so every web hit becomes a first-class article with its
 *      own in-site reader page.
 *
 * The AI pass (analyzeSpectrum) doubles as the relevance filter — loosely
 * related candidates that survive the distance threshold get dropped there.
 * Results are cached on the news_items row like reader extraction is.
 */

/** Same-story cosine distance ceiling — tighter than search's topical 0.7. */
const MAX_DISTANCE = Number(process.env.SPECTRUM_MAX_DISTANCE ?? 0.5);

/** Most perspectives shown; also caps what the AI pass has to judge. */
const MAX_PERSPECTIVES = 8;

const NEIGHBOR_LIMIT = 12;
const WEB_LIMIT = 10;

/** Sparse or keyless results get rebuilt after an hour; full ones are kept. */
const REFRESH_INCOMPLETE_MS = 60 * 60 * 1000;

type Candidate = {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  canonicalUrl: string;
  publishedAt: Date | string | null;
  sourceName: string | null;
};

/**
 * Cache-through accessor used by the API route: returns the stored analysis
 * when it's complete (AI-labeled with at least one perspective), rebuilds
 * hourly otherwise so new coverage and a newly configured API key get picked up.
 */
export async function getOrBuildSpectrum(article: ArticleDTO): Promise<SpectrumAnalysis> {
  const cached = article.spectrum;
  if (cached) {
    const complete = cached.aiGenerated && cached.perspectives.length > 0;
    const age = article.spectrumAt
      ? Date.now() - new Date(article.spectrumAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (complete || age < REFRESH_INCOMPLETE_MS) return cached;
  }

  const analysis = await buildSpectrum(article);
  await db
    .update(newsItems)
    .set({ spectrum: analysis, spectrumAt: new Date() })
    .where(eq(newsItems.id, article.id));
  return analysis;
}

async function buildSpectrum(article: ArticleDTO): Promise<SpectrumAnalysis> {
  const [corpus, web] = await Promise.all([corpusCandidates(article), webCandidates(article)]);

  // Merge, keeping corpus (higher-precision) hits first and one story per
  // outlet — the point is breadth of voices, not depth per publisher.
  const originalCanonical = canonicalizeUrl(article.url);
  const originalSource = article.sourceName?.toLowerCase() ?? null;
  const seenIds = new Set<number>([article.id]);
  const seenSources = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of [...corpus, ...web]) {
    if (candidates.length >= MAX_PERSPECTIVES) break;
    const source = (c.sourceName ?? hostOf(c.url)).toLowerCase();
    if (seenIds.has(c.id) || c.canonicalUrl === originalCanonical) continue;
    if (source === originalSource || seenSources.has(source)) continue;
    seenIds.add(c.id);
    seenSources.add(source);
    candidates.push(c);
  }

  const generatedAt = new Date().toISOString();
  if (!candidates.length) {
    return { overview: null, divergence: null, perspectives: [], aiGenerated: false, generatedAt };
  }

  const coverage: SpectrumCoverageItem[] = candidates.map((c) => ({
    id: c.id,
    sourceName: c.sourceName ?? hostOf(c.url),
    title: decodeEntities(c.title),
    summary: c.summary ? decodeEntities(c.summary) : null,
  }));
  const result = await analyzeSpectrum({
    original: {
      title: article.title,
      summary: article.summary,
      sourceName: article.sourceName ?? "the publisher",
    },
    coverage,
  });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const perspectives: SpectrumPerspective[] = result.perspectives.flatMap((p) => {
    const c = byId.get(p.id);
    if (!c) return [];
    return [
      {
        newsItemId: c.id,
        title: decodeEntities(c.title),
        url: c.url,
        sourceName: c.sourceName ?? hostOf(c.url),
        publishedAt: c.publishedAt ? new Date(c.publishedAt).toISOString() : null,
        label: p.label.trim(),
        angle: p.angle.trim(),
      },
    ];
  });

  return {
    overview: result.overview,
    divergence: result.divergence,
    perspectives,
    aiGenerated: result.aiGenerated,
    generatedAt,
  };
}

/** Cluster mates + embedding neighbors already in the corpus. */
async function corpusCandidates(article: ArticleDTO): Promise<Candidate[]> {
  const [row] = await db
    .select({ clusterId: newsItems.clusterId, embedding: newsItems.embedding })
    .from(newsItems)
    .where(eq(newsItems.id, article.id))
    .limit(1);
  if (!row) return [];

  const clusterMates = row.clusterId
    ? await candidateQuery()
        .where(and(ne(newsItems.id, article.id), eq(newsItems.clusterId, row.clusterId)))
        .orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
        .limit(MAX_PERSPECTIVES)
    : [];

  let neighbors: Candidate[] = [];
  if (row.embedding) {
    const vec = toVectorLiteral(row.embedding);
    const distance = sql<number>`(${newsItems.embedding} <=> ${vec}::vector)`;
    neighbors = await candidateQuery()
      .where(
        and(
          ne(newsItems.id, article.id),
          sql`${newsItems.embedding} is not null`,
          sql`${distance} < ${MAX_DISTANCE}`,
        ),
      )
      .orderBy(distance)
      .limit(NEIGHBOR_LIMIT);
  }

  return [...clusterMates, ...neighbors];
}

/**
 * Live web coverage via the existing Bing News search + ingest pipeline —
 * hits become regular news_items, so perspective cards can link to the
 * in-site reader. Never throws (searchWebNews returns [] on any failure).
 */
async function webCandidates(article: ArticleDTO): Promise<Candidate[]> {
  const originalHost = hostOf(article.url);
  const originalCanonical = canonicalizeUrl(article.url);
  const hits = (await searchWebNews(article.title, WEB_LIMIT)).filter(
    (h) => hostOf(h.url) !== originalHost && canonicalizeUrl(h.url) !== originalCanonical,
  );
  if (!hits.length) return [];

  const ids = await ingestWebResults(hits);
  if (!ids.length) return [];
  const rows = await candidateQuery().where(inArray(newsItems.id, ids));
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

function candidateQuery() {
  return db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      url: newsItems.url,
      canonicalUrl: newsItems.canonicalUrl,
      publishedAt: newsItems.publishedAt,
      sourceName: sources.name,
    })
    .from(newsItems)
    .leftJoin(sources, eq(newsItems.sourceId, sources.id))
    .$dynamic();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
