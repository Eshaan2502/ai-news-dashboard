# Architecture

This document explains the system design, data flow, the deduplication algorithm,
impact scoring & trending, search, and the key engineering decisions & trade-offs.

## 1. Overview

A single **Next.js 16 (App Router, TypeScript)** application provides the frontend, the REST
API, and the ingestion logic — and keeps itself fresh: an in-process scheduler started at
boot (`src/instrumentation.ts`) re-ingests every 15 minutes. A standalone **worker** process
can run the same loop instead for split deployments. State lives in **PostgreSQL +
pgvector**. **OpenAI** powers summarization, entity extraction, taxonomy classification,
LinkedIn post drafts, the Spectrum lens analysis, and the embeddings used for semantic
dedup and semantic search.

Choosing one cohesive full-stack app over a separate frontend + backend was deliberate for
an MVP built and defended by one person: less operational surface, shared types end-to-end,
and every evaluation dimension (ingestion → DB → API → UI → share) still cleanly layered.

```
RSS feeds ───────▶ Ingestion pipeline ──▶ Postgres+pgvector ──▶ API routes ──▶ React dashboard
Bing News ───┘     fetch/normalize/          (Drizzle ORM)        (REST)        Front page · Reader
(live search /     embed/dedup/enrich/score                                     Spectrum · Insights
 spectrum fallback)                                                              Share → channels
```

## 2. Layers

### Ingestion (`src/lib/ingest`)
- **`sources.ts`** — 78 registered feeds (69 active) with `category` and `weight` (authority
  bias), spanning all 8 topics — primary sources (OpenAI, NASA, WHO), research outlets
  (Nature, Science, arXiv, MIT), and established media (BBC, NYT, The Economist, FT,
  Washington Post). Every feed URL is verified against the real fetcher before activation;
  dead ones are parked with `active: false`. A source's `topic` is only the item's
  *default* — enrichment can refile a story under a different taxonomy topic (see §3),
  which is what keeps world/all-content desks from dumping off-topic items into one row.
- **`scheduler.ts`** — the shared non-overlapping ingestion loop (run now, then every
  `INGEST_INTERVAL_MINUTES`), started in-process by `src/instrumentation.ts` on server boot
  and by `src/worker/index.ts` in split deployments.
- **`fetcher.ts`** — fetches raw XML with a real User-Agent, timeout and redirect handling
  (Reddit/YouTube reject default agents), then parses with `rss-parser`. Never throws —
  returns a tagged `{ ok, items } | { ok:false, error }`, so one bad feed can't fail the run.
- **`normalize.ts`** — → `{ title, url, canonicalUrl, author, publishedAt, rawContent,
  fullBlocks, imageUrl }`; HTML-stripped, date-parsed, image extracted from
  media/enclosure/`<img>`. When the feed ships the whole article in `content:encoded`
  (WordPress and most company blogs), it is parsed into reader blocks (`fullBlocks`) and
  stored as the pre-filled reader cache (`extraction_status = "feed"`) — those articles
  never need scraping.
- **`dedup.ts`** — in-memory near-duplicate detector (see §4).
- **`score.ts`** — impact score (see §5).
- **`run.ts`** — orchestrates a full pass with bounded concurrency and returns run stats.

### Data (`src/lib/db`)
Drizzle schema + a transparent SQL migrator (`migrate.ts` applies `drizzle/*.sql`, ensures the
`vector` extension and a cosine **HNSW** index), an idempotent seed, and typed query helpers
(`queries.ts`) for the feed, sources, topics and stats.

### API (`src/app/api`)
Thin route handlers over the query/command helpers. All are `force-dynamic` (live data).
`POST /api/ingest` (secret-protected) is the manual/external override; routine ingestion
runs on the in-process schedule.

### Frontend (`src/app`, `src/components`)
Server components fetch initial data directly from the query layer (no self-fetch): the
front page renders search + Trending + the user's priority-ordered topic rows
(`TopicSection`/`HorizontalRow`), plus `/article/[id]`, `/favorites`, `/insights`, and
`/settings`. Client components (`SearchSection`, `NewsCard`, `FavoriteButton`,
`ShareActions`, `SpectrumPanel`) handle interaction, calling the API via
`lib/client-api.ts`. Optimistic favoriting, debounced search, and toast confirmations.

