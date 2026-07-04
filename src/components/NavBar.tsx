"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Newspaper, Star, RefreshCw, Sparkles } from "lucide-react";
import { triggerIngestion } from "@/app/actions";
import { useToast } from "./ui/Toast";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/favorites", label: "Favorites", icon: Star },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const busy = refreshing || isPending;

  async function onRefresh() {
    setRefreshing(true);
    try {
      const stats = await triggerIngestion();
      toast({
        title: "Feed refreshed",
        description: `${stats.inserted} new item${stats.inserted === 1 ? "" : "s"} · ${stats.sourcesOk}/${stats.sourcesTotal} sources · ${stats.duplicates} deduped`,
        variant: "success",
      });
      startTransition(() => router.refresh());
    } catch {
      toast({
        title: "Refresh failed",
        description: "Check the DATABASE_URL / server logs.",
        variant: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            AI News <span className="text-muted">Dashboard</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-card text-foreground"
                    : "text-muted hover:bg-card-hover hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={busy} className="ml-1">
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            <span className="hidden sm:inline">{refreshing ? "Fetching…" : "Refresh"}</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
