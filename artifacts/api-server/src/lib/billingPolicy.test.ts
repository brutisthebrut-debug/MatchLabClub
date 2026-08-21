import { describe, expect, it } from "vitest";
import {
  resolveCheckoutPrice,
  summarizeBillingSubscriptions,
} from "./billingPolicy";

const prices = {
  price_insight: "insight",
  price_match: "match",
} as const;

describe("authenticated billing policy", () => {
  it("resolves only approved package/cadence combinations", () => {
    const env = {
      STRIPE_PRICE_INSIGHT_MONTHLY: "price_insight",
      STRIPE_PRICE_MATCH_QUARTERLY: "price_match",
    };
    expect(resolveCheckoutPrice("insight", "monthly", env)).toBe(
      "price_insight",
    );
    expect(resolveCheckoutPrice("insight", "quarterly", env)).toBeNull();
    expect(resolveCheckoutPrice("match", "quarterly", env)).toBe("price_match");
  });

  it("reports the strongest live recognized subscription", () => {
    expect(
      summarizeBillingSubscriptions(
        [
          { status: "past_due", metadata: { matchlabPlan: "match" } },
          { status: "active", metadata: { matchlabPlan: "insight" } },
        ],
        prices,
      ),
    ).toEqual({
      state: "active",
      planKey: "match",
      hasLiveSubscription: true,
    });
  });

  it("keeps payment recovery states out of new checkout", () => {
    expect(
      summarizeBillingSubscriptions(
        [{ status: "past_due", metadata: { matchlabPlan: "match" } }],
        prices,
      ).hasLiveSubscription,
    ).toBe(true);
    expect(
      summarizeBillingSubscriptions(
        [{ status: "incomplete", metadata: { matchlabPlan: "insight" } }],
        prices,
      ).hasLiveSubscription,
    ).toBe(true);
  });

  it("treats canceled recognized subscriptions as inactive", () => {
    expect(
      summarizeBillingSubscriptions(
        [
          {
            status: "canceled",
            items: { data: [{ price: { id: "price_match" } }] },
          },
        ],
        prices,
      ),
    ).toEqual({
      state: "inactive",
      planKey: "match",
      hasLiveSubscription: false,
    });
  });
});
