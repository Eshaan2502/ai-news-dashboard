import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Lightweight, transparent migrator — applies every `*.sql` file in ./drizzle
 * in filename order, tracking applied files in a `_migrations` table so it is
 * safe to re-run. It also ensures the pgvector extension exists (needed by the
 * embedding column) and creates the cosine HNSW index afterwards.
 *
 * Run with: npm run db:migrate
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");

  const sql = postgres(url, { max: 1, prepare: false });

  console.log("→ Ensuring pgvector extension…");
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  } catch (e) {
    console.warn(
      "⚠ Could not create the 'vector' extension — semantic dedup will be disabled.\n" +
        "  On Supabase, enable it under Database → Extensions → 'vector'.",
      e instanceof Error ? e.message : e,
    );
  }

  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const dir = join(process.cwd(), "drizzle");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const appliedRows = await sql<{ id: string }[]>`SELECT id FROM _migrations`;
  const applied = new Set(appliedRows.map((r) => r.id));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  • ${file} (already applied)`);
      continue;
    }
    const contents = await readFile(join(dir, file), "utf8");
    console.log(`  → applying ${file}`);
    await sql.unsafe(contents); // multi-statement DDL, no params
    await sql`INSERT INTO _migrations (id) VALUES (${file})`;
  }

  console.log("→ Ensuring vector similarity index…");
  try {
    await sql`CREATE INDEX IF NOT EXISTS news_embedding_idx
              ON news_items USING hnsw (embedding vector_cosine_ops)`;
  } catch (e) {
    console.warn("⚠ Skipped HNSW index (older pgvector?):", e instanceof Error ? e.message : e);
  }

  console.log("✓ Database schema is ready.");
  await sql.end();
}

main().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
