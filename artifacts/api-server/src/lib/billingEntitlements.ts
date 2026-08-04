import {
  billingEntitlementsTable,
  db,
  usersTable,
  type BillingEntitlement,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";

export type PaidTier = "reset" | "wingman";
export type BillingDisplayStatus =
  | "free"
  | "active"
  | "canceling"
  | "past_due"
  | "incomplete"
  | "unpaid"
  | "canceled";

const PAID_THROUGH_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

export interface BillingState {
  tier: "free" | PaidTier;
  status: BillingDisplayStatus;
  active: boolean;
  source: "free" | "founder" | "stripe";
  accessUntil: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
}

function isFuture(value: Date | null, now: Date): boolean {
  return Boolean(value && value.getTime() > now.getTime());
}

export function entitlementIsActive(
  row: BillingEntitlement,
  now = new Date(),
): boolean {
  if (row.product === "dating-reset") {
    return row.status === "paid" || row.status === "active";
  }
  if (row.product !== "wingman") return false;
  return (
    PAID_THROUGH_STATUSES.has(row.status) &&
    isFuture(row.accessEndsAt, now)
  );
}

function displayStatus(row: BillingEntitlement): BillingDisplayStatus {
  if (
    row.product === "wingman" &&
    row.cancelAtPeriodEnd &&
    (row.status === "active" || row.status === "trialing")
  ) {
    return "canceling";
  }
  if (
    row.status === "paid" ||
    row.status === "active" ||
    row.status === "trialing"
  ) {
    return "active";
  }
  if (
    row.status === "past_due" ||
    row.status === "incomplete" ||
    row.status === "unpaid" ||
    row.status === "canceled"
  ) {
    return row.status;
  }
  return "canceled";
}

export async function loadBillingState(
  userId: string,
  now = new Date(),
): Promise<BillingState> {
  const [userRows, entitlements] = await Promise.all([
    db
      .select({
        tier: usersTable.tier,
        tierSource: usersTable.tierSource,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1),
    db
      .select()
      .from(billingEntitlementsTable)
      .where(eq(billingEntitlementsTable.userId, userId))
      .orderBy(desc(billingEntitlementsTable.updatedAt)),
  ]);

  const user = userRows[0];
  // Existing null-source grants predate the source column and were all made
  // manually by a founder. Preserve them as explicit beta overrides.
  if (
    (user?.tier === "reset" || user?.tier === "wingman") &&
    user.tierSource !== "stripe"
  ) {
    return {
      tier: user.tier,
      status: "active",
      active: true,
      source: "founder",
      accessUntil: null,
      cancelAtPeriodEnd: false,
      canManageBilling: entitlements.some((row) =>
        Boolean(row.stripeCustomerId),
      ),
    };
  }

  const activeWingman = entitlements.find(
    (row) => row.product === "wingman" && entitlementIsActive(row, now),
  );
  if (activeWingman) {
    return {
      tier: "wingman",
      status: displayStatus(activeWingman),
      active: true,
      source: "stripe",
      accessUntil: activeWingman.accessEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: activeWingman.cancelAtPeriodEnd,
      canManageBilling: Boolean(activeWingman.stripeCustomerId),
    };
  }

  const activeReset = entitlements.find(
    (row) => row.product === "dating-reset" && entitlementIsActive(row, now),
  );
  if (activeReset) {
    return {
      tier: "reset",
      status: "active",
      active: true,
      source: "stripe",
      accessUntil: null,
      cancelAtPeriodEnd: false,
      canManageBilling: Boolean(activeReset.stripeCustomerId),
    };
  }

  const latestSubscription = entitlements.find(
    (row) => row.product === "wingman",
  );
  if (latestSubscription) {
    return {
      tier: "free",
      status: displayStatus(latestSubscription),
      active: false,
      source: "stripe",
      accessUntil: latestSubscription.accessEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: latestSubscription.cancelAtPeriodEnd,
      canManageBilling: Boolean(latestSubscription.stripeCustomerId),
    };
  }

  return {
    tier: "free",
    status: "free",
    active: false,
    source: "free",
    accessUntil: null,
    cancelAtPeriodEnd: false,
    canManageBilling: entitlements.some((row) =>
      Boolean(row.stripeCustomerId),
    ),
  };
}

export async function loadEffectivePaidTier(
  userId: string,
): Promise<PaidTier | null> {
  const state = await loadBillingState(userId);
  return state.active && state.tier !== "free" ? state.tier : null;
}

export async function latestStripeCustomerId(
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ stripeCustomerId: billingEntitlementsTable.stripeCustomerId })
    .from(billingEntitlementsTable)
    .where(eq(billingEntitlementsTable.userId, userId))
    .orderBy(desc(billingEntitlementsTable.updatedAt));
  return (
    rows.find((row) => Boolean(row.stripeCustomerId))?.stripeCustomerId ?? null
  );
}

/**
 * Keep the legacy users.tier column accurate for founder reporting and older
 * clients. Product authorization never trusts this cache for Stripe grants;
 * it always calls loadBillingState.
 */
export async function refreshStripeTierCache(userId: string): Promise<void> {
  const userRows = await db
    .select({
      tier: usersTable.tier,
      tierSource: usersTable.tierSource,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return;
  if (
    (user.tier === "reset" || user.tier === "wingman") &&
    user.tierSource !== "stripe"
  ) {
    return;
  }

  const state = await loadBillingState(userId);
  const tier = state.active && state.tier !== "free" ? state.tier : null;
  await db
    .update(usersTable)
    .set({
      tier,
      tierSource: tier ? "stripe" : null,
      tierGrantedAt: tier ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}
