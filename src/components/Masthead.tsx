import Link from "next/link";
import { getCurrentUser } from "@/lib/db/user";
import { MastheadActions } from "./MastheadActions";
import { MastheadDate } from "./MastheadDate";

/**
 * The Spectrum masthead: a centered serif wordmark over a double rule, with
 * a utility strip (date on the left, refresh/settings/account on the right).
 */
export async function Masthead() {
  const user = await getCurrentUser();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="mx-auto w-full max-w-6xl px-4 pt-5">
      <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted">
        <MastheadDate initial={today} />
        <MastheadActions
          userName={user?.name ?? "Guest"}
          userImage={user?.image ?? null}
          isGuest={user?.isGuest ?? true}
        />
      </div>
      <div className="py-6 text-center">
        <Link href="/" className="inline-block">
          <h1 className="font-serif text-5xl font-black tracking-tight text-foreground sm:text-6xl">
            Spectrum
          </h1>
        </Link>
        <p className="mt-2 font-serif text-sm italic text-muted">
          News without the tunnel vision
        </p>
      </div>
      <div className="masthead-rule" />
    </header>
  );
}
