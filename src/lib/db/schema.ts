import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  uuid,
  real,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ArticleBlock, SpectrumAnalysis } from "../types";

/**
 * sources — registered news feeds (RSS/API).
 * `weight` biases the impact score; `category` groups sources for the UI.
 */
export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(), // feed URL
    siteUrl: text("site_url"),
    type: text("type").notNull().default("rss"), // rss | api
    category: text("category").notNull().default("Media"), // Company | Research | Media | Community
    topic: text("topic").notNull().default("Technology"), // one of the 8 Spectrum topics
    weight: real("weight").notNull().default(1),
    active: boolean("active").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastStatus: text("last_status"), // ok | error:<msg>
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_url_idx").on(t.url)],
);

/**
 * news_items — normalized, deduped, (optionally) AI-enriched articles.
 * Near-duplicates share a `clusterId`; the canonical item has isDuplicate=false.
 * `embedding` (pgvector) powers semantic dedup and "related" lookups.
 */
export const newsItems = pgTable(
  "news_items",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    rawContent: text("raw_content"),
    author: text("author"),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    tags: jsonb("tags").$type<string[]>().default([]),
    entities: jsonb("entities").$type<string[]>().default([]),
    topic: text("topic"),
    impactScore: real("impact_score").notNull().default(0),
    clusterId: uuid("cluster_id"),
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    embedding: vector("embedding", { dimensions: 1536 }),
    enriched: boolean("enriched").notNull().default(false),
    // In-site reader cache: full text extracted from the original page,
    // stored as safe text blocks (no HTML reaches the client).
    extractedContent: jsonb("extracted_content").$type<ArticleBlock[]>(),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    extractionStatus: text("extraction_status"), // ok | failed
    // Full Spectrum cache: multi-outlet perspective analysis, built on demand.
    spectrum: jsonb("spectrum").$type<SpectrumAnalysis>(),
    spectrumAt: timestamp("spectrum_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("news_canonical_idx").on(t.canonicalUrl),
    index("news_published_idx").on(t.publishedAt),
    index("news_cluster_idx").on(t.clusterId),
    index("news_impact_idx").on(t.impactScore),
  ],
);

/**
 * users — guests (device-scoped, identified by the `spectrum_guest` cookie's
 * UUID in `guestId`) and Google accounts (identified by email). Guests get a
 * synthetic `guest-<uuid>@guest.spectrum.local` email to satisfy the unique
 * email index. `preferredTopics` is an ordered array — index = priority,
 * and it drives homepage row order.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("user"),
    isGuest: boolean("is_guest").notNull().default(false),
    guestId: uuid("guest_id"),
    image: text("image"),
    preferredTopics: jsonb("preferred_topics").$type<string[]>(),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_guest_id_idx").on(t.guestId)],
);

/** favorites — a user's saved items (one row per user+item). */
export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    newsItemId: integer("news_item_id")
      .references(() => newsItems.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_user_item_idx").on(t.userId, t.newsItemId)],
);

/**
 * reads — a user's reading history (one row per user+item). The first open
 * inserts the row; re-opens bump `readCount` and `lastReadAt`. Powers the
 * Insights page (topic/source leanings, activity over time).
 */
export const reads = pgTable(
  "reads",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    newsItemId: integer("news_item_id")
      .references(() => newsItems.id, { onDelete: "cascade" })
      .notNull(),
    readCount: integer("read_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reads_user_item_idx").on(t.userId, t.newsItemId),
    index("reads_user_idx").on(t.userId),
  ],
);

/* ---------- relations (for typed joins via db.query) ---------- */

export const sourcesRelations = relations(sources, ({ many }) => ({
  items: many(newsItems),
}));

export const newsItemsRelations = relations(newsItems, ({ one, many }) => ({
  source: one(sources, { fields: [newsItems.sourceId], references: [sources.id] }),
  favorites: many(favorites),
  reads: many(reads),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  newsItem: one(newsItems, { fields: [favorites.newsItemId], references: [newsItems.id] }),
}));

export const readsRelations = relations(reads, ({ one }) => ({
  user: one(users, { fields: [reads.userId], references: [users.id] }),
  newsItem: one(newsItems, { fields: [reads.newsItemId], references: [newsItems.id] }),
}));

/* ---------- inferred types ---------- */

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type User = typeof users.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Read = typeof reads.$inferSelect;
