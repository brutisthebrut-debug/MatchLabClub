# CI Gate

This project uses Replit's validation system as its blocking CI gate. Both checks
below must pass before changes can be merged.

| Validation name | Command                                | Blocking |
|-----------------|----------------------------------------|----------|
| `typecheck`     | `pnpm run typecheck`                   | yes      |
| `api-tests`     | `pnpm --filter @workspace/api-server run test` | yes      |

A red `typecheck` blocks merges the same way a red `api-tests` run does.

## Running locally

```
pnpm run typecheck
pnpm --filter @workspace/api-server run test
```

`pnpm run typecheck` is the canonical full check: it first builds the composite
lib project references (`tsc --build`) and then runs the per-package
`typecheck` script across every artifact and `scripts`. See `package.json` at
the repo root for the exact wiring.

## Lint

Lint is intentionally **not** part of the gate. No package in the monorepo
defines a `lint` script and there is no ESLint config checked in. If a lint
setup is introduced later, add it here and register a `lint` validation
alongside `typecheck` and `api-tests`.

## How the validations are registered

The two validations above are registered with the Replit validation system
(see `.local/skills/validation/SKILL.md`). They are upserted by name:

- `typecheck` -> `pnpm run typecheck`
- `api-tests` -> `pnpm --filter @workspace/api-server run test`

This file is the source-of-truth documentation for the gate. If the registered
commands ever drift from what's listed here, update both.
