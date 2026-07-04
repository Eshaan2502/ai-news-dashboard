import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { DEMO_USER } from "../constants";

/**
 * Resolves the current user id, creating the demo user on first use.
 * The MVP is single-user; swapping this for real auth is the only change needed.
 */
export async function getCurrentUserId(): Promise<number> {
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_USER.email))
    .limit(1);
  if (found.length) return found[0].id;

  const inserted = await db
    .insert(users)
    .values(DEMO_USER)
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (inserted.length) return inserted[0].id;

  // Lost an insert race — read it back.
  const again = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_USER.email))
    .limit(1);
  return again[0].id;
}
