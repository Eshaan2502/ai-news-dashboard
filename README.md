# 🧠 AI News Aggregation & Broadcasting Dashboard

An MVP that **aggregates AI news from 20+ sources**, **deduplicates & clusters** related
stories, **ranks them by impact**, and lets you **favorite** items and **broadcast** them to
Email / LinkedIn / WhatsApp / Blog / Newsletter with **AI-generated, channel-tailored copy**.

Built as a single, cohesive full-stack app: **Next.js 16 (App Router, TypeScript) · PostgreSQL + pgvector · OpenAI · Docker · Railway/Supabase-ready.**

---

## ✨ What it does (mapped to the BRD)

| BRD requirement | How it's met |
|---|---|
| Aggregate from ≥20 high-signal sources | 26 registered feeds (~22 actively ingesting): OpenAI, DeepMind, Google AI, HuggingFace, NVIDIA, AWS ML, arXiv ×3, BAIR, TechCrunch, Ars Technica, The Verge, Reddit, HN, YouTube… — fetched concurrently and resiliently. A few BRD-named sources (Anthropic, Meta AI, Stability) publish no public RSS and are registered but inactive. |
| Normalize (title, summary, author, date, url) | `src/lib/ingest/normalize.ts` — HTML-stripped, date-parsed, image-extracted |
| Deduplicate (≥0.9 precision) + cluster | Hybrid: URL canonicalization → fuzzy title (Jaccard) → **semantic cosine via embeddings**; near-dupes share a `cluster_id` |
| AI summarization / captioning | OpenAI `gpt-4o-mini` for summaries, entities, topic & impact; per-channel broadcast copy |
| Dashboard: feed + favorites, sortable, filters | Feed & Favorites pages; search, source/topic filters, sort by date/impact/source |
| Favorites persisted in DB | `favorites` table, optimistic UI |
| Broadcast (Email/LinkedIn/WhatsApp…) | Mocked delivery **+ real deep links** (`wa.me`, LinkedIn share, `mailto:`); every send logged to `broadcast_logs` |
| ≤3 clicks to broadcast | Card → Broadcast → pick channel (2 clicks) |
| Charts / insights / entity chips (Creativity) | KPI tiles, 3 validated charts, impact meters, entity chips, dedup badges |
| Deployment-ready, Dockerized | `Dockerfile` + `docker-compose.yml` (app + pgvector + worker) + `railway.json` |

---

## 🏗️ Architecture

```
                    ┌──────────────── 22 RSS / API sources ────────────────┐
                    │ OpenAI · DeepMind · Anthropic · HF · arXiv · TC · … │
                    └───────────────────────┬──────────────────────────────┘
                                             │  scheduled (worker) / on-demand (Refresh)
                            ┌────────────────▼─────────────────┐
                            │  Ingestion pipeline (src/lib/ingest) │
                            │  fetch → normalize → embed →         │
                            │  dedup/cluster → AI-enrich → score   │
                            └────────────────┬─────────────────┘
                                             │
                     ┌───────────────────────▼───────────────────────┐
                     │      PostgreSQL + pgvector (Supabase)          │
                     │  sources · news_items · favorites ·           │
                     │  broadcast_logs · users                        │
                     └───────────────────────┬───────────────────────┘
                                             │  Drizzle ORM
                     ┌───────────────────────▼───────────────────────┐
                     │   Next.js API routes  (/api/news, /favorites,  │
                     │   /broadcast, /ingest, /stats, /sources)       │
                     └───────────────────────┬───────────────────────┘
                                             │
                     ┌───────────────────────▼───────────────────────┐
                     │   React dashboard (Feed · Favorites · Charts)  │
                     │            Broadcast → Email/LinkedIn/WhatsApp │
                     └────────────────────────────────────────────────┘
```

Full write-up incl. the dedup algorithm & scoring: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## 🚀 Quick start

### Option A — Docker (one command; recommended)

Requires Docker Desktop. Brings up Postgres (pgvector) + the app, runs migrations, seeds
demo data, and starts serving.

```bash
cp .env.example .env          # then paste your OPENAI_API_KEY (optional — works without it)
docker compose up --build     # → http://localhost:3000
```

To also run the scheduled ingestion worker:

```bash
docker compose --profile worker up --build
```

### Option B — Local dev (Node 20.9+)

```bash
npm install
cp .env.example .env          # set DATABASE_URL + OPENAI_API_KEY

# Postgres with pgvector: use Supabase, or spin one up locally:
docker compose up -d db

npm run db:migrate            # create schema (+ pgvector, HNSW index)
npm run db:seed               # 22 sources + demo user + demo articles
npm run ingest                # (optional) pull live news now
npm run dev                   # → http://localhost:3000
```

> **No OpenAI key?** Everything still runs — summaries fall back to extractive text,
> broadcast copy uses clean templates, and dedup degrades to URL + fuzzy-title matching.

---

