import { pgTable, serial, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable(
  "journal_entries",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    title: varchar("title", { length: 200 }),
    body: text("body").notNull(),
    mood: varchar("mood", { length: 32 }),
    tag: varchar("tag", { length: 32 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("journal_entries_user_created_idx").on(t.userId, t.createdAt),
    index("journal_entries_anon_created_idx").on(t.anonymousClaimToken, t.createdAt),
  ],
);

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable, {
  title: z.string().trim().max(200).nullish(),
  body: z.string().trim().min(1).max(20000),
  mood: z.string().trim().max(32).nullish(),
  tag: z.string().trim().max(32).nullish(),
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
