import type Stripe from "stripe";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable } from "@workspace/db";
import {
  resolveCheckoutPrice,
  summarizeBillingSubscriptions,
  type BillablePlanKey,
  type BillingCadence,
} from "../lib/billingPolicy";
import { serializePlanAssignment } from "../lib/commercialPlans";
import {
  getUncachableStripeClient,
  isStripeConnected,
} from "../lib/stripeClient";
import {
  buildStripePricePlanMap,
  type SubscriptionLike,
} from "../lib/subscriptionEntitlements";
import { resolvePublicWebOrigin } from "../lib/runtimeConfig";

const router: IRouter = Router();

const CheckoutBody = z.object({
  planKey: z.enum(["insight", "match"]),
  cadence: z.enum(["monthly", "annual", "quarterly"]),
});

interface BillingUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: string | null;
  tierGrantedAt: Date | null;
}

async function currentBillingUser(userId: string): Promise<BillingUser | null> {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      tier: usersTable.tier,
      tierGrantedAt: usersTable.tierGrantedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

function stripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findStripeCustomer(
  stripe: Stripe,
  user: BillingUser,
): Promise<Stripe.Customer | null> {
  try {
    const result = await stripe.customers.search({
      query: `metadata["matchlabUserId"]:"${stripeSearchValue(user.id)}"`,
      limit: 1,
    });
    if (result.data[0]) return result.data[0];
  } catch {
    // Some Stripe accounts can have Search temporarily unavailable. The exact
    // email lookup below is a bounded fallback, not an entitlement signal.
  }

  if (!user.email) return null;
  const result = await stripe.customers.list({ email: user.email, limit: 100 });
  return (
    result.data.find(
      (customer) => customer.metadata?.["matchlabUserId"] === user.id,
    ) ?? null
  );
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: BillingUser,
): Promise<Stripe.Customer> {
  const existing = await findStripeCustomer(stripe, user);
  if (existing) return existing;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return stripe.customers.create(
    {
      email: user.email ?? undefined,
      name: name || undefined,
      metadata: { matchlabUserId: user.id },
    },
    { idempotencyKey: `matchlab-customer-${user.id}` },
  );
}

async function listCustomerSubscriptions(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const result = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return result.data;
}

router.get("/billing/status", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await currentBillingUser(req.user.id);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const assignment = serializePlanAssignment(user.tier, user.tierGrantedAt);
  if (!(await isStripeConnected())) {
    res.json({
      configured: false,
      assignment,
      billingState: user.tierGrantedAt ? "beta_grant" : "unavailable",
      stripePlanKey: null,
      portalAvailable: false,
    });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const customer = await findStripeCustomer(stripe, user);
  if (!customer) {
    res.json({
      configured: true,
      assignment,
      billingState: user.tierGrantedAt ? "beta_grant" : "inactive",
      stripePlanKey: null,
      portalAvailable: false,
    });
    return;
  }

  const subscriptions = await listCustomerSubscriptions(stripe, customer.id);
  const summary = summarizeBillingSubscriptions(
    subscriptions as SubscriptionLike[],
    buildStripePricePlanMap(),
    process.env["STRIPE_ENABLE_GUIDED"] === "true",
  );
  res.json({
    configured: true,
    assignment,
    billingState: user.tierGrantedAt ? "beta_grant" : summary.state,
    stripePlanKey: summary.planKey,
    portalAvailable: true,
  });
});

router.post("/billing/checkout", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose an available package and cadence" });
    return;
  }

  const user = await currentBillingUser(req.user.id);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.tierGrantedAt) {
    res.status(409).json({
      error: "Founder beta access is already active for this account",
      code: "beta_grant_active",
    });
    return;
  }

  const { planKey, cadence } = parsed.data as {
    planKey: BillablePlanKey;
    cadence: BillingCadence;
  };
  const priceId = resolveCheckoutPrice(planKey, cadence);
  if (!priceId) {
    res.status(503).json({
      error: "That package cadence is not configured for beta checkout",
      code: "price_unavailable",
    });
    return;
  }
  const webOrigin = resolvePublicWebOrigin();
  if (!webOrigin) {
    res.status(503).json({
      error: "The beta web origin is not configured",
      code: "web_origin_unavailable",
    });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const customer = await getOrCreateStripeCustomer(stripe, user);
  const currentSubscriptions = await listCustomerSubscriptions(
    stripe,
    customer.id,
  );
  const current = summarizeBillingSubscriptions(
    currentSubscriptions as SubscriptionLike[],
    buildStripePricePlanMap(),
    process.env["STRIPE_ENABLE_GUIDED"] === "true",
  );
  if (current.hasLiveSubscription) {
    res.status(409).json({
      error: "Manage the existing subscription before starting another",
      code: "subscription_exists",
      portalAvailable: true,
    });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${webOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${webOrigin}/pricing?checkout=cancelled`,
    metadata: {
      matchlabUserId: user.id,
      matchlabPlan: planKey,
      matchlabCadence: cadence,
    },
    subscription_data: {
      metadata: {
        matchlabUserId: user.id,
        matchlabPlan: planKey,
        matchlabCadence: cadence,
      },
    },
  });

  if (!session.url) {
    res.status(502).json({ error: "Stripe did not return a checkout URL" });
    return;
  }
  res.status(201).json({ url: session.url });
});

router.post("/billing/portal", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = await currentBillingUser(req.user.id);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const webOrigin = resolvePublicWebOrigin();
  if (!webOrigin) {
    res.status(503).json({ error: "The beta web origin is not configured" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const customer = await findStripeCustomer(stripe, user);
  if (!customer) {
    res.status(404).json({
      error: "No Stripe billing account exists for this member",
      code: "billing_account_missing",
    });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${webOrigin}/account`,
  });
  res.status(201).json({ url: session.url });
});

export default router;
