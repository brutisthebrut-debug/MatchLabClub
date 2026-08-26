import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One short note written to the person the user has not met yet, stored as a
 * private first-party record. Storage, Echo use, confirmed learning, and
 * matching use remain separate member-controlled states.
 *
 * The note body is stored so the user can replay it later, exactly like a
 * journal entry, and it is the user's own content shown back only to them. Only
 * an explicitly matching-approved note may feed only a derived count to
 * readiness. The raw body never leaves owner-scoped replay storage.
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
    /** Saving never grants downstream use. */
    echoUseAllowed: boolean("echo_use_allowed").notNull().default(false),
    echoUseUpdatedAt: timestamp("echo_use_updated_at"),
    learningConfirmed: boolean("learning_confirmed").notNull().default(false),
    learningConfirmedAt: timestamp("learning_confirmed_at"),
    matchingUseAllowed: boolean("matching_use_allowed").notNull().default(false),
    matchingUseUpdatedAt: timestamp("matching_use_updated_at"),
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
  echoUseAllowed: true,
  echoUseUpdatedAt: true,
  learningConfirmed: true,
  learningConfirmedAt: true,
  matchingUseAllowed: true,
  matchingUseUpdatedAt: true,
});

export type InsertTimeCapsule = z.infer<typeof insertTimeCapsuleSchema>;
export type TimeCapsuleRow = typeof timeCapsulesTable.$inferSelect;
