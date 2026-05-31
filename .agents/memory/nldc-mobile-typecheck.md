---
name: vitest broken/missing in nldc + nldc-mobile after merge
description: Triage + fix for "Cannot find module vitest" typecheck/test failures in the web and mobile artifacts
---

# vitest fails in nldc / nldc-mobile

Two distinct failure shapes, different responses:

## 1. Whole vitest package missing after a task merge / reconciliation
Symptom: `test-claim-client`, `test-mobile`, `test-mobile-auth`, and `typecheck` all go red at once with
`Cannot find module '.../artifacts/nldc/node_modules/vitest/vitest.mjs'` (or `vitest`/`vitest/config`).
Root cause: the post-merge reconciliation can leave a partial install where the `vitest` **package directory is gone** but the `.bin/vitest` symlink and the `package.json` devDependency still exist.

**Fix:** run `pnpm install` at the repo root. It restores the missing package from the lockfile (lockfile is already up to date, so it just re-links). After that, restart the affected `test-*` and `typecheck` workflows so their stale red status refreshes to green.

**How to apply:** before assuming this is a skip-able quirk, check `ls artifacts/nldc/node_modules/vitest/`. If the dir is missing, it is a real broken install, not a quirk. `pnpm install` fixes it.

## 2. tsc type-resolution quirk (vitest present, but tsc still complains)
Symptom: only `src/integration/*.test.tsx` ("Cannot find module 'vitest'") or `nldc-mobile/vitest.config.ts` ("Cannot find module 'vitest/config'") error under `tsc`, while the `test-*` workflows pass.
This is a tsc-only quirk in test/config files, not real breakage. `pnpm -r` aborts on the first package failure, so a root typecheck may stop at nldc-mobile before nldc reports.

**How to apply:** if vitest IS installed (case 1 ruled out) and you did not touch the test/config files, this is not your regression. Verify your changed source with `pnpm --filter @workspace/<pkg> run typecheck` and grep for YOUR files; safe to use as a `skip_validation_reason` for typecheck when only these test-file errors remain.
