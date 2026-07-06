-- 0004_politics_rename — the "World & Politics" topic is now just "Politics".
-- Topic display strings are stored verbatim (see src/lib/topics.ts), so every
-- stored copy of the old name must be rewritten: source topics, item topics,
-- item tags (ingest copies the topic into tags), and users' ordered
-- preferred_topics arrays (text-level replace keeps the priority order).

UPDATE sources SET topic = 'Politics' WHERE topic = 'World & Politics';

UPDATE news_items SET topic = 'Politics' WHERE topic = 'World & Politics';

UPDATE news_items
SET tags = replace(tags::text, '"World & Politics"', '"Politics"')::jsonb
WHERE tags::text LIKE '%"World & Politics"%';

UPDATE users
SET preferred_topics = replace(preferred_topics::text, '"World & Politics"', '"Politics"')::jsonb
WHERE preferred_topics::text LIKE '%"World & Politics"%';
