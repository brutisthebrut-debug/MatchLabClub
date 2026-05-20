import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditsTable = pgTable("audits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  anonymousClaimToken: varchar("anonymous_claim_token"),
  firstName: text("first_name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  orientation: text("orientation"),
  datingGoal: text("dating_goal").notNull(),
  currentApps: text("current_apps").array().notNull().default([]),
  bio: text("bio").notNull(),
  prompts: text("prompts"),
  recentMessageSample: text("recent_message_sample"),
  photoCount: integer("photo_count"),
  relationshipHistory: text("relationship_history"),
  biggestChallenge: text("biggest_challenge"),
  status: text("status").notNull().default("pending"),
  readinessScore: integer("readiness_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true, status: true, readinessScore: true, userId: true });
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
