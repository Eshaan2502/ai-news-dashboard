import { getStats } from "@/lib/db/queries";
import { jsonOk, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/stats — aggregate metrics for the dashboard header + charts. */
export const GET = withErrorHandling("GET /api/stats", async () => {
  const stats = await getStats();
  return jsonOk(stats);
});