## ⚙️ Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URI. Supabase: use the **Transaction pooler** (port 6543). |
| `OPENAI_API_KEY` | Enables real summaries, captions & semantic dedup. Blank = fallback mode. |
| `OPENAI_MODEL` | Chat model (default `gpt-4o-mini`). |
| `OPENAI_EMBED_MODEL` | Embeddings (default `text-embedding-3-small`, 1536-dim). |
| `INGEST_ITEMS_PER_SOURCE` | Max items pulled per feed per run (default 15). |
| `ENRICH_LIMIT` | Max new items sent to the LLM per run — cost guard (default 40). |
| `DEDUP_TITLE_THRESHOLD` / `DEDUP_COSINE_THRESHOLD` | Dedup sensitivity (0.82 / 0.88). |
| `INGEST_INTERVAL_MINUTES` | Worker cadence (default 15). |
| `INGEST_SECRET` | Auth for `POST /api/ingest` (the worker/cron path). |

---

## 🔌 API

| Method & path | Description |
|---|---|
| `GET /api/news` | Feed. Query: `q, sourceId, topic, category, sort, includeDuplicates, favoritesOnly, days, limit, offset` |
| `GET /api/favorites` · `POST` · `DELETE /api/favorites/:newsItemId` | List / add / remove favorites |
| `POST /api/broadcast` | Generate channel copy, (mock) deliver, log. Body: `{ newsItemId, platform, recipient?, content? }` |
| `GET /api/broadcast` | Recent broadcast history |
| `GET /api/stats` | KPI totals + chart aggregates (by day / source / topic / category) |
| `GET /api/sources` | Registered sources (+ counts) and topics |
| `POST /api/ingest` | Trigger an ingestion pass (needs `x-ingest-secret`) |

---

## 🗄️ Database schema

`sources`, `news_items` (with `embedding vector(1536)`, `cluster_id`, `is_duplicate`,
`impact_score`), `favorites`, `broadcast_logs`, `users`. DDL lives in
[`drizzle/0000_init.sql`](./drizzle/0000_init.sql); the Drizzle model is
[`src/lib/db/schema.ts`](./src/lib/db/schema.ts).

---

## 🧠 How dedup, AI & scoring work (short version)

- **Dedup / clustering** — for each new item: canonicalize the URL (drop `utm_*`, sort
  params), then compare against a rolling 14-day index by **fuzzy title (Jaccard ≥ 0.82)**
  and **embedding cosine (≥ 0.88)**. A match inherits the matched item's `cluster_id` and is
  flagged `is_duplicate`; the feed shows one canonical card with an "N sources" badge.
- **AI enrichment** — the top items per run (bounded by `ENRICH_LIMIT`) get a 1-2 sentence
  summary, up to 6 entities, a topic label, and a 0-100 newsworthiness estimate in a single
  JSON call.
- **Impact score** = `0.6 × model_newsworthiness + source_authority(0-20) + recency(0-20)`,
  used for sorting and the charts.

---

## 📁 Project structure

```
src/
├─ app/                     # pages (Feed, Favorites), API routes, server action
│  ├─ api/{news,favorites,broadcast,ingest,stats,sources}/
│  ├─ page.tsx · favorites/page.tsx · layout.tsx · actions.ts
├─ components/              # NavBar, FeedView, NewsCard, FilterBar, BroadcastModal,
│  │                        # StatTiles, InsightsPanel (charts), ui/*
├─ lib/
│  ├─ db/                   # schema, client, queries, migrate, seed, demo-data
│  ├─ ingest/               # sources, fetcher, normalize, dedup, score, run, cli
│  ├─ ai/openai.ts          # summaries, captions, embeddings (+ fallbacks)
│  ├─ broadcast/            # mocked delivery + real deep links
│  └─ utils · types · constants · ui · client-api · http
└─ worker/index.ts          # scheduled ingestion loop
drizzle/0000_init.sql · Dockerfile · docker-compose.yml · railway.json
```

## 📜 Scripts

`dev` · `build` · `start` · `db:migrate` · `db:seed` · `db:setup` · `ingest` · `worker` · `lint`

---

## ☁️ Deploy (Railway + Supabase)

1. **Supabase** → create a project → Database → Extensions → enable **`vector`**. Copy the
   **Transaction pooler** connection string.
2. **Railway** → New Project → Deploy from repo (it uses the `Dockerfile`). Set env vars:
   `DATABASE_URL` (Supabase pooler URI), `OPENAI_API_KEY`, `INGEST_SECRET`. On boot the
   container runs migrations + seed automatically.
3. *(Optional)* add a second Railway service from the same repo with start command
   `npm run worker` (set `RUN_MIGRATIONS=false`) for scheduled ingestion — or use Railway
   Cron to `POST /api/ingest` with the `x-ingest-secret` header.

---

## ✅ Acceptance criteria

- [x] Working dashboard with real **and** mocked news (demo seed + live ingestion)
- [x] Favorites system functioning (persisted, optimistic)
- [x] Broadcast actions simulated (Email/LinkedIn/WhatsApp) with confirmations + real deep links
- [x] Clean architecture explanation ([ARCHITECTURE.md](./ARCHITECTURE.md))
- [x] Deployment instructions included
- [x] Runs via Docker (`docker compose up --build`)
