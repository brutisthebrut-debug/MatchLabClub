import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Echo's own derived notes about a person: the things it noticed without being
 * asked. Each observation is derived from real signal coverage (never raw
 * content). `severity` is "praise", "note", or "challenge" so the UI and the
 * candor engine can weight honest, harder feedback distinctly from
 * encouragement. `signalId` optionally ties the note to a signal-registry lane.
 *
 * No foreign key on user_id; the GDPR delete handler wipes these rows.
 */
export const companionObservationsTable = pgTable(
  "companion_observations",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    kind: varchar("kind").notNull(),
    severity: varchar("severity").notNull().default("note"),
    body: text("body").notNull(),
    signalId: varchar("signal_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (t) => [index("companion_observations_user_idx").on(t.userId, t.createdAt)],
);

export type CompanionObservation =
  typeof companionObservationsTable.$inferSelect;
