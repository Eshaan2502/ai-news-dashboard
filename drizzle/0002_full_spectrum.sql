-- 0002_full_spectrum — cached "Full Spectrum" perspective analysis per story:
-- coverage of the same event from other outlets (corpus + live web search),
-- each labeled with its framing by the AI. Built on first request, then cached.

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS spectrum jsonb;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS spectrum_at timestamptz;
