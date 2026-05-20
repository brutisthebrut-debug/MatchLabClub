import { pgTable, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type OcrLearnedRuleKind =
  | "nameSubstitution"
  | "sourceAppOverride"
  | "promptAddition";

export type OcrRuleStatus = "pending" | "approved" | "rejected";

export const ocrLearnedRulesTable = pgTable(
  "ocr_learned_rules",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    pattern: text("pattern").notNull(),
    replacement: text("replacement").notNull(),
    scope: text("scope"),
    occurrences: integer("occurrences").notNull().default(0),
    status: text("status").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    learnedAt: timestamp("learned_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("UQ_ocr_learned_rules_kind_pattern_scope").on(
      table.kind,
      table.pattern,
      table.scope,
    ),
  ],
);

export type OcrLearnedRule = typeof ocrLearnedRulesTable.$inferSelect;
export type InsertOcrLearnedRule = typeof ocrLearnedRulesTable.$inferInsert;
