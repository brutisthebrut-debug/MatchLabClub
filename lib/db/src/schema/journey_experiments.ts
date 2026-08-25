import { index, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const JOURNEY_EXPERIMENT_STATUSES = ["planned", "tried", "helped", "did-not-help"] as const;
export type JourneyExperimentStatus = (typeof JOURNEY_EXPERIMENT_STATUSES)[number];

/**
 * A concrete behavior the member intends to try and what they learned from it.
 * This replaces the old browser-only experiment cards with an account-backed,
 * recoverable record that Journey can own without parsing journal prose.
 */
export const journeyExperimentsTable = pgTable(
  "journey_experiments",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 24 }).notNull().default("planned"),
    result: text("result").notNull().default(""),
    triedAt: timestamp("tried_at"),
    readinessRecordedAt: timestamp("readiness_recorded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("journey_experiments_user_created_idx").on(t.userId, t.createdAt),
    index("journey_experiments_user_status_idx").on(t.userId, t.status),
  ],
);

export const insertJourneyExperimentSchema = createInsertSchema(journeyExperimentsTable, {
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000),
  status: z.enum(JOURNEY_EXPERIMENT_STATUSES),
  result: z.string().trim().max(5000),
}).pick({ title: true, description: true, status: true, result: true });

export type InsertJourneyExperiment = z.infer<typeof insertJourneyExperimentSchema>;
export type JourneyExperiment = typeof journeyExperimentsTable.$inferSelect;
