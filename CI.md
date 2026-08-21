# CI Gate

This project uses GitHub Actions as its repository CI gate. The workflow at
`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual
dispatches. All checks below must pass before changes can be merged.

| Validation name | Command                                                                   | Blocking |
| --------------- | ------------------------------------------------------------------------- | -------- |
| `typecheck`     | `pnpm run typecheck`                                                      | yes      |
| `api-tests`     | `pnpm --filter @workspace/api-server run test`                            | yes      |
| `lint`          | `pnpm run lint`                                                           | yes      |
| `schema-drift`  | `pnpm --filter @workspace/db run check-schema-drift`                      | yes      |
| `voice-lint`    | `pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts` | yes      |
| `web-tests`     | `pnpm --filter @workspace/nldc run test`                                  | yes      |
| `web-build`     | `pnpm --filter @workspace/nldc run build`                                 | yes      |
| artifact upload | `actions/upload-artifact`                                                   | no       |

Any red validation blocks merges.

## GitHub Actions

The GitHub workflow groups the gate into two jobs:

- `Typecheck, lint, schema, voice, and web` installs once and runs the canonical
  full typecheck, root lint, schema drift, voice lint, and nldc web tests.
- `API tests` uses an ephemeral Postgres 16 service, pushes the current schema,
  and runs the API suite.

The production web build is blocking. Uploading that build as a downloadable
review artifact is best-effort because GitHub can reject uploads when the
account-level Actions storage quota is full; an upload failure does not weaken
or bypass typecheck, tests, lint, schema, voice, or build validation.

The Playwright e2e suite remains manual until its Replit-only reverse-proxy
assumption is removed. See `MIGRATION.md` section 6.9.

## Bitbucket Pipelines mirror

`bitbucket-pipelines.yml` mirrors the same command set for compatibility with the
older hosting plan. If the command set changes, update this file, the GitHub
workflow, and the Bitbucket mirror together.

## Running locally

```
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm run lint
pnpm --filter @workspace/db run check-schema-drift
pnpm --filter @workspace/nldc exec vitest run src/lib/voiceLint.test.ts
pnpm --filter @workspace/nldc run test
```

`pnpm run typecheck` is the canonical full check: it first builds the composite
lib project references (`tsc --build`) and then runs the per-package
`typecheck` script across every artifact and `scripts`. See `package.json` at
the repo root for the exact wiring.

## Lint

The root `lint` script runs `eslint .` against the whole monorepo using the
flat config at `eslint.config.mjs`. The config wires up:

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` (so React `rules-of-hooks` is enforced and
  inline `// eslint-disable-next-line react-hooks/exhaustive-deps` directives
  resolve correctly)

Generated code (`lib/api-zod/src/generated/**`, `lib/api-client-react/src/generated/**`),
build output (`dist/**`, `build/**`, `.expo/**`), and `.local/` are ignored.
Several noisy rules are intentionally disabled (`@typescript-eslint/no-explicit-any`,
`@typescript-eslint/no-unused-vars`, `prefer-const`, etc.) so the gate enforces
real correctness signals (parse errors, React hook misuse, `no-var`,
`no-debugger`) without forcing a codebase-wide cleanup. To make the gate
stricter over time, flip rules on in `eslint.config.mjs` and clean up the
fallout in the same task.

## Legacy Replit registrations

The three original validations may still be registered with the Replit
validation system (see `.local/skills/validation/SKILL.md`):

- `typecheck` -> `pnpm run typecheck`
- `api-tests` -> `pnpm --filter @workspace/api-server run test`
- `lint` -> `pnpm run lint`

They are no longer the repository gate. This file and `.github/workflows/ci.yml`
are the source of truth.
