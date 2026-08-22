# MatchLab Club

Relationship decision companion with controlled introductions. MatchLab gets to
know a member, helps them understand themselves and what they want, introduces
one considered person when the pilot can do so honestly, and learns with them
afterward. The AI is hybrid: a deterministic engine runs on every account by
default, with Anthropic Claude layered on top, opt-in per account.

## Start here

New to the codebase? Read in this order:

1. `PRODUCTION_STATUS.md`: approved v1 contract, repository reality, and gates.
2. `ARCHITECTURE.md`: guided map of the monorepo and how a request flows.
3. `MIGRATION.md`: the plan to move off Replit to production.
4. `replit.md`: conventions, gotchas, and product overview.

More detail: `PROJECT_SPECIFICATION.md` and `VISION.md` (product), `OPERATIONS.md`
(runbooks), `CI.md` (the CI gate).

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

Runs on Bitbucket Pipelines (`bitbucket-pipelines.yml`): typecheck, lint, API
tests, schema-drift, and voice-lint on every pull request and on pushes to
`main`. See `CI.md` and `MIGRATION.md` section 6.9.
