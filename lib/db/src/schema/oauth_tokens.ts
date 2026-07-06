import {
  pgTable,
  serial,
  varchar,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One row per (user, provider) holding the encrypted OAuth credentials for a
 * per-user consumer connector (Strava, Fitbit, Exist, and any future provider
 * that authorizes each end user individually rather than the whole Repl).
 *
 * SECURITY: `accessToken` and `refreshToken` are NEVER stored in the clear.
 * They are sealed with AES-256-GCM by `tokenCrypto.ts` before they reach this
 * table and unsealed only in-process at sync time. This table is the ONLY place
 * tokens live; `connector_connections` remains product-state only and never
 * holds a token. Everything else about a connection (lifecycle, last sync, the
 * derived count) lives in `connector_connections` / `imported_sources`.
 *
 * Removing a source (trust-ledger purge, disconnect, or account deletion)
 * deletes the matching row here so no credential outlives the user's consent.
 *
 * Upserted on (user_id, provider): re-authorizing the same provider replaces
 * the stored credentials rather than stacking new rows.
 */
export const oauthTokensTable = pgTable(
  "oauth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    /** Provider key: 'strava' | 'fitbit' | 'exist'. */
    provider: varchar("provider", { length: 48 }).notNull(),
    /** AES-256-GCM sealed access token (never plaintext). */
    accessToken: text("access_token").notNull(),
    /** AES-256-GCM sealed refresh token, when the provider issues one. */
    refreshToken: text("refresh_token"),
    /** Read-only OAuth scopes granted, for the visible consent record. */
    scopes: jsonb("scopes").$type<string[]>(),
    /** When the access token expires, so a sync can refresh proactively. */
    expiresAt: timestamp("expires_at"),
    /** The provider's own account id, kept for token refresh and de-dupe. */
    providerUserId: varchar("provider_user_id", { length: 128 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("oauth_tokens_user_provider_idx").on(t.userId, t.provider),
  ],
);

export type OauthToken = typeof oauthTokensTable.$inferSelect;