### Reader (`src/lib/extract.ts`)
The in-site reader never links out. Articles whose feed shipped full text are pre-filled at
ingest; everything else is extracted on first open, with three strategies in order:
**Mozilla Readability** on the publisher's HTML → the page's **AMP variant** (static HTML
that parses where the canonical page is script-rendered) → the **r.jina.ai reader proxy**
for JS-only pages (disable with `READER_PROXY=off`; optional `JINA_API_KEY` raises its rate
limits). Results are cached on the `news_items` row as plain text blocks — no raw HTML
reaches the client, so no XSS surface — and failures fall back to the feed excerpt and are
retried after 24 h.

### Search (`src/lib/db/queries.ts`, `src/lib/websearch.ts`)
Free-text search is **hybrid**: a keyword pass (title, summary, enriched entities/tags)
OR'd with a semantic pass that embeds the query and pulls items within
`SEARCH_MAX_DISTANCE` cosine distance (default 0.7) — that's what lets "Cricket" surface
"T20 World Cup" stories that never contain the literal word. While a query is active,
relevance ordering overrides the browse sort; without an OpenAI key it degrades to
keyword-only. When the corpus has **zero hits**, the API searches **Bing News' public RSS
endpoint** live (free, keyless) and ingests the hits through the regular pipeline (embed +
enrich + insert), so web results come back as first-class articles — reader page,
favorites, sharing — and future searches find them in the corpus directly. Each web
publisher gets an inert `web:<host>` source row (`active: false`, so the scheduler never
touches it) purely so cards can show the outlet name. Bing over Google News because its
links carry the real publisher URL (Google's redirect tokens can't be resolved
server-side), which the reader needs for extraction.

### Share (`src/components/ShareActions.tsx`)
No third-party send API (no WhatsApp Business, no SendGrid, no LinkedIn posting API) — every
channel is a **real deep link** the reader completes themselves: `wa.me` and `mailto:` open
prefilled WhatsApp/email directly, and LinkedIn opens a modal with a real AI-drafted post
(`POST /api/share/linkedin` → `generateLinkedInPost()` in `src/lib/ai/openai.ts`, an actual
`gpt-4o-mini` call) plus a copy-to-clipboard fallback for mobile. The draft is editable by
hand *or* by instruction — the same endpoint accepts `{ draft, instruction }` and has the
model revise the reader's current draft while staying grounded in the article. Nothing is
logged server-side today.

### Full Spectrum (`src/lib/spectrum.ts`, `src/components/SpectrumPanel.tsx`)
The article page's "explore perspectives" panel — same-story coverage from other outlets,
each labeled with the lens it views the story through. `GET /api/spectrum/:id` gathers
candidates from two places: the corpus (dedup **cluster mates** — near-duplicates from other
feeds are by definition the same story — plus pgvector neighbors within
`SPECTRUM_MAX_DISTANCE`, default 0.5) and a **live Bing News search** reusing the search
fallback's ingest pipeline, so web hits become first-class articles with reader pages. One
story per outlet, capped at 8. A single `gpt-4o-mini` call (`analyzeSpectrum()`) then acts as
both relevance filter and analyst: it drops unrelated candidates, assigns each survivor a 2–5
word lens label + one-line angle, and writes a "common ground" / "where they split" summary.
Keyless fallback lists the coverage unlabeled. Results cache on the `news_items` row
(`spectrum`, `spectrum_at`) like reader extraction; sparse or keyless results rebuild hourly,
complete ones are kept.

### Reading Insights (`src/app/(app)/insights`, `src/components/InsightsCharts.tsx`)
Opening an article upserts a row in `reads` (first open inserts; re-opens bump
`read_count`/`last_read_at`). Recording happens server-side in the article page and
swallows errors — tracking must never break the reader. `/insights` aggregates one user's
history in SQL (no client fetching): a topic donut, a source-category split
(Media/Company/Research/Community), top outlets, a 14-day activity chart, and the recent
trail.

## 3. Data flow (an ingestion pass)

1. Load active sources + a skip-set of known canonical URLs + a 14-day dedup index.
2. **Fetch** all feeds concurrently (limit 6); record per-source `last_status`.
3. **Normalize**; drop items already seen (by canonical URL) this run or in the DB, then drop
   junk (`heuristics.ts`: shopping deals, sponsored posts, puzzle hints, horoscopes, stubs)
   before spending anything on them.
