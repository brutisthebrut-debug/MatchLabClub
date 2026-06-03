import {
  pgTable,
  serial,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One response to a "what would you do" scenario reel. Each scenario presents a
 * realistic relationship moment and a small set of responses; which one a person
 * reaches for reveals their communication and conflict style more honestly than
 * a stated preference, so each distinct scenario answered feeds matching
 * readiness as its own low-weight lane.
 *
 * The scenario text and the response options live in the frontend deck. The
 * server stores only the stable scenario id and the option id chosen, never any
 * free text. One row per (user, scenario) via the unique index, so changing your
 * mind updates in place and the distinct-scenario count stays honest.
 */
export const scenarioResponsesTable = pgTable(
  "scenario_responses",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable id of the scenario from the frontend deck. */
    scenarioId: varchar("scenario_id", { length: 64 }).notNull(),
    /** Stable id of the chosen response option from the frontend deck. */
    optionId: varchar("option_id", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("scenario_user_scenario_idx").on(t.userId, t.scenarioId),
    index("scenario_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const insertScenarioResponseSchema = createInsertSchema(
  scenarioResponsesTable,
  {
    scenarioId: z.string().trim().min(1).max(64),
    optionId: z.string().trim().min(1).max(16),
  },
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  anonymousClaimToken: true,
});

export type InsertScenarioResponse = z.infer<
  typeof insertScenarioResponseSchema
>;
export type ScenarioResponseRow = typeof scenarioResponsesTable.$inferSelect;
