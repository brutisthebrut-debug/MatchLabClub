# MatchLab Club — Technical Specification

AI-powered "second brain for your dating life." A companion web + mobile product that sits alongside Tinder/Hinge/Bumble: it audits profiles, rewrites bios, coaches messages, surfaces communication patterns, builds a rising **Match Readiness** meter from every signal a person feeds it, and ultimately powers AI-driven, radius-based matching.

> Scope note: this document is a structural and functional specification. It covers the architecture, the languages and tools, how the frontend and backend are built, and a complete inventory of features, pages, API route groups, backend services, and database tables, with the key functions and patterns for each major subsystem. It describes the system at the module/subsystem level (with named functions) rather than reproducing every individual function body, of which there are thousands.

---

## 1. Languages and core technologies

| Layer | Language / Tool |
| --- | --- |
| Everything | TypeScript 5.9 (strict), Node.js 24 |
| Monorepo manager | pnpm workspaces |
| Frontend (web) | React 19 + Vite 7 |
| Web routing | Wouter |
| Server state / data fetching | TanStack Query (React Query) |
| Animation | Framer Motion |
| Charts | Recharts |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Fonts | Plus Jakarta Sans (body) + Playfair Display (display) |
| Backend API | Express 5 |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod (`zod/v4`) + `drizzle-zod` |
| API contract | OpenAPI spec + Orval codegen |
| Server bundler | esbuild |
| Logging | Pino (structured) |
| Mobile | Expo / React Native |
| AI providers | Anthropic Claude (`@anthropic-ai/sdk`), OpenAI SDK, via Replit AI Integration |
| Payments | Stripe (Replit-managed integration) |
| Calendar | Google Calendar integration |

The whole codebase is TypeScript end to end. There is no separate language for the backend versus the frontend; the same type definitions and Zod schemas are shared across both through the contract-first workflow described in section 4.

---

## 2. Repository structure (monorepo)

A single pnpm-managed repository contains multiple deployable apps ("artifacts") and shared libraries.

```
workspace/
├── artifacts/              # Deployable applications
│   ├── nldc/               # Web app (React + Vite), preview path "/"
│   ├── api-server/         # Express API server, preview path "/api"
│   ├── nldc-mobile/        # Expo / React Native mobile app
│   └── mockup-sandbox/     # Internal design canvas (not customer-facing)
├── lib/                    # Shared libraries
│   ├── db/                 # Drizzle schema + migrations (source of truth)
│   ├── api-spec/           # OpenAPI spec source of truth
│   ├── api-client-react/   # Generated React Query hooks + Zod schemas
│   ├── api-zod/            # Generated Zod schemas
│   ├── ai-schemas/         # Shared AI request/response schemas
│   ├── integrations-anthropic-ai/  # Anthropic provider wrapper
│   ├── echo/               # Shared companion ("Echo") logic
│   └── replit-auth-web/    # Auth client hook + helpers
├── scripts/                # Shared utility scripts
├── pnpm-workspace.yaml     # Workspace + dependency catalog
├── tsconfig.base.json      # Shared strict TS defaults
└── tsconfig.json           # Solution config for composite libs
```

**Why this layout:** the web app, mobile app, and backend reuse the same database types, API contract, and AI schemas instead of redefining them three times. `lib/*` packages are composite (they emit type declarations); `artifacts/*` are leaf apps that consume them but never import each other.

---

## 3. Frontend architecture (web)

Located in `artifacts/nldc/`.

### Build and entry
- `main.tsx` — React root, mounts the app.
- `App.tsx` — declares **~105 routes** with Wouter and wraps everything in `AppLayout`.
- Vite serves the dev server on a dynamic `$PORT`; the production build is static assets served behind the shared proxy.

### Layout shell (conditional navigation)
- `components/layout/AppLayout.tsx` — every page renders this. It shows the persistent **left sidebar** (`AppSidebar.tsx`) when the user is authenticated and not on a marketing route; otherwise it shows the marketing **top-nav** (`Navbar`) + `Footer`.
- Marketing/public routes (`/`, `/pricing`, `/blog`, `/quizzes`, legal, checkout) always keep the top-nav even when signed in, governed by `MARKETING_PREFIXES`.
- `/founder` and `/report/:id` are intentionally excluded from the sidebar.

