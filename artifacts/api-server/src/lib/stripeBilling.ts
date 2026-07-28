import type Stripe from "stripe";
import {
  billingEntitlementsTable,
  db,
  purchaseInterestTable,
  stripeWebhookEventsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { refreshStripeTierCache } from "./billingEntitlements";

type Product = "signal-audit" | "dating-reset" | "wingman";

function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return null;
}

function productOf(metadata: Stripe.Metadata | null | undefined): Product | null {
  const product = metadata?.["product"];
  return product === "signal-audit" ||
    product === "dating-reset" ||
    product === "wingman"
    ? product
    : null;
}

function dateFromUnix(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000)
    : null;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));
  return ends.length > 0 ? dateFromUnix(Math.max(...ends)) : null;
}

function invoicePeriodEnd(invoice: Stripe.Invoice): Date | null {
  const ends = invoice.lines.data
    .map((line) => line.period?.end)
    .filter((value): value is number => typeof value === "number");
  return ends.length > 0 ? dateFromUnix(Math.max(...ends)) : null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

export interface BillingWebhookResult {
  duplicate: boolean;
  handled: boolean;
}

/**
 * Apply a verified Stripe event once. The idempotency row and every billing
 * mutation share one transaction: a duplicate is a no-op, while an exception
 * rolls everything back so Stripe's retry can safely run the event again.
 */
export async function processStripeBillingEvent(
  event: Stripe.Event,
): Promise<BillingWebhookResult> {
  const affectedUserIds = new Set<string>();
  let handled = false;
  let duplicate = false;
  const eventCreatedAt = new Date(event.created * 1000);

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeWebhookEventsTable)
      .values({
        id: event.id,
        type: event.type,
        eventCreatedAt,
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: stripeWebhookEventsTable.id })
      .returning({ id: stripeWebhookEventsTable.id });

    if (inserted.length === 0) {
      duplicate = true;
      return;
    }

    const resolveUserId = async (input: {
      explicitUserId?: string | null;
      customerId?: string | null;
      email?: string | null;
      subscriptionId?: string | null;
    }): Promise<string | null> => {
      if (input.explicitUserId) {
        const rows = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.id, input.explicitUserId))
          .limit(1);
        if (rows[0]?.id) return rows[0].id;
      }
      if (input.subscriptionId) {
        const rows = await tx
          .select({ userId: billingEntitlementsTable.userId })
          .from(billingEntitlementsTable)
          .where(
            eq(
              billingEntitlementsTable.stripeSubscriptionId,
              input.subscriptionId,
            ),
          )
          .limit(1);
        if (rows[0]?.userId) return rows[0].userId;
      }
      if (input.customerId) {
        const rows = await tx
          .select({ userId: billingEntitlementsTable.userId })
          .from(billingEntitlementsTable)
          .where(
            eq(billingEntitlementsTable.stripeCustomerId, input.customerId),
          )
          .orderBy(desc(billingEntitlementsTable.updatedAt))
          .limit(1);
        if (rows[0]?.userId) return rows[0].userId;
      }
      const email = input.email?.trim().toLowerCase();
      if (email) {
        const rows = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(sql`lower(${usersTable.email}) = ${email}`)
          .limit(1);
        if (rows[0]?.id) return rows[0].id;
      }
      return null;
    };

    const upsertCheckoutEntitlement = async (input: {
      userId: string;
      product: "dating-reset" | "wingman";
      status: string;
      amountCents: number | null;
      customerId: string | null;
      sessionId: string;
      subscriptionId: string | null;
    }): Promise<void> => {
      const existing = input.subscriptionId
        ? await tx
            .select()
            .from(billingEntitlementsTable)
            .where(
              eq(
                billingEntitlementsTable.stripeSubscriptionId,
                input.subscriptionId,
              ),
            )
            .limit(1)
        : await tx
            .select()
            .from(billingEntitlementsTable)
            .where(
              eq(
                billingEntitlementsTable.stripeCheckoutSessionId,
                input.sessionId,
              ),
            )
            .limit(1);

      if (existing[0]) {
        // A subscription event may already have established the authoritative
        // status and paid-through date. Checkout only fills attribution.
        await tx
          .update(billingEntitlementsTable)
          .set({
            stripeCheckoutSessionId: input.sessionId,
            stripeCustomerId:
              input.customerId ?? existing[0].stripeCustomerId,
            amountCents: input.amountCents ?? existing[0].amountCents,
            updatedAt: new Date(),
          })
          .where(eq(billingEntitlementsTable.id, existing[0].id));
        return;
      }

      await tx.insert(billingEntitlementsTable).values({
        userId: input.userId,
        product: input.product,
        status: input.status,
        amountCents: input.amountCents,
        stripeCustomerId: input.customerId,
        stripeCheckoutSessionId: input.sessionId,
        stripeSubscriptionId: input.subscriptionId,
        accessStartsAt: eventCreatedAt,
        accessEndsAt: null,
        lastStripeEventCreatedAt: eventCreatedAt,
      });
    };

    if (event.type === "checkout.session.completed") {
      handled = true;
      const session = event.data.object as Stripe.Checkout.Session;
      const product = productOf(session.metadata);
      const customerId = idOf(session.customer);
      const subscriptionId = idOf(session.subscription);
      const explicitUserId =
        session.metadata?.["userId"] ?? session.client_reference_id;
      let email =
        session.customer_details?.email ?? session.customer_email ?? null;
      const userId = await resolveUserId({
        explicitUserId,
        customerId,
        email,
        subscriptionId,
      });

      if (!email && userId) {
        const rows = await tx
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
        email = rows[0]?.email ?? null;
      }

      if (product && email && session.payment_status === "paid") {
        const alreadyCaptured = await tx
          .select({ id: purchaseInterestTable.id })
          .from(purchaseInterestTable)
          .where(eq(purchaseInterestTable.stripeSessionId, session.id))
          .limit(1);
        if (alreadyCaptured.length === 0) {
          await tx.insert(purchaseInterestTable).values({
            email,
            product,
            amountCents: session.amount_total ?? 0,
            source: "stripe-webhook",
            stripeSessionId: session.id,
            status: "paid",
          });
        }
      }

      if (
        userId &&
        product === "dating-reset" &&
        session.payment_status === "paid"
      ) {
        await upsertCheckoutEntitlement({
          userId,
          product,
          status: "paid",
          amountCents: session.amount_total,
          customerId,
          sessionId: session.id,
          subscriptionId: null,
        });
        affectedUserIds.add(userId);
      } else if (userId && product === "wingman" && subscriptionId) {
        // The subscription event supplies the period boundary. Until that
        // verified event lands, an incomplete record never unlocks access.
        await upsertCheckoutEntitlement({
          userId,
          product,
          status: "incomplete",
          amountCents: session.amount_total,
          customerId,
          sessionId: session.id,
          subscriptionId,
        });
        affectedUserIds.add(userId);
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      handled = true;
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = idOf(subscription.customer);
      const product =
        productOf(subscription.metadata) ??
        (subscription.items.data.some(
          (item) => item.price.id === process.env["STRIPE_PRICE_WINGMAN"],
        )
          ? "wingman"
          : null);
      if (product !== "wingman") return;

      const userId = await resolveUserId({
        explicitUserId: subscription.metadata?.["userId"],
        customerId,
        subscriptionId: subscription.id,
      });
      if (!userId) return;

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`billing:${subscription.id}`}))`,
      );
      const existing = await tx
        .select()
        .from(billingEntitlementsTable)
        .where(
          eq(
            billingEntitlementsTable.stripeSubscriptionId,
            subscription.id,
          ),
        )
        .limit(1);
      const prior = existing[0];
      if (
        prior?.lastStripeEventCreatedAt &&
        prior.lastStripeEventCreatedAt.getTime() > eventCreatedAt.getTime()
      ) {
        return;
      }

      const deleted = event.type === "customer.subscription.deleted";
      const status = deleted ? "canceled" : subscription.status;
      const accessEndsAt = deleted
        ? eventCreatedAt
        : subscriptionPeriodEnd(subscription);
      const values = {
        userId,
        product: "wingman",
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        accessEndsAt,
        cancelAtPeriodEnd: deleted
          ? false
          : subscription.cancel_at_period_end,
        lastStripeEventCreatedAt: eventCreatedAt,
        updatedAt: new Date(),
      };

      if (prior) {
        await tx
          .update(billingEntitlementsTable)
          .set(values)
          .where(eq(billingEntitlementsTable.id, prior.id));
      } else {
        await tx.insert(billingEntitlementsTable).values({
          ...values,
          accessStartsAt: eventCreatedAt,
        });
      }
      affectedUserIds.add(userId);
    } else if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      handled = true;
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) return;
      const existing = await tx
        .select()
        .from(billingEntitlementsTable)
        .where(
          eq(
            billingEntitlementsTable.stripeSubscriptionId,
            subscriptionId,
          ),
        )
        .limit(1);
      const prior = existing[0];
      if (!prior) return;
      if (
        prior.lastStripeEventCreatedAt &&
        prior.lastStripeEventCreatedAt.getTime() > eventCreatedAt.getTime()
      ) {
        return;
      }

      const paid = event.type === "invoice.paid";
      await tx
        .update(billingEntitlementsTable)
        .set({
          status: paid ? "active" : "past_due",
          accessEndsAt: paid
            ? (invoicePeriodEnd(invoice) ?? prior.accessEndsAt)
            : prior.accessEndsAt,
          lastStripeEventCreatedAt: eventCreatedAt,
          updatedAt: new Date(),
        })
        .where(eq(billingEntitlementsTable.id, prior.id));
      affectedUserIds.add(prior.userId);
    }
  });

  // Authorization reads billing_entitlements directly. This cache refresh is
  // for legacy clients and founder reporting, so it may safely happen after
  // the idempotent transaction commits.
  for (const userId of affectedUserIds) {
    await refreshStripeTierCache(userId);
  }

  return { duplicate, handled };
}
