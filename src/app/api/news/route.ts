import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/db/user";
import { jsonOk, withErrorHandling } from "@/lib/http";
import type { SortOption } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** GET /api/news — filtered, sorted, deduped feed. */
export const GET = withErrorHandling("GET /api/news", async (req: NextRequest) => {
  const userId = await getCurrentUserId();
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);

  const items = await getFeed({
    userId,
    q: sp.get("q") || undefined,
    sourceId: num("sourceId"),
    topic: sp.get("topic") || undefined,
    category: sp.get("category") || undefined,
    sort: (sp.get("sort") as SortOption) || "date",
    includeDuplicates: sp.get("includeDuplicates") === "true",
    favoritesOnly: sp.get("favoritesOnly") === "true",
    limit: num("limit"),
    offset: num("offset"),
    days: num("days"),
  });

  return jsonOk({ items, count: items.length });
});
