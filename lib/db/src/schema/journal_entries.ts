import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  smallint,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Persisted reflective journal entries. Replaces the ephemeral state in
 * WeeklyGrowthPlan + freeform reflections so journaling actually compounds
 * over time and can feed the Mirror's journaling-streak readiness signal.
 *
 * Soft-delete + restore follow the same pattern as audits (task #43/#72/#73)
 * so undo works consistently across the product.
 */
export const journalEntriesTable = pgTable(
  "journal_entries",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Optional curated prompt the entry was written against. Null = freeform. */
    prompt: text("prompt"),
    body: text("body").notNull(),
    /** Free-form tags (e.g. "weekly", "intention", "reflection"). */
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    /** Self-reported mood, 1 (low) – 5 (high). Null = not provided. */
    mood: smallint("mood"),
    /** Optional cross-reference to an audit this entry reflects on. */
    linkedAuditId: integer("linked_audit_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("journal_entries_user_created_idx").on(t.userId, t.createdAt),
    index("journal_entries_anon_created_idx").on(
      t.anonymousClaimToken,
      t.createdAt,
    ),
  ],
);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable, {
  prompt: z.string().trim().max(500).nullish(),
  body: z.string().trim().min(1).max(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  mood: z.number().int().min(1).max(5).nullish(),
  linkedAuditId: z.number().int().positive().nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
