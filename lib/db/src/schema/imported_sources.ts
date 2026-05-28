import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per GDPR-style data export uploaded by the user (Hinge, Tinder,
 * Bumble — Hinge first). Tracks processing state and stores the structured
 * summary we extract via the import pipeline (counts, themes, attachment-style
 * indicators, etc.). The raw zip is not persisted in the DB.
 *
 * Anonymous-claim wiring matches the audits pattern so the upload can begin
 * pre-signup and be reassigned to the user when they create an account.
 */
export const importedSourcesTable = pgTable(
  "imported_sources",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Source app the export came from. */
    source: varchar("source", { length: 32 }).notNull(), // 'hinge' | 'tinder' | 'bumble' | 'instagram-paste'
    /** Lifecycle state machine. */
    status: varchar("status", { length: 20 }).notNull().default("uploaded"), // 'uploaded' | 'pending' | 'parsing' | 'ready' | 'failed'
    originalFilename: varchar("original_filename", { length: 255 }),
    /** Structured summary after parsing. Shape varies per source. */
    parsedSummary: jsonb("parsed_summary").$type<Record<string, unknown>>(),
    /** Error message when status='failed'. */
    error: text("error"),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("imported_sources_user_idx").on(t.userId, t.uploadedAt),
    index("imported_sources_anon_idx").on(t.anonymousClaimToken),
    index("imported_sources_status_idx").on(t.status),
  ],
);

export const insertImportedSourceSchema = createInsertSchema(
  importedSourcesTable,
  {
    source: z.enum(["hinge", "tinder", "bumble"]),
    status: z.enum(["uploaded", "parsing", "ready", "failed"]).default("uploaded"),
    originalFilename: z.string().trim().max(255).nullish(),
  },
).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertImportedSource = z.infer<typeof insertImportedSourceSchema>;
export type ImportedSource = typeof importedSourcesTable.$inferSelect;
