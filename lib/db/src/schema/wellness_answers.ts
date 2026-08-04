import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
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
 *   - four purpose-specific permission states. Saving an answer does not grant
 *     Echo, Mirror, matching, or research use. Each starts false and is changed
 *     through the dedicated permission endpoint.
 *   - consentLevel remains only as a legacy compatibility field. New rows use
 *     "coaching"; no product decision may infer permission from that column.
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
    /** Deprecated legacy capture scope. Purpose permissions below are canonical. */
    consentLevel: varchar("consent_level", { length: 20 })
      .notNull()
      .default("coaching"),
    /** May Echo use this answer as conversational context? */
    echoUseApproved: boolean("echo_use_approved").notNull().default(false),
    /** Has the member confirmed this answer as part of their visible Mirror? */
    mirrorConfirmed: boolean("mirror_confirmed").notNull().default(false),
    /** May this answer contribute to matching readiness or compatibility? */
    matchingUseApproved: boolean("matching_use_approved")
      .notNull()
      .default(false),
    /** May this answer be used for research? Never implied by product use. */
    researchUseApproved: boolean("research_use_approved")
      .notNull()
      .default(false),
    /** Last explicit permission change, separate from answer content edits. */
    permissionUpdatedAt: timestamp("permission_updated_at", {
      withTimezone: true,
    }),
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
  consentLevel: z
    .enum(["coaching", "matching", "research", "all"])
    .default("coaching"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  userId: true,
  anonymousClaimToken: true,
  echoUseApproved: true,
  mirrorConfirmed: true,
  matchingUseApproved: true,
  researchUseApproved: true,
  permissionUpdatedAt: true,
});

export type InsertWellnessAnswer = z.infer<typeof insertWellnessAnswerSchema>;
export type WellnessAnswer = typeof wellnessAnswersTable.$inferSelect;
