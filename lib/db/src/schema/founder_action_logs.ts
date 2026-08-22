import {
  bigserial,
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Append-only audit trail for every authenticated founder/admin request.
 *
 * The middleware writes one row after the response finishes. Application code
 * exposes no update or delete path for this table. Paths are stored without a
 * query string so secrets and member-entered search text cannot leak into the
 * audit trail.
 */
export const founderActionLogsTable = pgTable(
  "founder_action_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: varchar("actor_user_id").notNull(),
    method: varchar("method", { length: 12 }).notNull(),
    path: varchar("path", { length: 512 }).notNull(),
    statusCode: integer("status_code").notNull(),
    ip: varchar("ip", { length: 128 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("founder_action_logs_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("founder_action_logs_created_idx").on(table.createdAt),
  ],
);

export type FounderActionLog = typeof founderActionLogsTable.$inferSelect;
