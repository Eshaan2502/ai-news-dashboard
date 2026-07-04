import { getSources, getTopics } from "@/lib/db/queries";
import { jsonOk, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/sources — registered sources (with item counts) and available topics. */
export const GET = withErrorHandling("GET /api/sources", async () => {
  const [sources, topics] = await Promise.all([getSources(), getTopics()]);
  return jsonOk({ sources, topics });
});
