# CI Gate

GitHub Actions is the blocking CI gate. The workflow at
`.github/workflows/ci.yml` runs on pull requests to `main`, pushes to `main`,
and manual dispatches.

| Gate            | Command                                                                   | Blocking |
| --------------- | ------------------------------------------------------------------------- | -------- |
| Typecheck       | `pnpm run typecheck`                                                      | yes      |
| Lint            | `pnpm run lint`                                                           | yes      |
| API tests       | `pnpm --filter @workspace/api-server run test`                            | yes      |
| Web tests       | `pnpm --filter @workspace/nldc run test`                                  | yes      |
| Schema drift    | `pnpm --filter @workspace/db run check-schema-drift`                      | yes      |
| Echo voice      | `pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts` | yes      |
| Web build       | `pnpm --filter @workspace/nldc run build`                                 | yes      |
| Browser journey | `pnpm -C e2e exec playwright test --project=chromium`                     | yes      |

The API and browser jobs provision disposable PostgreSQL 16 databases. No
external database secret is needed for the default gate. Browser tests start
the API and web apps themselves and use the Vite `/api` proxy, so they do not
depend on Replit's shared proxy.

If the command set changes, update this file and `.github/workflows/ci.yml`
together.

## Running locally

```bash
pnpm run typecheck
pnpm run lint
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/nldc run test
pnpm --filter @workspace/db run check-schema-drift
pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts
pnpm --filter @workspace/nldc run build
```

`pnpm run typecheck` is the canonical full check: it first builds the composite
library project references (`tsc --build`) and then runs the per-package
`typecheck` script across every artifact and `scripts`.

The API and browser suites require a PostgreSQL database. The GitHub workflow
creates one automatically; local runs should set `DATABASE_URL` and apply the
schema first:

```bash
pnpm --filter @workspace/db run push-force
pnpm -C e2e exec playwright install chromium
pnpm -C e2e exec playwright test --project=chromium
```

## Lint

The root `lint` script runs `eslint .` against the whole monorepo using the flat
config at `eslint.config.mjs`. Generated code, build output, and `.local/` are
ignored. The gate is intentionally focused on real correctness signals such as
parse errors, React hook misuse, `no-var`, and `no-debugger`.

## Branch protection

Protect `main` with the three GitHub jobs: `quality`, `api`, and `e2e`. Direct
pushes and force-pushes to `main` should remain disabled.
