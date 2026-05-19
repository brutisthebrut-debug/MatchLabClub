import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailInsightsTable = pgTable("email_insights", {
  id: serial("id").primaryKey(),
  sourceLabel: text("source_label").notNull(),
  pastedContent: text("pasted_content").notNull(),
  consentGiven: boolean("consent_given").default(false),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailInsightSchema = createInsertSchema(emailInsightsTable).omit({ id: true, createdAt: true, status: true });
export type InsertEmailInsight = z.infer<typeof insertEmailInsightSchema>;
export type EmailInsight = typeof emailInsightsTable.$inferSelect;
