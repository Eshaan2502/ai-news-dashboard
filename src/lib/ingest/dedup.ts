import { randomUUID } from "node:crypto";
import { titleSimilarity, cosineSimilarity } from "../utils";

/**
 * In-memory near-duplicate detector (BRD: ≥0.9 dedup precision, clustering).
 *
 * Two signals, whichever fires:
 *   • fuzzy title  — Jaccard over tokens ≥ DEDUP_TITLE_THRESHOLD
 *   • semantic     — embedding cosine ≥ DEDUP_COSINE_THRESHOLD (when embeddings exist)
 *
 * Matches inherit the matched item's clusterId; novel items start a new cluster.
 * The index is seeded from recent DB rows and grows as items are accepted, so
 * duplicates arriving within the same run also cluster correctly.
 */
export type IndexItem = {
  id: number | null;
  clusterId: string;
  title: string;
  embedding: number[] | null;
};

export type Classification = {
  clusterId: string;
  isDuplicate: boolean;
  matchedId: number | null;
  similarity: number;
  method: "title" | "embedding" | "none";
};

export class Deduper {
  private index: IndexItem[];
  private readonly titleThreshold: number;
  private readonly cosineThreshold: number;

  constructor(recent: IndexItem[]) {
    this.index = [...recent];
    this.titleThreshold = Number(process.env.DEDUP_TITLE_THRESHOLD ?? 0.82);
    this.cosineThreshold = Number(process.env.DEDUP_COSINE_THRESHOLD ?? 0.88);
  }

  classify(candidate: { title: string; embedding: number[] | null }): Classification {
    let best: { item: IndexItem; sim: number; method: "title" | "embedding" } | null = null;

    for (const item of this.index) {
      const tSim = titleSimilarity(candidate.title, item.title);
      if (tSim >= this.titleThreshold && (!best || tSim > best.sim)) {
        best = { item, sim: tSim, method: "title" };
      }
      if (candidate.embedding && item.embedding) {
        const cSim = cosineSimilarity(candidate.embedding, item.embedding);
        if (cSim >= this.cosineThreshold && (!best || cSim > best.sim)) {
          best = { item, sim: cSim, method: "embedding" };
        }
      }
    }

    if (best) {
      return {
        clusterId: best.item.clusterId,
        isDuplicate: true,
        matchedId: best.item.id,
        similarity: Number(best.sim.toFixed(3)),
        method: best.method,
      };
    }
    return { clusterId: randomUUID(), isDuplicate: false, matchedId: null, similarity: 0, method: "none" };
  }

  /** Register an accepted item so later candidates in the same run can match it. */
  add(item: IndexItem) {
    this.index.push(item);
  }
}
