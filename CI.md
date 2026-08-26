# CI Gate

GitHub Actions is the repository CI gate. The workflow at
`.github/workflows/phase0.yml` runs on every pull request and push to `main`.

| Job | Commands | Database | Blocking release evidence |
|---|---|---|---|
| `static-verification` | typecheck, lint, release-environment contract tests, schema drift, voice lint, web tests | no | yes |
| `database-verification` | ordered migrations plus the full API test suite | ephemeral Postgres 16 | yes |
| `canonical-member-walkthrough` | seeded development sign-in plus desktop and phone Playwright walkthroughs | ephemeral Postgres 16 | yes |

All three jobs install with the pinned `pnpm@10.26.1` and
`pnpm install --frozen-lockfile`. The database job creates a clean
`matchlab_test` database, applies the committed Drizzle migrations in order with `migrate`, and
then runs the API suite with `DATABASE_URL` set.

Do not describe Phase 0 as release-verified until all three jobs pass for the
exact commit being considered. Stripe test-mode operations remain a separate manual
release gate because they require configured Stripe test credentials and
dashboard webhook registration.

## Running locally

```sh
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run test:release-env
pnpm --filter @workspace/db run check-schema-drift
pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts
pnpm --filter @workspace/nldc run test
```

For database-backed verification:

```sh
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/matchlab_test"
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run test
```

For the authenticated canonical browser walkthrough, keep the same
`DATABASE_URL` available:

```sh
pnpm --filter @workspace/e2e exec playwright install chromium
pnpm --filter @workspace/e2e run test:canonical
```

## Legacy pipeline

`bitbucket-pipelines.yml` remains as a parity reference for the earlier
off-Replit migration path. GitHub Actions is authoritative while the canonical
repository is `brutisthebrut-debug/MatchLabClub`.
