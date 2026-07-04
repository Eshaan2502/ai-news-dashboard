"use server";

import { revalidatePath } from "next/cache";
import { runIngestion, type IngestStats } from "@/lib/ingest/run";

/**
 * Server Action used by the dashboard "Refresh" button. Runs a full ingestion
 * pass on the server (no secret needed — it never touches the client) and
 * revalidates the pages so fresh data shows on the next render.
 */
export async function triggerIngestion(): Promise<IngestStats> {
  const stats = await runIngestion();
  revalidatePath("/");
  revalidatePath("/favorites");
  return stats;
}
