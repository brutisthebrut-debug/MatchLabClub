import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Trust & Safety verification state, one row per person. This is the product
 * layer over bought regulated primitives (Twilio Verify for phone, later Stripe
 * Identity for selfie + government ID). We deliberately store only the RESULT of
 * a check, never the underlying phone number, code, selfie, or document. A
 * passed check is a single boolean plus the moment it cleared.
 *
 * Verification is SOFT throughout the product: a verified member ranks a little
 * higher and wears a badge, but it never gates a match, never narrows who can be
 * matched, and is never required to use anything. Inclusivity is non-negotiable.
 *
 * The row is created lazily, only on the first successful check, so an empty
 * table means "nobody verified yet" rather than a row of falses per user.
 * Downstream tiers (selfie, government ID) add their own boolean + timestamp
 * columns here as they ship.
 */
export const userVerificationsTable = pgTable(
  "user_verifications",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    anonymousClaimToken: varchar("anonymous_claim_token"),
    /** True once a phone number cleared a Twilio Verify (or log-fallback) check. */
    phoneVerified: boolean("phone_verified").notNull().default(false),
    /** When the phone check cleared. Null until it does. */
    phoneVerifiedAt: timestamp("phone_verified_at"),
    /**
     * True once a government ID cleared a Stripe Identity check. Stripe holds the
     * document; we keep only this boolean and the moment it cleared.
     */
    idVerified: boolean("id_verified").notNull().default(false),
    /** When the government ID check cleared. Null until it does. */
    idVerifiedAt: timestamp("id_verified_at"),
    /**
     * True when the Stripe Identity check confirmed the holder is 18 or older.
     * Derived from the document date of birth inside Stripe's verified outputs and
     * then discarded: we store only this boolean, never the date of birth itself.
     */
    ageOver18: boolean("age_over_18").notNull().default(false),
    /**
     * The Stripe Identity VerificationSession id, our provider reference for the
     * ID check. It points at Stripe's record; no document or image lives here.
     */
    stripeVerificationSessionId: varchar("stripe_verification_session_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_verifications_user_idx").on(t.userId)],
);

export type UserVerificationRow = typeof userVerificationsTable.$inferSelect;
