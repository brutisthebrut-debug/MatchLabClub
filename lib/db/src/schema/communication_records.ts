import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Durable source records for the contextual Communication capability. One row
 * per member and lens replaces browser-only results without flattening their
 * source inputs or the full member-visible readout into a Mirror summary.
 */
export const communicationRecordsTable = pgTable(
  "communication_records",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    // connection_style | personal_blueprint
    lens: varchar("lens", { length: 32 }).notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    generatedBy: varchar("generated_by", { length: 24 }).notNull(),
    confidence: integer("confidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("communication_records_user_lens_uidx").on(t.userId, t.lens),
    index("communication_records_user_idx").on(t.userId),
  ],
);

export type CommunicationRecordRow = typeof communicationRecordsTable.$inferSelect;
