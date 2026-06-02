# Operations runbook

Operational walkthroughs that used to live in `replit.md`. Day-to-day product
docs stay in `replit.md`; this file holds the step-by-step setup/maintenance
procedures that are only needed occasionally.

## Error monitoring (Sentry)

We use Sentry for production error monitoring. The free tier is fine for our volume.

Env vars:

- `SENTRY_DSN_API` — server-side Sentry DSN. When unset, error monitoring is a no-op.
- `VITE_SENTRY_DSN` — client-side Sentry DSN. When unset, frontend Sentry is a no-op.

Setup:

1. Create a Sentry account and add two projects: one for `nldc-web` (platform: React) and one for `api-server` (platform: Node.js / Express).
2. Copy each project's DSN.
3. Paste the api-server DSN into the `SENTRY_DSN_API` env var, and the web DSN into `VITE_SENTRY_DSN` (Replit Secrets, "shared" environment so Vite exposes it).
4. Restart the `artifacts/api-server: API Server` and `artifacts/nldc: web` workflows so the new env is picked up.

Both SDKs short-circuit to a no-op when their DSN is unset, so it is safe to leave either side unconfigured during local development.

## Refreshing GeoIP data

Sign-in notification emails include approximate location via the bundled `geoip-lite` MaxMind GeoLite2 dataset. The dataset ships with the package and should be refreshed **monthly** to keep IP-to-location mappings accurate as IP ranges are reassigned over time.

Related env vars:

- `GEOIP_KEY_MISSING_ALERT_DAYS` — days since the last successful GeoIP refresh before the founder is emailed about a missing/expired `MAXMIND_LICENSE_KEY` (default 35).
- `GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES` — min healthy minutes after the GeoIP key is restored before another missing-key alert may fire (default 15).

How to refresh:

1. Get a free MaxMind license key at https://www.maxmind.com/en/geolite2/signup
2. Set it as an environment variable: `MAXMIND_LICENSE_KEY=your_key_here`
3. Run the updater from the repo root:
   ```
   MAXMIND_LICENSE_KEY=your_key pnpm --filter @workspace/api-server run update-geoip
   ```
4. Restart the API server so it picks up the new data files.

The updater fetches current GeoLite2 CSV files directly from MaxMind, converts them to geoip-lite's binary format, and writes them into `artifacts/api-server/node_modules/geoip-lite/data/`. No runtime behavior or email format changes — only the location lookups become fresher.

## Stripe checkout operations

Checkout (`/checkout/:product`) renders a Stripe Payment Link button when the corresponding env var is set, and falls back to a "save your spot" purchase-interest form when it isn't. Wiring is in `artifacts/nldc/src/pages/Checkout.tsx` (`PaidForm` reads `import.meta.env[config.stripeEnvKey]`).

### Required env vars (frontend, `shared` environment, prefixed `VITE_` so Vite exposes them)

| Product | Price | Env var | Stripe URL shape |
| --- | --- | --- | --- |
| `signal-audit` | $29 one-time | `VITE_STRIPE_SIGNAL_AUDIT_LINK` | `https://buy.stripe.com/...` |
| `dating-reset` | $97 one-time | `VITE_STRIPE_DATING_RESET_LINK` | `https://buy.stripe.com/...` |
| `wingman` | $197/mo | `VITE_STRIPE_WINGMAN_LINK` | `https://buy.stripe.com/...` |

When all three are present, customers go straight to Stripe-hosted checkout. When any are missing, that product silently falls back to the email-capture form — safe to ship partially configured.

### Creating the Payment Links in Stripe

1. Stripe Dashboard → Products → create one product per row above (one-time for the first two, monthly subscription for Wingman).
2. Products → product → "Create payment link". Set quantity = 1, allow promotion codes, collect customer name + email.
3. Under "After payment", set the success URL to `https://<your-domain>/checkout/success?product=<slug>` and (optionally) a cancel URL to `https://<your-domain>/checkout/cancel?product=<slug>` (use the `signal-audit` / `dating-reset` / `wingman` slug).
4. Copy the resulting `https://buy.stripe.com/...` URL into the matching env var on Replit (Secrets → Environment variables, "shared").
5. Restart the `artifacts/nldc: web` workflow so Vite re-reads the env.

### Stripe webhook + reconciliation (live)

The Stripe webhook is wired through the **Replit Stripe integration** (no key needed from the user) plus the `stripe-replit-sync` package. There is nothing to paste manually:

- **Connection + credentials** — `artifacts/api-server/src/lib/stripeClient.ts` reads the integration's secret key and webhook secret at runtime from the Replit connectors endpoint (never stored). `isStripeConnected()` is the guard; when no connection exists, every Stripe path is a no-op and the server boots normally.
- **Startup init** — `artifacts/api-server/src/lib/initStripe.ts` runs `stripe-replit-sync` migrations (creates the `stripe` schema), registers a managed webhook at `/api/stripe/webhook`, then backfills and reconciles in the background. Guarded: it logs and returns if there is no connection or `DATABASE_URL`, so it never blocks or crashes startup. Called fire-and-forget from `index.ts`.
- **Webhook route** — registered in `app.ts` **before** `express.json()` with `express.raw()` so the raw body Buffer reaches signature verification. The CSRF origin guard lets it through (Stripe is server-to-server, no Origin header); the Stripe signature is the real auth. Handler lives in `artifacts/api-server/src/lib/webhookHandlers.ts`, which delegates to `stripe-replit-sync`'s `processWebhook` to verify and sync the event into the `stripe` schema.
- **Reconciliation** — `artifacts/api-server/src/lib/stripeReconcile.ts` runs read-only against `stripe.checkout_sessions` (managed by the sync package; we never write to the `stripe.*` schema), matches paid sessions to our `purchase_interest` rows by case-insensitive email, and stamps `status = "paid"` + `stripe_session_id` on our own table. Runs automatically on startup after backfill, and on demand via `POST /api/purchase-interest/reconcile` (founder-only).

Refunds and disputes are still handled entirely in the Stripe Dashboard. To reconcile on demand after a payment, a founder can hit the reconcile endpoint (or just restart the API server, which reconciles on boot).
