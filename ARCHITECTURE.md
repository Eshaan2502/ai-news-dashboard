# Architecture

This document explains the system design, data flow, the deduplication algorithm,
impact scoring, and the key engineering decisions & trade-offs.

## 1. Overview

A single **Next.js 16 (App Router, TypeScript)** application provides the frontend, the REST
API, and the ingestion logic; a small **worker** process runs the same ingestion on a
schedule. State lives in **PostgreSQL + pgvector**. **OpenAI** powers summarization,
entity/topic extraction, broadcast copy, and the embeddings used for semantic dedup.

Choosing one cohesive full-stack app over a separate frontend + backend was deliberate for
an MVP built and defended by one person: less operational surface, shared types end-to-end,
and every evaluation dimension (ingestion → DB → API → UI → broadcast) still cleanly layered.

```
Sources ──▶ Ingestion pipeline ──▶ Postgres+pgvector ──▶ API routes ──▶ React dashboard
  (RSS)     fetch/normalize/          (Drizzle ORM)       (REST)         Feed · Favorites
            embed/dedup/enrich/score                                     Broadcast → channels
```

## 2. Layers

### Ingestion (`src/lib/ingest`)
- **`sources.ts`** — 22 registered feeds with `category` and `weight` (authority bias).
- **`fetcher.ts`** — fetches raw XML with a real User-Agent, timeout and redirect handling
  (Reddit/YouTube reject default agents), then parses with `rss-parser`. Never throws —
  returns a tagged `{ ok, items } | { ok:false, error }`, so one bad feed can't fail the run.
- **`normalize.ts`** — → `{ title, url, canonicalUrl, author, publishedAt, rawContent,
  imageUrl }`; HTML-stripped, date-parsed, image extracted from media/enclosure/`<img>`.
- **`dedup.ts`** — in-memory near-duplicate detector (see §4).
- **`score.ts`** — impact score (see §5).
- **`run.ts`** — orchestrates a full pass with bounded concurrency and returns run stats.

### Data (`src/lib/db`)
Drizzle schema + a transparent SQL migrator (`migrate.ts` applies `drizzle/*.sql`, ensures the
`vector` extension and a cosine **HNSW** index), an idempotent seed, and typed query helpers
(`queries.ts`) for the feed, sources, topics and stats.

### API (`src/app/api`)
Thin route handlers over the query/command helpers. All are `force-dynamic` (live data). A
`triggerIngestion` **server action** backs the in-app Refresh button; `POST /api/ingest`
(secret-protected) backs the external worker/cron.

### Frontend (`src/app`, `src/components`)
Server components fetch initial data directly from the query layer (no self-fetch); client
components (`FeedView`, `FilterBar`, `NewsCard`, `BroadcastModal`, `InsightsPanel`) handle
interaction, calling the API via `lib/client-api.ts`. Optimistic favoriting, debounced
filtering, and toast confirmations.

### Broadcast (`src/lib/broadcast`)
Delivery is mocked (no keys required) but returns **real deep links** (`wa.me`, LinkedIn
share, `mailto:`). Every attempt is written to `broadcast_logs`. Swapping in SendGrid / the
LinkedIn API / WhatsApp Business is a one-function change in `deliver()`.

## 3. Data flow (an ingestion pass)

1. Load active sources + a skip-set of known canonical URLs + a 14-day dedup index.
2. **Fetch** all feeds concurrently (limit 6); record per-source `last_status`.
3. **Normalize**; drop items already seen (by canonical URL) this run or in the DB.
4. **Embed** each novel candidate (`text-embedding-3-small`) — cheap; enables semantic dedup.
5. **Classify** sequentially against the index → `cluster_id` + `is_duplicate` (order matters
   so intra-run duplicates cluster correctly).
6. **Enrich** the top `ENRICH_LIMIT` canonical items with one JSON LLM call each; the rest get
   deterministic fallbacks.
7. **Score** and **insert** (`onConflictDoNothing` on canonical URL as a final guard).

## 4. Deduplication & clustering

Goal: ≥0.9 precision, plus grouping the same story across sources.

```
for each candidate (canonical URL not already stored):
    best = null
    for each item in rolling 14-day index (+ items accepted earlier this run):
        if jaccard(titleTokens(candidate), titleTokens(item)) ≥ 0.82:  best = max(best, …)
        if candidate.embedding and item.embedding
           and cosine(candidate, item) ≥ 0.88:                          best = max(best, …)
    if best:  clusterId = best.clusterId; isDuplicate = true
    else:     clusterId = new uuid;       isDuplicate = false
    index.push(candidate)   # so later candidates can match it
```

- **URL canonicalization** first removes trivial dupes (tracking params, fragments, trailing
  slash) for free and is enforced by a unique index.
- **Two thresholds** give high precision: fuzzy title catches re-posts with tweaked wording;
  cosine catches semantically identical stories with different headlines.
- The feed shows only canonical items by default; `clusterSize` surfaces an "N sources" badge.
  A toggle reveals near-duplicates.
- **Graceful degradation:** with no OpenAI key there are no embeddings, so dedup uses URL +
  fuzzy title only — still effective, just less semantic.

## 5. Impact scoring

```
impact = 0.6 · model_newsworthiness(0-100)
       + source_authority(0-20)   // from source weight 0.8–1.6
       + recency(0-20)            // 20 ≤6h, 14 ≤24h, 8 ≤3d, 4 ≤7d, else 2
```
Blends editorial judgment (the LLM), source trust, and freshness. Drives default sorting and
the dashboard charts. Fully deterministic when AI is off (newsworthiness defaults to 50).

## 6. Data model

`sources` (feeds + status) · `news_items` (content, `embedding vector(1536)`, `cluster_id`,
`is_duplicate`, `impact_score`, `entities`) · `favorites` (unique per user+item) ·
`broadcast_logs` (platform, content, status) · `users` (single demo user in the MVP).
Indexes on canonical URL (unique), published_at, cluster_id, impact_score, and an HNSW cosine
index on `embedding`.

## 7. Key decisions & trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| One Next.js app vs FE + Python backend | Fewer moving parts, shared types, faster to ship & defend | Less "classic microservice" separation |
| Postgres + pgvector (Supabase) | One store for relational + vectors; managed | Vector search adds an extension dependency |
| In-memory dedup index per run | Simple, deterministic, testable; avoids N vector round-trips | Rebuilds each run (fine at MVP scale; would move to ANN queries later) |
| Mocked delivery + real deep links | Meets the brief with zero secrets, yet buttons actually work | Not a true server-side send |
| Bounded LLM enrichment (`ENRICH_LIMIT`) | Predictable cost/latency | Lower-ranked items get extractive summaries |
| Graceful AI fallback | App is fully runnable & demoable without a key | Fallback summaries are less polished |

## 8. Scaling notes (beyond MVP)

Move dedup to pgvector ANN queries (HNSW is already indexed) instead of loading the window
into memory; push ingestion onto a queue (Redis/BullMQ) with per-source workers; add real
auth to replace the single demo user; cache `/api/stats`; and add retry/backoff + per-source
scheduling. The layering above is designed so each of these is a localized change.
