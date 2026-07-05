import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";
import type { SortOption } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** GET /api/news — filtered, sorted, deduped feed. */
export const GET = withErrorHandling("GET /api/news", async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);

  const items = await getFeed({
    userId: user.id,
    q: sp.get("q") || undefined,
    sourceId: num("sourceId"),
    topic: sp.get("topic") || undefined,
    sort: (sp.get("sort") as SortOption) || "date",
    includeDuplicates: sp.get("includeDuplicates") === "true",
    favoritesOnly: sp.get("favoritesOnly") === "true",
    limit: num("limit"),
    offset: num("offset"),
    days: num("days"),
    minImpact: num("minImpact"),
  });

  return jsonOk({ items, count: items.length });
});
