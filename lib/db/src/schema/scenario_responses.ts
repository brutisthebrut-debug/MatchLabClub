import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One response to a "what would you do" scenario reel. The option is stored as
 * a private first-party record. Storage, Echo use, confirmed learning, and
 * matching use remain separate member-controlled states.
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
    /** Saving never grants downstream use. */
    echoUseAllowed: boolean("echo_use_allowed").notNull().default(false),
    echoUseUpdatedAt: timestamp("echo_use_updated_at"),
    learningConfirmed: boolean("learning_confirmed").notNull().default(false),
    learningConfirmedAt: timestamp("learning_confirmed_at"),
    matchingUseAllowed: boolean("matching_use_allowed").notNull().default(false),
    matchingUseUpdatedAt: timestamp("matching_use_updated_at"),
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
  echoUseAllowed: true,
  echoUseUpdatedAt: true,
  learningConfirmed: true,
  learningConfirmedAt: true,
  matchingUseAllowed: true,
  matchingUseUpdatedAt: true,
});

export type InsertScenarioResponse = z.infer<
  typeof insertScenarioResponseSchema
>;
export type ScenarioResponseRow = typeof scenarioResponsesTable.$inferSelect;