4. **Embed** each novel candidate (`text-embedding-3-small`) — cheap; enables semantic dedup.
5. **Classify** sequentially against the index → `cluster_id` + `is_duplicate` (order matters
   so intra-run duplicates cluster correctly).
6. **Enrich** the top `ENRICH_LIMIT` canonical items with one JSON LLM call each — summary,
   entities, newsworthiness, and a **taxonomy category**: when the model files the story
   under one of the 8 Spectrum topics, that wins over the source's default topic (a
   `TOPIC_ALIASES` map in `topics.ts` conservatively normalizes near-miss labels; anything
   unmappable keeps the source topic). The rest get deterministic fallbacks (heuristic
   newsworthiness — not a flat score).
7. **Score** and **insert** (`onConflictDoNothing` on canonical URL as a final guard).

At read time, browsing views (home rows, topic feeds) apply an importance floor
(`MIN_IMPACT_SCORE`, default 45) so low-impact filler never reaches the page; explicit
lookups — search, a chosen source, Favorites — bypass the floor.

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
- **Two thresholds** give high precision: fuzzy title (Jaccard over content words —
  stopwords are filtered so filler variations can't dilute a match) catches re-posts with
  tweaked wording; cosine catches semantically identical stories with different headlines.
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

## 6. Trending

The front-page strip ranks **stories, not articles**: a story is a dedup cluster (or a lone
item), and it trends when multiple outlets land articles on it inside the 48 h window — not
merely because the model scored one article highly.

```
story_score = (coverage − 1) · 15        # distinct outlets in the window
            + 0.6 · max(impact_score)    # best article's impact
            + freshness (24 → 0)         # linear decay since the story last moved
```

Coverage ≥ 2 is importance evidence in its own right, so multi-outlet stories bypass the
impact floor that gates single-article ones. Each story displays through its canonical row
while that row is inside the window, and through its **newest article** once it isn't — an
ongoing story trends under its latest headline, not the one from when it broke. Finally a
soft per-topic cap (⌈limit/3⌉, min 2, with spillover backfill) keeps one busy news desk
from filling the strip. The `coverage` count surfaces on cards as the "N sources" badge.

## 7. Data model

`sources` (feeds + status, fixed `topic` per feed) · `news_items` (content, `topic`,
`embedding vector(1536)`, `cluster_id`, `is_duplicate`, `impact_score`, `entities`, plus the
reader cache `extracted_content` and the `spectrum` cache) · `users` (guests + Google
accounts, `preferred_topics` = ordered priority list) · `favorites` (unique per user+item) ·
`reads` (per-user read log: unique user+item, `read_count`, `last_read_at`). Indexes on
canonical URL (unique), published_at, cluster_id, impact_score, and an HNSW cosine index on
`embedding`. Migrations: `drizzle/0000_init.sql` … `0004_politics_rename.sql`, applied by
the transparent migrator. A `broadcast_logs` table exists in the initial migration but is
unused by the app — a leftover from an earlier design; drop it or wire up real logging in
`ShareActions`.

## 8. Key decisions & trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| One Next.js app vs FE + Python backend | Fewer moving parts, shared types, faster to ship & defend | Less "classic microservice" separation |
| Postgres + pgvector (Supabase) | One store for relational + vectors; managed | Vector search adds an extension dependency |
| In-memory dedup index per run | Simple, deterministic, testable; avoids N vector round-trips | Rebuilds each run (fine at MVP scale; would move to ANN queries later) |
| Mocked delivery + real deep links | Meets the brief with zero secrets, yet buttons actually work | Not a true server-side send |
| Bounded LLM enrichment (`ENRICH_LIMIT`) | Predictable cost/latency | Lower-ranked items get extractive summaries |
| Graceful AI fallback | App is fully runnable & demoable without a key | Fallback summaries are less polished |
| Keyless Bing News RSS for search/spectrum fallback | Free, no API key, and links carry the real publisher URL (Google News redirect tokens can't be resolved server-side) | Unofficial endpoint — could change without notice; guarded by timeouts and never-throw wrappers |

## 9. Scaling notes (beyond MVP)

Move dedup to pgvector ANN queries (HNSW is already indexed) instead of loading the window
into memory; push ingestion onto a queue (Redis/BullMQ) with per-source workers; add
retry/backoff + per-source scheduling; and log shares server-side (the `broadcast_logs`
table is waiting). The layering above is designed so each of these is a localized change.
