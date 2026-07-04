"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Share2,
  MessageCircle,
  PenLine,
  Newspaper,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";
import { broadcast } from "@/lib/client-api";
import type { FeedItemDTO } from "@/lib/types";
import { BROADCAST_PLATFORMS, type BroadcastPlatform } from "@/lib/constants";
import { PLATFORM_LABEL } from "@/lib/ui";
import { cn } from "@/lib/utils";

const PLATFORM_ICON: Record<BroadcastPlatform, typeof Mail> = {
  email: Mail,
  linkedin: Share2,
  whatsapp: MessageCircle,
  blog: PenLine,
  newsletter: Newspaper,
};

export function BroadcastModal({
  item,
  open,
  onClose,
  onBroadcasted,
}: {
  item: FeedItemDTO | null;
  open: boolean;
  onClose: () => void;
  onBroadcasted?: () => void;
}) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<BroadcastPlatform | null>(null);
  const [content, setContent] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state each time the modal opens for a (possibly new) item.
  useEffect(() => {
    if (open) {
      setPlatform(null);
      setContent("");
      setShareUrl(null);
      setCopied(false);
    }
  }, [open, item?.id]);

  async function choose(p: BroadcastPlatform) {
    if (!item) return;
    setPlatform(p);
    setLoading(true);
    setShareUrl(null);
    try {
      const res = await broadcast({ newsItemId: item.id, platform: p });
      setContent(res.content);
      setShareUrl(res.result.shareUrl);
      toast({
        title: `Broadcast to ${PLATFORM_LABEL[p]}`,
        description: res.result.detail,
        variant: "success",
      });
      onBroadcasted?.();
    } catch {
      toast({ title: "Broadcast failed", description: "Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "error" });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Broadcast" description={item?.title}>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Pick a channel — content is generated and the broadcast is logged.
      </p>

      <div className="flex flex-wrap gap-2">
        {BROADCAST_PLATFORMS.map((p) => {
          const Icon = PLATFORM_ICON[p];
          const active = platform === p;
          return (
            <button
              key={p}
              onClick={() => choose(p)}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted hover:bg-card-hover hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {PLATFORM_LABEL[p]}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating {platform ? PLATFORM_LABEL[platform] : ""} content…
        </div>
      )}

      {!loading && content && platform && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">
              {PLATFORM_LABEL[platform]} content
            </span>
            <span className="text-[11px] text-muted-foreground">editable before sharing</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            className="w-full resize-y rounded-md border border-border bg-surface p-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <ExternalLink className="h-4 w-4" />
                Open in {PLATFORM_LABEL[platform]}
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
