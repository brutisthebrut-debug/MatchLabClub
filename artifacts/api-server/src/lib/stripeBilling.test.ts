import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@workspace/db", async () => await import("./testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
  const fake = await import("./testDb");
  return {
    ...actual,
    eq: fake.eq,
    and: fake.and,
    desc: fake.desc,
    sql: fake.sql,
  };
});

import {
  db,
  dumpTable,
  resetTestDb,
  usersTable,
} from "./testDb";
import { loadBillingState } from "./billingEntitlements";
import { processStripeBillingEvent } from "./stripeBilling";

const USER_ID = "billing-user-1";
const EMAIL = "member@example.com";

function event(
  id: string,
  type: Stripe.Event.Type,
  created: number,
  object: unknown,
): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: "2026-06-30.basil",
    created,
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

function subscriptionObject(input: {
  status: Stripe.Subscription.Status;
  periodEnd: number;
  cancelAtPeriodEnd?: boolean;
}): Stripe.Subscription {
  return {
    id: "sub_wingman_1",
    object: "subscription",
    customer: "cus_member_1",
    status: input.status,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    metadata: { product: "wingman", userId: USER_ID },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          current_period_end: input.periodEnd,
          current_period_start: input.periodEnd - 2_592_000,
          price: { id: "price_wingman" },
        },
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
  } as Stripe.Subscription;
}

describe.sequential("Stripe billing lifecycle", () => {
  beforeEach(async () => {
    resetTestDb();
    await db.insert(usersTable).values({ id: USER_ID, email: EMAIL });
  });

  it("grants permanent Dating Reset only after a paid server event", async () => {
    const paid = event("evt_reset_paid", "checkout.session.completed", 100, {
      id: "cs_test_reset1",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      amount_total: 9700,
      customer: "cus_member_1",
      customer_details: { email: EMAIL },
      customer_email: EMAIL,
      client_reference_id: USER_ID,
      metadata: { product: "dating-reset", userId: USER_ID },
      subscription: null,
    });

    expect(await processStripeBillingEvent(paid)).toEqual({
      duplicate: false,
      handled: true,
    });
    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "reset",
      status: "active",
      active: true,
      accessUntil: null,
      source: "stripe",
    });
    expect(dumpTable("purchase_interest")).toHaveLength(1);
    expect(dumpTable("purchase_interest")[0]).toMatchObject({
      product: "dating-reset",
      status: "paid",
      stripeSessionId: "cs_test_reset1",
    });

    expect(await processStripeBillingEvent(paid)).toEqual({
      duplicate: true,
      handled: false,
    });
    expect(dumpTable("billing_entitlements")).toHaveLength(1);
    expect(dumpTable("purchase_interest")).toHaveLength(1);
  });

  it("never unlocks Wingman from an incomplete checkout", async () => {
    await processStripeBillingEvent(
      event("evt_incomplete", "checkout.session.completed", 100, {
        id: "cs_test_incomplete1",
        object: "checkout.session",
        mode: "subscription",
        payment_status: "unpaid",
        amount_total: 19700,
        customer: "cus_member_1",
        customer_details: { email: EMAIL },
        customer_email: EMAIL,
        client_reference_id: USER_ID,
        metadata: { product: "wingman", userId: USER_ID },
        subscription: "sub_wingman_1",
      }),
    );

    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "free",
      status: "incomplete",
      active: false,
    });
    expect(dumpTable("purchase_interest")).toHaveLength(0);
  });

  it("keeps canceling or past-due Wingman active only through paid time", async () => {
    const futureEnd = Math.floor(Date.now() / 1000) + 86_400;
    await processStripeBillingEvent(
      event(
        "evt_sub_active",
        "customer.subscription.created",
        200,
        subscriptionObject({ status: "active", periodEnd: futureEnd }),
      ),
    );
    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "wingman",
      status: "active",
      active: true,
    });

    await processStripeBillingEvent(
      event(
        "evt_sub_canceling",
        "customer.subscription.updated",
        300,
        subscriptionObject({
          status: "active",
          periodEnd: futureEnd,
          cancelAtPeriodEnd: true,
        }),
      ),
    );
    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "wingman",
      status: "canceling",
      active: true,
      cancelAtPeriodEnd: true,
    });

    await processStripeBillingEvent(
      event("evt_invoice_failed", "invoice.payment_failed", 400, {
        id: "in_failed_1",
        object: "invoice",
        parent: {
          type: "subscription_details",
          subscription_details: {
            subscription: "sub_wingman_1",
            metadata: { product: "wingman", userId: USER_ID },
          },
        },
        lines: {
          data: [{ period: { start: futureEnd - 2_592_000, end: futureEnd } }],
        },
      }),
    );
    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "wingman",
      status: "past_due",
      active: true,
    });

    // Same Stripe status with a paid-through boundary in the past does not
    // remain a forever-entitlement.
    await processStripeBillingEvent(
      event(
        "evt_sub_past_boundary",
        "customer.subscription.updated",
        500,
        subscriptionObject({
          status: "past_due",
          periodEnd: Math.floor(Date.now() / 1000) - 60,
        }),
      ),
    );
    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "free",
      status: "past_due",
      active: false,
    });
  });

  it("does not let an older Stripe event overwrite newer state", async () => {
    const futureEnd = Math.floor(Date.now() / 1000) + 86_400;
    await processStripeBillingEvent(
      event(
        "evt_new_active",
        "customer.subscription.updated",
        900,
        subscriptionObject({ status: "active", periodEnd: futureEnd }),
      ),
    );
    await processStripeBillingEvent(
      event(
        "evt_old_failed",
        "customer.subscription.updated",
        800,
        subscriptionObject({ status: "past_due", periodEnd: futureEnd }),
      ),
    );

    expect(await loadBillingState(USER_ID)).toMatchObject({
      tier: "wingman",
      status: "active",
      active: true,
    });
  });
});
