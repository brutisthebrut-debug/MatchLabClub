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
 * The kinds of behavioral-growth action a user can take. These map to tools
 * that used to live in localStorage only (Experiments, What Changed, Pattern
 * Breaker, Follow-Ups, Companion commitments), so completing them left no real
 * signal. Stored as varchar so the set can grow without an enum-type migration;
 * the Zod schema enforces the bounded set at the API edge.
 */
export const BEHAVIORAL_GROWTH_TYPES = [
  "experiment_tried",
  "what_changed",
  "pattern_broken",
  "follow_up_logged",
  "commitment_kept",
] as const;
export type BehavioralGrowthType = (typeof BEHAVIORAL_GROWTH_TYPES)[number];

/**
 * One behavioral-growth action a user completed. We store only the action TYPE
 * and when it happened, never the private notes inside the tool that produced
 * it. The count of actions over time reads as follow-through: whether someone
 * acts on what they learn, not just reads it. It is a first-class
 * account-backed source that feeds matching readiness alongside journal,
 * wellness, compass, post-date notes, and dating wins.
 *
 * Hard-deleted on account close and when the user purges this source from their
 * trust ledger. Soft-delete column follows the dating-wins/journal pattern so
 * behaviour is consistent across first-party sources.
 */
export const behavioralGrowthEventsTable = pgTable(
  "behavioral_growth_events",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** One of BEHAVIORAL_GROWTH_TYPES. */
    type: varchar("type", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("behavioral_growth_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const insertBehavioralGrowthEventSchema = createInsertSchema(
  behavioralGrowthEventsTable,
  {
    type: z.enum(BEHAVIORAL_GROWTH_TYPES),
  },
).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
  userId: true,
});

export type InsertBehavioralGrowthEvent = z.infer<
  typeof insertBehavioralGrowthEventSchema
>;
export type BehavioralGrowthEvent =
  typeof behavioralGrowthEventsTable.$inferSelect;
