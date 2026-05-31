# MatchLab Club

AI-powered "second brain for your dating life" — a companion web + mobile app that sits alongside Tinder/Hinge/Bumble. Audits profiles, rewrites bios, coaches messages, surfaces communication patterns, and (post-pivot) runs Compatibility Compass reads + ingests Hinge GDPR exports. Hybrid AI: deterministic baseline always-on, Anthropic Claude layered on top for semantic depth, opt-in per account.

## Privacy & AI in one paragraph

Two layers. The deterministic engine (`aiEngine.ts`) runs on every account by default: no keys, no external calls, no rate limits. On top of that, Anthropic Claude is opt-in via a single per-account toggle (`ai_content_consent`, surfaced in `/account` as "Deep AI lane"). The Claude layer covers bio rewrites, message coaching, Compatibility Compass synthesis, Hinge import summaries, Instagram tone extraction, and profile photo critique (Claude vision, opt-in only, with a deterministic photo checklist as the always-on baseline). When the toggle is off, or when a Claude call fails or hits the daily cap, the deterministic engine handles the request and nothing breaks. Anthropic processes prompts under their zero-retention API policy. We never sell, share, or train on user content. Users can export and delete everything from their account at any time. Any marketing copy that says "no external AI" without qualification is stale and should be rewritten.

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
- Optional env: `SENTRY_DSN_API` — server-side Sentry DSN. When unset, error monitoring is a no-op.
- Optional env: `VITE_SENTRY_DSN` — client-side Sentry DSN. When unset, frontend Sentry is a no-op.

### Error monitoring

We use Sentry for production error monitoring. The free tier is fine for our volume. Setup:

1. Create a Sentry account and add two projects: one for `nldc-web` (platform: React) and one for `api-server` (platform: Node.js / Express).
2. Copy each project's DSN.
3. Paste the api-server DSN into the `SENTRY_DSN_API` env var, and the web DSN into `VITE_SENTRY_DSN` (Replit Secrets, "shared" environment so Vite exposes it).
4. Restart the `artifacts/api-server: API Server` and `artifacts/nldc: web` workflows so the new env is picked up.

Both SDKs short-circuit to a no-op when their DSN is unset, so it is safe to leave either side unconfigured during local development.

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
- `artifacts/api-server/src/lib/aiEngine.ts` — deterministic AI engine (always-on baseline, no external calls). The product as a whole is hybrid: this engine plus optional Anthropic Claude, opt-in per account.
- `artifacts/api-server/src/lib/signalRegistry.ts` — single source of truth for every readiness/matching signal (`SIGNAL_REGISTRY`). `readiness.ts` and the `matching.ts` external-read prompt both derive from it.
- `lib/api-spec/` — OpenAPI spec source of truth
- `lib/api-client-react/src/generated/` — generated hooks and Zod schemas (do not edit)
- `lib/db/src/schema.ts` — Drizzle schema source of truth

## Architecture decisions

