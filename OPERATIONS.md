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

Checkout (`/checkout/:product`) now asks the signed-in API to create a short-lived
Stripe Checkout session from a server-owned price ID. A browser redirect or
success-page query parameter never grants access. If Stripe is not configured,
the page falls back to the existing "save your spot" purchase-interest form.

### Required API-server env vars

| Setting | Env var |
| --- | --- |
| Stripe secret API key | `STRIPE_SECRET_KEY` |
| Webhook endpoint signing secret | `STRIPE_WEBHOOK_SECRET` |
| Canonical public app origin | `APP_ORIGIN` (or `PUBLIC_APP_URL`) |
| Signal Audit one-time Price ID | `STRIPE_PRICE_SIGNAL_AUDIT` |
| Dating Reset one-time Price ID | `STRIPE_PRICE_DATING_RESET` |
| Monthly Wingman recurring Price ID | `STRIPE_PRICE_WINGMAN` |
| Approved products open for checkout | `BILLING_LIVE_PRODUCTS` (comma-separated canonical slugs; empty means enrollment stays closed) |

The secret key and price IDs must never use a `VITE_` prefix or enter the browser
bundle. Add a product to `BILLING_LIVE_PRODUCTS` only after its price, service
scope, capacity, and checkout terms have founder approval.

### Stripe dashboard setup

1. Create the three Products/Prices above and copy each `price_...` ID into the
   matching server environment variable.
2. Register `https://<your-domain>/api/stripe/webhook` as a webhook endpoint and
   copy its `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Subscribe it to `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`, and `charge.refunded`, plus the
   existing Stripe Identity verification events.
4. Configure the Stripe customer portal to allow payment-method changes and
   end-of-period subscription cancellation.
5. Apply migration `0045` before enabling checkout.
6. After founder approval of the exact offer and fulfillment capacity, add only
   that canonical slug (`signal-audit`, `dating-reset`, or `wingman`) to
   `BILLING_LIVE_PRODUCTS`. Price IDs alone do not open enrollment.

### Entitlement behavior

- The webhook route is mounted before `express.json()` and verifies the raw body
  with the official Stripe SDK and the endpoint secret.
- `stripe_events` provides idempotency and a processed/failed operations trail
  without retaining raw payment payloads.
- `billing_entitlements` records the canonical one-time or subscription access
  state. `users.tier` is a synchronized compatibility cache, not the authority.
- Checkout and renewal events grant/extend access. End-of-period cancellation
  remains active through the current period. Failed subscription payment
  suspends access; a later paid invoice restores it. Deletion/cancellation
  revokes it.
- A fully refunded one-time charge changes that entitlement to `refunded` and
  revokes its tier. Refunding a subscription charge does not silently cancel the
  subscription; cancel it in Stripe/portal when future renewal must stop.
- The Account page opens Stripe's short-lived customer portal. Account deletion
  first schedules any still-renewing subscription to stop and aborts safely if
  Stripe cannot confirm that action.
- The founder manual tier override and reconcile endpoint are retired.
