"use server";

import { revalidatePath } from "next/cache";
import { runIngestion, type IngestStats } from "@/lib/ingest/run";
import { getCurrentUser } from "@/lib/db/user";

/**
 * Server Action behind the masthead "Refresh" button. Runs a full ingestion
 * pass on the server and revalidates pages so fresh data shows immediately.
 *
 * The button is visible to every visitor and ingestion calls OpenAI, so two
 * production guards apply: callers must have an identity (guest or Google),
 * and runs are rate-limited per server instance with a short cooldown.
 */
const COOLDOWN_MS = 5 * 60 * 1000;
let lastRun: { at: number; stats: IngestStats } | null = null;
let inFlight: Promise<IngestStats> | null = null;

export async function triggerIngestion(): Promise<IngestStats> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  if (lastRun && Date.now() - lastRun.at < COOLDOWN_MS) {
    return lastRun.stats; // recently refreshed — serve the last result
  }
  if (!inFlight) {
    inFlight = runIngestion()
      .then((stats) => {
        lastRun = { at: Date.now(), stats };
        return stats;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  const stats = await inFlight;
  revalidatePath("/");
  revalidatePath("/favorites");
  return stats;
}
