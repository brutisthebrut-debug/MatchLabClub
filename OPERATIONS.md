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

## Receipts forwarding inbox (Beat 2)

Each user gets a private address `{handle}@receipts.matchlab.club` (the `handle` is a 12-char hex token minted on activation). They forward real-life confirmation emails (reservations, tickets, bookings, class sign-ups) there, or paste the headers in by hand on `/receipts`. Both paths accumulate into ONE row in `imported_sources` (`source = "receipts"`), whose derived item count feeds the `receipts` lane of the signal registry and nudges Match Readiness. We read and store ONLY the sender, subject line, and timestamp. The email body is never accepted, stored, or sent to any prompt.

Related env var:

- `RECEIPTS_WEBHOOK_SECRET` — shared secret the inbound email provider must send in the `x-receipts-secret` header. Defaults to `receipts-${REPL_ID}` when unset, so it is safe to ship before configuring a provider.

### Wiring up the inbound webhook (DNS + provider, the last mile)

The webhook route `POST /api/receipts/inbound` is already live. To actually receive forwarded mail you need an inbound-email provider (for example SendGrid Inbound Parse, Mailgun Routes, or Postmark inbound) pointed at the domain:

1. Add an MX record for `receipts.matchlab.club` pointing at your inbound-email provider's mail host (per their docs).
2. In the provider, route all mail for `receipts.matchlab.club` to a webhook (the "inbound parse" feature). Set the destination URL to `https://<your-domain>/api/receipts/inbound`.
3. Configure the provider to POST a JSON body with at least `to`, `from`, `subject`, and `date`. Any body/text/html fields the provider also posts are ignored by our schema and never read.
4. Set `RECEIPTS_WEBHOOK_SECRET` in the API server environment and configure the provider to send the same value in the `x-receipts-secret` header on every call. Requests without a matching secret are rejected with 401.

The endpoint resolves the recipient handle back to its owning row and accumulates one header-only entry. It returns `202` even for unknown handles, so it never leaks which handles exist. Until an MX record and provider are configured, the manual paste path on `/receipts` works standalone.

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
