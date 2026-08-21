# MatchLab Club

AI companion that sits alongside dating apps (Tinder, Hinge, Bumble). Echo helps
someone understand their patterns, name what they really want, and wait honestly.
When a real nearby fit exists, MatchLab can support one considered introduction;
profile completion never earns or guarantees another person. The AI is hybrid: a
deterministic engine runs on every account by default, with Anthropic Claude
layered on top, opt-in per account.

## Start here

New to the codebase? Read in this order:

1. `ROADMAP.md`: the current approved milestone, delivery batches, and drift guards.
2. `ARCHITECTURE.md`: guided map of the monorepo and how a request flows.
3. `MIGRATION.md`: the plan to move off Replit to production.
4. `replit.md`: conventions, gotchas, and product overview.

More detail: `PROJECT_SPECIFICATION.md` and `VISION.md` (product), `OPERATIONS.md`
(runbooks), `CI.md` (the CI gate).

## Current product shell

The approved signed-in v1 has five primary destinations: **Today, Matches, My
MatchLab, Journey, and Play**. Echo remains present across the signed-in
experience. Existing tools and routes are preserved behind contextual hubs and
secondary navigation, so consolidation must not delete or orphan working
capability.

Profile evidence, search activity, and market availability are separate states.
A member becoming profile-ready must never be presented as proof that an
introduction is available. Member-facing primary surfaces use qualitative
evidence states rather than a numeric score that could imply human worth or
entitlement.

The Matches destination presents waiting, proposal, mutual reveal, date, and
debrief as one lifecycle. Signed-out review uses a labeled process preview only;
fake people, messages, and implied availability do not stand in for member data.

My MatchLab brings the member's profile model, source coverage, permissions, and
readiness evidence into one decision view. The detailed profile workspace stays
available at `/me/details`; consolidation does not delete it.

Journey is a server-backed history of saved insights, reflections, compatibility
reads, introductions, dates, and wins. The older client-local timeline remains a
secondary experimental tool and never stands in for real member history.

Play is a bounded activity catalog rather than an endless feed. Every activity
states its duration, what it teaches Echo, and the result it saves; existing game
and quiz routes remain intact behind the catalog.

The public landing page and signed-in shell now tell the same journey. Public
copy does not promise that readiness creates availability, and the final public
CTA hands into Today with Echo. Echo's baseline voice states uncertainty and can
challenge a member without cruelty or false intimacy.

The current branch is also closing the connected-beta gap. Today prioritizes
real proposals and unread mutual conversations, Echo uses the approved visual
system without numeric readiness rewards, and the API accepts an explicit beta
web origin through `APP_ORIGINS`. The static review artifact remains useful for
visual acceptance, but authenticated beta acceptance requires the web, API,
session, and database to run together.

## Commercial plans

The backend commercial contract is **Member → Insight → Match → Guided**. These
are packages tied to outcomes, not numbered progress levels:

- Member: free; profile building, limited Echo/Play, first Mirror preview, basic
  Journey, and candidate-pool opt-in.
- Insight: $14.99/month or $99/year; full Mirror, deeper Echo/Journey, expanded
  Play, and selected low-cost/manual sources.
- Match: $49/month or $129/quarter; active search, limited introductions,
  compatibility explanations, prep, safety, debrief, and refinement.
- Guided: $249–$499/month; capped human coaching, scheduled review, and bounded
  asynchronous support.

`GET /api/plans` is the catalog source of truth. Historical `free`, `reset`, and
`wingman` assignments are resolved through a compatibility map; new controlled-
beta grants use canonical plan keys. Candidate-pool opt-in and active search are
separate: Member may opt into the pool, while initiating discovery requires
Match or Guided. None of the plans creates priority or entitlement to a person.

Stripe is now the entitlement source of truth for non-beta paid accounts. Signed
subscription, invoice, refund, credit, pause, and cancellation events trigger a
fresh read of the customer's current subscriptions, so duplicate or out-of-order
webhooks converge on one result. Authenticated Insight/Match Checkout Sessions,
billing status, and Billing Portal sessions are implemented server-side. Founder
beta grants remain explicit overrides, duplicate live subscriptions are blocked,
and Guided billing stays disabled until human capacity is defined. The approved
pricing, checkout return, and My MatchLab billing controls now use the same typed
contract. One connected test-mode runtime journey remains an open evidence gate.

