import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ExternalLink, Sparkles } from "lucide-react";
import { getArticle } from "@/lib/db/queries";
import { requireOnboardedUser } from "@/lib/db/user";
import { topicColor } from "@/lib/ui";
import { ArticleBody, ReaderSkeleton } from "@/components/ArticleBody";
import { FavoriteButton } from "@/components/FavoriteButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The in-site reader. The header (title, byline, AI summary) renders
 * instantly from the database; the full body streams in behind Suspense
 * while extraction runs on first view.
 */
export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const newsItemId = Number(id);
  if (!Number.isInteger(newsItemId) || newsItemId <= 0) notFound();

  const article = await getArticle(newsItemId, user.id);
  if (!article) notFound();

  const published = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <article className="mx-auto max-w-2xl">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {article.sourceName ?? "Unknown source"}
          <span className="mx-1.5 text-border-strong">·</span>
          <span style={{ color: topicColor(article.topic) }}>{article.topic ?? "General"}</span>
        </p>
        <h1 className="mt-3 font-serif text-3xl font-black leading-tight text-foreground sm:text-4xl">
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-4 text-sm text-muted-foreground">
          <span>
            {article.author ? `By ${article.author}` : "Staff report"}
            {published ? ` · ${published}` : ""}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <FavoriteButton newsItemId={article.id} initialFavorite={article.isFavorite} />
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              title="View the original on the publisher's site"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View original
            </a>
          </span>
        </div>
      </header>

      {article.summary && (
        <aside className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            AI summary
          </p>
          <p className="font-serif text-base italic leading-relaxed text-foreground">
            {article.summary}
          </p>
        </aside>
      )}

      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary publisher domains
        <img
          src={article.imageUrl}
          alt=""
          className="mt-6 w-full rounded-lg border border-border object-cover"
        />
      )}

      <div className="mt-8">
        <Suspense fallback={<ReaderSkeleton />}>
          <ArticleBody article={article} />
        </Suspense>
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Reported by {article.sourceName ?? "the publisher"} — Spectrum shows this story in-place
        with an AI-generated summary.{" "}
        <a href={article.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          Read the original
        </a>
        .
      </footer>
    </article>
  );
}
