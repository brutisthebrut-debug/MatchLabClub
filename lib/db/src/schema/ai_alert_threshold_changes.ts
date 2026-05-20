import { pgTable, serial, text, integer, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";

export const aiAlertThresholdChangesTable = pgTable(
  "ai_alert_threshold_changes",
  {
    id: serial("id").primaryKey(),
    toolName: text("tool_name").notNull(),
    action: text("action").notNull(),
    oldWindowSize: integer("old_window_size"),
    oldMinSample: integer("old_min_sample"),
    oldThreshold: doublePrecision("old_threshold"),
    newWindowSize: integer("new_window_size"),
    newMinSample: integer("new_min_sample"),
    newThreshold: doublePrecision("new_threshold"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("ai_alert_threshold_changes_created_at_idx").on(t.createdAt),
  }),
);

export type AiAlertThresholdChange = typeof aiAlertThresholdChangesTable.$inferSelect;
export type InsertAiAlertThresholdChange = typeof aiAlertThresholdChangesTable.$inferInsert;
