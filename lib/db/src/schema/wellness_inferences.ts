import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Passive wellness inferences: confirm-before-write suggestions the machine
 * draws from a user's own free text (journal entries, audit bios/prompts,
 * message-coach threads). Nothing here is ever counted as a real signal until
 * the user explicitly confirms it, at which point it is written through the
 * normal wellness-answer path under a synthetic `inferred:<dimension>:<n>`
 * question id so it can never clobber a hand-written answer.
 *
 * status:
 *   - "pending"   waiting on the user to confirm or dismiss
 *   - "confirmed" the user accepted it (a wellness answer was written)
 *   - "dismissed" the user rejected it (never re-surfaced for that question id)
 *
 * This table holds first-party derived personal data, so it is purged in both
 * GDPR delete paths (account.ts full delete + the trust-ledger wellness purge).
 */
export const wellnessInferencesTable = pgTable(
  "wellness_inferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** Top-level wellness dimension this inference belongs to. */
    dimension: varchar("dimension", { length: 40 }).notNull(),
    /** Synthetic question id, e.g. "inferred:emotional:1". Namespaced so it
     *  never collides with hand-written ("emotional.confidence") or daily
     *  ("daily:emotional:1") wellness answers. */
    inferredQuestionId: varchar("inferred_question_id", {
      length: 120,
    }).notNull(),
    /** Canonical question text shown on confirm and stored on the written answer. */
    questionText: text("question_text").notNull(),
    /** The suggested answer drawn from the user's own words. */
    suggestedAnswer: text("suggested_answer").notNull(),
    /** Where it came from: journal, audit, coach, writing, or post_date. */
    sourceKind: varchar("source_kind", { length: 40 }).notNull(),
    /** Short, non-PII explanation of why this was surfaced. */
    rationale: text("rationale"),
    /** Which engine produced it: "deterministic" | "anthropic". */
    mode: varchar("mode", { length: 20 }).notNull().default("deterministic"),
    /** pending | confirmed | dismissed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("wellness_inferences_user_status_idx").on(t.userId, t.status),
    index("wellness_inferences_user_qid_idx").on(
      t.userId,
      t.inferredQuestionId,
    ),
  ],
);

export type WellnessInference = typeof wellnessInferencesTable.$inferSelect;
