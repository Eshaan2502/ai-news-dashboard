import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, type User } from "./schema";

/**
 * Current-user resolution for Spectrum's two identity kinds:
 *   1. Google account → Auth.js JWT session (users.id stashed in the token)
 *   2. Guest          → `spectrum_guest` cookie holding the users.guestId UUID
 * A live session always outranks the guest cookie, so a guest who signs in
 * with Google is seamlessly "upgraded" without clearing the cookie.
 */

export const GUEST_COOKIE = "spectrum_guest";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  image: string | null;
  isGuest: boolean;
  preferredTopics: string[] | null;
};

function toCurrentUser(u: User): CurrentUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    isGuest: u.isGuest,
    preferredTopics: u.preferredTopics,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // 1. Google session (Auth.js). Imported lazily so modules that only need
  // the guest path (or constants) don't pull the whole auth stack in.
  // Fail-soft: if Auth.js is misconfigured (e.g. AUTH_SECRET not set on the
  // host yet), fall through to the guest path instead of taking down every
  // page — the site stays usable in guest-only mode.
  let session = null;
  try {
    const { auth } = await import("../auth");
    session = await auth();
  } catch (e) {
    console.warn("Auth.js session check failed (guest-only mode):", e instanceof Error ? e.message : e);
  }
  if (session?.user) {
    const uid = Number(session.user.id);
    if (Number.isInteger(uid) && uid > 0) {
      const [row] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
      if (row) return toCurrentUser(row);
    }
    if (session.user.email) {
      const [row] = await db.select().from(users).where(eq(users.email, session.user.email)).limit(1);
      if (row) return toCurrentUser(row);
    }
  }

  // 2. Guest cookie.
  const gid = (await cookies()).get(GUEST_COOKIE)?.value;
  if (gid && UUID_RE.test(gid)) {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.guestId, gid), eq(users.isGuest, true)))
      .limit(1);
    if (row) return toCurrentUser(row);
  }

  return null;
}

/** Gate for pages that need any identity — bounces to the welcome screen. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}

/** Gate for personalized pages — also bounces users who never picked topics. */
export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.preferredTopics?.length) redirect("/onboarding");
  return user;
}
