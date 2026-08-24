import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Immutable, owner-scoped Photo Lab analysis runs.
 *
 * Raw image bytes are never stored here. sourcePhotoIds reference the member's
 * durable private profile photo rows. inputSnapshot contains only declared
 * composition attributes; result contains the textual/deterministic analysis
 * and optional vision observations returned after in-memory image processing.
 * Each new row is a new version, so earlier analyses remain reopenable.
 */
export const photoLabRunsTable = pgTable(
  "photo_lab_runs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    sourcePhotoIds: integer("source_photo_ids").array().notNull().default([]),
    inputSnapshot: jsonb("input_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("photo_lab_runs_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type PhotoLabRun = typeof photoLabRunsTable.$inferSelect;
