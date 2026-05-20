import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const ocrRuleReviewLogTable = pgTable("ocr_rule_review_log", {
  id: serial("id").primaryKey(),
  ruleId: text("rule_id").notNull(),
  action: text("action").notNull(),
  reviewedBy: text("reviewed_by").notNull(),
  reviewedAt: timestamp("reviewed_at").notNull().defaultNow(),
  kind: text("kind").notNull(),
  pattern: text("pattern").notNull(),
  replacement: text("replacement").notNull(),
});

export type OcrRuleReviewLog = typeof ocrRuleReviewLogTable.$inferSelect;
export type InsertOcrRuleReviewLog = typeof ocrRuleReviewLogTable.$inferInsert;
