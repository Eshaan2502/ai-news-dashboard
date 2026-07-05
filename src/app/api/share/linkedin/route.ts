import type { NextRequest } from "next/server";
import { z } from "zod";
import { getArticle } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/db/user";
import { generateLinkedInPost } from "@/lib/ai/openai";
import { jsonOk, jsonError, withErrorHandling } from "@/lib/http";
import { stripHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    newsItemId: z.number().int().positive(),
    // Optional revision: adjust an existing draft per the reader's instruction.
    instruction: z.string().trim().min(1).max(500).optional(),
    draft: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((b) => (b.instruction === undefined) === (b.draft === undefined), {
    message: "instruction and draft must be sent together",
  });

/**
 * POST /api/share/linkedin — draft a LinkedIn post analyzing an article, or
 * revise a draft. Body: { newsItemId, instruction?, draft? }.
 * Returns { post, aiGenerated }.
 */
export const POST = withErrorHandling("POST /api/share/linkedin", async (req: NextRequest) => {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return jsonError("Expected { newsItemId: number, instruction?: string, draft?: string }", 422);

  const user = await getCurrentUser();
  if (!user) return jsonError("Not signed in", 401);

  const article = await getArticle(parsed.data.newsItemId, user.id);
  if (!article) return jsonError("Article not found", 404);

  // Best available body text: extracted blocks, else the feed excerpt.
  const content =
    article.extractedContent?.map((b) => b.text).join("\n\n") || stripHtml(article.rawContent);

  const { instruction, draft } = parsed.data;
  const result = await generateLinkedInPost({
    title: article.title,
    summary: article.summary,
    content,
    sourceName: article.sourceName ?? "the publisher",
    topic: article.topic,
    revision: instruction && draft ? { instruction, draft } : undefined,
  });
  return jsonOk(result);
});