- **North star: readiness-first, matching is the payoff** — The single promise is: become genuinely relationship-ready, then get matched (AI-driven) with people you'd never find on your own, near you. Readiness leads; matching is the reward. The "optimize your existing dating apps" tools (profile audits, Signal Score, message coaching, bio/prompt rewrites, quizzes) are NOT the headline. They serve two jobs at once: (1) immediate value that keeps people sticky, and (2) the way the machine gathers signal to understand a person. The unifying line is "the more the machine knows you, the better it matches you." Every tool used, every source connected, every quiz answered feeds one rising **Match Readiness** meter that gates matching. Stickiness levers are gamification (the readiness climb, unlocks), sharing, and the blog. Data is gathered both manually (screenshots, profile details, quiz answers) and via integrations (social, spending, calendar). Matching is radius-based (e.g. 25/35/45 mi). Inclusivity is core: all genders and orientations, inclusive by default, not a niche app. Founder tools must let the founder curate what is good/bad. When messaging or surfacing any feature, frame it inside this spine. Do NOT reposition the outside-app tools as the headline product. LONG-TERM / NOT-YET (do not build unless asked): an invite-only "after dark" mode for casual connection with its own vibe; AI date-idea + location suggestions within both people's vicinity; full OAuth integrations.
- **Hybrid AI** — deterministic `aiEngine.ts` is the always-on baseline (no keys required, never rate-limited). Anthropic Claude (via Replit AI Integration, no key needed from the user) is layered on for semantic depth on tools that benefit: bio rewrites, message coaching, Compatibility Compass synthesis, Hinge import summarization, Instagram tone extraction, and profile photo critique (`analyzeProfilePhotos` in `aiService.ts`, Claude vision over the uploaded screenshot; consent-gated and daily-capped like every other Claude tool; the deterministic photo checklist in `aiEngine.ts` is the always-on fallback and the image is read in the moment, never stored). Provider routing lives in `aiService.ts`. Per-account `ai_content_consent` gate — see `requireContentConsent` in `aiService.ts`. When consent is off or a provider fails, calls fall back to the deterministic engine automatically.
- **Living signal registry** — every readiness/matching signal is one entry in `SIGNAL_REGISTRY` (`artifacts/api-server/src/lib/signalRegistry.ts`): id, count key, wellness dimensions, weight, confidence, normalization (count or binary), optional decay, a plain-English `describe()` prompt line, and the UI `action` copy. To add a new signal source (connector, quiz, import), add ONE registry entry plus its DB count, instead of hand-editing weights, denominators, the matching prompt, and UI copy across files. `normalizedWeights` auto-normalizes so adding a contributor never breaks the sum-to-1 invariant (ids MUST be unique, since weights are keyed by id). `readiness.ts` derives `computeBreakdown`/`scoreFromBreakdown`/`computeNextActions` from the registry; `matching.ts` external-read injects `describeActiveSignals(...)` so a new signal auto-appears in Echo's reasoning with no prompt rewrite (only aggregate coverage + generic descriptions are sent, never raw content/PII). Day-one behavior is preserved exactly (default weights already sum to 1.0). `proposeWeightAdjustments` is the "breathing" layer: bounded, deterministic, outcome-driven re-weighting that is intentionally NOT wired into live scoring yet, so nothing changes until we choose to act on it.
- **Connection Center is the spine of the deep product** — `/connections` (`pages/ConnectionCenter.tsx`) is the single operational hub for every data source the user can plug in. Each connector is a card with the same shape: name, status (live / building / researching), what it returns, what we'll see, what we'll never touch, and a CTA pointing to the real working page. The intent is that every new data signal we add (Plaid, forwarding inbox, calendar, Spotify, etc.) lives here and follows this contract. `/integrations` (`pages/Integrations.tsx`) is a separate, marketing-oriented "Platform Map" page covering the OAuth roadmap (Hinge / Tinder / Bumble) and waitlist requests — keep the two pages distinct, they have different jobs. Connector roadmap is sequenced in Beats: Beat 1 = Connection Center repositioning (shipped); Beat 2 = per-user forwarding inbox at `{handle}@receipts.matchlab.club` (subject + sender + timestamp only, never the body, sidesteps Google CASA entirely); Beat 3 = Plaid spending signals; Beat 4 = insight stream on `/me`; Beat 5 = calendar `.ics` paste (shipped, and wired into Match Readiness as the `calendar` "calendar rhythm" lane via the signal registry; reads only the derived event count from the stored summary, never the raw .ics); Beat 6 = signal-density visualisation; Beat 7 = matching cohort opt-in. Each beat ships standing alone.
- **Consent-first integrations** — every connector surfaces explicit "what we'll see / what we'll never touch" lists upfront, before the user plugs anything in. Sensitive sources (mail, bank) are constrained to subject-line or category-level reads, never the underlying body or balance. One toggle removes any source and purges its data.
- **Demo data as fallback** — Every page has hardcoded demo data so the UI never looks empty, even before a user completes their first audit.
- **Contract-first API** — OpenAPI spec → Orval codegen → typed hooks. Server and client share Zod schemas.
- **Revenue-first product** — Pricing page with three tiers ($0 / $97 / $197), podcast promo code, waitlist with early listener perks.
- **Cross-device anonymous claim** — Anonymous audits are tagged with a server-issued token kept in the `anon_claim` cookie. On login, `POST /api/claim-anonymous` reassigns them. For users who switch devices or clear cookies, `POST /api/claim-anonymous/handoff/issue` mints a short-lived (15 min) HMAC-signed token they can carry to another browser, and `POST /api/claim-anonymous/handoff/redeem` claims with that token instead of the cookie. Optional env `ANON_CLAIM_HANDOFF_SECRET` overrides the default signing key (derived from `REPL_ID`).

## Product

- **Landing page** — hero, social proof, privacy promise, final CTA
- **Intake wizard (5 steps)** — name/age/gender, goal, bio paste, message sample, review + submit
- **Dashboard** — score ring, score history sparkline, strengths/risks badges, recent audits, quick actions
- **Report page** — full audit with score, bio critique, AI rewrite, prompt rewrites, photo critique (real Claude vision read when the deep AI lane is on), photo checklist, action plan
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

### Stripe webhook + reconciliation (live)

The Stripe webhook is wired through the **Replit Stripe integration** (no key needed from the user) plus the `stripe-replit-sync` package. There is nothing to paste manually:

- **Connection + credentials** — `artifacts/api-server/src/lib/stripeClient.ts` reads the integration's secret key and webhook secret at runtime from the Replit connectors endpoint (never stored). `isStripeConnected()` is the guard; when no connection exists, every Stripe path is a no-op and the server boots normally.
- **Startup init** — `artifacts/api-server/src/lib/initStripe.ts` runs `stripe-replit-sync` migrations (creates the `stripe` schema), registers a managed webhook at `/api/stripe/webhook`, then backfills and reconciles in the background. Guarded: it logs and returns if there is no connection or `DATABASE_URL`, so it never blocks or crashes startup. Called fire-and-forget from `index.ts`.
- **Webhook route** — registered in `app.ts` **before** `express.json()` with `express.raw()` so the raw body Buffer reaches signature verification. The CSRF origin guard lets it through (Stripe is server-to-server, no Origin header); the Stripe signature is the real auth. Handler lives in `artifacts/api-server/src/lib/webhookHandlers.ts`, which delegates to `stripe-replit-sync`'s `processWebhook` to verify and sync the event into the `stripe` schema.
- **Reconciliation** — `artifacts/api-server/src/lib/stripeReconcile.ts` runs read-only against `stripe.checkout_sessions` (managed by the sync package; we never write to the `stripe.*` schema), matches paid sessions to our `purchase_interest` rows by case-insensitive email, and stamps `status = "paid"` + `stripe_session_id` on our own table. Runs automatically on startup after backfill, and on demand via `POST /api/purchase-interest/reconcile` (founder-only).

Refunds and disputes are still handled entirely in the Stripe Dashboard. To reconcile on demand after a payment, a founder can hit the reconcile endpoint (or just restart the API server, which reconciles on boot).

## User preferences

- **Voice:** no em dashes anywhere in user-facing copy, no AI-tell words ("dive in", "unleash", "elevate", "in today's world", etc.), no emojis in the UI (use lucide icons instead).
- **Keep the heart, keep the work:** the product is built with genuine care and inclusivity. When reorganizing or consolidating, do NOT delete or orphan existing pages/features. Everything must stay reachable, just organized better. Inclusivity (all genders/orientations) is non-negotiable.
- **Gamification is a recurring ask:** the founder repeatedly wants the experience gamified (readiness climb, streaks, unlocks). Lean into it.
- **Build for stickiness then matching:** people must get enough value (and fun, sharing, blog) to stay and share their data; matching is the long-game payoff that the data powers.
- The founder/admin view and the user view are both first-class; keep both substantial.

## Gotchas

- **Navigation shell is conditional in `AppLayout.tsx`** — every page renders `AppLayout` itself. `AppLayout` shows the persistent left sidebar (`components/layout/AppSidebar.tsx`) when `isAuthenticated && !isMarketingRoute(location)`, otherwise it falls back to the marketing top-nav (`Navbar`) + `Footer`. Marketing/public routes (`/`, `/pricing`, `/blog`, `/quizzes`, legal, checkout, etc.) always keep the top-nav, even when signed in. To make a new app page reachable, add it to a section in `AppSidebar.tsx`; to keep a page on the top-nav shell, add its prefix to `MARKETING_PREFIXES` in `AppLayout.tsx`. `/founder` (internal admin) and `/report/:id` (contextual detail) are intentionally excluded from the sidebar.
- Do not run `pnpm dev` at the workspace root — use workflow restart instead
- `pnpm --filter @workspace/nldc run typecheck` for frontend type checking (not `build`)
- CSS: Google Fonts `@import url(...)` must appear at the very top of `index.css` (before Tailwind imports)
- All API hooks from `@workspace/api-client-react`; mutations use `mutate({ data: { ... } })`
- **Dashboard filter-sync effect must navigate to `/dashboard`, not `/`** — `Dashboard.tsx` has a `useEffect` that syncs filter state (search query, sort, score range) to the URL. Its `target` must always be `/dashboard[?params]`. Using `"/"` as the no-filter fallback immediately redirects every Dashboard mount to the Landing page. See `artifacts/nldc/src/pages/Dashboard.tsx` around the `debouncedQuery/sort/scoreRange` effect.
- **OIDC `state` embed: use raw path, no `encodeURIComponent`** — `auth.ts` embeds `returnTo` in the OIDC state as `"<nonce>:<returnTo>"`. Do NOT wrap `returnTo` with `encodeURIComponent`: the Replit fake OIDC issuer echoes state without re-encoding it, so Express URL-decodes `%2F` to `/` on the callback, creating a mismatch between the stored cookie state and `req.query.state` → CSRF validation fails → redirect to `/`. The raw path survives round-trips correctly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
