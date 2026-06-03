import {
  pgTable,
  serial,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One short note written to the person the user has not met yet. Writing toward
 * a future partner is a low-friction way to surface intent and values in the
 * user's own words, and the act of returning to read past notes is its own
 * emotional payoff, so each note written feeds matching readiness as its own
 * low-weight lane.
 *
 * The note body is stored so the user can replay it later, exactly like a
 * journal entry, and it is the user's own content shown back only to them. Only
 * the derived count of distinct notes feeds the readiness signal, and only
 * derived themes (never the raw body) would ever be sent to any external model.
 * Multiple notes are expected over time, so there is no unique constraint; the
 * lane counts how many a person has written.
 */
export const timeCapsulesTable = pgTable(
  "time_capsules",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** The one-line note to a future partner, in the user's own words. */
    body: varchar("body", { length: 280 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("time_capsule_user_created_idx").on(t.userId, t.createdAt)],
);

export const insertTimeCapsuleSchema = createInsertSchema(timeCapsulesTable, {
  body: z.string().trim().min(1).max(280),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertTimeCapsule = z.infer<typeof insertTimeCapsuleSchema>;
export type TimeCapsuleRow = typeof timeCapsulesTable.$inferSelect;
