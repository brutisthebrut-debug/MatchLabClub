import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const aiRequestMetricsTable = pgTable("ai_request_metrics", {
  id: serial("id").primaryKey(),
  toolName: text("tool_name").notNull(),
  mode: text("mode").notNull(),
  model: text("model"),
  attempts: integer("attempts").notNull().default(1),
  validated: boolean("validated"),
  isFallback: boolean("is_fallback").notNull().default(false),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AiRequestMetric = typeof aiRequestMetricsTable.$inferSelect;
export type InsertAiRequestMetric = typeof aiRequestMetricsTable.$inferInsert;