A hosted beta opts into the strict startup contract with `CONNECTED_BETA=true`.
The API then refuses to boot if it would use Replit OIDC fallback, insecure or
inconsistent origins, development auth, a non-test Stripe key, missing canonical
Price IDs, or an unsigned anonymous handoff. This validates configuration only;
the real signup, checkout, cancellation, and recovery journey remains an open
acceptance gate.

## Beta-readiness boundary

The current branch is code-healthy and approaching a **controlled beta**. It is
not yet evidence of a full-feature beta. Green CI proves the typed contracts and
repository tests; it does not prove that every selected capability persists,
appears in the member's record, affects Echo or matching as intended, and works
through a deployed browser journey.

Quiz integration illustrates the distinction. The canonical Quiz Lab stores a
derived archetype and informed dimensions on the server, deduplicates retakes,
survives anonymous account claim, records Journey activity, and contributes to
the Mirror/matching signal registry. Care Dialect is server-scored. Batch 8A now
uses those server rows as the visible result history, labels browser storage as a
degraded fallback, redirects the old browser-only `/quiz` into Quiz Lab, and
shows whether the profile write actually succeeded. Granular wellness mappings
remain an explicit member choice. Full beta still requires connected
signup-to-quiz-to-profile acceptance against the hosted runtime.

Play now follows the same record rule. The bounded catalog remains Daily Spark,
This or That, Scenario Reels, Would You Rather, Quiz Lab, and Time Capsule; no
legacy directory was restored. Their durable server records now appear in
Journey, direct saves update Journey summary truth, and Daily Spark plus the
preserved Flags/Care Dialect sources count toward consistency days. Batch 8B is
code-complete and green, but hosted claim/cross-device proof and Play-table
privacy export/deletion parity remain open beta gates.

Batch 9A now closes account-deletion parity for selected Play data. Both
deletion endpoints use one purge registry, and a Postgres regression proves the
direct activity rows, Care Dialect, Journey instrumentation, Quiz Lab, and This
or That records are removed with the account. This does not close the whole
privacy gate: downloadable export, retention, and consent-revocation parity
still require a complete first-party table registry and drift protection.

An unrestricted full beta also requires Batch 9 production hardening. Scheduled
jobs currently start inside each API process, production schema application still
uses `drizzle-kit push`, and the required security-header/rate-limit, tested
backup/restore, privacy export/deletion, and staffed safety-operation gates remain
open. Until those are closed, any live cohort must be founder-controlled and the
API topology explicitly constrained to one job-running instance.

## Legacy capability guardrail

The original route surface remains an inventory, not a second product. Matching
and Future Connections belong under Matches; profile, wellness, photos, voice,
and verification belong under My MatchLab; history and learning belong under
Journey; quizzes and games belong under Play. Working capability must be
integrated into a better member job, preserved contextually, or explicitly
parked. This is not route parity: the old tool drawer must not be recreated in
new cards. The old Signal Audit, Dating Reset, and Wingman checkout copy is
retired and cannot assign canonical beta access.

## Quick start

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API on port 8080
pnpm --filter @workspace/nldc run dev         # web on $PORT
# Add ALLOW_DEV_AUTH=true only when the seeded development login is needed.
```

Required env: `DATABASE_URL` (Postgres). Set `APP_ORIGINS` to the comma-separated
web origins allowed to make credentialed API requests, for example
`https://beta.matchlab.club,http://localhost:3000`. A portable connected runtime
also sets `OIDC_CLIENT_ID`, `ISSUER_URL`, `API_PUBLIC_URL`, and `WEB_PUBLIC_URL`.
Connected-beta billing requires `CONNECTED_BETA=true`, production mode,
`ANON_CLAIM_HANDOFF_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
the four Insight/Match Stripe Price IDs documented in `OPERATIONS.md`.

## Tech stack

pnpm workspaces, Node.js 24, TypeScript 5.9. React + Vite (web), Express 5 (API),
PostgreSQL + Drizzle ORM, Expo (mobile). Contract-first API with OpenAPI and
Orval codegen.

## Layout

- `artifacts/`: deployable apps (`nldc` web, `api-server`, `nldc-mobile`).
- `lib/`: shared libraries (API spec, generated clients, db schema, and more).
- `e2e/`: Playwright tests. `scripts/`: shared utilities.

## CI

GitHub Actions (`.github/workflows/ci.yml`) is the repository gate. It runs
typecheck, lint, API tests, schema drift, voice lint, web tests, and produces a
reviewable web artifact for each pull request. `bitbucket-pipelines.yml` remains
a compatibility mirror. See `CI.md` and `MIGRATION.md` section 6.9.
