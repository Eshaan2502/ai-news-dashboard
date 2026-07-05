import { Info } from "lucide-react";
import { getOrExtractContent } from "@/lib/extract";
import type { ArticleDTO } from "@/lib/types";

/**
 * Async server component: streams in the full article text (extracting on
 * first view). Fallback chain: extracted body → RSS excerpt + notice →
 * AI summary already shown above.
 */
export async function ArticleBody({ article }: { article: ArticleDTO }) {
  const blocks = await getOrExtractContent(article);

  if (blocks?.length) {
    return (
      <div className="space-y-4">
        {blocks.map((block, i) => {
          switch (block.type) {
            case "h2":
              return (
                <h2 key={i} className="pt-2 font-serif text-2xl font-bold text-foreground">
                  {block.text}
                </h2>
              );
            case "h3":
              return (
                <h3 key={i} className="pt-1 font-serif text-xl font-bold text-foreground">
                  {block.text}
                </h3>
              );
            case "li":
              return (
                <p key={i} className="flex gap-2 pl-4 leading-relaxed text-foreground">
                  <span className="text-primary">•</span>
                  <span>{block.text}</span>
                </p>
              );
            case "blockquote":
              return (
                <blockquote
                  key={i}
                  className="border-l-2 border-primary pl-4 font-serif italic leading-relaxed text-muted"
                >
                  {block.text}
                </blockquote>
              );
            default:
              return (
                <p key={i} className="leading-relaxed text-foreground">
                  {block.text}
                </p>
              );
          }
        })}
      </div>
    );
  }

  const excerpt = article.rawContent?.trim();
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
        We couldn&apos;t load the full article from the publisher — showing the feed excerpt
        instead. The original is one click away below.
      </p>
      {excerpt ? (
        excerpt
          .split(/\n{2,}/)
          .filter((para) => para.trim())
          .map((para, i) => (
            <p key={i} className="leading-relaxed text-foreground">
              {para.trim()}
            </p>
          ))
      ) : (
        <p className="text-sm italic text-muted">
          No excerpt available for this story — the AI summary above is the short version.
        </p>
      )}
    </div>
  );
}

export function ReaderSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading article">
      {[92, 100, 96, 88, 100, 60].map((w, i) => (
        <div key={i} className="h-4 rounded bg-surface" style={{ width: `${w}%` }} />
      ))}
      <div className="pt-2 text-center text-xs text-muted-foreground">
        Fetching the full story from the publisher…
      </div>
    </div>
  );
}
