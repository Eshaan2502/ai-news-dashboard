import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { TOPICS } from "@/lib/topics";
import { TOPIC_COLOR } from "@/lib/topics";
import { continueAsGuest, googleSignIn } from "./actions";

export const dynamic = "force-dynamic";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.03c2.2-2.1 3.5-5.1 3.5-8.6" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.8-2.1-6.8-5l-.14.01-3.6 2.8-.05.13C3.4 21.3 7.4 24 12 24" />
      <path fill="#FBBC05" d="M5.2 14.4c-.25-.75-.4-1.5-.4-2.4 0-.8.15-1.6.4-2.4l-.01-.16-3.7-2.8-.12.06C.5 8.2 0 10 0 12s.5 3.8 1.4 5.4l3.8-3" />
      <path fill="#EB4335" d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.8 3c1-2.9 3.6-5 6.8-5" />
    </svg>
  );
}

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.preferredTopics?.length ? "/" : "/onboarding");

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Welcome to
        </p>
        <h1 className="mt-3 font-serif text-7xl font-black tracking-tight text-foreground sm:text-8xl">
          Spectrum
        </h1>
        <p className="mt-3 font-serif text-lg italic text-muted">News without the tunnel vision</p>

        <div className="masthead-rule mx-auto mt-8 w-48" />

        <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-muted">
          One front page, every angle — AI to world affairs, markets to match day. Pick your
          topics, rank what matters, and read it all in one place.
        </p>

        <div className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-3">
          {googleConfigured ? (
            <form action={googleSignIn}>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-card-hover"
              >
                <GoogleMark />
                Sign in with Google
              </button>
            </form>
          ) : (
            <button
              disabled
              title="Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable"
              className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground opacity-70"
            >
              <GoogleMark />
              Sign in with Google (not configured)
            </button>
          )}
          <form action={continueAsGuest}>
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
            >
              Continue as guest
            </button>
          </form>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Guest picks are remembered on this device — sign in with Google later and they come
            with you.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {TOPICS.map((t) => (
            <span key={t} className="text-[11px] font-medium uppercase tracking-wider" style={{ color: TOPIC_COLOR[t] }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
