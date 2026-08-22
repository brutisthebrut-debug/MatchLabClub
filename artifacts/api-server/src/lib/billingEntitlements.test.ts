import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import {
  billingEntitlementsTable,
  db,
  pool,
  stripeEventsTable,
  usersTable,
} from "@workspace/db";
import { processBillingEvent } from "./billingEntitlements";

const suffix = crypto.randomBytes(6).toString("hex");
const USER_ID = `billing-user-${suffix}`;
const EMAIL = `${USER_ID}@example.com`;
const EVENT_IDS = [
  `evt_reset_${suffix}`,
  `evt_refund_${suffix}`,
  `evt_wingman_${suffix}`,
  `evt_canceling_${suffix}`,
  `evt_failed_${suffix}`,
];

function event(type: Stripe.Event.Type, id: string, object: object): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2025-12-15.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

async function cleanup(): Promise<void> {
  await db
    .delete(billingEntitlementsTable)
    .where(eq(billingEntitlementsTable.userId, USER_ID));
  await db.delete(stripeEventsTable).where(inArray(stripeEventsTable.eventId, EVENT_IDS));
  await db.delete(usersTable).where(eq(usersTable.id, USER_ID));
}

beforeEach(async () => {
  await cleanup();
  await db.insert(usersTable).values({ id: USER_ID, email: EMAIL });
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("Stripe billing entitlements", () => {
  it("grants only from events, ignores duplicates, and revokes a fully refunded one-time tier", async () => {
    const checkout = event("checkout.session.completed", EVENT_IDS[0]!, {
      id: `cs_reset_${suffix}`,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: 9700,
      currency: "usd",
      customer: `cus_reset_${suffix}`,
      payment_intent: `pi_reset_${suffix}`,
      subscription: null,
      client_reference_id: USER_ID,
      customer_email: EMAIL,
      customer_details: { email: EMAIL },
      metadata: { userId: USER_ID, product: "dating-reset" },
    });
    expect(await processBillingEvent(checkout)).toBe("processed");
    expect(await processBillingEvent(checkout)).toBe("duplicate");

    const [paidUser] = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, USER_ID));
    expect(paidUser?.tier).toBe("reset");
    const resetRows = await db
      .select()
      .from(billingEntitlementsTable)
      .where(eq(billingEntitlementsTable.userId, USER_ID));
    expect(resetRows).toHaveLength(1);
    expect(resetRows[0]).toMatchObject({ status: "active", product: "dating-reset" });

    const refund = event("charge.refunded", EVENT_IDS[1]!, {
      id: `ch_reset_${suffix}`,
      object: "charge",
      refunded: true,
      amount: 9700,
      amount_refunded: 9700,
      payment_intent: `pi_reset_${suffix}`,
    });
    expect(await processBillingEvent(refund)).toBe("processed");
    const [refunded] = await db
      .select()
      .from(billingEntitlementsTable)
      .where(eq(billingEntitlementsTable.userId, USER_ID));
    expect(refunded?.status).toBe("refunded");
    expect(refunded?.refundedAt).toBeInstanceOf(Date);
    const [freeUser] = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, USER_ID));
    expect(freeUser?.tier).toBeNull();
  });

  it("keeps access through period-end cancellation and suspends it on payment failure", async () => {
    const subscriptionId = `sub_wingman_${suffix}`;
    await processBillingEvent(event("checkout.session.completed", EVENT_IDS[2]!, {
      id: `cs_wingman_${suffix}`,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: 19700,
      currency: "usd",
      customer: `cus_wingman_${suffix}`,
      payment_intent: null,
      subscription: subscriptionId,
      client_reference_id: USER_ID,
      customer_email: EMAIL,
      customer_details: { email: EMAIL },
      metadata: { userId: USER_ID, product: "wingman" },
    }));

    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;
    await processBillingEvent(event("customer.subscription.updated", EVENT_IDS[3]!, {
      id: subscriptionId,
      object: "subscription",
      status: "active",
      customer: `cus_wingman_${suffix}`,
      cancel_at_period_end: true,
      canceled_at: Math.floor(Date.now() / 1000),
      ended_at: null,
      metadata: { userId: USER_ID, product: "wingman" },
      items: {
        data: [{ price: { id: "price_wingman" }, current_period_start: Math.floor(Date.now() / 1000), current_period_end: periodEnd }],
      },
    }));
    const [canceling] = await db
      .select()
      .from(billingEntitlementsTable)
      .where(eq(billingEntitlementsTable.stripeSubscriptionId, subscriptionId));
    expect(canceling).toMatchObject({ status: "canceling", cancelAtPeriodEnd: true });
    const [stillPaid] = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, USER_ID));
    expect(stillPaid?.tier).toBe("wingman");

    await processBillingEvent(event("invoice.payment_failed", EVENT_IDS[4]!, {
      id: `in_failed_${suffix}`,
      object: "invoice",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: subscriptionId, metadata: null },
      },
    }));
    const [pastDue] = await db
      .select()
      .from(billingEntitlementsTable)
      .where(eq(billingEntitlementsTable.stripeSubscriptionId, subscriptionId));
    expect(pastDue?.status).toBe("past_due");
    const [suspended] = await db
      .select({ tier: usersTable.tier })
      .from(usersTable)
      .where(eq(usersTable.id, USER_ID));
    expect(suspended?.tier).toBeNull();
  });
});