### State and data
- **Server state**: TanStack Query, always through generated hooks from `@workspace/api-client-react`. Mutations use the `mutate({ data: { ... } })` shape.
- **Local/UI state**: React hooks. Persistent local preferences live in `lib/` helpers (e.g. `coachPrefs.ts`, `autoRefreshPref.ts`, `onboardingState.ts`).
- **Anonymous identity**: `lib/anonymousIds.ts` remembers anonymous work so it can be claimed on login.

### Custom hooks (`src/hooks/`)
- `useClaimAnonymousOnLogin` — reassigns anonymous audits to the account at login.
- `useReadinessClimb` — drives the gamified readiness-climb reveal.
- `usePageTracking` — analytics page views.
- `useMeta` — per-page document title/meta (SEO).
- `useSavedContext` — restores previously entered tool context.
- `use-toast`, `use-mobile` — UI helpers.

### Component groups (`src/components/`)
`auth/`, `climb/` (readiness gamification), `coach/`, `cosmic/`, `echo/` (companion), `founder/` (admin widgets), `layout/`, `safety/`, `seo/`, `ui/` (shadcn primitives), `wellness/`.

### Page inventory (~80 pages, grouped by purpose)

**Marketing & public**
Landing, HowItWorks, Pricing, Blog, BlogPost, Quizzes, Quiz, QuizPlay, SampleReport, Waitlist, ShareCard, ShebangsPartner, Terms, Privacy, not-found.

**Onboarding & intake**
Onboarding, Wizard (5-step intake), VoiceIntro, LifeContext.

**Self model / "what the machine knows about me"**
SelfHub (`/me`), YourMirror (`/your-mirror`, the unifying spine), MirrorProfile, plus the older Mirror pages under `mirror/` (mirror, journal, dates — demoted but still reachable).

**Profile audit tools**
Scan, SourcePaste, Report, ProfileReader, SignalCheck, PhotoLab, MatchPhotos, Gallery.

**Message & conversation coaching**
Coach, Lab (Chemistry Lab), NextMessage, Copilot + copilot/flirt, StyleMap, Insights, Reflection, RehearsalRoom, Scenarios, Wingman, WingmanRespond.

**Readiness, progress & gamification**
Roadmap, Milestones, DatingWinsLog, DailySpark, WhatChanged, Diagnosis, PredictYourself, Archetype, Blueprint, CareDialect, ConnectionStyle, Cosmic, ThisOrThat, WouldYouRather, TimeCapsule, FutureConnections, and the Progress* suite (ProgressReadiness, ProgressScorecard, ProgressTimeline, ProgressFeed, ProgressPatterns, ProgressExperiments, ProgressFollowUp, ProgressCompanion, ProgressControl, ProgressInsightsRoadmap).

**Matching**
Matching, Matches, MatchPath, MatchThread, MatchPhotos.

**Connections & data sources**
ConnectionCenter (`/connections`, the hub for every data source), Integrations (`/integrations`, the OAuth roadmap "Platform Map"), Imports, Receipts, SourcePaste, DataVault.

**Companion ("Echo")**
Echo, ProgressCompanion.

**Wellness, safety & account**
WellnessCenter, DateSafety, Account, UserControl, Verification, Flags, Feedback, Trash, Sessions.

**Checkout**
Checkout, CheckoutSuccess, CheckoutCancel.

**Founder / admin**
Founder (internal control center).

### Frontend conventions
- No em dashes in user-facing copy; no AI-tell words; no emojis (lucide icons only).
- Every page ships hardcoded demo data so the UI never looks empty before a user's first action. Demo data is an anonymous baseline, never a mask for a real-run failure: when a logged-in action fails, the page clears the stale result and shows an explicit error notice (see `Lab.tsx`, `DatingWinsLog.tsx`).

---

## 4. The contract-first API workflow

This is the backbone that keeps frontend and backend in sync.

1. The API is described in OpenAPI inside `lib/api-spec/`.
2. `pnpm --filter @workspace/api-spec run codegen` runs Orval, which generates:
   - typed React Query hooks into `lib/api-client-react/src/generated/`
   - Zod schemas into `lib/api-zod/`
