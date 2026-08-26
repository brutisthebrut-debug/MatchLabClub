import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The two sides of a Would You Rather prompt. Stored as a single char so the
 * deck can grow without a migration; the Zod schema enforces the bounded set at
 * the API edge.
 */
export const WYR_CHOICES = ["a", "b"] as const;
export type WyrChoice = (typeof WYR_CHOICES)[number];

/**
 * One answer to a daily Would You Rather prompt. A forced binary tradeoff
 * is stored as a private first-party record. Storage, Echo use, confirmed
 * learning, and matching use remain separate member-controlled states.
 *
 * The prompt content lives in the frontend deck; the server stores only the
 * stable prompt id and the side chosen, never any free text. One row per
 * (user, prompt) via the unique index, so changing your mind updates in place
 * and the distinct-prompt count stays honest.
 */
export const wyrAnswersTable = pgTable(
  "wyr_answers",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable id of the prompt from the frontend deck. */
    promptId: varchar("prompt_id", { length: 64 }).notNull(),
    /** One of WYR_CHOICES: which side they picked. */
    choice: varchar("choice", { length: 1 }).notNull(),
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
  (t) => [
    uniqueIndex("wyr_user_prompt_idx").on(t.userId, t.promptId),
    index("wyr_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const insertWyrAnswerSchema = createInsertSchema(wyrAnswersTable, {
  promptId: z.string().trim().min(1).max(64),
  choice: z.enum(WYR_CHOICES),
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

export type InsertWyrAnswer = z.infer<typeof insertWyrAnswerSchema>;
export type WyrAnswerRow = typeof wyrAnswersTable.$inferSelect;
