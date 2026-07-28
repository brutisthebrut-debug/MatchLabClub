import Stripe from "stripe";

let cachedClient: Stripe | null = null;
let cachedKey: string | null = null;

function stripeSecretKey(): string | null {
  return process.env["STRIPE_SECRET_KEY"]?.trim() || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env["STRIPE_WEBHOOK_SECRET"]?.trim() || null;
}

/**
 * Stripe is a normal portable server integration. No Replit connector or
 * private schema is required; production supplies the standard Stripe
 * environment variables.
 */
export async function isStripeConnected(): Promise<boolean> {
  return Boolean(stripeSecretKey());
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = stripeSecretKey();
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }
  if (!cachedClient || cachedKey !== secretKey) {
    cachedClient = new Stripe(secretKey);
    cachedKey = secretKey;
  }
  return cachedClient;
}

export async function constructStripeEvent(
  payload: Buffer,
  signature: string,
): Promise<Stripe.Event | null> {
  const webhookSecret = stripeWebhookSecret();
  if (!webhookSecret) return null;
  const stripe = await getUncachableStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
