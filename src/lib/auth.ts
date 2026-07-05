import NextAuth, { type DefaultSession } from "next-auth";
// Type-only import so the `next-auth/jwt` module augmentation below resolves.
import type {} from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { GUEST_COOKIE, UUID_RE } from "./db/user";

declare module "next-auth" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: number;
  }
}

/**
 * Auth.js v5 — Google sign-in with JWT sessions (no adapter tables; the
 * existing `users` table is upserted manually in the signIn callback).
 * Guests never touch this: they are identified by the `spectrum_guest`
 * cookie alone (see src/lib/db/user.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/welcome" },
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const name = user.name ?? email.split("@")[0];
      const image = user.image ?? null;

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      let row = existing[0];
      if (row) {
        await db.update(users).set({ name, image, isGuest: false }).where(eq(users.id, row.id));
      } else {
        const inserted = await db
          .insert(users)
          .values({ name, email, image, isGuest: false })
          .onConflictDoNothing({ target: users.email })
          .returning();
        row = inserted[0] ?? (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
      }
      if (!row) return false;

      // Guest → Google migration: if this device was a guest and the Google
      // account has no preferences yet, carry over the guest's personalization
      // and favorites. The guest cookie is left in place — a live session
      // always outranks it in getCurrentUser().
      try {
        const gid = (await cookies()).get(GUEST_COOKIE)?.value;
        if (gid && UUID_RE.test(gid) && !row.preferredTopics) {
          const [guest] = await db
            .select()
            .from(users)
            .where(and(eq(users.guestId, gid), eq(users.isGuest, true)))
            .limit(1);
          if (guest && guest.id !== row.id) {
            if (guest.preferredTopics?.length) {
              await db
                .update(users)
                .set({ preferredTopics: guest.preferredTopics, onboardedAt: guest.onboardedAt ?? new Date() })
                .where(eq(users.id, row.id));
            }
            await db.execute(sql`
              INSERT INTO favorites (user_id, news_item_id)
              SELECT ${row.id}, news_item_id FROM favorites WHERE user_id = ${guest.id}
              ON CONFLICT DO NOTHING
            `);
          }
        }
      } catch (e) {
        console.warn("Guest → Google migration skipped:", e instanceof Error ? e.message : e);
      }
      return true;
    },
    async jwt({ token, user }) {
      // First sign-in only: stash the serial users.id in the token.
      if (user?.email) {
        const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);
        if (row) token.uid = row.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) session.user.id = String(token.uid);
      return session;
    },
  },
});
