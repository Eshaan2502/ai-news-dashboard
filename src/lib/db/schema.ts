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
  },
  (t) => [
    uniqueIndex("news_canonical_idx").on(t.canonicalUrl),
    index("news_published_idx").on(t.publishedAt),
    index("news_cluster_idx").on(t.clusterId),
    index("news_impact_idx").on(t.impactScore),
  ],
);

/** users — minimal; a single demo user is seeded for the MVP. */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
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

/** broadcast_logs — every broadcast attempt (delivery is mocked in the MVP). */
export const broadcastLogs = pgTable("broadcast_logs", {
  id: serial("id").primaryKey(),
  favoriteId: integer("favorite_id").references(() => favorites.id, { onDelete: "set null" }),
  newsItemId: integer("news_item_id")
    .references(() => newsItems.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  platform: text("platform").notNull(), // email | linkedin | whatsapp | blog | newsletter
  content: text("content"), // AI-generated post/caption/message
  recipient: text("recipient"),
  status: text("status").notNull().default("sent"), // sent | failed | queued
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- relations (for typed joins via db.query) ---------- */

export const sourcesRelations = relations(sources, ({ many }) => ({
  items: many(newsItems),
}));

export const newsItemsRelations = relations(newsItems, ({ one, many }) => ({
  source: one(sources, { fields: [newsItems.sourceId], references: [sources.id] }),
  favorites: many(favorites),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  newsItem: one(newsItems, { fields: [favorites.newsItemId], references: [newsItems.id] }),
}));

export const broadcastLogsRelations = relations(broadcastLogs, ({ one }) => ({
  newsItem: one(newsItems, { fields: [broadcastLogs.newsItemId], references: [newsItems.id] }),
}));

/* ---------- inferred types ---------- */

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type User = typeof users.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type BroadcastLog = typeof broadcastLogs.$inferSelect;
export type NewBroadcastLog = typeof broadcastLogs.$inferInsert;
