import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per Compatibility Compass read. A "read" is an interpretation of a
 * candidate dating profile (pasted text or screenshot OCR) against the user's
 * own wellness answers + signals.
 *
 * Anonymous-claim wiring matches the existing pattern (audits, profiles, etc.)
 * so a user can run one read pre-signup and have it carry into their account.
 */
export const compatibilityReadsTable = pgTable(
  "compatibility_reads",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** How the candidate profile was provided. */
    sourceKind: varchar("source_kind", { length: 20 }).notNull(), // 'paste' | 'screenshot' | 'import'
    /** Original raw text (after OCR if applicable). Kept for transparency. */
    rawText: text("raw_text").notNull(),
    /** Structured candidate profile after parsing (name, age, bio, prompts...) */
    parsedProfile: jsonb("parsed_profile").$type<Record<string, unknown>>(),
    /** Final Anthropic (or fallback heuristic) compass output. Shape lives in @workspace/ai-schemas. */
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    /** 0-100 alignment score, mirrored out of resultJson for cheap listing. */
    overallAlignment: integer("overall_alignment"),
    /** Whether the result came from the live model or the deterministic fallback. */
    mode: varchar("mode", { length: 20 }).notNull().default("fallback"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("compatibility_reads_user_idx").on(t.userId, t.createdAt),
    index("compatibility_reads_anon_idx").on(t.anonymousClaimToken),
  ],
);

export const insertCompatibilityReadSchema = createInsertSchema(
  compatibilityReadsTable,
  {
    sourceKind: z.enum(["paste", "screenshot", "import"]),
    rawText: z.string().trim().min(1).max(20000),
    overallAlignment: z.number().int().min(0).max(100).nullish(),
    mode: z.enum(["live", "fallback", "setup-needed"]).default("fallback"),
  },
).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertCompatibilityRead = z.infer<typeof insertCompatibilityReadSchema>;
export type CompatibilityRead = typeof compatibilityReadsTable.$inferSelect;
