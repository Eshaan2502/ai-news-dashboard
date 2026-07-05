-- 0001_spectrum — Spectrum overhaul: source topics, guest/Google users,
-- ordered topic preferences, and cached full-text extraction for the reader.

-- sources: deterministic topic per feed (one of the 8 fixed Spectrum topics)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'Technology';

-- users: guest identity + Google profile + ordered topic prefs
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_topics jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_guest_id_idx ON users (guest_id);

-- news_items: cached full-text extraction for the in-site reader
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS extracted_content jsonb;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS extracted_at timestamptz;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS extraction_status text;
CREATE INDEX IF NOT EXISTS news_topic_idx ON news_items (topic);
