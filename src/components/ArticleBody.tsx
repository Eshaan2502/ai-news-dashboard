import { ExternalLink, Lock } from "lucide-react";
import { getOrExtractContent } from "@/lib/extract";
import type { ArticleDTO } from "@/lib/types";

/**
 * Async server component: streams in the full article text (extracting on
 * first view). Fallback chain: extracted body → "publisher doesn't provide
 * access" notice with a link out + feed preview → AI summary already shown above.
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
  const host = hostnameOf(article.url);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <strong>{article.sourceName ?? "This publisher"}</strong> doesn&apos;t provide access
            to the full article outside their own site
            {excerpt ? " — here's the preview they share, and the full story is one click away" : ""}
            .
          </span>
        </p>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Read the full article on {host}
        </a>
      </div>
      {excerpt && (
        <>
          <p className="pt-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            Preview from the publisher&apos;s feed
          </p>
          {excerpt
            .split(/\n{2,}/)
            .filter((para) => para.trim())
            .map((para, i) => (
              <p key={i} className="leading-relaxed text-foreground">
                {para.trim()}
              </p>
            ))}
        </>
      )}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the publisher's site";
  }
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
