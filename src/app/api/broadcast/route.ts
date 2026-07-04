import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { newsItems, sources, favorites, broadcastLogs } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/db/user";
import { generateBroadcastContent } from "@/lib/ai/openai";
import { deliver } from "@/lib/broadcast";
import { BROADCAST_PLATFORMS } from "@/lib/constants";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

const BroadcastSchema = z.object({
  newsItemId: z.number().int().positive(),
  platform: z.enum(BROADCAST_PLATFORMS),
  recipient: z.string().max(300).optional(),
  content: z.string().max(6000).optional(), // client may pass edited content
});

/** POST /api/broadcast — generate share content, (mock) deliver it, and log it. */
export const POST = withErrorHandling("POST /api/broadcast", async (req: NextRequest) => {
  const parsed = BroadcastSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid body", 422);
  const { newsItemId, platform, recipient, content: provided } = parsed.data;

  const userId = await getCurrentUserId();

  const [item] = await db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      url: newsItems.url,
      entities: newsItems.entities,
      sourceName: sources.name,
    })
    .from(newsItems)
    .leftJoin(sources, eq(newsItems.sourceId, sources.id))
    .where(eq(newsItems.id, newsItemId))
    .limit(1);
  if (!item) return jsonError("News item not found", 404);

  const [fav] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.newsItemId, newsItemId)))
    .limit(1);

  const content =
    provided ??
    (await generateBroadcastContent(platform, {
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceName: item.sourceName,
      entities: (item.entities as string[]) ?? [],
    }));

  const result = await deliver(platform, content, item.url, recipient);

  const [log] = await db
    .insert(broadcastLogs)
    .values({
      favoriteId: fav?.id ?? null,
      newsItemId,
      userId,
      platform,
      content,
      recipient: result.recipient,
      status: result.status,
    })
    .returning();

  return jsonOk({ ok: true, result, content, log });
});

/** GET /api/broadcast — recent broadcast history (for the activity panel). */
export const GET = withErrorHandling("GET /api/broadcast", async (req: NextRequest) => {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const rows = await db
    .select({
      id: broadcastLogs.id,
      platform: broadcastLogs.platform,
      status: broadcastLogs.status,
      content: broadcastLogs.content,
      createdAt: broadcastLogs.createdAt,
      title: newsItems.title,
      url: newsItems.url,
    })
    .from(broadcastLogs)
    .leftJoin(newsItems, eq(broadcastLogs.newsItemId, newsItems.id))
    .orderBy(desc(broadcastLogs.createdAt))
    .limit(Math.min(limit, 100));
  return jsonOk({ logs: rows });
});
