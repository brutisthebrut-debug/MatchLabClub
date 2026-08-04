import type Stripe from "stripe";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { PAID_PLAN_KEYS } from "./commercialPlans";
import { getUncachableStripeClient } from "./stripeClient";
import {
  buildStripePricePlanMap,
  decideCommercialEntitlement,
  stripeObjectId,
  type SubscriptionLike,
} from "./subscriptionEntitlements";
import { logger } from "./logger";

const RELEVANT_EVENT_PREFIXES = [
  "customer.subscription.",
  "invoice.",
  "credit_note.",
] as const;

const RELEVANT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
]);

function eventCanChangeEntitlement(eventType: string): boolean {
  return (
    RELEVANT_EVENT_TYPES.has(eventType) ||
    RELEVANT_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))
  );
}

function eventCustomerId(event: Stripe.Event): string | null {
  const object = event.data.object as unknown as {
    customer?: string | { id?: string | null } | null;
  };
  return stripeObjectId(object.customer);
}

function metadataUserId(
  subscriptions: readonly Stripe.Subscription[],
  customer: Stripe.Customer,
): string | null {
  const fromSubscription = subscriptions
    .map(
      (subscription) =>
        subscription.metadata?.["matchlabUserId"] ??
        subscription.metadata?.["userId"],
    )
    .find(Boolean);
  return (
    fromSubscription ??
    customer.metadata?.["matchlabUserId"] ??
    customer.metadata?.["userId"] ??
    null
  );
}

async function findMatchLabUser(
  subscriptions: readonly Stripe.Subscription[],
  customer: Stripe.Customer,
) {
  const userId = metadataUserId(subscriptions, customer);
  if (userId) {
    const rows = await db
      .select({
        id: usersTable.id,
        tier: usersTable.tier,
        tierGrantedAt: usersTable.tierGrantedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (rows[0]) return rows[0];
  }

  const email = customer.email?.trim().toLowerCase();
  if (!email) return null;
  const rows = await db
    .select({
      id: usersTable.id,
      tier: usersTable.tier,
      tierGrantedAt: usersTable.tierGrantedAt,
    })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .limit(1);
  return rows[0] ?? null;
}

export interface SubscriptionReconcileResult {
  customerId: string;
  userId: string | null;
  action: "grant" | "preserve" | "revoke" | "ignore" | "founder_override";
  planKey: string | null;
}

/**
 * Recompute one customer's commercial entitlement from Stripe's current state.
 * We never trust webhook ordering, and we never mutate the managed stripe.*
 * schema. A founder grant (tier_granted_at is set) is an explicit controlled-
 * beta override and remains untouched by billing events.
 */
export async function reconcileStripeCustomerCommercialPlan(
  customerId: string,
): Promise<SubscriptionReconcileResult> {
  const stripe = await getUncachableStripeClient();
  const [customerResult, subscriptionsResult] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    }),
  ]);

  if (customerResult.deleted) {
    return {
      customerId,
      userId: null,
      action: "ignore",
      planKey: null,
    };
  }

  const customer = customerResult as Stripe.Customer;
  const subscriptions = subscriptionsResult.data;
  const user = await findMatchLabUser(subscriptions, customer);
  if (!user) {
    logger.warn({ customerId }, "stripe.plan_sync.user_not_found");
    return {
      customerId,
      userId: null,
      action: "ignore",
      planKey: null,
    };
  }

  if (user.tierGrantedAt) {
    return {
      customerId,
      userId: user.id,
      action: "founder_override",
      planKey: user.tier,
    };
  }

  const decision = decideCommercialEntitlement(
    subscriptions as SubscriptionLike[],
    buildStripePricePlanMap(),
    process.env["STRIPE_ENABLE_GUIDED"] === "true",
  );

  if (decision.action === "grant") {
    await db
      .update(usersTable)
      .set({
        tier: decision.planKey,
        tierGrantedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(usersTable.id, user.id), isNull(usersTable.tierGrantedAt)));
  } else if (
    decision.action === "revoke" &&
    PAID_PLAN_KEYS.includes(user.tier as (typeof PAID_PLAN_KEYS)[number])
  ) {
    await db
      .update(usersTable)
      .set({ tier: "member", tierGrantedAt: null, updatedAt: new Date() })
      .where(and(eq(usersTable.id, user.id), isNull(usersTable.tierGrantedAt)));
  }

  const result: SubscriptionReconcileResult = {
    customerId,
    userId: user.id,
    action: decision.action,
    planKey: decision.planKey,
  };
  logger.info(result, "stripe.plan_sync.complete");
  return result;
}

export async function processCommercialPlanStripeEvent(
  event: Stripe.Event,
): Promise<SubscriptionReconcileResult | null> {
  if (!eventCanChangeEntitlement(event.type)) return null;
  const customerId = eventCustomerId(event);
  if (!customerId) {
    logger.warn(
      { eventId: event.id, eventType: event.type },
      "stripe.plan_sync.customer_missing",
    );
    return null;
  }
  return reconcileStripeCustomerCommercialPlan(customerId);
}

/**
 * Startup recovery for missed webhooks. The beta cap prevents an accidental
 * unbounded account sweep; duplicate customers collapse into one reconciliation.
 */
export async function reconcileAllStripeCommercialPlans(): Promise<{
  customersSeen: number;
  customersReconciled: number;
  truncated: boolean;
}> {
  const stripe = await getUncachableStripeClient();
  const maxCustomers = Math.max(
    1,
    Number.parseInt(
      process.env["STRIPE_RECONCILE_MAX_CUSTOMERS"] ?? "500",
      10,
    ) || 500,
  );
  const customerIds = new Set<string>();
  let truncated = false;

  for await (const subscription of stripe.subscriptions.list({
    status: "all",
    limit: 100,
  })) {
    const customerId = stripeObjectId(subscription.customer);
    if (!customerId) continue;
    customerIds.add(customerId);
    if (customerIds.size >= maxCustomers) {
      truncated = true;
      break;
    }
  }

  let customersReconciled = 0;
  for (const customerId of customerIds) {
    await reconcileStripeCustomerCommercialPlan(customerId);
    customersReconciled += 1;
  }

  return {
    customersSeen: customerIds.size,
    customersReconciled,
    truncated,
  };
}
