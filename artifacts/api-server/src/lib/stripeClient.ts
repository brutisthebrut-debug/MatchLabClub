import Stripe from "stripe";

let cached: { key: string; client: Stripe } | null = null;

function stripeSecretKey(): string | null {
  return process.env["STRIPE_SECRET_KEY"]?.trim() || null;
}

function stripeWebhookSecret(): string | null {
  return process.env["STRIPE_WEBHOOK_SECRET"]?.trim() || null;
}

/** Direct Stripe configuration; no Replit connector or synced schema. */
export async function isStripeConnected(): Promise<boolean> {
  return Boolean(stripeSecretKey());
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const key = stripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (cached?.key === key) return cached.client;
  const client = new Stripe(key);
  cached = { key, client };
  return client;
}

/**
 * Verify a webhook against the dedicated endpoint secret. The raw Buffer must
 * reach this function unchanged; app.ts mounts the route before express.json.
 */
export async function constructStripeEvent(
  payload: Buffer,
  signature: string,
): Promise<Stripe.Event | null> {
  const secret = stripeWebhookSecret();
  if (!secret) return null;
  const stripe = await getUncachableStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
