import type { NextRequest } from "next/server";
import { z } from "zod";
import { getArticle } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { generateLinkedInPost } from "@/lib/ai/openai";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";
import { stripHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ newsItemId: z.number().int().positive() });

/**
 * POST /api/share/linkedin — draft a LinkedIn post analyzing an article.
 * Body: { newsItemId }. Returns { post, aiGenerated }.
 */
export const POST = withErrorHandling("POST /api/share/linkedin", async (req: NextRequest) => {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Expected { newsItemId: number }", 422);

  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);

  const article = await getArticle(parsed.data.newsItemId, user.id);
  if (!article) return jsonError("Article not found", 404);

  // Best available body text: extracted blocks, else the feed excerpt.
  const content =
    article.extractedContent?.map((b) => b.text).join("\n\n") || stripHtml(article.rawContent);

  const result = await generateLinkedInPost({
    title: article.title,
    summary: article.summary,
    content,
    sourceName: article.sourceName ?? "the publisher",
    topic: article.topic,
  });
  return jsonOk(result);
});
