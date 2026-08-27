import type { CommercialPlanKey } from "./commercialPlans";
import {
  planForSubscription,
  type PricePlanMap,
  type SubscriptionLike,
} from "./subscriptionEntitlements";

export type BillablePlanKey = Extract<CommercialPlanKey, "insight" | "match">;
export type BillingCadence = "monthly" | "annual" | "quarterly";

const CHECKOUT_PRICE_KEYS: Readonly<
  Record<BillablePlanKey, Partial<Record<BillingCadence, string>>>
> = {
  insight: {
    monthly: "STRIPE_PRICE_INSIGHT_MONTHLY",
    annual: "STRIPE_PRICE_INSIGHT_ANNUAL",
  },
  match: {
    monthly: "STRIPE_PRICE_MATCH_MONTHLY",
    quarterly: "STRIPE_PRICE_MATCH_QUARTERLY",
  },
};

export function resolveCheckoutPrice(
  planKey: BillablePlanKey,
  cadence: BillingCadence,
  env: Partial<Record<string, string>> = process.env,
): string | null {
  const envKey = CHECKOUT_PRICE_KEYS[planKey][cadence];
  return envKey ? env[envKey]?.trim() || null : null;
}

export type BillingLifecycleState =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "inactive";

const PLAN_RANK: Readonly<Record<CommercialPlanKey, number>> = {
  member: 0,
  insight: 1,
  match: 2,
  guided: 3,
};

export interface BillingSubscriptionSummary {
  state: BillingLifecycleState;
  planKey: Exclude<CommercialPlanKey, "member"> | null;
  hasLiveSubscription: boolean;
}

export function summarizeBillingSubscriptions(
  subscriptions: readonly SubscriptionLike[],
  priceMap: PricePlanMap,
  guidedBillingEnabled = false,
): BillingSubscriptionSummary {
  let bestPlan: Exclude<CommercialPlanKey, "member"> | null = null;
  let state: BillingLifecycleState = "inactive";

  for (const subscription of subscriptions) {
    const planKey = planForSubscription(
      subscription,
      priceMap,
      guidedBillingEnabled,
    );
    if (!planKey) continue;

    const nextState: BillingLifecycleState =
      subscription.status === "active"
        ? "active"
        : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "past_due"
            ? "past_due"
            : subscription.status === "incomplete"
              ? "incomplete"
              : "inactive";

    const stateRank: Record<BillingLifecycleState, number> = {
      inactive: 0,
      incomplete: 1,
      past_due: 2,
      trialing: 3,
      active: 4,
    };
    if (stateRank[nextState] > stateRank[state]) state = nextState;
    if (!bestPlan || PLAN_RANK[planKey] > PLAN_RANK[bestPlan]) {
      bestPlan = planKey;
    }
  }

  return {
    state,
    planKey: bestPlan,
    hasLiveSubscription:
      state === "active" ||
      state === "trialing" ||
      state === "past_due" ||
      state === "incomplete",
  };
}
