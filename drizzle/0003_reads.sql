-- 0003_reads — per-user reading history powering the Insights page.
-- One row per user+item: the first open inserts it, re-opens bump
-- read_count and last_read_at (see recordRead in src/lib/db/queries.ts).

CREATE TABLE IF NOT EXISTS reads (
  id           serial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  news_item_id integer NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  read_count   integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reads_user_item_idx ON reads (user_id, news_item_id);
CREATE INDEX IF NOT EXISTS reads_user_idx ON reads (user_id);