3. The **server** validates inputs/outputs with those Zod schemas; the **client** calls the generated hooks. Both sides share one definition, so a contract change that breaks a caller is caught at typecheck time rather than in production.

Generated files are never hand-edited. The OpenAPI `info.title` controls generated filenames, so it is not changed casually.

---

## 5. Backend architecture (API server)

Located in `artifacts/api-server/`. Express 5, bundled with esbuild into a single CJS/MJS bundle, started with `node`. Structured logging via Pino (`req.log` in handlers, a singleton `logger` elsewhere — `console.log` is never used in server code).

### Directory shape
```
src/
├── index.ts          # boot: registers routes, jobs, integrations; listens on $PORT (8080)
├── routes/           # ~70 route modules (+ colocated tests)
├── lib/              # ~110 service/engine/job modules
├── middlewares/      # request middleware
└── types/            # shared server types
```

### Route groups (`src/routes/`)
- **Auth & identity**: `auth`, `devAuth`, `claim` (anonymous claim + cross-device handoff), `verification`, `push_tokens`.
- **Audits & reports**: `audits` (incl. from-screenshot OCR, bio AI, search), `photos`, `photoLab`, `profiles`.
- **Coaching & messages**: `messages` (coach AI + safety), `coachFollowUps` (stats/timeline), `rehearsal`, `scenarios`, `wingman`, `insights`.
- **Self model**: `mirror`, `journal`, `signalMap`, `wellness`.
- **Readiness/progress & engagement**: `achievements`, `journey`, `dailySpark`, `careDialect`, `wouldYouRather`, `predictions`, `lifePulse`, `timeCapsules`, `datingWins`, `postDateNotes`.
- **Matching**: `matching` (discover, benchmarks, block, reweighting, state-delta), `compass` (Compatibility Compass), `cosmic`.
- **Connections & imports**: `connections`, `connectors`, `imports` (Hinge GDPR parse), `meImports`, `receipts`.
- **Companion (Echo)**: `companion`.
- **Commerce & growth**: `purchaseInterest`, `leads`, `waitlist`, `referrals`, `events`.
- **AI ops**: `ai` (status), plus founder AI-metrics routes.
- **Safety & trust**: `safety`, `trustLedger`, `account` (incl. GDPR export/delete + safety purge).
- **Founder/admin**: `founder` (funnel, events, AI metrics/trends, OCR mismatches & learned rules, reweighting recommendations, wellness stats, referrals attribution).
- **Infra**: `health`, `meta`, `storage`, `flags`.

### Service / engine modules (`src/lib/`)
- **AI core**: `aiEngine.ts` (deterministic, always-on baseline — no keys, never rate-limited; includes `buildMirrorPortrait`, `answerMirrorQuestion`, digests, trends), `aiService.ts` (provider routing, consent gate `requireContentConsent`, daily caps), `aiSchemas`. Reliability/metrics: `aiReliabilityAlerts`, `aiMetricsRetention`.
- **Signals & readiness**: `signalRegistry.ts` (single source of truth `SIGNAL_REGISTRY`; `normalizedWeights`, `describeActiveSignals`, `proposeWeightAdjustments`), `readiness.ts`, `signalCounts.ts`, `signalMap.ts`.
- **Matching**: `matchEngine.ts`, `matchConnections.ts`, `brainConfig.ts` (founder control dial: hold/shadow/applied + cohort bucketing), background jobs `autoProposalJob`, `proposalExpiryJob`, `matchingNudgeJob`.
- **Companion (Echo)**: `companionEngine.ts`, `companionService.ts`, `companionNudgeJob.ts`, `echoMatchRead.ts`.
- **Imports & OCR**: `datingImports.ts`, `importEnrichment.ts`, `importRecoveryJob.ts`, `ocr.ts`, `ocrLearning.ts` (+ learning job), `chatOcr.ts`, `profileParser.ts`, `calendarParser.ts`.
- **Identity & tokens**: `identityVerification.ts`, `phoneVerification.ts`, `anonClaimToken.ts`, `handoffToken.ts` (+ rate limit + redemption cleanup), `wingmanToken.ts`.
- **Integrations**: `stripeClient.ts`, `initStripe.ts`, `stripeReconcile.ts`, `webhookHandlers.ts`, `googleCalendar.ts`, `placesProvider.ts`, `geoLocation.ts` / `geo.ts` / `geoipUpdateJob.ts`, `sms.ts`, `expoPush.ts`, `mailer.ts`, `objectStorage.ts` / `objectAcl.ts`.
- **Engagement/streaks**: `achievements.ts`, `streak.ts`, `activityDays.ts`, `journeyEvents.ts`, `cosmic.ts`, `astrocartography.ts`, `careDialect.ts`, `wellnessInference.ts`, `wellnessQuestionBank.ts`.
- **Cron/cleanup**: `auditTrashPurge`, `auditTrashPushJob`, `auditVersionPurge`, `dataExportTokenCleanup`, `mirrorDigestJob`, `loginNotifications`.
- **Infra**: `logger.ts`, `retry.ts`, `jobHeartbeat.ts`, `userBlocks.ts`, `userAgent.ts`, `testDb.ts`, `devSeed.ts`.

