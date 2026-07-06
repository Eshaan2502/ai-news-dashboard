"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Rainbow, RefreshCw, Telescope } from "lucide-react";
import { fetchSpectrum } from "@/lib/client-api";
import { timeAgo } from "@/lib/utils";
import type { SpectrumAnalysis } from "@/lib/types";
import { Button } from "./ui/Button";

/** Oxblood → mustard → olive → slate: the "spectrum" in one thin rule. */
const SPECTRUM_BAR = "linear-gradient(90deg, #9a3b26, #b98a2f, #6b7a3f, #3f5c7a)";

/** A cached analysis worth rendering without a click. */
function isComplete(a: SpectrumAnalysis | null): a is SpectrumAnalysis {
  return Boolean(a && a.aiGenerated && a.perspectives.length > 0);
}

/**
 * Full Spectrum panel for the article page: same-story coverage from other
 * outlets, each labeled with the lens it views the story through. The
 * analysis builds on first request (corpus + live web search + AI pass) and
 * is cached server-side, so revisits render instantly via `initial`.
 */
export function SpectrumPanel({
  newsItemId,
  initial,
}: {
  newsItemId: number;
  initial: SpectrumAnalysis | null;
}) {
  const [analysis, setAnalysis] = useState<SpectrumAnalysis | null>(
    isComplete(initial) ? initial : null,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isComplete(initial) ? "ready" : "idle",
  );

  const explore = useCallback(async () => {
    setStatus("loading");
    try {
      setAnalysis(await fetchSpectrum(newsItemId));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [newsItemId]);

  return (
    <aside className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div aria-hidden className="h-1 w-full" style={{ background: SPECTRUM_BAR }} />
      <div className="p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
          <Rainbow className="h-3.5 w-3.5" />
          Full Spectrum
        </p>

        {status === "idle" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-relaxed text-muted">
              One outlet is one lens. See how other publications and voices are covering this
              story.
            </p>
            <Button size="sm" onClick={() => void explore()}>
              <Telescope className="h-3.5 w-3.5" />
              Explore perspectives
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className="animate-pulse space-y-3 py-1" aria-label="Finding perspectives">
            {[100, 92, 96].map((w, i) => (
              <div key={i} className="h-3.5 rounded bg-surface" style={{ width: `${w}%` }} />
            ))}
            <p className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning our sources and the wider web for other coverage — this can take a
              moment on first look…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">Couldn&apos;t map the spectrum. Please try again.</p>
            <Button variant="secondary" size="sm" onClick={() => void explore()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {status === "ready" && analysis && (
          <SpectrumResult analysis={analysis} onRetry={() => void explore()} />
        )}
      </div>
    </aside>
  );
}

function SpectrumResult({
  analysis,
  onRetry,
}: {
  analysis: SpectrumAnalysis;
  onRetry: () => void;
}) {
  if (!analysis.perspectives.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-muted">
          No other outlets covering this story yet — it may be too fresh or too niche. Check
          back later.
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Look again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analysis.overview && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Common ground
          </p>
          <p className="mt-1 font-serif text-[15px] italic leading-relaxed text-foreground">
            {analysis.overview}
          </p>
        </div>
      )}
      {analysis.divergence && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Where they split
          </p>
          <p className="mt-1 font-serif text-[15px] italic leading-relaxed text-foreground">
            {analysis.divergence}
          </p>
        </div>
      )}

      <ul className="divide-y divide-border border-t border-border">
        {analysis.perspectives.map((p) => (
          <li key={p.newsItemId} className="py-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wider">
              {p.label && (
                <span className="rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
                  {p.label}
                </span>
              )}
              <span className="font-medium text-muted">{p.sourceName}</span>
              {p.publishedAt && (
                <span className="normal-case text-muted-foreground">{timeAgo(p.publishedAt)}</span>
              )}
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                title="View the original on the publisher's site"
                aria-label={`View the original of "${p.title}"`}
                className="ml-auto text-muted transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
            <Link
              href={`/article/${p.newsItemId}`}
              className="mt-1.5 block font-serif text-base font-bold leading-snug text-foreground transition-colors hover:text-primary"
            >
              {p.title}
            </Link>
            {p.angle && <p className="mt-1 text-sm leading-relaxed text-muted">{p.angle}</p>}
          </li>
        ))}
      </ul>

      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        {analysis.aiGenerated
          ? "Coverage gathered from Spectrum's sources and a live web search; lens labels are AI-generated."
          : "Related coverage from Spectrum's sources and a live web search. AI labeling is currently unavailable."}
      </p>
    </div>
  );
}
