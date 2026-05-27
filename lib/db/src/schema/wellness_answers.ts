import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per answered wellness question.
 *
 * Each answer carries:
 *   - the question id (stable key from the question bank)
 *   - the category / dimension it belongs to
 *   - the user's free-text (or selected) answer
 *   - consent: "coaching" | "matching" | "research" — user-controlled
 *
 * Soft-delete follows the same pattern as audits / journal entries so the
 * user can delete individual answers from the Data Vault.
 */
export const wellnessAnswersTable = pgTable(
  "wellness_answers",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable key from the question bank, e.g. "physical.confidence" */
    questionId: varchar("question_id", { length: 120 }).notNull(),
    /** Top-level dimension: emotional | physical | social | intellectual |
     *  spiritual | occupational | financial | environmental |
     *  communication | conflict | boundaries | affection | intimacy |
     *  lifestyle | future_vision | values | family | culture */
    dimension: varchar("dimension", { length: 40 }).notNull(),
    /** Sub-category within dimension, e.g. "body_experience" */
    category: varchar("category", { length: 80 }),
    /** The question text at time of answer (denormalised for audit trail) */
    questionText: text("question_text").notNull(),
    /** Free-text answer */
    answer: text("answer").notNull(),
    /** User consent choice for this answer */
    consentLevel: varchar("consent_level", { length: 20 })
      .notNull()
      .default("coaching"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("wellness_answers_user_dim_idx").on(t.userId, t.dimension),
    index("wellness_answers_anon_idx").on(t.anonymousClaimToken),
  ],
);

export const insertWellnessAnswerSchema = createInsertSchema(wellnessAnswersTable, {
  questionId: z.string().trim().min(1).max(120),
  dimension: z.string().trim().min(1).max(40),
  category: z.string().trim().max(80).nullish(),
  questionText: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(5000),
  consentLevel: z.enum(["coaching", "matching", "research"]).default("coaching"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertWellnessAnswer = z.infer<typeof insertWellnessAnswerSchema>;
export type WellnessAnswer = typeof wellnessAnswersTable.$inferSelect;