### How the backend code is written (patterns)
- Each route module is a small Express router that validates the request body/params with the generated Zod schema, calls into a `lib/` service, and returns a Zod-validated response.
- Business logic lives in `lib/` services, not in route handlers, so it can be unit-tested directly (most service files have a colocated `*.test.ts`).
- Background work is registered at boot in `index.ts` and gated by founder-dashboard toggles seeded from env flags; the scheduled tick is gated, while on-demand/test calls hit the underlying function directly.
- Boot guards throw at module load (e.g. every first-party signal lane must have a purge handler) so misconfigurations fail loudly on startup.

---

## 6. Database

`lib/db/src/schema/` holds **~60 schema files defining ~75 tables**, Drizzle as the ORM, with committed migrations in `lib/db/drizzle/`. `pnpm --filter @workspace/db run check-schema-drift` verifies migrations match the schema.

Tables grouped by domain:
- **Accounts & auth**: `auth` (users, sessions), `user_verifications`, `handoffTokenRedemptions`, `handoff_rate_limit_hits`, `dataExportTokens`.
- **Profiles & audits**: `profiles`, `profile_photos`, `audits`, `audit_report_versions`, `insights`.
- **Messages & coaching**: `messages`, `post_date_notes`, `scenario_responses`, `prediction_responses`, `wingman`.
- **Self model & wellness**: `journal_entries`, `mirror_digest_prefs`, `wellness_answers`, `wellness_tags`, `wellness_inferences`, `care_dialect_profiles`, `life_pulses`, `flag_selections`.
- **Engagement & gamification**: `dating_wins`, `daily_spark_answers`, `wyr_answers`, `time_capsules`, `journey_events`, `cosmic_charts`, `compatibility_reads`.
- **Matching**: `matching`, `match_connections`, `matching_readiness_snapshots`, `matching_nudge_state`.
- **Companion (Echo)**: `companion_state`, `companion_messages`, `companion_notifications`, `companion_observations`, `companion_commitments`, `companion_channel_prefs`.
- **Imports & connectors**: `imported_sources`, `connector_connections`.
- **AI ops**: `ai_metrics`, `ai_usage_counters`, `ai_alert_thresholds`, `ai_alert_threshold_changes`, `ai_tool_alert_state`.
- **OCR learning**: `ocr_learned_rules`, `ocr_rule_review_log`.
- **Founder & settings**: `founder_brain`, `founder_settings`.
- **Growth & commerce**: `waitlist`, `leads`, `purchase_interest`, `referrals`.
- **Safety & infra**: `safety`, `push_tokens`, `geoip_alert_state`, `loginNotifications`, `job_heartbeats`.

---

## 7. Key product subsystems

### Readiness-first north star
Everything feeds one rising **Match Readiness** meter that gates matching. Every signal source (a tool used, a quiz answered, a connector linked) is a single entry in `SIGNAL_REGISTRY`. `readiness.ts` derives the score, breakdown, and next actions from it; the matching prompt injects aggregate coverage only (never raw content/PII). Weights auto-normalize.

