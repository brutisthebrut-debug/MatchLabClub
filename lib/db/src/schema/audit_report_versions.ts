import { pgTable, serial, integer, jsonb, text, timestamp, index } from "drizzle-orm/pg-core";

export const auditReportVersionsTable = pgTable(
  "audit_report_versions",
  {
    id: serial("id").primaryKey(),
    auditId: integer("audit_id").notNull(),
    readinessScore: integer("readiness_score").notNull(),
    report: jsonb("report").$type<Record<string, unknown>>().notNull(),
    changeSummary: jsonb("change_summary").$type<Record<string, unknown>>(),
    engineVersion: text("engine_version"),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
  },
  (table) => [index("IDX_audit_report_versions_audit_id").on(table.auditId)],
);

export type AuditReportVersion = typeof auditReportVersionsTable.$inferSelect;
