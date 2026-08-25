import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const JOURNEY_FOLLOW_UP_STATUSES = ["pending", "answered", "skipped"] as const;
export type JourneyFollowUpStatus = (typeof JOURNEY_FOLLOW_UP_STATUSES)[number];
export const JOURNEY_FOLLOW_UP_SOURCE_TYPES = ["journal_entry", "post_date_note", "dating_win", "journey_experiment"] as const;
export type JourneyFollowUpSourceType = (typeof JOURNEY_FOLLOW_UP_SOURCE_TYPES)[number];

/** A question the member wants to revisit after a specific Journey moment. */
export const journeyFollowUpsTable = pgTable(
  "journey_follow_ups",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    sourceId: integer("source_id").notNull(),
    sourceLabel: varchar("source_label", { length: 500 }).notNull(),
    question: text("question").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    answer: text("answer").notNull().default(""),
    answeredAt: timestamp("answered_at"),
    readinessRecordedAt: timestamp("readiness_recorded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("journey_follow_ups_user_created_idx").on(t.userId, t.createdAt),
    index("journey_follow_ups_user_status_idx").on(t.userId, t.status),
    index("journey_follow_ups_source_idx").on(t.userId, t.sourceType, t.sourceId),
  ],
);

export const insertJourneyFollowUpSchema = createInsertSchema(journeyFollowUpsTable, {
  sourceType: z.enum(JOURNEY_FOLLOW_UP_SOURCE_TYPES),
  sourceId: z.number().int().positive(),
  sourceLabel: z.string().trim().min(1).max(500),
  question: z.string().trim().min(1).max(2000),
  status: z.enum(JOURNEY_FOLLOW_UP_STATUSES),
  answer: z.string().trim().max(10000),
}).pick({ sourceType: true, sourceId: true, sourceLabel: true, question: true, status: true, answer: true }).superRefine((value, ctx) => {
  if (value.status === "answered" && !value.answer) {
    ctx.addIssue({ code: "custom", path: ["answer"], message: "An answered follow-up needs an answer." });
  }
  if (value.status !== "answered" && value.answer) {
    ctx.addIssue({ code: "custom", path: ["answer"], message: "Only answered follow-ups can contain an answer." });
  }
});

export type InsertJourneyFollowUp = z.infer<typeof insertJourneyFollowUpSchema>;
export type JourneyFollowUp = typeof journeyFollowUpsTable.$inferSelect;
