import { pgTable, serial, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Persisted post-date debriefs. Replaces the ephemeral state in
 * DebriefWhatHappened so reflections survive a refresh and feed the Mirror's
 * outcome-streak + recent-dates signals.
 */
export const postDateNotesTable = pgTable(
  "post_date_notes",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    matchName: varchar("match_name", { length: 120 }),
    whatHappened: text("what_happened").notNull(),
    feltGood: text("felt_good").array().notNull().default([]),
    feltOff: text("felt_off").array().notNull().default([]),
    outcome: varchar("outcome", { length: 80 }),
    patternRead: text("pattern_read"),
    coachInsight: text("coach_insight"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("post_date_notes_user_created_idx").on(t.userId, t.createdAt),
    index("post_date_notes_anon_created_idx").on(t.anonymousClaimToken, t.createdAt),
  ],
);

export const insertPostDateNoteSchema = createInsertSchema(postDateNotesTable, {
  matchName: z.string().trim().max(120).nullish(),
  whatHappened: z.string().trim().min(1).max(20000),
  feltGood: z.array(z.string().trim().max(120)).max(50).default([]),
  feltOff: z.array(z.string().trim().max(120)).max(50).default([]),
  outcome: z.string().trim().max(80).nullish(),
  patternRead: z.string().trim().max(4000).nullish(),
  coachInsight: z.string().trim().max(4000).nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertPostDateNote = z.infer<typeof insertPostDateNoteSchema>;
export type PostDateNote = typeof postDateNotesTable.$inferSelect;
