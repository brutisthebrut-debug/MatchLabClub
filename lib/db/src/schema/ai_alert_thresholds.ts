import { pgTable, text, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const AI_ALERT_GLOBAL_KEY = "__global__";

export const aiAlertThresholdsTable = pgTable("ai_alert_thresholds", {
  toolName: text("tool_name").primaryKey(),
  windowSize: integer("window_size").notNull(),
  minSample: integer("min_sample").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AiAlertThreshold = typeof aiAlertThresholdsTable.$inferSelect;
export type InsertAiAlertThreshold = typeof aiAlertThresholdsTable.$inferInsert;
