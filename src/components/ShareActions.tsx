"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Mail, RefreshCw, Wand2, X } from "lucide-react";
import { generateLinkedInPost } from "@/lib/client-api";
import { Button } from "./ui/Button";
import { IconAI } from "./TopicIcon";
import { useToast } from "./ui/Toast";

/** LinkedIn's composer rejects posts beyond ~3000 characters. */
const LINKEDIN_MAX = 3000;

const ICON_BUTTON =
  "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-card-hover hover:text-foreground";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/**
 * Share buttons for the article header: WhatsApp and email share the original
 * link directly; LinkedIn opens a modal with an AI-drafted post the reader can
 * edit, copy, and drop into LinkedIn's composer (prefilled where supported).
 */
export function ShareActions({
  newsItemId,
  title,
  url,
  summary,
}: {
  newsItemId: number;
  title: string;
  url: string;
  summary: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [post, setPost] = useState("");
  const [aiGenerated, setAiGenerated] = useState(true);
  const [instruction, setInstruction] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const { toast } = useToast();

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n\n${url}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
    `${title}\n\n${summary ?? ""}\n\nRead the full story: ${url}`,
  )}`;

  const generate = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await generateLinkedInPost(newsItemId);
      setPost(result.post);
      setAiGenerated(result.aiGenerated);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [newsItemId]);

  const openModal = () => {
    setOpen(true);
    if (status === "idle" || status === "error") void generate();
  };

  /** Ask the AI to revise the current draft per the reader's instruction. */
  const adjust = async () => {
    const ask = instruction.trim();
    if (!ask || adjusting) return;
    setAdjusting(true);
    try {
      const result = await generateLinkedInPost(newsItemId, { draft: post, instruction: ask });
      if (!result.aiGenerated && result.post === post) {
        toast({ title: "AI is unavailable — the draft wasn't changed", variant: "error" });
      } else {
        setPost(result.post);
        setInstruction("");
        toast({ title: "Draft updated" });
      }
    } catch {
      toast({ title: "Couldn't adjust the draft — try again", variant: "error" });
    } finally {
      setAdjusting(false);
    }
  };

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const fullText = `${post.trim()}\n\n${url}`;

  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast({ title: "Post copied to clipboard" });
      return true;
    } catch {
      toast({ title: "Couldn't copy — select the text manually", variant: "error" });
      return false;
    }
  };

  const openLinkedIn = async () => {
    // Copy first as a fallback: LinkedIn only prefills the composer on
    // desktop web, so the clipboard covers mobile and logged-out cases.
    await copyPost();
    window.open(
      `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullText)}`,
      "_blank",
      "noopener",
    );
  };

  return (
    <>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
        className={ICON_BUTTON}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </a>
      <a href={emailHref} title="Share by email" aria-label="Share by email" className={ICON_BUTTON}>
        <Mail className="h-4 w-4" />
      </a>
      <button
        onClick={openModal}
        title="Share on LinkedIn — drafts an AI post about this story"
        aria-label="Share on LinkedIn"
        className={ICON_BUTTON}
      >
        <LinkedInIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share on LinkedIn"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
                  <IconAI className="h-3.5 w-3.5" />
                  {aiGenerated ? "AI-drafted LinkedIn post" : "Draft LinkedIn post"}
                </p>
                <h2 className="mt-1 font-serif text-xl font-bold text-foreground">
                  Share this story on LinkedIn
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-card-hover hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              {status === "loading" && (
                <div className="animate-pulse space-y-3 rounded-md border border-border bg-surface p-4">
                  {[100, 96, 88, 92, 60].map((w, i) => (
                    <div key={i} className="h-3 rounded bg-card-hover" style={{ width: `${w}%` }} />
                  ))}
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    Reading the article and writing your post…
                  </p>
                </div>
              )}

              {status === "error" && (
                <div className="rounded-md border border-border bg-surface p-4 text-sm text-foreground">
                  <p>Couldn&apos;t draft the post. Please try again.</p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => void generate()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              )}

              {status === "ready" && (
                <>
                  <textarea
                    value={post}
                    onChange={(e) => setPost(e.target.value)}
                    rows={10}
                    disabled={adjusting}
                    aria-label="LinkedIn post text"
                    className="w-full resize-y rounded-md border border-border bg-surface p-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:animate-pulse disabled:opacity-60"
                  />
                  <p className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>The article link is added at the end. Edit the draft as you like.</span>
                    <span className={fullText.length > LINKEDIN_MAX ? "text-primary" : ""}>
                      {fullText.length.toLocaleString()}/{LINKEDIN_MAX.toLocaleString()}
                    </span>
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void adjust();
                    }}
                    className="mt-3 flex items-center gap-2"
                  >
                    <input
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      disabled={adjusting}
                      aria-label="Describe changes to the draft"
                      placeholder='Want changes? e.g. "shorter and punchier", "more formal, no emoji"'
                      className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:opacity-60"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={adjusting || !instruction.trim()}
                      title="Have the AI revise the draft"
                    >
                      {adjusting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {adjusting ? "Adjusting…" : "Adjust"}
                    </Button>
                  </form>
                </>
              )}
            </div>

            {status === "ready" && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void generate()}
                  disabled={adjusting}
                  title="Write a new draft"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </Button>
                <Button variant="secondary" size="sm" disabled={adjusting} onClick={() => void copyPost()}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy post
                </Button>
                <Button size="sm" disabled={adjusting} onClick={() => void openLinkedIn()}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open LinkedIn
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
