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
- Optional env: `SENTRY_DSN_API` / `VITE_SENTRY_DSN` — Sentry DSNs (server / client). When unset, monitoring is a no-op. Setup steps in `OPERATIONS.md`.
- Optional env: `VITE_GA_MEASUREMENT_ID` — Google Analytics 4 measurement id (e.g. `G-XXXXXXXXXX`). When unset, GA is a no-op (mirrors the Sentry env-gate): `initAnalytics()` does nothing, and `trackPageView`/`trackEvent` skip gtag while the first-party Activity beacons still fire. When set, gtag loads and a `page_view` is sent on every Wouter route change via `usePageTracking`. Wiring lives in `artifacts/nldc/src/lib/analytics.ts`.
- Optional env: `MAXMIND_LICENSE_KEY` — for the monthly GeoIP dataset refresh used by sign-in location emails. Refresh steps in `OPERATIONS.md`.
- Optional env: `BENCHMARK_MIN_COHORT` — minimum number of people in a goal cohort before `/me/matching/benchmarks` will return anonymized per-lane percentiles; below this the endpoint reports `available: false` so no small-cohort comparison can leak (default 8, floored at 2).
- Optional env: `MATCHING_REWEIGHT_MIN_OUTCOMES` — confidence floor for the outcome-learning re-weighting: the minimum number of logged date outcomes before the outcome tilt is allowed to move any of a person's signal weights. Below this the sample is too small to trust, so base weights stand. Default 8, clamped to [2, 1000]. Also tunable per-environment from the founder control center (Re-weighting section).
- Optional env: `AUTO_PROPOSAL_ENABLED` — SEEDS the default for the founder-dashboard "Auto-proposal sweep" toggle (Brain control center, Background automation). The dashboard toggle is the live source of truth and flips with no redeploy; the env var only sets the day-one default. OFF unless set to a truthy value (`1`/`true`/`yes`/`on`); when off, matching is only minted on-demand by the discover route.
- Optional env: `AUTO_PROPOSAL_INTERVAL_HOURS` — how often the auto-proposal sweep runs, in hours, when `AUTO_PROPOSAL_ENABLED` is on (default 6).
- Optional env: `COMPANION_NUDGE_ENABLED` — SEEDS the default for the founder-dashboard "Echo proactivity sweep" toggle (Brain control center, Background automation). The dashboard toggle is the live source of truth and flips with no redeploy; the env var only sets the day-one default. When on, Echo writes proactive notifications (readiness dip, match waiting, gone quiet, missed commitment) to each engaged user's Echo feed and fans them out to opted-in off-site channels (SMS delivery additionally needs the Twilio credentials). OFF unless set to a truthy value (`1`/`true`/`yes`/`on`); when off, Echo only responds on demand.
- Optional env: `COMPANION_NUDGE_INTERVAL_HOURS` — how often the companion nudge sweep runs, in hours, when `COMPANION_NUDGE_ENABLED` is on (default 12).
- Optional env: `COMPANION_NUDGE_COOLDOWN_HOURS` — min hours between two nudges of the same kind for the same user, deduped against their own feed so repeated sweeps never spam (default 72).
- Optional env: `COMPANION_NUDGE_QUIET_DAYS` — days of silence (no Echo messages) before Echo treats a user as "gone quiet" (default 7).
- Optional env: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — Twilio credentials for Echo SMS delivery. When any is unset (or the optional `twilio` package is not installed), `sms.ts` logs the message and reports `transport: "log"` instead of sending, mirroring `mailer.ts`. Echo only ever texts users who explicitly opted into SMS and supplied a number.

> Operational runbooks (Sentry setup, monthly GeoIP refresh, Stripe payment-link creation + webhook/reconciliation) live in `OPERATIONS.md`. The summaries below stay here; the step-by-step procedures moved there to keep this file scannable.

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
- **Your Mirror is the unifying spine** — `/your-mirror` (`pages/YourMirror.tsx`) is the conversational, evolving model of the user that every tool and signal feeds. It is the answer to "what does the machine actually know about me." The deterministic synthesis lives in `aiEngine.ts` (`buildMirrorPortrait` + `answerMirrorQuestion`): it reads only the user's REAL signal coverage (per-registry-lane counts, stage, readiness breakdown, derived summaries) and produces a structured self-portrait: a headline of what we can see vs cannot, per-dimension coverage + confidence (`known[]`), `blindSpots[]` (lanes with no signal, each with a CTA into the real tool), the single highest-value `nextSignal` to feed, and the readiness/outcome tie-in. Routes in `routes/mirror.ts`: `GET /mirror/portrait` (deterministic, always non-empty) and `POST /mirror/ask` (ask-it-anything). `POST /mirror/ask` follows the exact hybrid contract: deterministic `answerMirrorQuestion` is the always-on baseline, Claude is layered on opt-in behind `ai_content_consent` + daily cap (toolName "Your Mirror" registered in `lib/ai-schemas`, `mirrorAskSchema`), deterministic fallback on consent-off/failure/cap. Only aggregate/derived signal coverage is sent to Claude, never raw content/PII. The frontend invalidates matching-state query after each ask so the readiness meter feels alive. Anon users get a clear demo-fallback portrait ("Sample view, sign in for your own"); the real endpoints are 401 for anon. Do NOT orphan the older Mirror pages (`/mirror`, `/mirror/journal`, `/mirror/dates`): trends are demoted to a "Your patterns over time" subsection on `/your-mirror` but stay reachable.
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

Checkout (`/checkout/:product`) renders a Stripe Payment Link button when the matching `VITE_STRIPE_*_LINK` env var is set (`signal-audit` $29, `dating-reset` $97, `wingman` $197/mo), and falls back to a "save your spot" purchase-interest form when it isn't, so it is safe to ship partially configured. Wiring is in `artifacts/nldc/src/pages/Checkout.tsx` (`PaidForm` reads `import.meta.env[config.stripeEnvKey]`).

The webhook + reconciliation run through the **Replit Stripe integration** (no key to paste): `stripeClient.ts` reads credentials at runtime, `initStripe.ts` registers the managed webhook and backfills on boot, and `stripeReconcile.ts` matches paid `stripe.checkout_sessions` to our `purchase_interest` rows by email (read-only against the `stripe.*` schema). Refunds/disputes stay in the Stripe Dashboard.

> Full env-var table, payment-link creation steps, and the webhook/reconciliation internals are in `OPERATIONS.md`.

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
