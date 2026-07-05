import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { getFeed } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/favorites — the current user's saved items. */
export const GET = withErrorHandling("GET /api/favorites", async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);
  const sort = (req.nextUrl.searchParams.get("sort") as "date" | "impact" | "source") || "date";
  const items = await getFeed({ userId: user.id, favoritesOnly: true, includeDuplicates: true, sort });
  return jsonOk({ items, count: items.length });
});

const AddSchema = z.object({ newsItemId: z.number().int().positive() });

/** POST /api/favorites — save an item. Body: { newsItemId }. */
export const POST = withErrorHandling("POST /api/favorites", async (req: NextRequest) => {
  const parsed = AddSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Expected { newsItemId: number }", 422);

  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);
  const [row] = await db
    .insert(favorites)
    .values({ userId: user.id, newsItemId: parsed.data.newsItemId })
    .onConflictDoNothing({ target: [favorites.userId, favorites.newsItemId] })
    .returning();

  return jsonOk({ ok: true, favorited: true, favorite: row ?? null });
});
