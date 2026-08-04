import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getUncachableStripeClient, isStripeConnected } from "../lib/stripeClient";
import {
  latestStripeCustomerId,
  loadBillingState,
} from "../lib/billingEntitlements";
import { originFor } from "../lib/expiredLinkPage";

const router: IRouter = Router();

const CheckoutBody = z.object({
  product: z.enum(["signal-audit", "dating-reset", "wingman"]),
});

const PRICE_ENV = {
  "signal-audit": "STRIPE_PRICE_SIGNAL_AUDIT",
  "dating-reset": "STRIPE_PRICE_DATING_RESET",
  wingman: "STRIPE_PRICE_WINGMAN",
} as const;

router.get("/billing/entitlement", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(await loadBillingState(req.user.id));
});

router.get("/billing/checkout-session/:sessionId", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const sessionId = req.params["sessionId"];
  if (
    typeof sessionId !== "string" ||
    !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)
  ) {
    res.status(400).json({ error: "Invalid checkout session." });
    return;
  }
  if (!(await isStripeConnected())) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionUserId =
    session.metadata?.["userId"] ?? session.client_reference_id;
  if (sessionUserId !== req.user.id) {
    res.status(404).json({ error: "Checkout session not found." });
    return;
  }
  const product = CheckoutBody.shape.product.safeParse(
    session.metadata?.["product"],
  );
  res.json({
    confirmed: session.payment_status === "paid",
    paymentStatus: session.payment_status,
    product: product.success ? product.data : null,
  });
});

router.post("/billing/checkout", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Sign in before checkout." });
    return;
  }
  if (!req.user.email) {
    res.status(400).json({ error: "An account email is required for checkout." });
    return;
  }
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid product." });
    return;
  }

  const product = parsed.data.product;
  const priceId = process.env[PRICE_ENV[product]]?.trim();
  if (!(await isStripeConnected()) || !priceId) {
    res.status(503).json({
      error: "Checkout is not configured yet.",
      code: "checkout_not_configured",
    });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const customerId = await latestStripeCustomerId(req.user.id);
  const origin = originFor(req);
  const metadata = { product, userId: req.user.id };
  const mode = product === "wingman" ? "subscription" : "payment";

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: req.user.id,
    customer: customerId ?? undefined,
    customer_email: customerId ? undefined : req.user.email,
    customer_creation:
      mode === "payment" && !customerId ? "always" : undefined,
    metadata,
    payment_intent_data: mode === "payment" ? { metadata } : undefined,
    subscription_data: mode === "subscription" ? { metadata } : undefined,
    allow_promotion_codes: true,
    success_url: `${origin}/checkout/success?product=${encodeURIComponent(product)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel?product=${encodeURIComponent(product)}`,
  });

  if (!session.url) {
    res.status(502).json({ error: "Stripe did not return a checkout URL." });
    return;
  }
  res.json({ url: session.url });
});

router.post("/billing/portal", async (req, res): Promise<void> => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const customerId = await latestStripeCustomerId(req.user.id);
  if (!(await isStripeConnected()) || !customerId) {
    res.status(409).json({ error: "No Stripe billing account is available." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${originFor(req)}/account`,
  });
  res.json({ url: portal.url });
});

export default router;
