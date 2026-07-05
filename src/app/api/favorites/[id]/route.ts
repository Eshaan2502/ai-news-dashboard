import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { jsonOk, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** DELETE /api/favorites/:newsItemId — remove a saved item (id is the news_item id). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const newsItemId = Number(id);
    if (!Number.isInteger(newsItemId)) return jsonError("Invalid id", 422);

    const user = await getCurrentUser();
    if (!user) return jsonError("Not signed in", 401);
    await db
      .delete(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.newsItemId, newsItemId)));

    return jsonOk({ ok: true, favorited: false });
  } catch (err) {
    console.error("[DELETE /api/favorites/:id]", err);
    return jsonError("Internal server error", 500);
  }
}
