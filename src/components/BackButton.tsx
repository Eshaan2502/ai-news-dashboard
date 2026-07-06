"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Top-left "Back" control shown on every app page except the front page.
 * Uses browser history when there is somewhere to go back to; falls back to
 * the front page for direct visits (e.g. a shared article link).
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}
