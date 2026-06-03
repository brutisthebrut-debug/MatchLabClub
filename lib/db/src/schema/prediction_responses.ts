import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One completed "predict yourself" round. Before working through a short set of
 * self-descriptive statements, the user first predicts how many will be true of
 * them. The gap between that prediction and the actual count is a deterministic
 * read on self-awareness, so each distinct round completed feeds matching
 * readiness as its own low-weight lane.
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
});

export type InsertPredictionResponse = z.infer<
  typeof insertPredictionResponseSchema
>;
export type PredictionResponseRow =
  typeof predictionResponsesTable.$inferSelect;
