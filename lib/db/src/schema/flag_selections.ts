import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A user's flag selection: the green flags they bring to a relationship and the
 * ones they look for in a partner. Naming what you offer and what you need is
 * its own read on standards and self-awareness, and the result is a shareable
 * card, so the selection accumulates in a single row per user (replaced in
 * place), not one row per pick.
 *
 * We store only the stable flag ids the user chose from the frontend catalog,
 * never any free text. The signal lane counts how many distinct flags they have
 * named across both lists.
 */
export const flagSelectionsTable = pgTable(
  "flag_selections",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable ids of the green flags the user says they bring. */
    bringFlags: jsonb("bring_flags").$type<string[]>().notNull().default([]),
    /** Stable ids of the flags the user looks for in a partner. */
    seekFlags: jsonb("seek_flags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("flag_selections_user_idx").on(t.userId)],
);

export const insertFlagSelectionSchema = createInsertSchema(flagSelectionsTable, {
  bringFlags: z.array(z.string().trim().min(1).max(64)).max(50),
  seekFlags: z.array(z.string().trim().min(1).max(64)).max(50),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertFlagSelection = z.infer<typeof insertFlagSelectionSchema>;
export type FlagSelectionRow = typeof flagSelectionsTable.$inferSelect;
