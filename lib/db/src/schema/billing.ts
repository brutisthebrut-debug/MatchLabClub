import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Durable billing state owned by MatchLab. Stripe remains the payment processor;
 * this table is the authority for what product access the app may grant.
 */
export const billingEntitlementsTable = pgTable(
  "billing_entitlements",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    email: text("email").notNull(),
    product: varchar("product", { length: 32 }).notNull(),
    tier: varchar("tier", { length: 24 }),
    kind: varchar("kind", { length: 24 }).notNull(), // one_time | subscription
    status: varchar("status", { length: 32 }).notNull(),
    amountCents: integer("amount_cents"),
    currency: varchar("currency", { length: 8 }),
    stripeCustomerId: varchar("stripe_customer_id"),
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id"),
    stripeSubscriptionId: varchar("stripe_subscription_id"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    lastStripeEventId: varchar("last_stripe_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("billing_entitlements_user_idx").on(table.userId),
    index("billing_entitlements_email_idx").on(table.email),
    index("billing_entitlements_customer_idx").on(table.stripeCustomerId),
    index("billing_entitlements_status_idx").on(table.status),
    uniqueIndex("billing_entitlements_checkout_session_unique").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("billing_entitlements_subscription_unique").on(
      table.stripeSubscriptionId,
    ),
  ],
);

/** Minimal idempotency/operations ledger; raw Stripe payloads are not stored. */
export const stripeEventsTable = pgTable(
  "stripe_events",
  {
    eventId: varchar("event_id").primaryKey(),
    type: varchar("type", { length: 128 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("processing"),
    error: text("error"),
    stripeCreatedAt: timestamp("stripe_created_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("stripe_events_status_idx").on(table.status)],
);

export type BillingEntitlement = typeof billingEntitlementsTable.$inferSelect;
export type StripeEventRecord = typeof stripeEventsTable.$inferSelect;
