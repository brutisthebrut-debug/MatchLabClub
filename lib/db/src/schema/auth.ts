import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
    userId: varchar("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ip: varchar("ip"),
    channel: varchar("channel"),
  },
  (table) => [
    index("IDX_session_expire").on(table.expire),
    index("IDX_session_user_id").on(table.userId),
  ],
);

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const usersTable = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Authorization is server-owned. Never infer elevated access from a browser
  // header or a client-bundled secret. Values: 'member' | 'founder' | 'admin'.
  role: varchar("role", { length: 24 }).notNull().default("member"),
  // Account-level consent for sending the user's own content to a hosted LLM
  // (Anthropic via Replit AI Integrations). When false/null, AI tools that
  // opt in to this gate fall back to deterministic output.
  aiContentConsentGranted: boolean("ai_content_consent_granted")
    .notNull()
    .default(false),
  aiContentConsentGrantedAt: timestamp("ai_content_consent_granted_at", {
    withTimezone: true,
  }),
  aiContentConsentRevokedAt: timestamp("ai_content_consent_revoked_at", {
    withTimezone: true,
  }),
  // Last time the consent boolean flipped (grant or revoke). Powers the
  // simplified `/me/consent` endpoint which exposes a single timestamp
  // alongside the current state.
  aiContentConsentUpdatedAt: timestamp("ai_content_consent_updated_at", {
    withTimezone: true,
  }),
  // Referral attribution — populated on signup from the `mlc_ref` cookie if
  // the user landed via an Echo share URL with `?ref=user-<inviterId>`.
  invitedByUserId: varchar("invited_by_user_id"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  // Compatibility cache for access checks and matching routing. The durable
  // authority is billing_entitlements; webhook reconciliation keeps this value
  // at the highest currently active tier. Values: null, 'reset', 'wingman'.
  tier: varchar("tier"),
  tierGrantedAt: timestamp("tier_granted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
