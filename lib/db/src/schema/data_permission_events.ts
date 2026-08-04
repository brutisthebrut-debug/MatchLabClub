import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const DATA_PERMISSION_PURPOSES = [
  "echo",
  "mirror",
  "matching",
  "research",
] as const;

export const DATA_PERMISSION_ACTORS = [
  "member",
  "system",
  "founder",
  "migration",
] as const;

/**
 * Append-only audit trail for purpose-specific data permissions.
 *
 * This table stores no raw member content. It records who changed which
 * purpose, for which resource, and when. Resource rows and their events are
 * purged together by source deletion and account deletion.
 */
export const dataPermissionEventsTable = pgTable(
  "data_permission_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id").notNull(),
    resourceType: varchar("resource_type", { length: 48 }).notNull(),
    resourceId: varchar("resource_id", { length: 120 }).notNull(),
    purpose: varchar("purpose", { length: 24 }).notNull(),
    granted: boolean("granted").notNull(),
    actorType: varchar("actor_type", { length: 24 }).notNull(),
    actorId: varchar("actor_id"),
    reason: varchar("reason", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("IDX_data_permission_events_user_resource").on(
      table.userId,
      table.resourceType,
      table.resourceId,
    ),
    index("IDX_data_permission_events_user_created").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type DataPermissionEvent =
  typeof dataPermissionEventsTable.$inferSelect;
