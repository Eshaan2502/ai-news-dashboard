# 🗞️ Spectrum — News without the tunnel vision

A personalized news reader that **aggregates ~70 sources across 8 topics** (AI, Technology,
Politics, Business & Finance, Science, Sports, Entertainment, Health),
**deduplicates & clusters** related stories, **summarizes them with AI**, and lays out a
front page ordered by **your topic priorities** — with every article readable **on the site
itself** via server-side full-text extraction, and every story explorable **across
outlets** via the Full Spectrum panel.

Built as a single full-stack app: **Next.js 16 (App Router, TypeScript) · PostgreSQL +
pgvector · Auth.js (Google + guest) · OpenAI · Docker · Railway/Supabase-ready.**

---

## ✨ Features

| Feature | How it works |
|---|---|
| Guest or Google sign-in | Auth.js v5. Guests get a device-scoped identity (httpOnly cookie + DB row) — no account needed. Signing in with Google later migrates a guest's topics & saved stories automatically. |
| Personalized front page | Onboarding topic picker with **priority ordering** — the order you choose is the order rows appear. Editable anytime in Settings. |
| Trending row | The most talked-about stories of the last 48h — ranked by a blend of how many outlets covered each story's cluster, its impact score, and how recently new coverage landed, soft-capped per topic. Ongoing stories surface their newest headline. |
| In-site article reader | Cards never link out. `/article/[id]` shows the AI summary instantly, then streams the full text — fetched from the publisher and extracted with Mozilla Readability, cached in Postgres, rendered as plain text blocks (no raw HTML → no XSS). Falls back to the feed excerpt when a publisher blocks extraction. |
| AI enrichment | OpenAI `gpt-4o-mini` writes a ≤45-word neutral summary + entities + newsworthiness per story at ingest time, and files it under one of the 8 topics (world/all-content feeds carry off-topic stories; the source topic is only the fallback). Cost-capped by `ENRICH_LIMIT`; runs fine without a key (extractive fallback). |
| Dedup / clustering | URL canonicalization → fuzzy title (Jaccard) → semantic cosine via pgvector embeddings. |
| Search that never dead-ends | Hybrid **keyword + semantic** search — the query is embedded, so "Cricket" finds "T20 World Cup" stories. Zero corpus hits → a **live Bing News search** whose results are ingested through the normal pipeline and come back as first-class articles (reader page, save, share). |
| Full Spectrum | Each article page gathers the **same story from other outlets** (dedup cluster mates + vector neighbors + live web search) and `gpt-4o-mini` labels the lens each outlet views it through, plus a "common ground / where they split" summary. Cached per article. |
| Share | WhatsApp and email open prefilled via real deep links; LinkedIn opens an **AI-drafted post** you can edit by hand or revise by instruction before posting. No third-party send APIs, no secrets. |
| Reading Insights | Every article you open is logged (per user); `/insights` charts your topic mix, outlet categories, top sources, and a 14-day reading rhythm. |
| Saved stories | Star any card; persisted per user (guest or Google) with optimistic UI. |

---

## 🚀 Quick start

### Option A — Docker (one command)

```bash
cp .env.example .env          # fill in DATABASE_URL etc. (see table below)
docker compose up --build     # → http://localhost:3000
```

### Option B — Local dev (Node 20.9+)

```bash
npm install
cp .env.example .env          # set DATABASE_URL (+ OPENAI_API_KEY, AUTH_SECRET)

# Postgres with pgvector: use Supabase, or spin one up locally:
docker compose up -d db

npm run db:migrate            # create schema (+ pgvector, HNSW index)
npm run db:seed               # register the 78-feed source registry (~70 active)
npm run ingest                # pull live news now
npm run dev                   # → http://localhost:3000
```

> **No OpenAI key?** Everything still runs — summaries fall back to extractive text and
> dedup degrades to URL + fuzzy-title matching.
> **No Google OAuth credentials?** The Google button shows as "not configured";
> **Continue as guest** works fully without any setup.

---

## ⚙️ Configuration (`.env`)

All secrets live in `.env`, which is **git-ignored** — never commit real values.
`.env.example` documents every variable.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URI. Supabase: use the **Transaction pooler** (port 6543). |
| `DIRECT_URL` | Optional session-mode URI (port 5432) for migrations/DDL. |
| `AUTH_SECRET` | Signs session JWTs. Generate with `npx auth secret` or any 32+ char random string. |
| `AUTH_URL` | Public base URL of the deployed site (e.g. `https://app.up.railway.app`). **Required in production** so OAuth callbacks/redirects use the right host behind the proxy; unneeded locally. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (see **Google sign-in setup** below). Blank = guest-only. |
| `OPENAI_API_KEY` | Enables real summaries & semantic dedup. Blank = fallback mode. |
| `OPENAI_MODEL` / `OPENAI_EMBED_MODEL` | Defaults: `gpt-4o-mini` / `text-embedding-3-small`. |
| `INGEST_ITEMS_PER_SOURCE` | Max items pulled per feed per run (default 15). |
| `ENRICH_LIMIT` | Max new items sent to the LLM per run — cost guard (default 80). |
| `DEDUP_TITLE_THRESHOLD` / `DEDUP_COSINE_THRESHOLD` | Dedup sensitivity (0.82 / 0.88). |
| `MIN_IMPACT_SCORE` | Importance floor for browsing views — stories scoring below it are hidden (default 45, `0` disables). Search, source drill-downs, and Favorites are never gated. |
| `SEARCH_MAX_DISTANCE` | Cosine-distance ceiling for semantic search hits (default 0.7). |
| `SPECTRUM_MAX_DISTANCE` | Same-story distance ceiling for the Full Spectrum panel — tighter than search (default 0.5). |
| `READER_PROXY` | Set to `off` to disable the r.jina.ai fallback for JS-only pages and keep extraction first-party. |
| `JINA_API_KEY` | Optional key for the reader proxy — raises its rate limits; works keyless. |
| `INGEST_INTERVAL_MINUTES` | Worker cadence (default 15). |
| `INGEST_SECRET` | Auth for `POST /api/ingest` (worker/cron path). **Set a real value in production.** |

