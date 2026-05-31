import {
  pgTable,
  varchar,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/**
 * Per-user controls and state for the proactive Mirror digest lifecycle.
 *
 * `frequency` is the user-facing preference ("weekly" | "biweekly" | "off").
 * The remaining columns are job state: when we last sent a digest and the
 * readiness score + breakdown captured at that send, so the next digest can
 * report what changed without depending on snapshot write timing.
 */
export const mirrorDigestPrefsTable = pgTable("mirror_digest_prefs", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  frequency: varchar("frequency", { length: 16 }).notNull().default("weekly"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  lastScore: integer("last_score"),
  lastBreakdown: jsonb("last_breakdown").$type<Record<string, number>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
