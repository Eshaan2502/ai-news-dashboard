"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signIn, signOut } from "@/lib/auth";
import { GUEST_COOKIE, getCurrentUser } from "@/lib/db/user";
import { isTopic } from "@/lib/topics";

/**
 * "Continue as guest": mints a device-scoped identity — a users row keyed by
 * a fresh UUID, mirrored into a long-lived httpOnly cookie. Personalization
 * and favorites are cached to this device until the cookie is cleared (or the
 * guest upgrades to Google, which migrates their data).
 */
export async function continueAsGuest(): Promise<void> {
  const existing = await getCurrentUser();
  if (existing) redirect(existing.preferredTopics?.length ? "/" : "/onboarding");

  const gid = randomUUID();
  await db.insert(users).values({
    name: "Guest",
    email: `guest-${gid}@guest.spectrum.local`,
    isGuest: true,
    guestId: gid,
  });
  (await cookies()).set(GUEST_COOKIE, gid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // 400 days — Chrome's cookie lifetime cap
  });
  redirect("/onboarding");
}

/** "Sign in with Google" — /onboarding bounces onward to / if already onboarded. */
export async function googleSignIn(): Promise<void> {
  await signIn("google", { redirectTo: "/onboarding" });
}

export async function signOutAction(): Promise<void> {
  try {
    await signOut({ redirect: false });
  } catch {
    // No Auth.js session (guest) — nothing to sign out of.
  }
  (await cookies()).delete(GUEST_COOKIE);
  redirect("/welcome");
}

/**
 * Persists the ordered topic selection — array order IS the priority and
 * drives homepage row order. Used by onboarding and settings.
 */
export async function savePreferences(topics: string[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const valid = [...new Set(topics)].filter(isTopic);
  if (!valid.length) throw new Error("Pick at least one topic.");

  await db
    .update(users)
    .set({ preferredTopics: valid, onboardedAt: new Date() })
    .where(eq(users.id, user.id));
  revalidatePath("/");
  redirect("/");
}
