import { describe, expect, it } from "vitest";
import {
  buildStripePricePlanMap,
  decideCommercialEntitlement,
  planForSubscription,
  stripeObjectId,
} from "./subscriptionEntitlements";

const prices = {
  price_insight_monthly: "insight",
  price_match_monthly: "match",
} as const;

describe("Stripe commercial entitlement policy", () => {
  it("selects the highest active canonical plan", () => {
    expect(
      decideCommercialEntitlement(
        [
          { status: "active", metadata: { matchlabPlan: "insight" } },
          { status: "trialing", metadata: { matchlabPlan: "match" } },
        ],
        prices,
      ),
    ).toEqual({ action: "grant", planKey: "match" });
  });

  it("preserves but never grants or upgrades on past due", () => {
    expect(
      decideCommercialEntitlement(
        [{ status: "past_due", metadata: { matchlabPlan: "match" } }],
        prices,
      ),
    ).toEqual({ action: "preserve", planKey: null });
  });

  it.each(["paused", "unpaid", "canceled", "incomplete_expired"])(
    "revokes a recognized %s subscription",
    (status) => {
      expect(
        decideCommercialEntitlement(
          [{ status, metadata: { matchlabPlan: "insight" } }],
          prices,
        ),
      ).toEqual({ action: "revoke", planKey: null });
    },
  );

  it("ignores unrelated Stripe products", () => {
    expect(
      decideCommercialEntitlement(
        [{ status: "active", items: { data: [{ price: { id: "other" } }] } }],
        prices,
      ),
    ).toEqual({ action: "ignore", planKey: null });
  });

  it("maps configured price ids when metadata is absent", () => {
    expect(
      planForSubscription(
        {
          status: "active",
          items: { data: [{ price: { id: "price_match_monthly" } }] },
        },
        prices,
      ),
    ).toBe("match");
  });

  it("does not sell Guided until capacity is explicitly enabled", () => {
    const subscription = {
      status: "active",
      metadata: { matchlabPlan: "guided" },
    };
    expect(planForSubscription(subscription, prices, false)).toBeNull();
    expect(planForSubscription(subscription, prices, true)).toBe("guided");
  });

  it("builds the canonical server-side price map", () => {
    expect(
      buildStripePricePlanMap({
        STRIPE_PRICE_INSIGHT_MONTHLY: " price_i ",
        STRIPE_PRICE_MATCH_QUARTERLY: "price_m",
      }),
    ).toEqual({ price_i: "insight", price_m: "match" });
  });

  it("normalizes expanded and unexpanded Stripe ids", () => {
    expect(stripeObjectId("cus_123")).toBe("cus_123");
    expect(stripeObjectId({ id: "cus_456" })).toBe("cus_456");
    expect(stripeObjectId(null)).toBeNull();
  });
});
