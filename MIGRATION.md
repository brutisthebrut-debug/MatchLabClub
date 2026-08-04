# MatchLab Club — Production Migration Plan

> **Phase 0 scope contract.** This document is documentation only.
> Phase 0 must not change product behavior, database schema, auth behavior,
> payment behavior, deployment behavior, application logic, routes, environment
> usage, package versions, build scripts, or deployment configuration.
> Every change in Phase 0 is a `.md` file write or a `docs/` file write.
> Nothing else.

---

## Table of contents

1. [Migration phases overview](#1-migration-phases-overview)
2. [Replit dependency inventory](#2-replit-dependency-inventory)
3. [Environment variable inventory](#3-environment-variable-inventory)
4. [Production readiness checklist](#4-production-readiness-checklist)
5. [Human code review checklist](#5-human-code-review-checklist)
6. [Local development and Bitbucket handoff guide](#6-local-development-and-bitbucket-handoff-guide)

---

## 1. Migration phases overview

### Phase 0 — Documentation and audit (this phase, no code changes)

**Goal:** Produce a complete written record of every Replit coupling point,
every environment variable, every external dependency, and every risk area
before a single line of production code is touched. A human engineer must be
able to read this document and understand the full migration scope without
touching the codebase.

**Deliverables (all `.md` files, no runtime changes):**

- This file (`MIGRATION.md`)
- Replit dependency inventory (section 2)
- Environment variable inventory (section 3)
- Production readiness checklist (section 4)
- Human code review checklist (section 5)
- Local development and Bitbucket handoff guide (section 6)

**Exit criteria:** All sections below are complete and reviewed by at least one
human engineer. No open questions in any checklist item marked REQUIRED.

---

### Phase 1 — Replace auth (highest risk, do first)

**Goal:** Swap Replit OIDC (`https://replit.com/oidc`) for a self-managed
identity provider without losing any existing user accounts or sessions.

**Scope:**

- Choose an IdP: Clerk, Auth0, or WorkOS are the recommended options. Clerk is
  the fastest path for a small team; Auth0 scales further; WorkOS is best if
  enterprise SSO is a future requirement.
- Add an account-linking migration: existing `users` rows carry a Replit `sub`
  claim. New IdP will issue different `sub` values. A one-time migration
  endpoint or an "link your new account" flow is required so existing users do
  not lose their data.
- Rebuild the mobile token-exchange endpoint (`/api/mobile-auth/token-exchange`)
  against the new IdP's SDK.
- Replace `REPL_ID` as the OIDC `client_id` with a real OAuth application
  client ID stored in a proper secret.
- The anonymous claim flow (`anon_claim` cookie, handoff token) is
  IdP-independent and does not need changes beyond ensuring `REPL_ID` is
  replaced as the handoff signing key seed (use an explicit `APP_SECRET`).
- Remove `devAuth.ts` bypass entirely or move it behind a more explicit
  `ALLOW_DEV_AUTH=true` + `NODE_ENV !== 'production'` double gate.

**Key files:**

- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/lib/auth.ts`
- `artifacts/api-server/src/middlewares/authMiddleware.ts`
- `artifacts/api-server/src/routes/devAuth.ts`
- `artifacts/api-server/src/lib/anonClaimToken.ts`
- `artifacts/api-server/src/lib/handoffToken.ts`

**Risk:** High. Auth is the trust boundary for every route. Run against a
staging database first. Keep the old Replit OIDC path alive behind a feature
flag until the new path is proven.

---

### Phase 2 — Replace Replit-managed services (Stripe, storage, email)

**Goal:** Swap every Replit sidecar/connector for a direct SDK or managed
cloud service, so the server boots and runs without any Replit infrastructure.

**Sub-tasks in recommended order:**

#### 2a. Stripe (`stripe-replit-sync` → direct SDK)

- Remove `stripe-replit-sync` from `package.json`.
- Write a plain webhook handler using the official `stripe` SDK
  (`stripe.webhooks.constructEvent`).
- Create a `stripe_webhook_secret` env var and store the signing secret from
  the Stripe dashboard.
- Decide whether to keep the `stripe.*` Postgres schema (populated by
  `stripe-replit-sync`) or normalize relevant fields into `purchase_interest`.
  Recommendation: keep a `stripe_events` table seeded by the webhook and
  query it for reconciliation; retire the managed schema.
- Update `stripeReconcile.ts` to read from the new table.
- Update `initStripe.ts` to remove the managed webhook registration; instead
  register the webhook manually in the Stripe dashboard pointing to your
  production domain.

**Key files:** `artifacts/api-server/src/lib/stripeClient.ts`,
`artifacts/api-server/src/lib/initStripe.ts`,
`artifacts/api-server/src/lib/stripeReconcile.ts`,
`artifacts/api-server/src/lib/webhookHandlers.ts`

#### 2b. Object storage (sidecar → direct GCS or S3-compatible)

- The sidecar at `http://127.0.0.1:1106` handles GCS token exchange and signed
  URL generation. Replace with one of:
  - **Direct GCS**: service account JSON key → `GOOGLE_APPLICATION_CREDENTIALS`
    env var; use `@google-cloud/storage` directly.
  - **Cloudflare R2**: S3-compatible, zero egress cost; switch to `@aws-sdk/client-s3`
    with a custom endpoint.
  - **AWS S3**: straightforward; `@aws-sdk/client-s3`.
- `objectStorage.ts` has a clean abstraction layer; the only changes are in
  the `getToken()` and `getSignedUrl()` helpers at the top of that file.
- `PUBLIC_OBJECT_SEARCH_PATHS` and `PRIVATE_OBJECT_DIR` env vars remain as-is;
  only the credential mechanism changes.

**Key files:** `artifacts/api-server/src/lib/objectStorage.ts`

#### 2c. Google Calendar (`@replit/connectors-sdk` → real OAuth)

- Currently, no OAuth tokens are stored — Replit proxies the API call.
- Migration requires: Google Cloud project → OAuth 2.0 credentials →
  `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → store per-user `access_token`
  - `refresh_token` in a new `oauth_tokens` table → surface a consent screen
    to users → refresh tokens automatically before expiry.
- `googleCalendar.ts` currently calls `ReplitConnectors.proxy()`. Replace the
  call with a direct `https://www.googleapis.com/calendar/v3/...` fetch using
  the stored token.
- Update the Connection Center UI to show a real "Connect Google Calendar"
  OAuth button (currently it works silently through Replit).

**Key files:** `artifacts/api-server/src/lib/googleCalendar.ts`

#### 2d. Email (Resend connector → direct Resend SDK or SMTP)

- `mailer.ts` already supports both `RESEND_API_KEY` (direct) and `SMTP_URL`.
  The only Replit-coupled path is when it reads credentials from
  `REPLIT_CONNECTORS_HOSTNAME`. Set `RESEND_API_KEY` explicitly and the
  connector path is never reached.
- Action: set `RESEND_API_KEY` as an explicit secret. No code change required.

---

### Phase 3 — Replace AI proxy with direct API keys

**Goal:** Remove dependency on Replit's AI integration proxy so the API server
can call Anthropic and OpenAI directly.

**Scope:**

- Add `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as explicit secrets.
- In `aiService.ts`, update the SDK initialization to use the direct base URL
  (remove any Replit proxy configuration). Anthropic SDK defaults to
  `https://api.anthropic.com`; OpenAI SDK defaults to `https://api.openai.com`.
- Verify the daily cap system (`ai_usage_counters`) and consent gate
  (`ai_content_consent`) are unchanged — they are purely application-layer and
  have no Replit coupling.
- The voice pass / regeneration logic has no external dependencies; unchanged.

**Key files:** `artifacts/api-server/src/lib/aiService.ts`

**Risk:** Low — `aiService.ts` is well-isolated. The deterministic fallback
(`aiEngine.ts`) means a misconfigured key degrades gracefully rather than
breaking the product entirely.

---

### Phase 4 — Background jobs, security hardening, and database migrations

**Goal:** Make the server safe for horizontal scale and production traffic.

#### 4a. Background jobs (critical for autoscale)

All eight in-process jobs run via `setInterval`/`setTimeout`. On a multi-replica
deployment they fire on every instance simultaneously, causing duplicate
proposals, duplicate nudges, and duplicate GeoIP updates.

**Options (choose one):**

- **pg-boss** (recommended): Postgres-native job queue; no Redis dependency;
  works with the existing `DATABASE_URL`; distributed locks built in.
- **BullMQ + Redis**: higher throughput ceiling; requires a managed Redis
  instance (Upstash or Redis Cloud).
- **Temporal**: complex but most durable; overkill for current volume.

Move each job from `index.ts` into a separate worker process (or a dedicated
queue worker) that runs as a single instance regardless of API replica count.

**Jobs to migrate:**
`autoProposalJob`, `matchingNudgeJob`, `companionNudgeJob`, `mirrorDigestJob`,
`geoipUpdateJob`, `ocrLearningJob`, `auditTrashPurge`,
`handoffRedemptionCleanup`, `dataExportTokenCleanup`

#### 4b. Database migrations (push → migrate)

`scripts/post-merge.sh` runs `pnpm --filter db push` which calls
`drizzle-kit push` — this directly mutates the schema without recording
migration history. This is acceptable in a single-developer Replit environment
but dangerous against a managed production database.

**Action:** Replace `drizzle-kit push` with `drizzle-kit migrate` in CI/CD:

1. Always generate migration files (`drizzle-kit generate`) when schema changes.
2. Commit the generated SQL under `lib/db/drizzle/`.
3. CI applies migrations via `drizzle-kit migrate` as a deploy step (never
   automatically on merge).
4. Never run `drizzle-kit push` against the production database.

#### 4c. Security hardening

- Add `helmet()` to `app.ts` middleware stack (before routes).
- Add `express-rate-limit` globally on all routes; tighten further on auth
  endpoints (`/api/auth/login`, `/api/auth/callback`).
- Scope `express.json({ limit: '12mb' })` to only the file-upload routes;
  use `express.json({ limit: '64kb' })` globally.
- Add session rotation on privilege escalation (consent grant, tier upgrade).
- Add an explicit `APP_SECRET` env var to seed the handoff signing key
  (currently derived from `REPL_ID`).
- Add a secondary `ALLOW_DEV_AUTH=true` gate to `devAuth.ts` so it cannot
  accidentally become live if `NODE_ENV` is misconfigured.

#### 4d. Database backups

Configure automated daily backups on the managed Postgres provider. Document
the restore procedure. Set a retention window (minimum 30 days).

---

### Phase 5 — CI/CD, hosting, and go-live

**Goal:** Full Bitbucket-based development workflow, automated CI, and a
non-Replit production hosting target.

#### 5a. Bitbucket repository and branch permissions

- Mirror the monorepo to Bitbucket. The pnpm workspace structure, TypeScript
  project references, and Orval codegen pipeline are fully portable.
- Branch permissions on `main` (Repository settings -> Branch restrictions):
  require passing builds (Bitbucket Pipelines), require at least one approval,
  and disable force-push and direct pushes so every change lands through a
  pull request.

#### 5b. Bitbucket Pipelines CI

CI runs on Bitbucket Pipelines. The committed config is `bitbucket-pipelines.yml`
at the repo root; it runs on every pull request and on pushes to `main`. Steps
run in parallel where independent:

| Step         | Command                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| Typecheck    | `pnpm run typecheck`                                                          |
| Lint         | `pnpm run lint`                                                               |
| API tests    | `pnpm --filter @workspace/api-server run test` (against a `postgres` service) |
| Schema drift | `pnpm --filter @workspace/db run check-schema-drift`                          |
| Voice lint   | `pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts`     |
| Web tests    | `pnpm --filter @workspace/nldc run test`                                      |

The end-to-end Playwright suite is wired as a manually triggered `custom: e2e`
pipeline rather than a PR gate, because `e2e/playwright.config.ts` currently
targets the Replit shared proxy at `localhost:80`. Point that at a real reverse
proxy (or update the config to hit the two dev servers directly) before promoting
e2e to a blocking step. See section 6.9 and the comments in
`bitbucket-pipelines.yml`.

Note: the full `nldc` vitest suite takes 2+ minutes; keep it in its own step (or
shard it) so it does not stretch the parallel group.

#### 5c. Recommended hosting stack

| Service           | Recommended option          | Notes                                                                                                       |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| API server        | Fly.io or Railway           | Both support the esbuild `.mjs` bundle; persistent workers; health-check path `/api/healthz` already exists |
| Web (static)      | Cloudflare Pages or Vercel  | Vite builds to `dist/public`; zero-config deploy                                                            |
| Database          | Neon (serverless Postgres)  | Direct `DATABASE_URL` swap; no Drizzle changes; autoscales to zero                                          |
| Background jobs   | pg-boss on the same Neon DB | Eliminates Redis dependency                                                                                 |
| Object storage    | Cloudflare R2               | S3-compatible; free egress; swap `objectStorage.ts` credential block                                        |
| Email             | Resend (direct API key)     | No code change required once `RESEND_API_KEY` is set                                                        |
| Redis (if needed) | Upstash                     | Serverless, pay-per-request                                                                                 |
| Mobile builds     | Expo EAS                    | Already fully portable; no changes                                                                          |

#### 5d. Production deployment runbook

Write a step-by-step runbook covering:

- Environment variable checklist (all variables in section 3 marked REQUIRED)
- Database migration apply procedure
- Stripe webhook re-registration at the new domain
- Google OAuth redirect URI update
- Sentry DSN swap
- Smoke test checklist (auth flow, one audit end-to-end, one message coach
  request, one Stripe checkout)

---

## 2. Replit dependency inventory

This section catalogs every place the codebase couples to Replit infrastructure.
Each entry lists the exact file(s), the coupling mechanism, the migration action,
and the effort level. **Nothing in this list is a problem today on Replit; it
becomes a blocker the moment the process runs outside Replit.**

---

### 2.1 OIDC authentication — REPLIT AUTH

**Coupling type:** Identity provider  
**Risk:** Critical — every authenticated request flows through this

| Item          | Detail                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| OIDC issuer   | `https://replit.com/oidc` (hardcoded default in `auth.ts`, overridable via `ISSUER_URL`)                       |
| Client ID     | `process.env.REPL_ID` — the Replit Repl's unique ID serves as the OAuth client ID                              |
| Token refresh | Access tokens are refreshed against Replit's token endpoint using the stored refresh token                     |
| User identity | `users.id` is a UUID generated on first login; the Replit OIDC `sub` claim links the row to the Replit account |
| Mobile auth   | `/api/mobile-auth/token-exchange` exchanges an Expo-issued OIDC code with Replit as the IdP                    |

**Files:**

- `artifacts/api-server/src/routes/auth.ts` — OIDC flow, callback, state management
- `artifacts/api-server/src/lib/auth.ts` — `ISSUER_URL` constant, `upsertUser`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — session hydration + token refresh
- `artifacts/api-server/src/routes/devAuth.ts` — dev-only bypass (must be removed/double-gated)

**Migration action:** Phase 1. Choose a new IdP. Replace `REPL_ID` with a real
`OIDC_CLIENT_ID`. Add account-linking migration for existing users.

---

### 2.2 AI proxy — REPLIT AI INTEGRATIONS

**Coupling type:** Managed API proxy (no local API keys needed on Replit)  
**Risk:** High — all live AI calls fail without the proxy

| Item      | Detail                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------- |
| Anthropic | `@anthropic-ai/sdk` initialized without an explicit key; Replit injects credentials via its proxy |
| OpenAI    | `openai` SDK initialized without an explicit key; same mechanism                                  |
| Env var   | `REPLIT_INTEGRATIONS_TOKEN` or similar (injected by platform, not user-set)                       |

**Files:**

- `artifacts/api-server/src/lib/aiService.ts` — SDK initialization, all provider calls

**Migration action:** Phase 3. Add `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as
explicit secrets; remove Replit proxy base URL configuration from SDK init.
The deterministic fallback (`aiEngine.ts`) means the product degrades gracefully
during the transition.

---

### 2.3 Stripe — `stripe-replit-sync`

**Coupling type:** Proprietary package + managed webhook registration  
**Risk:** High — payments, tier upgrades, and reconciliation break without it

| Item                 | Detail                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Package              | `stripe-replit-sync` (Replit-proprietary; not on npm public registry)                                       |
| Webhook registration | `initStripe.ts` calls `StripeSync.registerWebhook()` which auto-configures a Replit-hosted webhook endpoint |
| DB schema            | Populates a `stripe.*` Postgres schema; `stripeReconcile.ts` reads from `stripe.checkout_sessions`          |
| Credentials          | `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`, `WEB_REPL_RENEWAL` (all Replit-injected)                     |

**Files:**

- `artifacts/api-server/src/lib/stripeClient.ts`
- `artifacts/api-server/src/lib/initStripe.ts`
- `artifacts/api-server/src/lib/stripeReconcile.ts`
- `artifacts/api-server/src/lib/webhookHandlers.ts`

**Migration action:** Phase 2a. Remove `stripe-replit-sync`. Write a direct
`stripe.webhooks.constructEvent` handler. Register the webhook manually in the
Stripe dashboard. Replace or normalize the `stripe.*` schema.

---

### 2.4 Object storage — GCS sidecar

**Coupling type:** Local HTTP sidecar process  
**Risk:** High — all file uploads, signed URL generation, and private object
reads fail without the sidecar

| Item              | Detail                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Sidecar address   | `http://127.0.0.1:1106` (hardcoded in `objectStorage.ts`)                                 |
| Functions coupled | `getToken()` (credential exchange), `getSignedUrl()` (signed GCS URLs), `getCredential()` |
| Public paths      | `PUBLIC_OBJECT_SEARCH_PATHS` env var (format stays the same post-migration)               |
| Private paths     | `PRIVATE_OBJECT_DIR` env var (format stays the same post-migration)                       |

**Files:**

- `artifacts/api-server/src/lib/objectStorage.ts` — top ~30 lines contain all sidecar calls

**Migration action:** Phase 2b. Replace the three sidecar helper functions with
direct GCS (service account key) or S3-compatible (Cloudflare R2 / AWS S3)
credentials. The rest of `objectStorage.ts` is clean abstraction and needs no
changes.

---

### 2.5 Google Calendar — `@replit/connectors-sdk`

**Coupling type:** Managed OAuth proxy (no local tokens)  
**Risk:** Medium — Calendar integration stops working; user data is not lost
(the calendar lane falls back to zero signal count)

| Item             | Detail                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Package          | `@replit/connectors-sdk`                                                                            |
| Mechanism        | `ReplitConnectors.proxy()` — Replit holds the OAuth tokens and proxies the Google Calendar API call |
| No local storage | There are no `access_token` or `refresh_token` rows in the database for Calendar today              |

**Files:**

- `artifacts/api-server/src/lib/googleCalendar.ts`

**Migration action:** Phase 2c. Implement Google OAuth 2.0 with a real
`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Store tokens per user in a new
`oauth_tokens` table. Update the Connection Center UI to surface a real OAuth
consent button.

---

### 2.6 Email — Resend connector

**Coupling type:** Optional connector credential fetch  
**Risk:** Low — falls back to SMTP or log transport; already supports direct key

| Item      | Detail                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Mechanism | `mailer.ts` checks `REPLIT_CONNECTORS_HOSTNAME` to fetch Resend credentials at runtime |
| Fallback  | If `RESEND_API_KEY` is set directly, the connector path is never reached               |

**Files:**

- `artifacts/api-server/src/lib/mailer.ts`

**Migration action:** Phase 2d. Set `RESEND_API_KEY` explicitly. No code change
required.

---

### 2.7 CORS allowlist — `REPLIT_DOMAINS` and `REPLIT_EXPO_DEV_DOMAIN`

**Coupling type:** Environment variable (Replit-injected)  
**Risk:** High — if these are empty on a non-Replit host, the CORS allowlist
collapses and all cross-origin requests (including from the SPA) are rejected

| Item                     | Detail                                                                           |
| ------------------------ | -------------------------------------------------------------------------------- |
| `REPLIT_DOMAINS`         | Comma-separated list of all Replit-assigned domains; feeds `getAllowedOrigins()` |
| `REPLIT_EXPO_DEV_DOMAIN` | Expo tunnel domain in development; allows the mobile dev build to reach the API  |

**Files:**

- `artifacts/api-server/src/app.ts` — `getAllowedOrigins()` function at the top

**Migration action:** Add `ALLOWED_ORIGINS` as an explicit env var (comma-separated
production domains + staging domain + `localhost:*` for development). Update
`getAllowedOrigins()` to read it. This is a one-line change in `app.ts`.

---

### 2.8 Deployment routing — `artifact.toml` and `.replit`

**Coupling type:** Platform-specific configuration format  
**Risk:** Low — these files are ignored outside Replit; production hosting uses
its own config (`fly.toml`, `Dockerfile`, Vercel `vercel.json`, etc.)

| Item                                                  | Detail                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `artifacts/api-server/.replit-artifact/artifact.toml` | Defines service routing at `/api`, port 8080, production build/run commands             |
| `artifacts/nldc/.replit-artifact/artifact.toml`       | Defines static serve from `dist/public`, SPA rewrites                                   |
| `.replit`                                             | `deploymentTarget = "autoscale"`, port mappings, workflow definitions, `postMerge` hook |

**Files:** `.replit`, `artifacts/*/. replit-artifact/artifact.toml`

**Migration action:** Phase 5. Write equivalent host-specific configs
(`fly.toml`, `Dockerfile` for the API; `vercel.json` or Cloudflare Pages config
for the web). The actual build commands are identical; only the config format
changes.

---

### 2.9 Background jobs — in-process, autoscale-unsafe

**Coupling type:** Architecture assumption (single instance)  
**Risk:** High on autoscale — duplicate sends, duplicate DB writes on every
additional replica

| Jobs                       | Risk                                          |
| -------------------------- | --------------------------------------------- |
| `autoProposalJob`          | Duplicate match proposals                     |
| `matchingNudgeJob`         | Duplicate SMS/in-app nudges                   |
| `companionNudgeJob`        | Duplicate Echo nudges                         |
| `mirrorDigestJob`          | Duplicate digest generation                   |
| `geoipUpdateJob`           | Duplicate MaxMind downloads (minor)           |
| `ocrLearningJob`           | Duplicate rule writes (minor, idempotent-ish) |
| `auditTrashPurge`          | Safe (deletes are idempotent)                 |
| `handoffRedemptionCleanup` | Safe                                          |
| `dataExportTokenCleanup`   | Safe                                          |

**Files:** `artifacts/api-server/src/index.ts` — all jobs started here

**Migration action:** Phase 4a. Move jobs to a queue worker (pg-boss
recommended). API replicas do not run job timers; a single worker process
consumes the queue.

---

### 2.10 `post-merge.sh` — `drizzle-kit push`

**Coupling type:** Workflow assumption (safe only in single-dev environments)  
**Risk:** High if run against production — `push` directly mutates schema
without migration file history

**File:** `scripts/post-merge.sh`

```bash
# Current (Replit only)
pnpm install --frozen-lockfile
pnpm --filter db push       # <-- dangerous against a managed production DB
```

**Migration action:** Phase 4b. In CI/CD, replace with `drizzle-kit migrate`
which replays only the committed SQL files in `lib/db/drizzle/`.

---

### 2.11 Handoff signing key — derived from `REPL_ID`

**Coupling type:** Environment variable (Replit-injected as a stable identifier)  
**Risk:** Medium — if `REPL_ID` is absent or changes, existing handoff tokens
become invalid (anonymous-to-authenticated migrations fail)

**Files:**

- `artifacts/api-server/src/lib/anonClaimToken.ts`
- `artifacts/api-server/src/lib/handoffToken.ts`

**Migration action:** Add an explicit `APP_SECRET` env var. Update both files
to use `process.env.APP_SECRET ?? process.env.REPL_ID` during transition, then
remove the `REPL_ID` fallback once set.

---

## 3. Environment variable inventory

Variables are grouped by category. The **Status** column tells you what is
required for the application to boot (`BOOT`), required for a feature to work
(`FEATURE`), or only valid/meaningful on Replit (`REPLIT-ONLY`).

### 3.1 Core runtime (BOOT — must be set on every host)

| Variable         | Used in                                                       | Notes                                                                                         |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | `lib/db/src/index.ts`, `drizzle.config.ts`, migration scripts | Standard Postgres connection string                                                           |
| `PORT`           | `artifacts/api-server/src/index.ts`                           | API server listen port; throws on missing; set to `8080` in production artifact.toml          |
| `NODE_ENV`       | Throughout                                                    | Set to `production` in production builds; gates `devAuth.ts`                                  |
| `SESSION_SECRET` | Cookie signing                                                | Must be a strong random string; rotate with a graceful overlap                                |
| `ISSUER_URL`     | `artifacts/api-server/src/lib/auth.ts`                        | OIDC issuer base URL; defaults to `https://replit.com/oidc` — **must be replaced in Phase 1** |

### 3.2 Authentication (Phase 1 replacements)

| Variable             | Status                   | Notes                                                                                             |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `REPL_ID`            | REPLIT-ONLY (BOOT today) | Used as OIDC client ID and handoff signing key seed; replace with `OIDC_CLIENT_ID` + `APP_SECRET` |
| `OIDC_CLIENT_ID`     | FEATURE (Phase 1)        | New IdP application client ID; replaces `REPL_ID` in auth.ts                                      |
| `OIDC_CLIENT_SECRET` | FEATURE (Phase 1)        | New IdP application client secret                                                                 |
| `APP_SECRET`         | FEATURE (Phase 1)        | Random 32-byte secret for handoff token signing; replaces `REPL_ID` fallback                      |

### 3.3 AI services (Phase 3 replacements)

| Variable            | Status            | Notes                                                        |
| ------------------- | ----------------- | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | FEATURE (Phase 3) | Direct Anthropic API key; currently provided by Replit proxy |
| `OPENAI_API_KEY`    | FEATURE (Phase 3) | Direct OpenAI API key; currently provided by Replit proxy    |

### 3.4 Stripe payments

| Variable                        | Status             | Notes                                                                         |
| ------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `REPLIT_CONNECTORS_HOSTNAME`    | REPLIT-ONLY        | Stripe credential fetch host; replaced in Phase 2a                            |
| `REPL_IDENTITY`                 | REPLIT-ONLY        | Replit identity token for connector auth; replaced in Phase 2a                |
| `WEB_REPL_RENEWAL`              | REPLIT-ONLY        | Connector token renewal; replaced in Phase 2a                                 |
| `STRIPE_SECRET_KEY`             | FEATURE (Phase 2a) | Direct Stripe secret key; replaces connector credential fetch                 |
| `STRIPE_WEBHOOK_SECRET`         | FEATURE (Phase 2a) | Stripe-generated webhook signing secret; register endpoint manually           |
| `VITE_STRIPE_SIGNAL_AUDIT_LINK` | FEATURE            | Stripe Payment Link URL for $29 product; falls back to interest form if unset |
| `VITE_STRIPE_DATING_RESET_LINK` | FEATURE            | Stripe Payment Link URL for $97 product                                       |
| `VITE_STRIPE_WINGMAN_LINK`      | FEATURE            | Stripe Payment Link URL for $197/mo product                                   |

### 3.5 Object storage (Phase 2b replacements)

| Variable                           | Status             | Notes                                                                                 |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | REPLIT-ONLY        | Replit object storage bucket reference; replaced in Phase 2b                          |
| `PUBLIC_OBJECT_SEARCH_PATHS`       | FEATURE            | Comma-separated GCS path prefixes for public objects; format unchanged post-migration |
| `PRIVATE_OBJECT_DIR`               | FEATURE            | GCS path prefix for private objects; format unchanged post-migration                  |
| `GOOGLE_APPLICATION_CREDENTIALS`   | FEATURE (Phase 2b) | Path to GCS service account JSON key; or use `AWS_*` vars for S3/R2                   |

### 3.6 Google OAuth (Phase 2c replacement)

| Variable               | Status             | Notes                                               |
| ---------------------- | ------------------ | --------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | FEATURE (Phase 2c) | OAuth 2.0 client ID for Google Calendar integration |
| `GOOGLE_CLIENT_SECRET` | FEATURE (Phase 2c) | OAuth 2.0 client secret                             |

### 3.7 Email

| Variable         | Status  | Notes                                                                                      |
| ---------------- | ------- | ------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` | FEATURE | Direct Resend API key; when set, bypasses the Replit connector path; no code change needed |
| `SMTP_URL`       | FEATURE | Alternative: standard SMTP connection string; lower priority than `RESEND_API_KEY`         |

### 3.8 SMS (Twilio — no coupling, already direct)

| Variable             | Status  | Notes                              |
| -------------------- | ------- | ---------------------------------- |
| `TWILIO_ACCOUNT_SID` | FEATURE | Logs instead of sending when unset |
| `TWILIO_AUTH_TOKEN`  | FEATURE |                                    |
| `TWILIO_FROM_NUMBER` | FEATURE | E.164 format                       |

### 3.9 Observability and monitoring

| Variable                 | Status  | Notes                                    |
| ------------------------ | ------- | ---------------------------------------- |
| `SENTRY_DSN_API`         | FEATURE | Server-side Sentry DSN; no-op when unset |
| `VITE_SENTRY_DSN`        | FEATURE | Frontend Sentry DSN; no-op when unset    |
| `VITE_GA_MEASUREMENT_ID` | FEATURE | Google Analytics; no-op when unset       |

### 3.10 GeoIP

| Variable                                | Status  | Notes                                                                   |
| --------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `MAXMIND_LICENSE_KEY`                   | FEATURE | Monthly GeoLite2 refresh; no-op when unset (stale bundled data is used) |
| `GEOIP_KEY_MISSING_ALERT_DAYS`          | FEATURE | Days before founder is alerted about missing key (default 35)           |
| `GEOIP_ALERT_REBREACH_COOLDOWN_MINUTES` | FEATURE | Cooldown between alerts (default 15)                                    |

### 3.11 Matching automation and Echo

| Variable                         | Status  | Notes                                                  |
| -------------------------------- | ------- | ------------------------------------------------------ |
| `AUTO_PROPOSAL_ENABLED`          | FEATURE | Seeds founder-dashboard toggle; defaults ON when unset |
| `PROPOSAL_EXPIRY_ENABLED`        | FEATURE | Seeds toggle; defaults ON                              |
| `MATCHING_NUDGE_ENABLED`         | FEATURE | Seeds toggle; defaults ON                              |
| `COMPANION_NUDGE_ENABLED`        | FEATURE | Seeds toggle; defaults OFF                             |
| `AUTO_PROPOSAL_INTERVAL_HOURS`   | FEATURE | Tuning                                                 |
| `PROPOSAL_EXPIRY_INTERVAL_HOURS` | FEATURE | Tuning                                                 |
| `PROPOSAL_EXPIRY_MAX_AGE_DAYS`   | FEATURE | Tuning                                                 |
| `MATCHING_NUDGE_INTERVAL_HOURS`  | FEATURE | Tuning                                                 |
| `MATCHING_NUDGE_COOLDOWN_HOURS`  | FEATURE | Tuning                                                 |
| `COMPANION_NUDGE_INTERVAL_HOURS` | FEATURE | Tuning                                                 |
| `COMPANION_NUDGE_COOLDOWN_HOURS` | FEATURE | Tuning                                                 |
| `COMPANION_NUDGE_QUIET_DAYS`     | FEATURE | Days of week when nudges are suppressed                |

### 3.12 Reliability tuning

| Variable                                   | Status  | Notes                                                                |
| ------------------------------------------ | ------- | -------------------------------------------------------------------- |
| `AI_RELIABILITY_REBREACH_COOLDOWN_MINUTES` | FEATURE | Cooldown between AI reliability alerts                               |
| `AUDIT_TRASH_RETENTION_DAYS`               | FEATURE | Days before trashed audits are hard-deleted                          |
| `AUDIT_TRASH_PURGE_INTERVAL_HOURS`         | FEATURE | Purge job frequency                                                  |
| `ANON_CLAIM_HANDOFF_SECRET`                | FEATURE | Overrides `REPL_ID`-derived default signing key; set this in Phase 1 |
| `RECEIPTS_WEBHOOK_SECRET`                  | FEATURE | Inbound email webhook authentication                                 |

### 3.13 Admin

| Variable                         | Status  | Notes                                              |
| -------------------------------- | ------- | -------------------------------------------------- |
| `FOUNDER_KEY`                    | FEATURE | Static bearer token gating the `/founder/*` routes |
| `BENCHMARK_MIN_COHORT`           | FEATURE | Min cohort size before benchmarks become available |
| `MATCHING_REWEIGHT_MIN_OUTCOMES` | FEATURE | Minimum outcome count for re-weighting confidence  |

### 3.14 Replit-only variables (all become obsolete post-migration)

| Variable                     | Replaced by                                  |
| ---------------------------- | -------------------------------------------- |
| `REPL_ID`                    | `OIDC_CLIENT_ID` + `APP_SECRET`              |
| `REPLIT_DOMAINS`             | `ALLOWED_ORIGINS`                            |
| `REPLIT_EXPO_DEV_DOMAIN`     | Include dev domains in `ALLOWED_ORIGINS`     |
| `REPLIT_CONNECTORS_HOSTNAME` | Direct `STRIPE_SECRET_KEY`, `RESEND_API_KEY` |
| `REPL_IDENTITY`              | Direct `STRIPE_SECRET_KEY`                   |
| `WEB_REPL_RENEWAL`           | Direct `STRIPE_SECRET_KEY`                   |

---

## 4. Production readiness checklist

Each item is either REQUIRED (blocks go-live) or RECOMMENDED (should be done
before significant traffic). Items reference the phase in which they are
addressed.

### 4.1 Authentication and identity

- [ ] **REQUIRED** OIDC issuer replaced — `ISSUER_URL` no longer points to `https://replit.com/oidc` _(Phase 1)_
- [ ] **REQUIRED** `REPL_ID` removed as OIDC client ID — replaced with `OIDC_CLIENT_ID` _(Phase 1)_
- [ ] **REQUIRED** Existing user account-linking migration written and tested against a staging DB _(Phase 1)_
- [ ] **REQUIRED** Mobile `token-exchange` endpoint tested against new IdP _(Phase 1)_
- [ ] **REQUIRED** `devAuth.ts` removed from production build or double-gated with `ALLOW_DEV_AUTH=true` _(Phase 1)_
- [ ] **RECOMMENDED** Session rotation on privilege escalation (consent grant, tier change) _(Phase 4c)_
- [ ] **RECOMMENDED** Session TTL enforced at DB level (index on `sessions.expire`) _(Phase 4c)_

### 4.2 Sessions

- [ ] **REQUIRED** `SESSION_SECRET` set to a strong random value (not a placeholder) _(Phase 0 check)_
- [ ] **REQUIRED** `APP_SECRET` set for handoff token signing, replacing `REPL_ID` fallback _(Phase 1)_
- [ ] **RECOMMENDED** Session cleanup job confirmed running (not duplicating on multiple replicas) _(Phase 4a)_

### 4.3 Security headers

- [ ] **REQUIRED** `helmet()` added to `app.ts` middleware stack _(Phase 4c)_
- [ ] **REQUIRED** Content Security Policy configured (at minimum: `default-src 'self'`, exceptions for Stripe, Google Analytics, Sentry CDNs) _(Phase 4c)_
- [ ] **REQUIRED** `express.json` body limit scoped — `64kb` globally, `12mb` only on upload routes _(Phase 4c)_

### 4.4 Rate limiting

- [ ] **REQUIRED** Global rate limiter on all routes (e.g., 200 req/15 min per IP) _(Phase 4c)_
- [ ] **REQUIRED** Tighter rate limits on auth endpoints (`/api/auth/login`, `/api/auth/callback`) _(Phase 4c)_
- [ ] **REQUIRED** Existing handoff rate limit (`handoffRateLimit.ts`) verified still applies _(Phase 4c check)_
- [ ] **RECOMMENDED** Per-user rate limits on AI-consuming routes _(Phase 4c)_

### 4.5 Background jobs

- [ ] **REQUIRED** All 9 jobs confirmed safe for single-executor model (no duplicate sends on multi-replica) _(Phase 4a)_
- [ ] **REQUIRED** Job queue chosen and implemented (pg-boss or BullMQ) _(Phase 4a)_
- [ ] **REQUIRED** Worker process deployed separately from API replicas _(Phase 4a)_
- [ ] **RECOMMENDED** Job failure alerting wired to Sentry or PagerDuty _(Phase 4a)_

### 4.6 Database migrations

- [ ] **REQUIRED** `drizzle-kit push` removed from CI/CD pipeline _(Phase 4b)_
- [ ] **REQUIRED** `drizzle-kit migrate` (file-based) used for all production schema changes _(Phase 4b)_
- [ ] **REQUIRED** Migration dry-run tested against a production DB snapshot before first apply _(Phase 4b)_
- [ ] **REQUIRED** `post-merge.sh` updated for non-Replit environments _(Phase 5)_

### 4.7 Database backups

- [ ] **REQUIRED** Automated daily backups configured on managed Postgres provider _(Phase 5)_
- [ ] **REQUIRED** Restore procedure written and tested _(Phase 5)_
- [ ] **RECOMMENDED** Point-in-time recovery (PITR) enabled _(Phase 5)_
- [ ] **RECOMMENDED** 30-day backup retention minimum _(Phase 5)_

### 4.8 Object storage

- [ ] **REQUIRED** GCS sidecar replaced with direct SDK or S3-compatible client _(Phase 2b)_
- [ ] **REQUIRED** Private object ACL gate verified (`PRIVATE_OBJECT_DIR` path, auth + reveal gate) _(Phase 2b)_
- [ ] **REQUIRED** Public object signed URL expiry verified _(Phase 2b)_
- [ ] **RECOMMENDED** Object storage CORS policy set to production domains only _(Phase 2b)_

### 4.9 AI API keys

- [ ] **REQUIRED** `ANTHROPIC_API_KEY` set and confirmed reaching `api.anthropic.com` directly _(Phase 3)_
- [ ] **REQUIRED** `OPENAI_API_KEY` set and confirmed reaching `api.openai.com` directly _(Phase 3)_
- [ ] **REQUIRED** Daily cap system (`ai_usage_counters`) tested post-key-swap _(Phase 3)_
- [ ] **REQUIRED** Deterministic fallback confirmed still firing on consent-off accounts _(Phase 3)_
- [ ] **RECOMMENDED** AI call cost alerting set up (Anthropic + OpenAI usage dashboards) _(Phase 3)_

### 4.10 Stripe webhooks

- [ ] **REQUIRED** `stripe-replit-sync` removed _(Phase 2a)_
- [ ] **REQUIRED** Direct webhook handler implemented and signed with `STRIPE_WEBHOOK_SECRET` _(Phase 2a)_
- [ ] **REQUIRED** Webhook endpoint registered in Stripe dashboard at production domain _(Phase 2a)_
- [ ] **REQUIRED** End-to-end checkout flow tested in Stripe test mode against the new handler _(Phase 2a)_
- [ ] **REQUIRED** Tier upgrade (`purchase_interest` → user tier) verified after webhook fires _(Phase 2a)_

### 4.11 Google OAuth (Calendar)

- [ ] **REQUIRED** `@replit/connectors-sdk` removed from `googleCalendar.ts` _(Phase 2c)_
- [ ] **REQUIRED** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set _(Phase 2c)_
- [ ] **REQUIRED** OAuth redirect URI allowlist in Google Cloud Console updated to production domain _(Phase 2c)_
- [ ] **REQUIRED** Per-user token storage in DB tested (connect → disconnect → reconnect) _(Phase 2c)_

### 4.12 Observability

- [ ] **REQUIRED** `SENTRY_DSN_API` set and first error confirmed captured _(Phase 5)_
- [ ] **REQUIRED** `VITE_SENTRY_DSN` set and frontend error confirmed captured _(Phase 5)_
- [ ] **RECOMMENDED** Structured logging (pino) confirmed flowing to a log aggregator (Datadog, Logtail, etc.) _(Phase 5)_
- [ ] **RECOMMENDED** Uptime monitoring on `/api/healthz` _(Phase 5)_
- [ ] **RECOMMENDED** Alerting on P95 API latency > 2s _(Phase 5)_

### 4.13 Privacy and consent

- [ ] **REQUIRED** Both GDPR delete paths (user-initiated + admin) confirmed purging all first-party lanes _(Phase 0 check — review only)_
- [ ] **REQUIRED** `ai_content_consent` consent gate confirmed firing before any user content reaches Claude _(Phase 0 check — review only)_
- [ ] **REQUIRED** Data export (`/api/account/export`) confirmed complete and downloading _(Phase 0 check — review only)_
- [ ] **RECOMMENDED** Cookie banner / privacy notice reviewed for accuracy post-migration (Replit references may need removing) _(Phase 5)_

### 4.14 Founder / admin access

- [ ] **REQUIRED** `FOUNDER_KEY` set to a strong random value in production _(Phase 0 check)_
- [ ] **RECOMMENDED** Move from a static shared key to a proper admin role on the new IdP _(Phase 1)_

---

## 5. Human code review checklist

This checklist is for a senior engineer reviewing the codebase before or during
migration. Each area should be independently reviewed and signed off.

---

### 5.1 Auth / session review

**Reviewer goal:** Confirm the trust boundary is correct; no route that should
require auth can be reached unauthenticated; no session can be forged or
replayed.

- [ ] `authMiddleware.ts` — does it always reject on missing/expired session before calling `next()`? Is there a code path that calls `next()` with `req.user` undefined?
- [ ] `auth.ts` routes — is PKCE state compared correctly? Is the `state` cookie cleared after use?
- [ ] Anonymous claim flow — can a user claim another user's audits? Is the `anon_claim` cookie tamper-evident?
- [ ] Handoff token — is it single-use? Is the 15-minute expiry enforced?
- [ ] Session cleanup — are expired sessions pruned from the DB? Is the pruning job safe to run on multiple replicas?
- [ ] `devAuth.ts` — confirm it is unreachable in production. Check `NODE_ENV` check is correct and cannot be bypassed.

---

### 5.2 AI service review

**Reviewer goal:** Confirm the consent gate cannot be bypassed; daily caps are
atomic; voice pass cannot be bypassed.

- [ ] `aiService.ts` — does every public function check `requireContentConsent` before passing user content to a model?
- [ ] Daily cap — is the `ai_usage_counters` increment atomic (no TOCTOU race)?
- [ ] Voice pass — does the regeneration loop run at most once? Can a second off-voice response ship to the user?
- [ ] Timeout — is the 30,000ms provider call timeout enforced for both Anthropic and OpenAI paths?
- [ ] Fallback — if the live model call throws, is the deterministic fallback always returned (never a 500)?
- [ ] `analyzeProfilePhotos` (Claude vision) — is it consent-gated? Is the uploaded image read in the moment and never stored?

---

### 5.3 Stripe / payments review

**Reviewer goal:** Confirm the Stripe webhook cannot be spoofed; tier upgrades
cannot be self-granted; payment reconciliation is correct.

- [ ] Webhook signature verification — is `stripe.webhooks.constructEvent` (or equivalent) the first thing the webhook handler does? Is an unverified body ever processed?
- [ ] Tier upgrade — is tier granted only after a confirmed `checkout.session.completed` event, never from a client-side signal?
- [ ] `VITE_STRIPE_*_LINK` — are Payment Link URLs treated as public (they are just URLs)? Is there no server-side secret in them?
- [ ] Reconciliation — does `stripeReconcile.ts` only read, never write, payment records? Is it idempotent?
- [ ] `purchase_interest` — can a user mark their own record as paid?

---

### 5.4 Object storage review

**Reviewer goal:** Confirm private objects cannot be accessed by the wrong user;
signed URLs expire; uploads are validated.

- [ ] Private object gate — is `PRIVATE_OBJECT_DIR` always checked against the authenticated user's ID before serving?
- [ ] Reveal gate — does the two-layer ACL (auth + reveal status) hold for every private object route?
- [ ] Signed URL expiry — what is the TTL? Is it short enough (< 15 min) to prevent sharing?
- [ ] Upload validation — is file type and size validated server-side (not just client-side)?
- [ ] Public search paths — can a public search path ever be used to serve private content?

---

### 5.5 Matching and background jobs review

**Reviewer goal:** Confirm match proposals cannot be forged; blocking/safety
mechanisms hold; jobs are idempotent or queue-safe.

- [ ] `match_proposals` — can a user create their own proposal to another user directly via API?
- [ ] Block list — is a blocked user excluded from all match results, including the discover endpoint?
- [ ] Radius gate — is the radius check applied symmetrically (min of both users' radii)?
- [ ] Partial unique index — does the index on `(user_id, proposed_to_user_id)` prevent duplicate proposals?
- [ ] Background jobs — if a job fires twice concurrently (e.g., on multi-replica), what is the worst case? Are nudge sends idempotent?

---

### 5.6 Consent and privacy review

**Reviewer goal:** Confirm GDPR delete paths are complete; data export is
accurate; consent is not assumed.

- [ ] GDPR delete (user-initiated, `DELETE /api/account`) — does it wipe every first-party lane (`trust_ledger`, `behavioral_growth_events`, all signal tables)?
- [ ] GDPR delete (admin path) — does it wipe the same set? Do the two paths stay in sync?
- [ ] Boot guard test — does the boot guard in `index.ts` catch a new first-party lane that is missing from the purge handler?
- [ ] `ai_content_consent` — if a user revokes consent, are pending AI jobs for that user cancelled or does their content still reach Claude?
- [ ] Data export — does the export include every table that contains user-generated content?

---

### 5.7 Database schema review

**Reviewer goal:** Confirm schema is consistent; no missing foreign keys; no
unbounded JSONB columns storing regulated data unintentionally.

- [ ] All `user_id` foreign keys — do they have `ON DELETE CASCADE` or are orphaned rows handled by the purge job?
- [ ] `audits.report` (JSONB) — what is the maximum expected size? Is there a risk of unbounded growth per row?
- [ ] `companion_messages` — is there a row limit per user to prevent unbounded growth?
- [ ] `sessions` — is there an index on `expire` for efficient cleanup queries?
- [ ] `ai_metrics` — is this table pruned? What is the retention policy?
- [ ] `ocr_learned_rules` — does this table contain PII (derived from user screenshots)? Is it covered by the GDPR delete paths?

---

### 5.8 Founder / admin review

**Reviewer goal:** Confirm founder-only routes cannot be reached by regular users;
founder actions cannot corrupt production data.

- [ ] `FOUNDER_KEY` gate — is it checked on every `/founder/*` route, including sub-routes?
- [ ] Reweighting (`proposeWeightAdjustments`) — is it confirmed NOT wired into live scoring? Can a founder accidentally apply weight changes that affect all users immediately?
- [ ] OCR correction acceptance — does accepting a correction update `ocr_learned_rules` in an append-only way, or can it overwrite existing rules?
- [ ] Brain config mutations — are they validated (Zod schema) before persisting?

---

### 5.9 Mobile auth review

**Reviewer goal:** Confirm the mobile token-exchange endpoint is safe; the
Bearer token path does not allow cross-user access.

- [ ] `/api/mobile-auth/token-exchange` — is the OIDC code exchanged server-side and never trusted from the client?
- [ ] Bearer token (`Authorization: Bearer <sid>`) — is the `sid` validated against the `sessions` table on every request, same as the cookie path?
- [ ] Expo push tokens (`push_tokens` table) — can a user register a push token for another user's account?
- [ ] Mobile CORS (`REPLIT_EXPO_DEV_DOMAIN`) — after migration, is this replaced with an explicit `ALLOWED_ORIGINS` entry for production?

---

### 5.10 Deployment scripts review

**Reviewer goal:** Confirm no deploy script can corrupt production data or expose
secrets.

- [ ] `scripts/post-merge.sh` — confirm `drizzle-kit push` is not used against production; confirm `pnpm install --frozen-lockfile` is correct for CI _(replace in Phase 4b)_
- [ ] `artifacts/api-server/build.mjs` — is the esbuild externals list complete? Are there any native modules that will fail to load at runtime because they are not installed alongside the bundle?
- [ ] Vite `manualChunks` — confirm no vendor chunk isolation that caused the TDZ white-screen (documented in memory: cyclic vendors must stay in `vendor-misc`) _(verify before each publish)_
- [ ] Metro export (mobile) — is the Expo build step time-bounded? Does it fail loudly rather than silently overrun the build window?

---

## 6. Local development and Bitbucket handoff guide

This section is for a new engineer setting up the project outside of Replit.

### 6.1 Prerequisites

```
Node.js >= 24.x (matches .replit modules = ["nodejs-24"])
pnpm >= 9.x
PostgreSQL 16.x (local) or a remote DATABASE_URL
```

### 6.2 Clone and install

```bash
git clone <repo-url> matchlab
cd matchlab
pnpm install
```

### 6.3 Environment variables

Copy the template below into `.env` at the repo root and fill in values.
The API server reads environment variables from the process environment.
In development, use `dotenv` or `direnv` to load `.env` automatically.

```bash
# .env (development only — never commit this file)

# Required
DATABASE_URL=postgres://localhost:5432/matchlab_dev
PORT=8080
NODE_ENV=development

# Auth — use placeholder values in local dev until Phase 1 is complete
ISSUER_URL=https://replit.com/oidc         # replace in Phase 1
REPL_ID=local-dev-placeholder              # replace in Phase 1

# Admin
FOUNDER_KEY=local-dev-only-not-secret
SESSION_SECRET=change-me-to-a-random-string

# AI — optional in dev; deterministic fallback fires when keys are absent
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Stripe — optional in local dev; required for connected-beta billing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
API_PUBLIC_URL=http://localhost:8080
STRIPE_PRICE_INSIGHT_MONTHLY=
STRIPE_PRICE_INSIGHT_ANNUAL=
STRIPE_PRICE_MATCH_MONTHLY=
STRIPE_PRICE_MATCH_QUARTERLY=
# Keep unset until Guided capacity is approved
STRIPE_ENABLE_GUIDED=

# Object storage — optional in dev; upload routes will fail if unset
PUBLIC_OBJECT_SEARCH_PATHS=
PRIVATE_OBJECT_DIR=

# Email — optional; logs to console when unset
RESEND_API_KEY=

# SMS — optional; logs to console when unset
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

### 6.4 Database setup

```bash
# First time: push schema to the local database
pnpm --filter @workspace/db run push

# After schema changes: generate a migration file and commit it
pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts
git add lib/db/drizzle/
git commit -m "db: add migration for <change>"

# Apply committed migrations (use this in CI and production)
pnpm --filter @workspace/db exec drizzle-kit migrate --config ./drizzle.config.ts
```

### 6.5 Running the app locally

Open two terminals:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Web frontend
PORT=3000 pnpm --filter @workspace/nldc run dev
```

The web dev server proxies `/api/*` through to `http://localhost:8080` via
Vite's dev server (no proxy config is needed; the shared reverse proxy handles
this on Replit, and the `BASE_URL` in `customFetch` handles it locally).

### 6.6 Running tests

```bash
# Full typecheck (required before every PR)
pnpm run typecheck

# Linting
pnpm run lint

# API server tests (requires DATABASE_URL)
DATABASE_URL=$DATABASE_URL pnpm --filter @workspace/api-server run test

# Frontend unit tests
pnpm --filter @workspace/nldc run test

# Schema drift check
pnpm --filter @workspace/db run check-schema-drift

# Voice lint
pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts

# E2E (requires DATABASE_URL + running API server)
cd e2e && DATABASE_URL=$DATABASE_URL npx playwright test --project=chromium
```

### 6.7 Code generation

After changing the OpenAPI spec at `lib/api-spec/`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/src/generated/` and
`lib/api-zod/src/generated/`. Never hand-edit those directories.

### 6.8 Recommended Bitbucket branch and PR workflow

```
main          ← protected; CI must pass; requires one human review
staging       ← optional; mirrors production environment for final checks
feature/*     ← all development work; open PR against main
```

**PR checklist for reviewers:**

1. `pnpm run typecheck` passes locally.
2. `pnpm run lint` passes locally.
3. `pnpm --filter @workspace/api-server run test` passes.
4. New routes are covered in the OpenAPI spec and codegen has been re-run.
5. Any schema change has a committed migration file in `lib/db/drizzle/`.
6. No `REPL_*` or `REPLIT_*` env vars added (they will not exist off Replit).
7. No new uses of `stripe-replit-sync`, `@replit/connectors-sdk`, or the
   sidecar address `127.0.0.1:1106`.
8. Voice rules: no em dashes, no AI-tell words in user-facing copy. Run
   `pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts`.

### 6.9 Bitbucket Pipelines config

CI lives in `bitbucket-pipelines.yml` at the repo root (committed). It pins pnpm
via corepack, caches the pnpm store, provisions a `postgres:16` service for the
API tests, and runs typecheck, lint, API tests, schema-drift, and voice-lint in
parallel on every pull request and on pushes to `main`.

To enable it: in Bitbucket open Repository settings -> Pipelines -> Settings and
toggle Pipelines on. The committed config uses an ephemeral in-pipeline Postgres,
so no external `DATABASE_URL` secret is required for the default gate; add
repository variables only for any additional secrets a future step needs.

The Playwright end-to-end suite is defined as a manually triggered pipeline
(`custom: e2e`). Run it from Pipelines -> Run pipeline -> custom: e2e once its
Replit shared-proxy dependency at `localhost:80` is resolved (see the inline
comment in the file).

### 6.10 What to do if you are the first engineer off Replit

1. Read this file top to bottom.
2. Work through section 2 (Replit dependency inventory) and confirm you can
   locate each coupling point in the code.
3. Work through section 4 (production readiness checklist) and mark every
   REQUIRED item that is not yet done.
4. Do not start Phase 1 until you have a staging environment with a separate
   database and a separate domain.
5. Do Phase 1 (auth) before anything else. Auth is the hardest to roll back
   and the highest risk if done wrong.
6. After Phase 1, do Phase 2 sub-tasks in any order (they are independent).
7. Phase 3 (AI keys) can be done at any time; it is the lowest risk.
8. Do Phase 4 (background jobs + hardening) before opening to significant
   traffic.
9. Do Phase 5 (CI/CD and go-live) last.

---

_This document was generated in Phase 0 of the migration. It is a living
document — update it as each phase completes and as new coupling points are
discovered. The source of truth for CI commands is `CI.md`; the source of
truth for operational runbooks is `OPERATIONS.md`. This file covers migration
only._
