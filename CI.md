# CI Gate

This project uses Replit's validation system as its blocking CI gate. All checks
below must pass before changes can be merged.

| Validation name | Command                                | Blocking |
|-----------------|----------------------------------------|----------|
| `typecheck`     | `pnpm run typecheck`                   | yes      |
| `api-tests`     | `pnpm --filter @workspace/api-server run test` | yes      |
| `lint`          | `pnpm run lint`                        | yes      |

A red `typecheck`, `api-tests`, or `lint` blocks merges.

## Running locally

```
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm run lint
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

## How the validations are registered

The three validations above are registered with the Replit validation system
(see `.local/skills/validation/SKILL.md`). They are upserted by name:

- `typecheck` -> `pnpm run typecheck`
- `api-tests` -> `pnpm --filter @workspace/api-server run test`
- `lint` -> `pnpm run lint`

This file is the source-of-truth documentation for the gate. If the registered
commands ever drift from what's listed here, update both.
