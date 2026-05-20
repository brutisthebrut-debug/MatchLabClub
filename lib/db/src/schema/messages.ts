import { pgTable, text, serial, integer, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageCoachingSessionsTable = pgTable("message_coaching_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  anonymousClaimToken: varchar("anonymous_claim_token"),
  matchName: text("match_name").notNull(),
  conversationContext: text("conversation_context").notNull(),
  yourLastMessage: text("your_last_message").notNull(),
  goal: text("goal"),
  sourceApp: text("source_app"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageCoachingSessionSchema = createInsertSchema(messageCoachingSessionsTable).omit({ id: true, createdAt: true, status: true, userId: true });
export type InsertMessageCoachingSession = z.infer<typeof insertMessageCoachingSessionSchema>;
export type MessageCoachingSession = typeof messageCoachingSessionsTable.$inferSelect;

export const coachFollowUpsTable = pgTable(
  "coach_follow_ups",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    sessionId: integer("session_id"),
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("IDX_coach_follow_ups_user").on(table.userId),
    index("IDX_coach_follow_ups_anon").on(table.anonymousClaimToken),
  ],
);

export type CoachFollowUp = typeof coachFollowUpsTable.$inferSelect;
