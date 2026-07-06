import { ExternalLink, Lock } from "lucide-react";
import { getOrExtractContent } from "@/lib/extract";
import { polishBlocks } from "@/lib/blocks";
import type { ArticleBlock, ArticleDTO } from "@/lib/types";

/** Consecutive list items render as one <ul>; everything else stays a block. */
type Segment = { kind: "list"; items: string[] } | { kind: "block"; block: ArticleBlock };

function toSegments(blocks: ArticleBlock[]): Segment[] {
  const segments: Segment[] = [];
  for (const block of blocks) {
    const last = segments[segments.length - 1];
    if (block.type === "li" && last?.kind === "list") last.items.push(block.text);
    else if (block.type === "li") segments.push({ kind: "list", items: [block.text] });
    else segments.push({ kind: "block", block });
  }
  return segments;
}

// Newspaper drop cap on the opening paragraph, sized off the body text.
const DROP_CAP =
  "first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:font-serif first-letter:text-[3.4em] first-letter:font-black first-letter:leading-[0.78] first-letter:text-primary";

/**
 * Wire-service dateline opening the first paragraph — "SAN FRANCISCO
 * (Reuters) — …". Typeset as a kicker rather than drop-capping its first
 * letter, which would split the place name.
 */
const DATELINE = /^([A-Z][A-Z0-9.,'’ -]{1,28}[A-Z.])(\s*\([A-Za-z .]{2,24}\))?\s*[—–:-]\s+(?=\S)/;

/** Words-per-minute for the reading-time estimate shown above the body. */
const READING_WPM = 225;

/**
 * Async server component: streams in the full article text (extracting on
 * first view). Fallback chain: extracted body → "publisher doesn't provide
 * access" notice with a link out + feed preview → AI summary already shown above.
 */
export async function ArticleBody({ article }: { article: ArticleDTO }) {
  const stored = await getOrExtractContent(article);
  const blocks = stored?.length ? polishBlocks(stored, article.title) : [];

  if (blocks.length) {
    const segments = toSegments(blocks);
    const words = blocks.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
    const minutes = Math.max(1, Math.round(words / READING_WPM));
    return (
      <div>
        <p className="mb-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {minutes} min read
          <span aria-hidden className="h-px flex-1 bg-border" />
        </p>
        <div className="space-y-5 break-words font-serif-text text-[1.125rem] leading-[1.8] text-foreground">
          {segments.map((segment, i) => {
            if (segment.kind === "list") {
              return (
                <ul key={i} className="space-y-2.5 pl-1">
                  {segment.items.map((item, j) => (
                    <li key={j} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80"
                      />
                      <span className="text-pretty">{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            const { block } = segment;
            switch (block.type) {
              case "h2":
                return (
                  <h2
                    key={i}
                    className="pt-6 font-serif text-2xl font-bold leading-snug text-balance before:mb-4 before:block before:h-[3px] before:w-12 before:bg-accent/80 before:content-['']"
                  >
                    {block.text}
                  </h2>
                );
              case "h3":
                return (
                  <h3 key={i} className="pt-4 font-serif text-xl font-bold leading-snug text-balance">
                    {block.text}
                  </h3>
                );
              case "blockquote":
                return (
                  <blockquote
                    key={i}
                    className="border-l-2 border-accent py-0.5 pl-5 font-serif text-[1.25rem] italic leading-relaxed text-foreground/85"
                  >
                    {block.text}
                  </blockquote>
                );
              default: {
                const dateline = i === 0 ? block.text.match(DATELINE) : null;
                if (dateline && dateline[1].split(/\s+/).length <= 4) {
                  return (
                    <p key={i} className="text-pretty">
                      <span className="mr-1 font-sans text-[0.72em] font-bold tracking-[0.08em] text-primary">
                        {dateline[1]}
                        {dateline[2] ? ` ${dateline[2].trim()}` : ""}
                      </span>
                      <span className="text-muted">— </span>
                      {block.text.slice(dateline[0].length)}
                    </p>
                  );
                }
                const dropCap = i === 0 && /^[A-Za-z]/.test(block.text);
                return (
                  <p key={i} className={dropCap ? `text-pretty ${DROP_CAP}` : "text-pretty"}>
                    {block.text}
                  </p>
                );
              }
            }
          })}
          {/* Classic end-of-article tombstone */}
          <div aria-hidden className="flex items-center justify-center gap-3 pt-4">
            <span className="h-px w-10 bg-border-strong" />
            <span className="text-[0.55rem] leading-none text-primary">■</span>
            <span className="h-px w-10 bg-border-strong" />
          </div>
        </div>
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
              <p
                key={i}
                className="text-pretty break-words font-serif-text text-[1.125rem] leading-[1.8] text-foreground"
              >
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
