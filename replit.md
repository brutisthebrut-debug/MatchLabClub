# MatchLab Club

AI-powered dating profile and messaging coaching web app that audits profiles, rewrites bios, coaches messages, and surfaces communication patterns — all without any external AI API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nldc run dev` — run the frontend (dynamic port via $PORT)
- `pnpm run typecheck` — full typecheck across all packages (blocking CI check; see `CI.md`)
- `pnpm --filter @workspace/api-server run test` — API server test suite (blocking CI check; see `CI.md`)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run check-schema-drift` — verify the committed Drizzle migrations under `lib/db/drizzle/` are in sync with `lib/db/src/schema/` (registered as the `schema-drift` validation; runs `drizzle-kit generate` into a throwaway temp dir, no DB connection or persistent file writes)
- `pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts` — generate a new migration after an intentional schema change, then commit the new files under `lib/db/drizzle/` alongside your schema edits
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `AI_RELIABILITY_REBREACH_COOLDOWN_MINUTES` — min healthy minutes after a "recovered" email before another breach email may fire for the same tool (default 15)
- Optional env: `AUDIT_TRASH_RETENTION_DAYS` — days before a soft-deleted audit is permanently purged by the trash purge job (default 30)
- Optional env: `AUDIT_TRASH_PURGE_INTERVAL_HOURS` — how often the background trash purge job runs, in hours (default 24)
- Optional env: `GEOIP_KEY_MISSING_ALERT_DAYS` — days since the last successful GeoIP refresh before the founder is emailed about a missing/expired MAXMIND_LICENSE_KEY (default 35)
- Optional env: `GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES` — min healthy minutes after the GeoIP key is restored before another missing-key alert may fire (default 15)

### Refreshing GeoIP data

Sign-in notification emails include approximate location via the bundled `geoip-lite` MaxMind GeoLite2 dataset. The dataset ships with the package and should be refreshed **monthly** to keep IP-to-location mappings accurate as IP ranges are reassigned over time.

**How to refresh:**

1. Get a free MaxMind license key at https://www.maxmind.com/en/geolite2/signup
2. Set it as an environment variable: `MAXMIND_LICENSE_KEY=your_key_here`
3. Run the updater from the repo root:
   ```
   MAXMIND_LICENSE_KEY=your_key pnpm --filter @workspace/api-server run update-geoip
   ```
4. Restart the API server so it picks up the new data files.

The updater fetches current GeoLite2 CSV files directly from MaxMind, converts them to geoip-lite's binary format, and writes them into `artifacts/api-server/node_modules/geoip-lite/data/`. No runtime behavior or email format changes — only the location lookups become fresher.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + TanStack Query + Framer Motion + Recharts
- UI: shadcn/ui components, Tailwind v4, Plus Jakarta Sans + Playfair Display fonts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nldc/` — React+Vite frontend (previewPath: `/`)
- `artifacts/api-server/` — Express API server (previewPath: `/api`)
- `artifacts/api-server/src/lib/aiEngine.ts` — deterministic AI engine (no external API)
- `lib/api-spec/` — OpenAPI spec source of truth
- `lib/api-client-react/src/generated/` — generated hooks and Zod schemas (do not edit)
- `lib/db/src/schema.ts` — Drizzle schema source of truth

## Architecture decisions

- **No external AI API** — the coaching engine is entirely deterministic, built on structured prompt-to-output logic in `aiEngine.ts`. Ships without API keys, never fails from rate limits.
- **Consent-first integrations** — Integrations page is UI-only (coming soon), with explicit consent toggles and clear "what we access / never touch" breakdowns.
- **Demo data as fallback** — Every page has hardcoded demo data so the UI never looks empty, even before a user completes their first audit.
- **Contract-first API** — OpenAPI spec → Orval codegen → typed hooks. Server and client share Zod schemas.
- **Revenue-first product** — Pricing page with three tiers ($0 / $97 / $197), podcast promo code, waitlist with early listener perks.
- **Cross-device anonymous claim** — Anonymous audits are tagged with a server-issued token kept in the `anon_claim` cookie. On login, `POST /api/claim-anonymous` reassigns them. For users who switch devices or clear cookies, `POST /api/claim-anonymous/handoff/issue` mints a short-lived (15 min) HMAC-signed token they can carry to another browser, and `POST /api/claim-anonymous/handoff/redeem` claims with that token instead of the cookie. Optional env `ANON_CLAIM_HANDOFF_SECRET` overrides the default signing key (derived from `REPL_ID`).

## Product

- **Landing page** — hero, social proof, privacy promise, final CTA
- **Intake wizard (5 steps)** — name/age/gender, goal, bio paste, message sample, review + submit
- **Dashboard** — score ring, score history sparkline, strengths/risks badges, recent audits, quick actions
- **Report page** — full audit with score, bio critique, AI rewrite, prompt rewrites, photo checklist, action plan
- **Message coach** — paste conversation, get 3 reply options (Playful/Direct/Warm) with rationale
- **Email insights** — paste message history, get communication patterns, attachment style, profile tips
- **Integrations settings** — consent-first UI for Gmail, Calendar, screenshot upload, social import (coming soon)
- **Pricing** — 3-tier pricing with podcast discount, FAQ accordion
- **Waitlist** — live count, signup form, early listener perks

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

### Reconciliation today (manual, intentional)

There is **no Stripe webhook**. The `purchase_interest` table tracks early-list signups only. Real Stripe orders show up in the Stripe Dashboard. To match a paid customer to an NLDC account during beta:

1. In the Stripe Dashboard, copy the customer's email from the successful payment.
2. In `/founder` → Purchase interest, search that email (rows here will be `interest`-status leads who clicked "save my spot" without paying — usually empty for paid customers).
3. If the email matches a real user, mark the account as paid manually (founder-side note for now); if not, send them the onboarding email with a link to `/start` and the founder review note.
4. Refunds and disputes are handled entirely in the Stripe Dashboard — nothing in this app needs to change.

If/when we move beyond beta, add a Stripe webhook → set `purchase_interest.status = "paid"` and stamp `stripe_session_id` (columns already exist in `lib/db/src/schema/purchase_interest.ts`). The schema is intentionally pre-wired for this.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not run `pnpm dev` at the workspace root — use workflow restart instead
- `pnpm --filter @workspace/nldc run typecheck` for frontend type checking (not `build`)
- CSS: Google Fonts `@import url(...)` must appear at the very top of `index.css` (before Tailwind imports)
- All API hooks from `@workspace/api-client-react`; mutations use `mutate({ data: { ... } })`
- **Dashboard filter-sync effect must navigate to `/dashboard`, not `/`** — `Dashboard.tsx` has a `useEffect` that syncs filter state (search query, sort, score range) to the URL. Its `target` must always be `/dashboard[?params]`. Using `"/"` as the no-filter fallback immediately redirects every Dashboard mount to the Landing page. See `artifacts/nldc/src/pages/Dashboard.tsx` around the `debouncedQuery/sort/scoreRange` effect.
- **OIDC `state` embed: use raw path, no `encodeURIComponent`** — `auth.ts` embeds `returnTo` in the OIDC state as `"<nonce>:<returnTo>"`. Do NOT wrap `returnTo` with `encodeURIComponent`: the Replit fake OIDC issuer echoes state without re-encoding it, so Express URL-decodes `%2F` to `/` on the callback, creating a mismatch between the stored cookie state and `req.query.state` → CSRF validation fails → redirect to `/`. The raw path survives round-trips correctly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
