import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_PLANS,
  normalizePlanGrant,
  resolveCommercialPlan,
  serializePlanAssignment,
} from "./commercialPlans";

describe("commercial plan contract", () => {
  it("keeps the approved names, prices, and progression order", () => {
    expect(
      COMMERCIAL_PLANS.map((plan) => ({
        key: plan.key,
        prices: plan.prices,
        range: plan.monthlyRangeCents,
        next: plan.nextPlanKey,
      })),
    ).toEqual([
      {
        key: "member",
        prices: [{ cadence: "free", amountCents: 0 }],
        range: null,
        next: "insight",
      },
      {
        key: "insight",
        prices: [
          { cadence: "monthly", amountCents: 1499 },
          { cadence: "annual", amountCents: 9900 },
        ],
        range: null,
        next: "match",
      },
      {
        key: "match",
        prices: [
          { cadence: "monthly", amountCents: 4900 },
          { cadence: "quarterly", amountCents: 12900 },
        ],
        range: null,
        next: "guided",
      },
      {
        key: "guided",
        prices: [],
        range: { min: 24900, max: 49900 },
        next: null,
      },
    ]);
  });

  it("only gives Match and Guided active-search access", () => {
    expect(serializePlanAssignment("member").canActivateSearch).toBe(false);
    expect(serializePlanAssignment("insight").canActivateSearch).toBe(false);
    expect(serializePlanAssignment("match").canActivateSearch).toBe(true);
    expect(serializePlanAssignment("guided").canActivateSearch).toBe(true);
  });

  it("maps legacy beta tiers without changing old customer records", () => {
    expect(resolveCommercialPlan("free").plan.key).toBe("member");
    expect(resolveCommercialPlan("reset").plan.key).toBe("insight");
    expect(resolveCommercialPlan("wingman").plan.key).toBe("guided");
    expect(resolveCommercialPlan("wingman").source).toBe("legacy");
  });

  it("normalizes founder grants to canonical plan keys", () => {
    expect(normalizePlanGrant("MATCH")).toBe("match");
    expect(normalizePlanGrant("wingman")).toBe("guided");
    expect(normalizePlanGrant("not-a-plan")).toBeNull();
  });
});