### Hybrid AI (two layers)
1. **Deterministic engine** (`aiEngine.ts`) — always on, no keys, no external calls, no rate limits.
2. **Anthropic Claude** — opt-in per account via a single toggle (`ai_content_consent`), layered on for semantic depth: bio rewrites, message coaching, Compatibility Compass synthesis, Hinge-import summaries, Instagram tone extraction, and profile-photo critique (Claude vision). When consent is off, or a provider call fails or hits the daily cap, the deterministic engine handles it and nothing breaks. Provider routing lives in `aiService.ts`.

### Your Mirror (the unifying spine)
`/your-mirror` is the evolving model of the user. `buildMirrorPortrait` + `answerMirrorQuestion` read only real signal coverage and return a structured self-portrait (what we can/cannot see, per-dimension knowns, blind spots with CTAs, the highest-value next signal).

### Connection Center & consent-first integrations
`/connections` is the single hub for data sources; each connector card shows status, what it returns, what we will see, what we will never touch, and a CTA. Sensitive sources are constrained to subject-line or category-level reads, never bodies or balances. One toggle removes any source and purges its derived data.

### Matching
Radius-based, symmetric hard gate on distance. Internal matches are stored as two ordered rows per pair with a partial unique index for idempotency. Automation (auto-proposal, expiry, re-engagement nudge) runs as background jobs, each gated by a founder toggle.

### Cross-device anonymous claim
Anonymous work is tagged with a server-issued token in the `anon_claim` cookie and reassigned on login. A short-lived HMAC-signed handoff token lets users carry work to another browser.

### Stripe checkout
`/checkout/:product` renders a Stripe Payment Link when the env var is set and falls back to a "save your spot" interest form otherwise. The webhook and reconciliation run through the Replit Stripe integration; reconciliation matches paid sessions to interest rows by email.

---

## 8. Mobile app

`artifacts/nldc-mobile/` — Expo / React Native, sharing the same backend and contract. Includes message coaching, follow-up tracking, and push notifications (`coachNotifications.ts`). It bundles for web preview through Expo's dev server.

---

## 9. Testing and quality gates

Quality is enforced through workflows that run like CI checks:
- **typecheck** — `pnpm run typecheck` across all packages (libs built first, then leaf apps).
- **lint** — ESLint across the repo.
- **api-tests** — the backend Vitest suite (~940 tests).
- **test-claim-client** — the web Vitest suite.
- **test-mobile / test-mobile-auth** — the mobile suites.
- **schema-drift** — migrations vs schema.
- **e2e-founder-ocr-trend** — full Playwright end-to-end.

Testing conventions: most backend services have colocated unit tests; the web suite uses Vitest with explicit imports (no global jest-dom, manual `cleanup()`), and `testDb.ts` provides an in-memory store for service tests.

---

## 10. Build, run, and deploy

Run locally (via Replit workflows, not root `pnpm dev`):
- API server: `pnpm --filter @workspace/api-server run dev` (port 8080)
- Web: `pnpm --filter @workspace/nldc run dev` (dynamic `$PORT`)
- Typecheck: `pnpm run typecheck`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- DB push (dev): `pnpm --filter @workspace/db run push`

A reverse proxy routes by path: the web app at `/`, the API at `/api`. Services bind to the assigned `$PORT` and handle their full base path. Publishing builds and hosts the apps on a `.replit.app` domain (or a custom domain), with TLS and health checks handled by the platform. Checkpoints are saved after each chunk of work so any change can be rolled back.

---

## 11. Operational notes

- Optional env (sensible defaults baked in): Sentry/GA monitoring, MaxMind GeoIP, AI reliability cooldowns, audit-trash purge cadence, matching cohort/automation tuning, Echo companion nudges, Twilio SMS for Echo.
- Privacy posture: Anthropic processes prompts under a zero-retention API policy; user content is never sold, shared, or trained on; users can export and delete everything at any time.
- Runbooks (Sentry, GeoIP refresh, Stripe payment-link creation + webhook/reconciliation) live in `OPERATIONS.md`.
