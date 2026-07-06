"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChartPie, Settings, Star, LogOut } from "lucide-react";
import { signOutAction } from "@/app/welcome/actions";

export function MastheadActions({
  userName,
  userImage,
  isGuest,
}: {
  userName: string;
  userImage: string | null;
  isGuest: boolean;
}) {
  const [signingOut, startSignOut] = useTransition();

  return (
    <div className="flex items-center gap-1 text-muted">
      <Link
        href="/favorites"
        title="Saved stories"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <Star className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Saved</span>
      </Link>
      <Link
        href="/insights"
        title="Your reading insights"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <ChartPie className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Insights</span>
      </Link>
      <Link
        href="/settings"
        title="Edit your topics"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Topics</span>
      </Link>
      <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
      <span className="inline-flex items-center gap-1.5 px-1" title={isGuest ? "Browsing as guest" : userName}>
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar comes from Google's CDN
          <img src={userImage} alt="" className="h-5 w-5 rounded-full border border-border" />
        ) : (
          <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-surface text-[10px] font-semibold text-muted">
            {userName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate md:inline">{isGuest ? "Guest" : userName}</span>
      </span>
      <button
        onClick={() => startSignOut(() => signOutAction())}
        disabled={signingOut}
        title={isGuest ? "Leave guest session" : "Sign out"}
        className="inline-flex h-7 items-center rounded-md px-2 transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
