import type { NextRequest } from "next/server";
import { getFeed, getFeedByIds } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";
import { ingestWebResults, searchWebNews } from "@/lib/websearch";
import type { SortOption } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** GET /api/news — filtered, sorted, deduped feed. */
export const GET = withErrorHandling("GET /api/news", async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  const q = sp.get("q") || undefined;

  let items = await getFeed({
    userId: user.id,
    q,
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

  // The corpus has nothing for an explicit query — search the web live and
  // ingest the hits so they come back as first-class articles (reader page,
  // favorites, sharing) and future searches find them in the corpus directly.
  let webSearched = false;
  if (q && items.length === 0) {
    webSearched = true;
    const ids = await ingestWebResults(await searchWebNews(q, num("limit") ?? 10));
    if (ids.length) items = await getFeedByIds(ids, user.id);
  }

  return jsonOk({ items, count: items.length, webSearched });
});
