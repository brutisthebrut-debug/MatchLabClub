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

## Quick start

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API on port 8080
pnpm --filter @workspace/nldc run dev         # web on $PORT
```

Required env: `DATABASE_URL` (Postgres). See `MIGRATION.md` section 3 for the full
env inventory.

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
