import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One completed "predict yourself" round, stored as a private first-party
 * record. Storage, Echo use, confirmed learning, and matching use remain
 * separate member-controlled states.
 *
 * The prompts and statements live in the frontend deck. The server stores only
 * the stable item id, the predicted count, and the actual count, never any free
 * text or which individual statements were marked true. One row per (user, item)
 * via the unique index, so replaying updates in place and the distinct-round
 * count stays honest.
 */
export const predictionResponsesTable = pgTable(
  "prediction_responses",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** Stable id of the prediction round from the frontend deck. */
    itemId: varchar("item_id", { length: 64 }).notNull(),
    /** How many statements the user predicted would be true of them. */
    predicted: integer("predicted").notNull(),
    /** How many statements the user actually marked true. */
    actual: integer("actual").notNull(),
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
    uniqueIndex("prediction_user_item_idx").on(t.userId, t.itemId),
    index("prediction_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const insertPredictionResponseSchema = createInsertSchema(
  predictionResponsesTable,
  {
    itemId: z.string().trim().min(1).max(64),
    predicted: z.number().int().min(0).max(100),
    actual: z.number().int().min(0).max(100),
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

export type InsertPredictionResponse = z.infer<
  typeof insertPredictionResponseSchema
>;
export type PredictionResponseRow =
  typeof predictionResponsesTable.$inferSelect;
