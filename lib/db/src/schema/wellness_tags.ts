import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Compatibility insight tags derived from wellness answers.
 *
 * Tags are generated server-side from patterns in wellness answers
 * and are always editable / deletable by the user.
 *
 * Examples: "direct-communicator", "touch-forward", "security-oriented",
 * "repair-focused", "future-family-oriented", "routine-driven".
 */
export const wellnessTagsTable = pgTable(
  "wellness_tags",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    /** Stable slug, e.g. "direct-communicator" */
    tag: varchar("tag", { length: 80 }).notNull(),
    /** Human-readable label, e.g. "Direct communicator" */
    label: varchar("label", { length: 120 }).notNull(),
    /** Category the tag belongs to for grouping in UI */
    category: varchar("category", { length: 40 }).notNull(),
    /** Whether user has approved this tag for matching use */
    approvedForMatching: boolean("approved_for_matching").notNull().default(false),
    /** Whether user has hidden this tag from their profile */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("wellness_tags_user_idx").on(t.userId),
    index("wellness_tags_user_tag_idx").on(t.userId, t.tag),
  ],
);

export const insertWellnessTagSchema = createInsertSchema(wellnessTagsTable, {
  tag: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  approvedForMatching: z.boolean().default(false),
  hidden: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export type InsertWellnessTag = z.infer<typeof insertWellnessTagSchema>;
export type WellnessTag = typeof wellnessTagsTable.$inferSelect;