---

## 🔐 Google sign-in setup

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) →
   **Create credentials → OAuth client ID → Web application**.
2. Add **Authorized redirect URIs** (one per environment):
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://<your-production-domain>/api/auth/callback/google` (deployed site)
3. Put the client ID/secret in `.env` locally and in your host's environment variables in
   production.
4. So that *anyone* can sign in (not just you): OAuth consent screen → **Publish app**
   (Testing mode only allows listed test users).

---

## ☁️ Deploy (Railway + Supabase)

1. **Supabase** → create a project → Database → Extensions → enable **`vector`**. Copy the
   **Transaction pooler** connection string.
2. **Railway** → New Project → Deploy from this repo (uses the `Dockerfile`). Set env vars:
   `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (your public Railway URL),
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `INGEST_SECRET`.
   Migrations + seed run automatically on boot.
3. Add your Railway domain as a Google OAuth redirect URI (step 2 above) and publish the
   consent screen.
4. Scheduled ingestion is **built in**: the web service starts an in-process scheduler on
   boot (`src/instrumentation.ts`) that ingests every `INGEST_INTERVAL_MINUTES` (default 15).
   *(Optional)* to split it out instead, add a second Railway service from the same repo with
   start command `npm run worker` (set `RUN_MIGRATIONS=false` there and
   `INGEST_INTERVAL_MINUTES=0` on the web service) — or use Railway Cron to
   `POST /api/ingest` with the `x-ingest-secret` header.

Production notes: sessions are JWT (no session table needed); the guest cookie is
`Secure` + `httpOnly` in production; ingestion runs server-side on a schedule — no
user-facing trigger — so anonymous traffic can't run up LLM costs.

---

## 🔌 API

| Method & path | Description |
|---|---|
| `GET /api/news` | Feed (requires guest/Google identity). Query: `q, sourceId, topic, sort, includeDuplicates, favoritesOnly, days, limit, offset`. When `q` has zero corpus hits the API falls back to live web search and flags the response `webSearched: true`. |
| `GET /api/favorites` · `POST` · `DELETE /api/favorites/:newsItemId` | List / add / remove saved stories |
| `GET /api/spectrum/:id` | Same-story coverage from other outlets with AI lens labels (cached per article) |
| `POST /api/share/linkedin` | Draft — or, with `{ draft, instruction }`, revise — a LinkedIn post for an article |
| `GET/POST /api/auth/*` | Auth.js (Google OAuth) routes |
| `POST /api/ingest` | Trigger an ingestion pass (needs `x-ingest-secret`) |

---

## 🗄️ Database schema

`sources` (with a fixed `topic` per feed), `news_items` (with `embedding vector(1536)`,
`cluster_id`, `impact_score`, the reader's `extracted_content` cache, and the `spectrum`
cache), `users` (guests + Google accounts, `preferred_topics` = ordered priority list),
`favorites`, `reads` (per-user read log behind the Insights page).
DDL: the five migrations in [`drizzle/`](./drizzle) (`0000_init.sql` …
`0004_politics_rename.sql`); Drizzle model:
[`src/lib/db/schema.ts`](./src/lib/db/schema.ts).

Architecture write-up: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## 📁 Project structure

```
src/
├─ app/
│  ├─ welcome/               # landing: guest / Google sign-in (+ server actions)
│  ├─ onboarding/            # topic picker with priority ordering
│  ├─ (app)/                 # signed-in chrome (masthead)
│  │  ├─ page.tsx            # front page: search + Trending + priority-ordered topic rows
│  │  ├─ article/[id]/       # in-site reader + Full Spectrum + share
│  │  ├─ favorites/ · insights/ · settings/
│  ├─ api/{news,favorites,spectrum,share,ingest,auth}/
├─ components/               # Masthead, TopicSection, HorizontalRow, NewsCard, SearchSection,
│                            # ArticleBody, SpectrumPanel, ShareActions, InsightsCharts,
│                            # TopicPicker, FavoriteButton, ui/*
├─ lib/
│  ├─ auth.ts                # Auth.js config (Google, JWT, guest→Google migration)
│  ├─ extract.ts             # full-text extraction: Readability → AMP → reader proxy (cached)
│  ├─ websearch.ts           # live Bing News search + ingest-results-as-articles fallback
│  ├─ spectrum.ts            # same-story coverage gathering for the Full Spectrum panel
│  ├─ topics.ts              # the 8-topic taxonomy, label aliases, colors
│  ├─ db/                    # schema, client, queries, user resolution, migrate, seed
│  ├─ ingest/                # sources registry, scheduler, fetcher, normalize, dedup, score, run
│  └─ ai/openai.ts           # enrichment, embeddings, LinkedIn drafts, spectrum analysis (+ fallbacks)
└─ worker/index.ts           # standalone ingestion worker (optional split deployment)
```

## 📜 Scripts

`dev` · `build` · `start` · `db:migrate` · `db:seed` · `db:setup` · `ingest` · `worker` · `lint`
