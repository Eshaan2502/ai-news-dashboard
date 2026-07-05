"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { addFavorite, removeFavorite } from "@/lib/client-api";
import { useToast } from "./ui/Toast";
import { cn } from "@/lib/utils";

/**
 * Self-contained optimistic star. Safe to render inside a Link — it swallows
 * the click so toggling never navigates.
 */
export function FavoriteButton({
  newsItemId,
  initialFavorite,
  className,
  onChange,
}: {
  newsItemId: number;
  initialFavorite: boolean;
  className?: string;
  onChange?: (favorited: boolean) => void;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !favorite;
    setFavorite(next);
    setBusy(true);
    try {
      await (next ? addFavorite(newsItemId) : removeFavorite(newsItemId));
      onChange?.(next);
    } catch {
      setFavorite(!next); // roll back
      toast({ title: "Couldn't update saved stories", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={favorite ? "Remove from saved" : "Save story"}
      title={favorite ? "Remove from saved" : "Save story"}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-card-hover hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", favorite && "fill-[var(--color-accent)] text-[var(--color-accent)]")} />
    </button>
  );
}
