-- 0000_init — initial schema for the AI News Dashboard.
-- Applied by `npm run db:migrate` (see src/lib/db/migrate.ts).
-- The `vector` extension and the HNSW similarity index are handled by the
-- migrator around this file, so plain Postgres users can read the DDL cleanly.

-- ── sources ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sources (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  url           text NOT NULL,
  site_url      text,
  type          text NOT NULL DEFAULT 'rss',
  category      text NOT NULL DEFAULT 'Media',
  weight        real NOT NULL DEFAULT 1,
  active        boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz,
  last_status   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_url_idx ON sources (url);

-- ── news_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_items (
  id            serial PRIMARY KEY,
  source_id     integer REFERENCES sources(id) ON DELETE SET NULL,
  title         text NOT NULL,
  summary       text,
  raw_content   text,
  author        text,
  url           text NOT NULL,
  canonical_url text NOT NULL,
  image_url     text,
  published_at  timestamptz,
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  tags          jsonb DEFAULT '[]'::jsonb,
  entities      jsonb DEFAULT '[]'::jsonb,
  topic         text,
  impact_score  real NOT NULL DEFAULT 0,
  cluster_id    uuid,
  is_duplicate  boolean NOT NULL DEFAULT false,
  embedding     vector(1536),
  enriched      boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS news_canonical_idx ON news_items (canonical_url);
CREATE INDEX IF NOT EXISTS news_published_idx ON news_items (published_at);
CREATE INDEX IF NOT EXISTS news_cluster_idx ON news_items (cluster_id);
CREATE INDEX IF NOT EXISTS news_impact_idx ON news_items (impact_score);

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- ── favorites ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id           serial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  news_item_id integer NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_item_idx ON favorites (user_id, news_item_id);

-- ── broadcast_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id           serial PRIMARY KEY,
  favorite_id  integer REFERENCES favorites(id) ON DELETE SET NULL,
  news_item_id integer NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  user_id      integer REFERENCES users(id) ON DELETE SET NULL,
  platform     text NOT NULL,
  content      text,
  recipient    text,
  status       text NOT NULL DEFAULT 'sent',
  created_at   timestamptz NOT NULL DEFAULT now()
);
