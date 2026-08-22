import { Router, type IRouter, type Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  BILLING_PRODUCTS,
  billingCustomerForUser,
  billingStateForUser,
  configuredPriceId,
  productConfig,
} from "../lib/billingEntitlements";
import { getUncachableStripeClient, isStripeConnected } from "../lib/stripeClient";

const router: IRouter = Router();
const CheckoutBody = z.object({ product: z.enum(BILLING_PRODUCTS) });

function publicOrigin(req: Request): string | null {
  const configured =
    process.env["APP_ORIGIN"]?.trim() || process.env["PUBLIC_APP_URL"]?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  if (process.env["NODE_ENV"] === "production") return null;
  return `${req.protocol}://${req.get("host")}`;
}

router.get("/me/billing", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Sign in to view billing." });
    return;
  }
  res.json(await billingStateForUser(req.user.id));
});

router.post("/me/billing/checkout", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Sign in before checkout." });
    return;
  }
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Unknown billing product." });
    return;
  }
  const product = parsed.data.product;
  const price = configuredPriceId(product);
  const origin = publicOrigin(req);
  if (!(await isStripeConnected()) || !price || !origin) {
    res.status(503).json({ error: "Checkout is not configured yet." });
    return;
  }
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);
  if (!user?.email) {
    res.status(422).json({ error: "Add an account email before checkout." });
    return;
  }
  const config = productConfig(product);
  const stripe = await getUncachableStripeClient();
  const metadata = { userId: req.user.id, product };
  const session = await stripe.checkout.sessions.create({
    mode: config.kind === "subscription" ? "subscription" : "payment",
    customer_email: user.email,
    client_reference_id: req.user.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    metadata,
    ...(config.kind === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata }, customer_creation: "always" as const }),
    success_url: `${origin}/checkout/success?product=${encodeURIComponent(product)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel?product=${encodeURIComponent(product)}`,
  });
  if (!session.url) {
    res.status(502).json({ error: "Stripe did not return a checkout URL." });
    return;
  }
  res.status(201).json({ url: session.url });
});

router.post("/me/billing/portal", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Sign in to manage billing." });
    return;
  }
  const origin = publicOrigin(req);
  const customer = await billingCustomerForUser(req.user.id);
  if (!(await isStripeConnected()) || !origin) {
    res.status(503).json({ error: "Billing management is not configured." });
    return;
  }
  if (!customer) {
    res.status(404).json({ error: "No managed subscription was found." });
    return;
  }
  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${origin}/account`,
  });
  res.status(201).json({ url: session.url });
});

export default router;
