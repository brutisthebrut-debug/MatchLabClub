import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// NOTE: user_id intentionally has NO foreign key to users.id. Same rationale
// as ai_usage_counters: keeps anon and pre-claim flows simple. User deletes
// do not auto-cascade; the GDPR delete handler in
// artifacts/api-server/src/routes/account.ts wipes these rows explicitly.

export const matchPreferencesTable = pgTable("match_preferences", {
  userId: varchar("user_id").primaryKey(),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  distanceKm: integer("distance_km"),
  genderPreference: varchar("gender_preference"),
  dealBreakers: text("deal_breakers").array(),
  mustHaves: text("must_haves").array(),
  cityHint: varchar("city_hint"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const matchPoolMembershipTable = pgTable("match_pool_membership", {
  userId: varchar("user_id").primaryKey(),
  // 'off' | 'building' | 'ready' | 'paused' | 'concierge_only'
  status: varchar("status").notNull().default("off"),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  pausedReason: varchar("paused_reason"),
  // 'free' | 'reset' | 'wingman'
  tier: varchar("tier"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const matchProposalsTable = pgTable(
  "match_proposals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    proposedToUserId: varchar("proposed_to_user_id"),
    // 'internal' | 'external_paste' | 'concierge'
    source: varchar("source").notNull(),
    compatibilityScore: integer("compatibility_score").notNull(),
    summary: text("summary"),
    // 'proposed' | 'user_yes' | 'user_no' | 'mutual_yes' | 'expired' | 'completed'
    status: varchar("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("match_proposals_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("match_proposals_status_idx").on(t.status),
  ],
);

export const insertMatchPreferencesSchema = createInsertSchema(
  matchPreferencesTable,
  {
    ageMin: z.number().int().min(18).max(120).nullish(),
    ageMax: z.number().int().min(18).max(120).nullish(),
    distanceKm: z.number().int().min(0).max(20000).nullish(),
    genderPreference: z.string().trim().max(64).nullish(),
    dealBreakers: z.array(z.string().trim().min(1).max(120)).max(50).nullish(),
    mustHaves: z.array(z.string().trim().min(1).max(120)).max(50).nullish(),
    cityHint: z.string().trim().max(120).nullish(),
  },
).omit({ userId: true, updatedAt: true });

export const insertMatchPoolMembershipSchema = createInsertSchema(
  matchPoolMembershipTable,
  {
    status: z.enum(["off", "building", "ready", "paused", "concierge_only"]),
    pausedReason: z.string().trim().max(280).nullish(),
    tier: z.enum(["free", "reset", "wingman"]).nullish(),
  },
).omit({ userId: true, readyAt: true, updatedAt: true });

export const insertMatchProposalSchema = createInsertSchema(
  matchProposalsTable,
  {
    source: z.enum(["internal", "external_paste", "concierge"]),
    status: z
      .enum([
        "proposed",
        "user_yes",
        "user_no",
        "mutual_yes",
        "expired",
        "completed",
      ])
      .default("proposed"),
    compatibilityScore: z.number().int().min(0).max(100),
    summary: z.string().trim().max(8000).nullish(),
  },
).omit({ id: true, createdAt: true, updatedAt: true });

export type MatchPreferences = typeof matchPreferencesTable.$inferSelect;
export type InsertMatchPreferences = z.infer<typeof insertMatchPreferencesSchema>;
export type MatchPoolMembership = typeof matchPoolMembershipTable.$inferSelect;
export type InsertMatchPoolMembership = z.infer<typeof insertMatchPoolMembershipSchema>;
export type MatchProposal = typeof matchProposalsTable.$inferSelect;
export type InsertMatchProposal = z.infer<typeof insertMatchProposalSchema>;
