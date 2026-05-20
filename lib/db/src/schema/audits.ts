import { pgTable, text, serial, integer, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type OcrCorrectionField =
  | "firstName"
  | "age"
  | "sourceApp"
  | "bio"
  | "prompts";

export type OcrCorrectionEntry = {
  raw: string | number | string[] | null;
  corrected: string | number | string[] | null;
};

export type OcrCorrectionsRecord = Partial<Record<OcrCorrectionField, OcrCorrectionEntry>>;

export const auditsTable = pgTable(
  "audits",
  {
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
    sourceApp: text("source_app"),
    status: text("status").notNull().default("pending"),
    source: text("source").notNull().default("manual"),
    readinessScore: integer("readiness_score"),
    report: jsonb("report").$type<Record<string, unknown>>(),
    reportGeneratedAt: timestamp("report_generated_at"),
    previousReport: jsonb("previous_report").$type<Record<string, unknown>>(),
    previousReadinessScore: integer("previous_readiness_score"),
    previousReportGeneratedAt: timestamp("previous_report_generated_at"),
    rawOcrText: text("raw_ocr_text"),
    ocrCorrections: jsonb("ocr_corrections").$type<OcrCorrectionsRecord>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("IDX_audits_first_name_trgm").using("gin", sql`${table.firstName} gin_trgm_ops`),
    index("IDX_audits_bio_trgm").using("gin", sql`${table.bio} gin_trgm_ops`),
  ],
);

export const insertAuditSchema = createInsertSchema(auditsTable).omit({ id: true, createdAt: true, status: true, readinessScore: true, userId: true, report: true });
export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type Audit = typeof auditsTable.$inferSelect;
