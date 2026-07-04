import type { NextRequest } from "next/server";
import { runIngestion } from "@/lib/ingest/run";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // ingestion can take a while; allow up to 5 min where supported

/**
 * POST /api/ingest — trigger an ingestion pass. Protected by INGEST_SECRET so
 * the external cron worker can call it. The in-app "Refresh" button uses the
 * server action instead (see src/app/actions.ts), which needs no secret.
 */
export const POST = withErrorHandling("POST /api/ingest", async (req: NextRequest) => {
  const secret = process.env.INGEST_SECRET;
  const provided = req.headers.get("x-ingest-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret && provided !== secret) return jsonError("Unauthorized", 401);

  const stats = await runIngestion();
  return jsonOk({ ok: true, stats });
});
