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
 * Server-authoritative record of access that was actually paid for.
 *
 * One-time products have no accessEndsAt. Recurring Wingman access always has
 * a paid-through boundary so a canceled or failed subscription cannot grant
 * access forever merely because an old `users.tier` value survived.
 */
export const billingEntitlementsTable = pgTable(
  "billing_entitlements",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    product: varchar("product", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    source: varchar("source", { length: 24 }).notNull().default("stripe"),
    amountCents: integer("amount_cents"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    accessStartsAt: timestamp("access_starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    accessEndsAt: timestamp("access_ends_at", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    lastStripeEventCreatedAt: timestamp("last_stripe_event_created_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_billing_entitlements_user_id").on(table.userId),
    index("IDX_billing_entitlements_customer_id").on(table.stripeCustomerId),
    uniqueIndex("UQ_billing_entitlements_checkout_session").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("UQ_billing_entitlements_subscription").on(
      table.stripeSubscriptionId,
    ),
  ],
);

/**
 * The event row and its side effects are committed in one database
 * transaction. A duplicate webhook therefore becomes a safe no-op, while a
 * failed transaction rolls back the row so Stripe can retry it.
 */
export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  eventCreatedAt: timestamp("event_created_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull(),
});

export type BillingEntitlement =
  typeof billingEntitlementsTable.$inferSelect;
