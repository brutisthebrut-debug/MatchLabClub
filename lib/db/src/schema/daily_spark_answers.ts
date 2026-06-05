import {
  pgTable,
  serial,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One answer to a Daily Spark question. A single daily reflective prompt with a
 * small set of choices builds a habit and a steady read on how someone thinks
 * about connection over time. Answering across days, not in one burst, is the
 * point, so each answer also feeds the daily consistency lane.
 *
 * The prompt content lives in the frontend deck; the server stores only the
 * stable question id and the option key chosen, never any free text. One row per
 * (user, question) via the unique index, so changing your mind updates in place
 * and the distinct-question count stays honest.
 */
export const dailySparkAnswersTable = pgTable(
  "daily_spark_answers",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable id of the question from the frontend deck. */
    questionId: varchar("question_id", { length: 64 }).notNull(),
    /** Stable key of the chosen option from the frontend deck. */
    choice: varchar("choice", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_spark_user_question_idx").on(t.userId, t.questionId),
    index("daily_spark_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const insertDailySparkAnswerSchema = createInsertSchema(
  dailySparkAnswersTable,
  {
    questionId: z.string().trim().min(1).max(64),
    choice: z.string().trim().min(1).max(64),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertDailySparkAnswer = z.infer<typeof insertDailySparkAnswerSchema>;
export type DailySparkAnswerRow = typeof dailySparkAnswersTable.$inferSelect;
