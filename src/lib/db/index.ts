import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ainews";

// Reuse a single connection across HMR reloads in dev to avoid exhausting the pool.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

/**
 * `prepare: false` is required when connecting through Supabase's transaction
 * pooler (PgBouncer, port 6543). It is harmless for a direct/local connection.
 */
export const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idle_timeout: 30,
    connect_timeout: 12,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });

export * as schema from "./schema";
