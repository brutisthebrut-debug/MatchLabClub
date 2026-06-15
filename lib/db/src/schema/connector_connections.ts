import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One row per (user, provider) live data connection. PRODUCT STATE ONLY: this
 * table records that a connection exists, its lifecycle, and the last sync
 * outcome so the founder dashboard can show connector health and the user can
 * see/withdraw a source. It NEVER holds raw third-party content (events,
 * tracks, captions) and NEVER holds OAuth tokens — Google tokens are
 * Replit-managed, and any future provider refresh tokens live encrypted
 * elsewhere. The derived signal itself flows through `imported_sources` (the
 * `source` column below points at the `imported_sources.source` string the
 * connection writes), so a single readiness lane can aggregate paste + live.
 *
 * Upserted on (user_id, provider): connecting/syncing the same provider again
 * updates the existing row rather than stacking new ones.
 */
export const connectorConnectionsTable = pgTable(
  "connector_connections",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** Provider key: 'google-calendar' | 'spotify' | 'instagram-oauth'. */
    provider: varchar("provider", { length: 48 }).notNull(),
    /** Readiness lane this connection feeds (e.g. 'calendar'). */
    laneId: varchar("lane_id", { length: 48 }).notNull(),
    /** The `imported_sources.source` string this connection writes derived signal to. */
    source: varchar("source", { length: 48 }).notNull(),
    /** Lifecycle: 'connected' | 'disconnected' | 'error'. */
    status: varchar("status", { length: 24 }).notNull().default("connected"),
    /** Read-only OAuth scopes granted, for the visible consent record. */
    scopes: jsonb("scopes").$type<string[]>(),
    /** Version of the consent contract the user agreed to. */
    consentVersion: varchar("consent_version", { length: 24 }),
    /** Last time a sync was attempted (success or failure). */
    lastSyncAt: timestamp("last_sync_at"),
    /** Last time a sync succeeded. */
    lastSuccessAt: timestamp("last_success_at"),
    /** Machine-readable last error code, null when healthy. */
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    /** id of the latest `imported_sources` row this connection produced. */
    derivedImportId: integer("derived_import_id"),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
    disconnectedAt: timestamp("disconnected_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("connector_connections_user_provider_idx").on(
      t.userId,
      t.provider,
    ),
  ],
);

export type ConnectorConnection = typeof connectorConnectionsTable.$inferSelect;
