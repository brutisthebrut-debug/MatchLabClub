# MatchLab Club

AI companion that sits alongside dating apps (Tinder, Hinge, Bumble). The north
star is readiness first, matching as the payoff: help someone become genuinely
relationship-ready, then match them (AI-driven, radius-based) with people they
would not find on their own. The AI is hybrid: a deterministic engine runs on
every account by default, with Anthropic Claude layered on top, opt-in per
account.

## Start here

New to the codebase? Read in this order:

1. `ARCHITECTURE.md`: guided map of the monorepo and how a request flows.
2. `MIGRATION.md`: the plan to move off Replit to production.
3. `replit.md`: conventions, gotchas, and product overview.

More detail: `PROJECT_SPECIFICATION.md` and `VISION.md` (product), `OPERATIONS.md`
(runbooks), `CI.md` (the CI gate).

## Quick start

```bash
pnpm install
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=21668 pnpm --filter @workspace/nldc run dev
```

Required env: `DATABASE_URL` (Postgres). See `MIGRATION.md` section 3 for the full
env inventory. The Vite dev server proxies `/api` to
`http://127.0.0.1:8080` by default.

## Tech stack

pnpm workspaces, Node.js 24, TypeScript 5.9. React + Vite (web), Express 5 (API),
PostgreSQL + Drizzle ORM, Expo (mobile). Contract-first API with OpenAPI and
Orval codegen.

## Layout

- `artifacts/`: deployable apps (`nldc` web, `api-server`, `nldc-mobile`).
- `lib/`: shared libraries (API spec, generated clients, db schema, and more).
- `e2e/`: Playwright tests. `scripts/`: shared utilities.

## CI

Runs in GitHub Actions (`.github/workflows/ci.yml`): typecheck, lint, API and
web tests, schema drift, Echo voice checks, the production web build, and the
Playwright browser journey. See `CI.md` and `MIGRATION.md` section 6.9.
