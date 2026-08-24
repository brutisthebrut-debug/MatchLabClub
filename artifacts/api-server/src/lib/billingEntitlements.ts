import type Stripe from "stripe";
import {
  billingEntitlementsTable,
  db,
  purchaseInterestTable,
  stripeEventsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";
import { recordJourneyEvent } from "./journeyEvents";

export const BILLING_PRODUCTS = [
  "signal-audit",
  "dating-reset",
  "wingman",
] as const;
export type BillingProduct = (typeof BILLING_PRODUCTS)[number];

const PRODUCT_CONFIG: Record<
  BillingProduct,
  { tier: "reset" | "wingman" | null; kind: "one_time" | "subscription"; priceEnv: string }
> = {
  "signal-audit": {
    tier: null,
    kind: "one_time",
    priceEnv: "STRIPE_PRICE_SIGNAL_AUDIT",
  },
  "dating-reset": {
    tier: "reset",
    kind: "one_time",
    priceEnv: "STRIPE_PRICE_DATING_RESET",
  },
  wingman: {
    tier: "wingman",
    kind: "subscription",
    priceEnv: "STRIPE_PRICE_WINGMAN",
  },
};

const ACCESS_STATUSES = ["active", "trialing", "canceling"];

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function fromUnix(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

function isProduct(value: unknown): value is BillingProduct {
  return typeof value === "string" && BILLING_PRODUCTS.includes(value as BillingProduct);
}

export function configuredPriceId(product: BillingProduct): string | null {
  return process.env[PRODUCT_CONFIG[product].priceEnv]?.trim() || null;
}

export function isBillingProductLive(product: BillingProduct): boolean {
  const configured = process.env["BILLING_LIVE_PRODUCTS"]
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.includes(product) ?? false;
}

export function inferProduct(
  metadata: Stripe.Metadata | null | undefined,
  priceId?: string | null,
): BillingProduct | null {
  if (isProduct(metadata?.["product"])) return metadata.product;
  if (priceId) {
    for (const product of BILLING_PRODUCTS) {
      if (configuredPriceId(product) === priceId) return product;
    }
  }
  return null;
}

async function resolveUser(
  requestedUserId: string | null,
  email: string,
): Promise<{ id: string; email: string | null; tier: string | null; tierGrantedAt: Date | null } | null> {
  if (requestedUserId) {
    const [byId] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        tier: usersTable.tier,
        tierGrantedAt: usersTable.tierGrantedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, requestedUserId))
      .limit(1);
    if (byId) return byId;
  }
  const [byEmail] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      tier: usersTable.tier,
      tierGrantedAt: usersTable.tierGrantedAt,
    })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`)
    .limit(1);
  return byEmail ?? null;
}

async function syncUserTier(userId: string, email: string): Promise<void> {
  const entitlements = await db
    .select({ tier: billingEntitlementsTable.tier })
    .from(billingEntitlementsTable)
    .where(
      and(
        or(
          eq(billingEntitlementsTable.userId, userId),
          sql`lower(${billingEntitlementsTable.email}) = lower(${email})`,
        ),
        inArray(billingEntitlementsTable.status, ACCESS_STATUSES),
      ),
    );
  const nextTier = entitlements.some((row) => row.tier === "wingman")
    ? "wingman"
    : entitlements.some((row) => row.tier === "reset")
      ? "reset"
      : null;
  const [current] = await db
    .select({ tier: usersTable.tier, tierGrantedAt: usersTable.tierGrantedAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  await db
    .update(usersTable)
    .set({
      tier: nextTier,
      tierGrantedAt:
        nextTier === null
          ? null
          : current?.tier === nextTier && current.tierGrantedAt
            ? current.tierGrantedAt
            : new Date(),
    })
    .where(eq(usersTable.id, userId));
}

async function linkAndSyncUser(
  entitlementId: number,
  requestedUserId: string | null,
  email: string,
): Promise<string | null> {
  const user = await resolveUser(requestedUserId, email);
  if (!user) return null;
  await db
    .update(billingEntitlementsTable)
    .set({ userId: user.id })
    .where(eq(billingEntitlementsTable.id, entitlementId));
  await syncUserTier(user.id, user.email ?? email);
  return user.id;
}

async function productForCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<BillingProduct | null> {
  const direct = inferProduct(session.metadata);
  if (direct) return direct;
  const stripe = await getUncachableStripeClient();
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  return inferProduct(null, asId(lines.data[0]?.price));
}

async function processCheckoutSession(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return;
  }
  const product = await productForCheckoutSession(session);
  if (!product) throw new Error(`Unknown product for checkout session ${session.id}`);
  const config = PRODUCT_CONFIG[product];
  const email = (session.customer_details?.email ?? session.customer_email)?.trim();
  if (!email) throw new Error(`Checkout session ${session.id} has no customer email`);
  const requestedUserId = session.metadata?.["userId"] ?? session.client_reference_id ?? null;
  const subscriptionId = asId(session.subscription);
  const values = {
    userId: requestedUserId,
    email,
    product,
    tier: config.tier,
    kind: config.kind,
    status: "active",
    amountCents: session.amount_total,
    currency: session.currency,
    stripeCustomerId: asId(session.customer),
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId: asId(session.payment_intent),
    cancelAtPeriodEnd: false,
    lastStripeEventId: eventId,
  } as const;
  const paymentIntentId = asId(session.payment_intent);
  const [existingRow] = subscriptionId
    ? await db
        .select({
          id: billingEntitlementsTable.id,
          status: billingEntitlementsTable.status,
          refundedAt: billingEntitlementsTable.refundedAt,
        })
        .from(billingEntitlementsTable)
        .where(eq(billingEntitlementsTable.stripeSubscriptionId, subscriptionId))
        .limit(1)
    : paymentIntentId
      ? await db
          .select({
            id: billingEntitlementsTable.id,
            status: billingEntitlementsTable.status,
            refundedAt: billingEntitlementsTable.refundedAt,
          })
          .from(billingEntitlementsTable)
          .where(eq(billingEntitlementsTable.stripePaymentIntentId, paymentIntentId))
          .limit(1)
      : [];
  const subscriptionCheckoutValues = {
    userId: requestedUserId,
    email,
    product,
    tier: config.tier,
    kind: config.kind,
    amountCents: session.amount_total,
    currency: session.currency,
    stripeCustomerId: asId(session.customer),
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: subscriptionId,
    stripePaymentIntentId: paymentIntentId,
    lastStripeEventId: eventId,
  } as const;
  const [entitlement] = existingRow
    ? await db
        .update(billingEntitlementsTable)
        .set(
          subscriptionId
            ? subscriptionCheckoutValues
            : existingRow.status === "refunded"
            ? { ...values, status: "refunded", refundedAt: existingRow.refundedAt ?? new Date() }
            : values,
        )
        .where(eq(billingEntitlementsTable.id, existingRow.id))
        .returning({ id: billingEntitlementsTable.id })
    : await db
        .insert(billingEntitlementsTable)
        .values(values)
        .onConflictDoUpdate({
          target: billingEntitlementsTable.stripeCheckoutSessionId,
          set: values,
        })
        .returning({ id: billingEntitlementsTable.id });
  if (!entitlement) throw new Error("Failed to persist checkout entitlement");
  const userId = await linkAndSyncUser(entitlement.id, requestedUserId, email);
  const purchaseStatus = existingRow?.status === "refunded" ? "refunded" : "paid";

  await db
    .update(purchaseInterestTable)
    .set({ status: purchaseStatus, stripeSessionId: session.id })
    .where(
      and(
        sql`lower(${purchaseInterestTable.email}) = lower(${email})`,
        eq(purchaseInterestTable.product, product),
      ),
    );
  if (purchaseStatus === "paid") {
    void recordJourneyEvent({
      eventType: "purchase",
      userId,
      props: { via: "stripe_webhook", product },
    });
  }
}

function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items.data[0];
  return {
    start: fromUnix(item?.current_period_start),
    end: fromUnix(item?.current_period_end),
  };
}

function subscriptionStatus(subscription: Stripe.Subscription): string {
  if (
    subscription.cancel_at_period_end &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    return "canceling";
  }
  return subscription.status;
}

async function customerEmail(customerId: string): Promise<string | null> {
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  return customer.deleted ? null : customer.email?.trim() || null;
}

async function processSubscription(
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(billingEntitlementsTable)
    .where(eq(billingEntitlementsTable.stripeSubscriptionId, subscription.id))
    .limit(1);
  const priceId = asId(subscription.items.data[0]?.price);
  const product = inferProduct(subscription.metadata, priceId) ??
    (isProduct(existing[0]?.product) ? existing[0].product : null);
  if (!product) throw new Error(`Unknown product for subscription ${subscription.id}`);
  const config = PRODUCT_CONFIG[product];
  const customerId = asId(subscription.customer);
  if (!customerId) throw new Error(`Subscription ${subscription.id} has no customer`);
  const email = existing[0]?.email ?? (await customerEmail(customerId));
  if (!email) throw new Error(`Subscription ${subscription.id} has no customer email`);
  const requestedUserId = subscription.metadata?.["userId"] ?? existing[0]?.userId ?? null;
  const period = subscriptionPeriod(subscription);
  const values = {
    userId: requestedUserId,
    email,
    product,
    tier: config.tier,
    kind: "subscription" as const,
    status: subscriptionStatus(subscription),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: fromUnix(subscription.canceled_at ?? subscription.ended_at),
    lastStripeEventId: eventId,
  };
  const [entitlement] = await db
    .insert(billingEntitlementsTable)
    .values(values)
    .onConflictDoUpdate({
      target: billingEntitlementsTable.stripeSubscriptionId,
      set: values,
    })
    .returning({ id: billingEntitlementsTable.id });
  if (!entitlement) throw new Error("Failed to persist subscription entitlement");
  await linkAndSyncUser(entitlement.id, requestedUserId, email);
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return asId(invoice.parent?.subscription_details?.subscription);
}

async function processInvoicePaid(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const stripe = await getUncachableStripeClient();
  await processSubscription(await stripe.subscriptions.retrieve(subscriptionId), eventId);
}

async function processInvoiceFailed(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const [updated] = await db
    .update(billingEntitlementsTable)
    .set({ status: "past_due", lastStripeEventId: eventId })
    .where(eq(billingEntitlementsTable.stripeSubscriptionId, subscriptionId))
    .returning({
      id: billingEntitlementsTable.id,
      userId: billingEntitlementsTable.userId,
      email: billingEntitlementsTable.email,
    });
  if (updated?.userId) await syncUserTier(updated.userId, updated.email);
}

async function processChargeRefunded(charge: Stripe.Charge, eventId: string): Promise<void> {
  if (!charge.refunded || charge.amount_refunded < charge.amount) return;
  const paymentIntentId = asId(charge.payment_intent);
  if (!paymentIntentId) return;
  const rows = await db
    .update(billingEntitlementsTable)
    .set({ status: "refunded", refundedAt: new Date(), lastStripeEventId: eventId })
    .where(
      and(
        eq(billingEntitlementsTable.stripePaymentIntentId, paymentIntentId),
        eq(billingEntitlementsTable.kind, "one_time"),
      ),
    )
    .returning({
      userId: billingEntitlementsTable.userId,
      email: billingEntitlementsTable.email,
      product: billingEntitlementsTable.product,
    });
  for (const row of rows) {
    if (row.userId) await syncUserTier(row.userId, row.email);
    await db
      .update(purchaseInterestTable)
      .set({ status: "refunded" })
      .where(
        and(
          sql`lower(${purchaseInterestTable.email}) = lower(${row.email})`,
          eq(purchaseInterestTable.product, row.product),
        ),
      );
  }
  if (rows.length > 0) return;

  // Stripe does not guarantee webhook delivery order. If a full refund reaches
  // us before checkout completion, persist a refunded tombstone keyed by the
  // PaymentIntent; the later checkout event updates this same row instead of
  // accidentally creating a second active entitlement.
  const stripe = await getUncachableStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const product = inferProduct(paymentIntent.metadata ?? charge.metadata);
  const email = charge.billing_details.email?.trim();
  if (!product || !email) {
    throw new Error(`Cannot resolve refunded PaymentIntent ${paymentIntentId}`);
  }
  const config = PRODUCT_CONFIG[product];
  if (config.kind !== "one_time") return;
  const requestedUserId = paymentIntent.metadata?.["userId"] ?? null;
  const [tombstone] = await db
    .insert(billingEntitlementsTable)
    .values({
      userId: requestedUserId,
      email,
      product,
      tier: config.tier,
      kind: config.kind,
      status: "refunded",
      amountCents: charge.amount,
      currency: charge.currency,
      stripeCustomerId: asId(charge.customer) ?? asId(paymentIntent.customer),
      stripePaymentIntentId: paymentIntentId,
      refundedAt: new Date(),
      lastStripeEventId: eventId,
    })
    .returning({ id: billingEntitlementsTable.id });
  if (tombstone) {
    await linkAndSyncUser(tombstone.id, requestedUserId, email);
    await db
      .update(purchaseInterestTable)
      .set({ status: "refunded" })
      .where(
        and(
          sql`lower(${purchaseInterestTable.email}) = lower(${email})`,
          eq(purchaseInterestTable.product, product),
        ),
      );
  }
}

async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const [inserted] = await db
    .insert(stripeEventsTable)
    .values({
      eventId: event.id,
      type: event.type,
      stripeCreatedAt: fromUnix(event.created),
    })
    .onConflictDoNothing({ target: stripeEventsTable.eventId })
    .returning({ eventId: stripeEventsTable.eventId });
  if (inserted) return true;
  const [retry] = await db
    .update(stripeEventsTable)
    .set({ status: "processing", error: null })
    .where(
      and(
        eq(stripeEventsTable.eventId, event.id),
        eq(stripeEventsTable.status, "failed"),
      ),
    )
    .returning({ eventId: stripeEventsTable.eventId });
  return Boolean(retry);
}

export async function processBillingEvent(event: Stripe.Event): Promise<"processed" | "duplicate"> {
  if (!(await claimEvent(event))) return "duplicate";
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await processCheckoutSession(event.data.object as Stripe.Checkout.Session, event.id);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await processSubscription(event.data.object as Stripe.Subscription, event.id);
        break;
      case "invoice.paid":
        await processInvoicePaid(event.data.object as Stripe.Invoice, event.id);
        break;
      case "invoice.payment_failed":
        await processInvoiceFailed(event.data.object as Stripe.Invoice, event.id);
        break;
      case "charge.refunded":
        await processChargeRefunded(event.data.object as Stripe.Charge, event.id);
        break;
      default:
        break;
    }
    await db
      .update(stripeEventsTable)
      .set({ status: "processed", processedAt: new Date(), error: null })
      .where(eq(stripeEventsTable.eventId, event.id));
    return "processed";
  } catch (error) {
    await db
      .update(stripeEventsTable)
      .set({ status: "failed", error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000) })
      .where(eq(stripeEventsTable.eventId, event.id));
    throw error;
  }
}

export async function billingStateForUser(userId: string) {
  const [user] = await db
    .select({ email: usersTable.email, tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user?.email) return { tier: null, canManageBilling: false, entitlements: [] };
  const rows = await db
    .select()
    .from(billingEntitlementsTable)
    .where(
      or(
        eq(billingEntitlementsTable.userId, userId),
        sql`lower(${billingEntitlementsTable.email}) = lower(${user.email})`,
      ),
    )
    .orderBy(desc(billingEntitlementsTable.updatedAt));
  return {
    tier: user.tier === "reset" || user.tier === "wingman" ? user.tier : null,
    canManageBilling: rows.some((row) => row.kind === "subscription" && Boolean(row.stripeCustomerId)),
    entitlements: rows.map((row) => ({
      product: row.product,
      kind: row.kind,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      canceledAt: row.canceledAt?.toISOString() ?? null,
      refundedAt: row.refundedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function billingCustomerForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ customerId: billingEntitlementsTable.stripeCustomerId })
    .from(billingEntitlementsTable)
    .where(eq(billingEntitlementsTable.userId, userId))
    .orderBy(desc(billingEntitlementsTable.updatedAt))
    .limit(1);
  return row?.customerId ?? null;
}

export function productConfig(product: BillingProduct) {
  return PRODUCT_CONFIG[product];
}
