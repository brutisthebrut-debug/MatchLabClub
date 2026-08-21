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

## Stripe subscription operations

The canonical commercial ladder is Member, Insight, Match, and Guided. The
subscription lifecycle now runs server-side against signed Stripe events and
Stripe's current customer state. The older signal-audit, Dating Reset, and
Wingman Payment Links remain legacy purchase-interest paths; they do not assign
the canonical beta packages.

### Required connected-beta environment

| Variable                         | Purpose                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `CONNECTED_BETA`                 | Set to `true` to enforce the complete fail-closed beta startup contract.                       |
| `NODE_ENV`                       | Must be `production` when `CONNECTED_BETA=true`.                                               |
| `DATABASE_URL`                   | Postgres connection used by application data, sessions, and entitlement state.                |
| `STRIPE_SECRET_KEY`              | Server-side Stripe API key. Never expose it to Vite or the browser.                           |
| `STRIPE_WEBHOOK_SECRET`          | Verifies the raw body received at `/api/stripe/webhook`.                                      |
| `API_PUBLIC_URL`                 | Public API origin used for OIDC callbacks and webhook registration.                           |
| `WEB_PUBLIC_URL`                 | Approved web origin used for post-auth, Checkout, Portal, and cancellation returns.           |
| `OIDC_CLIENT_ID`                 | Portable OIDC client identifier; `REPL_ID` remains a migration fallback only.                 |
| `ANON_CLAIM_HANDOFF_SECRET`      | Explicit HMAC key for cross-device anonymous claim handoff; no Replit-derived beta fallback.   |
| `ALLOW_DEV_AUTH`                 | Leave unset in beta. Seeded test-login requires explicit `true` outside production only.       |
| `STRIPE_WEBHOOK_URL`             | Optional exact webhook URL override.                                                          |
| `STRIPE_PRICE_INSIGHT_MONTHLY`   | Maps the monthly Insight Stripe Price to `insight`.                                           |
| `STRIPE_PRICE_INSIGHT_ANNUAL`    | Maps the annual Insight Stripe Price to `insight`.                                            |
| `STRIPE_PRICE_MATCH_MONTHLY`     | Maps the monthly Match Stripe Price to `match`.                                               |
| `STRIPE_PRICE_MATCH_QUARTERLY`   | Maps the quarterly Match Stripe Price to `match`.                                             |
| `STRIPE_RECONCILE_MAX_CUSTOMERS` | Optional startup recovery cap; defaults to 500 for the controlled beta.                       |
| `STRIPE_ENABLE_GUIDED`           | Must remain unset until Guided capacity and support limits are approved.                      |

Explicit runtime credentials are the beta/production path. The Replit Stripe
connector remains a compatibility fallback only while migration is unfinished.

### Connected-beta startup preflight

When `CONNECTED_BETA=true`, the API exits before listening unless all of the
following agree:

- `NODE_ENV=production`, a positive `PORT`, and a non-empty `DATABASE_URL`;
- valid HTTPS `API_PUBLIC_URL` and `WEB_PUBLIC_URL`, with the exact web origin in
  `APP_ORIGINS`;
- explicit non-Replit `ISSUER_URL` and `OIDC_CLIENT_ID`;
- secure cookies, explicit `ANON_CLAIM_HANDOFF_SECRET`, and development auth off;
- Stripe test-mode secret and webhook keys plus all four canonical Price IDs;
- Guided billing disabled.

This is deliberately provider-neutral. It prevents a half-configured deployment
from looking healthy, but it does not replace the live signup, Checkout, Portal
cancellation, webhook, and payment-recovery acceptance journey.

### Entitlement policy

| Stripe state                                         | MatchLab behavior                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `active`, `trialing`                                 | Grant the highest recognized canonical package.                                      |
| `past_due`                                           | Preserve an existing assignment during retries, but never grant or upgrade.          |
| `paused`, `unpaid`, `canceled`, `incomplete_expired` | Revoke a Stripe-managed assignment to Member.                                        |
| Active with `cancel_at_period_end`                   | Retain access through the paid period; the terminal event revokes it.                |
| Refund or credit event                               | Reconcile current subscription truth; a refund alone is not treated as cancellation. |
| Unrecognized product                                 | Ignore it; never rewrite legacy customer history.                                    |
| Founder beta grant                                   | Preserve it as an explicit override regardless of billing events.                    |

Webhook delivery is intentionally treated as at-least-once and potentially out
of order. After the signed event is persisted by the managed Stripe sync,
MatchLab retrieves all current subscriptions for that customer and recalculates
one result. Duplicate events therefore converge on the same state. Startup
backfill performs the same bounded reconciliation to recover missed webhooks.

### Stripe setup and verification

1. Create the four canonical Stripe Prices for Insight monthly/annual and Match
   monthly/quarterly. Do not create a public Guided checkout yet.
2. Set the server environment variables above. Price IDs begin with `price_`;
   never use Product IDs in the mapping.
   Configure the Billing Portal in Stripe for cancellation, payment-method
   recovery, invoice history, and any permitted Insight-to-Match change.
3. Configure the public API URL and confirm the managed webhook targets
   `/api/stripe/webhook` over HTTPS.
4. Start Checkout only through authenticated `POST /api/billing/checkout`; the
   legacy public Payment Links are purchase-interest history, not beta package
   assignment. Ensure subscription or Checkout metadata contains
   `matchlabUserId=<users.id>` and `matchlabPlan=insight|match`. Email matching
   is a compatibility fallback, not the preferred identity key.
5. In Stripe test mode, exercise initial payment, renewal, failed payment,
   recovery, cancel-at-period-end, terminal cancellation, pause, and refund.
6. Confirm founder-granted beta users retain their explicit override throughout
   the same event sequence.

Authenticated endpoints now create canonical Insight/Match Checkout Sessions,
return billing status, and open Stripe Billing Portal sessions. They require a
signed-in member, use only server-owned Price IDs, attach member/package metadata,
block duplicate live or recovery subscriptions, preserve founder grants, and do
not sell Guided. The approved account/checkout UI hookup and the connected
web/API/auth/Postgres/Stripe test-mode journey remain open evidence gates.
