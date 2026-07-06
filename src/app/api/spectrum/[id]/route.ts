import { getArticle } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { getOrBuildSpectrum } from "@/lib/spectrum";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

// Corpus lookups are fast, but a cold build also runs a live web search,
// ingest (embed + enrich per new hit), and the analysis call.
export const maxDuration = 60;

/**
 * GET /api/spectrum/:id — the Full Spectrum for one article: same-story
 * coverage from other outlets with AI framing labels. Built on first request,
 * cached on the news_items row after that.
 */
export const GET = withErrorHandling(
  "GET /api/spectrum/[id]",
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const newsItemId = Number(id);
    if (!Number.isInteger(newsItemId) || newsItemId <= 0) return jsonError("Invalid id", 422);

    const user = await getCurrentUser();
    if (!user) return jsonError("Not signed in", 401);

    const article = await getArticle(newsItemId, user.id);
    if (!article) return jsonError("Article not found", 404);

    return jsonOk(await getOrBuildSpectrum(article));
  },
);
