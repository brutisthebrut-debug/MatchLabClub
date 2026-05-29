import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Allowed `category` values for a logged dating win. Stored as varchar so we
 * can extend later without an enum-type migration; the Zod schema enforces the
 * bounded set at the API edge. Mirrors the categories the DatingWinsLog UI
 * offered while it was localStorage-only.
 */
export const DATING_WIN_CATEGORIES = [
  "sent-it",
  "great-convo",
  "got-a-date",
  "noticed-something",
  "personal-win",
] as const;
export type DatingWinCategory = (typeof DATING_WIN_CATEGORIES)[number];

/**
 * Persisted "dating wins" — small moments of courage, good conversations, and
 * patterns the user notices. Previously this lived in localStorage only, so it
 * never synced across devices and never counted as a real signal. Now it is a
 * first-class account-backed source that feeds matching readiness alongside
 * journal, wellness, compass, post-date notes, and imports.
 *
 * Soft-delete follows the journal/post-date pattern so behaviour is consistent.
 */
export const datingWinsTable = pgTable(
  "dating_wins",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** One of DATING_WIN_CATEGORIES. */
    category: varchar("category", { length: 32 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("dating_wins_user_created_idx").on(t.userId, t.createdAt),
    index("dating_wins_anon_created_idx").on(
      t.anonymousClaimToken,
      t.createdAt,
    ),
  ],
);

export const insertDatingWinSchema = createInsertSchema(datingWinsTable, {
  category: z.enum(DATING_WIN_CATEGORIES),
  body: z.string().trim().min(1).max(2000),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertDatingWin = z.infer<typeof insertDatingWinSchema>;
export type DatingWin = typeof datingWinsTable.$inferSelect;
