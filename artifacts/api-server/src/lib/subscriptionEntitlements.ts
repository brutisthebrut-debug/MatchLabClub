import { normalizePlanGrant, type CommercialPlanKey } from "./commercialPlans";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "unpaid"
  | "canceled"
  | string;

export interface SubscriptionLike {
  status: SubscriptionStatus;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{ price?: { id?: string | null } | null }>;
  } | null;
}

export type PricePlanMap = Readonly<Record<string, CommercialPlanKey>>;

export type EntitlementDecision =
  | { action: "grant"; planKey: Exclude<CommercialPlanKey, "member"> }
  | { action: "preserve"; planKey: null }
  | { action: "revoke"; planKey: null }
  | { action: "ignore"; planKey: null };

const PLAN_RANK: Readonly<Record<CommercialPlanKey, number>> = {
  member: 0,
  insight: 1,
  match: 2,
  guided: 3,
};

const GRANTING_STATUSES = new Set<SubscriptionStatus>(["active", "trialing"]);

export function buildStripePricePlanMap(
  env: Partial<Record<string, string>> = process.env,
): PricePlanMap {
  const pairs: Array<[string | undefined, CommercialPlanKey]> = [
    [env["STRIPE_PRICE_INSIGHT_MONTHLY"], "insight"],
    [env["STRIPE_PRICE_INSIGHT_ANNUAL"], "insight"],
    [env["STRIPE_PRICE_MATCH_MONTHLY"], "match"],
    [env["STRIPE_PRICE_MATCH_QUARTERLY"], "match"],
  ];
  const result: Record<string, CommercialPlanKey> = {};
  for (const [rawPriceId, planKey] of pairs) {
    const priceId = rawPriceId?.trim();
    if (priceId) result[priceId] = planKey;
  }
  return result;
}

export function planForSubscription(
  subscription: SubscriptionLike,
  pricePlanMap: PricePlanMap,
  guidedBillingEnabled = false,
): Exclude<CommercialPlanKey, "member"> | null {
  const metadataPlan = normalizePlanGrant(
    subscription.metadata?.["matchlabPlan"] ??
      subscription.metadata?.["planKey"],
  );
  if (
    metadataPlan &&
    metadataPlan !== "member" &&
    (metadataPlan !== "guided" || guidedBillingEnabled)
  ) {
    return metadataPlan;
  }

  for (const item of subscription.items?.data ?? []) {
    const priceId = item.price?.id;
    const mapped = priceId ? pricePlanMap[priceId] : null;
    if (
      mapped &&
      mapped !== "member" &&
      (mapped !== "guided" || guidedBillingEnabled)
    ) {
      return mapped;
    }
  }
  return null;
}

/**
 * Recalculate entitlement from the customer's current Stripe subscriptions.
 * This makes duplicate and out-of-order webhook delivery harmless.
 *
 * Past-due never grants or upgrades access. It preserves an already-assigned
 * plan during Stripe's retry window. Paused, unpaid, canceled, and failed
 * activation states revoke a Stripe-managed assignment.
 */
export function decideCommercialEntitlement(
  subscriptions: readonly SubscriptionLike[],
  pricePlanMap: PricePlanMap,
  guidedBillingEnabled = false,
): EntitlementDecision {
  let best: Exclude<CommercialPlanKey, "member"> | null = null;
  let recognized = false;
  let hasPastDue = false;

  for (const subscription of subscriptions) {
    const planKey = planForSubscription(
      subscription,
      pricePlanMap,
      guidedBillingEnabled,
    );
    if (!planKey) continue;
    recognized = true;

    if (subscription.status === "past_due") {
      hasPastDue = true;
      continue;
    }
    if (!GRANTING_STATUSES.has(subscription.status)) continue;
    if (!best || PLAN_RANK[planKey] > PLAN_RANK[best]) best = planKey;
  }

  if (best) return { action: "grant", planKey: best };
  if (hasPastDue) return { action: "preserve", planKey: null };
  if (recognized) return { action: "revoke", planKey: null };
  return { action: "ignore", planKey: null };
}

export function stripeObjectId(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof value === "string") return value || null;
  return value?.id ?? null;
}
