import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageCoachingSessionsTable = pgTable("message_coaching_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  matchName: text("match_name").notNull(),
  conversationContext: text("conversation_context").notNull(),
  yourLastMessage: text("your_last_message").notNull(),
  goal: text("goal"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageCoachingSessionSchema = createInsertSchema(messageCoachingSessionsTable).omit({ id: true, createdAt: true, status: true, userId: true });
export type InsertMessageCoachingSession = z.infer<typeof insertMessageCoachingSessionSchema>;
export type MessageCoachingSession = typeof messageCoachingSessionsTable.$inferSelect;
