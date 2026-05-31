---
name: vitest types fail under tsc (nldc + nldc-mobile)
description: Triage rule for pre-existing "Cannot find module 'vitest'" typecheck failures that do not reflect real breakage
---

# vitest types fail under tsc (pre-existing)

`pnpm run typecheck` / per-package `tsc --noEmit` can fail in both `artifacts/nldc` and `artifacts/nldc-mobile`:
- `nldc`: `src/integration/*.test.tsx` → "Cannot find module 'vitest'".
- `nldc-mobile`: `vitest.config.ts` → "Cannot find module 'vitest/config'".

vitest IS installed and the `test-*` workflows (which actually run vitest) pass. This is a tsc type-resolution quirk in test/config files, not a real breakage. `pnpm -r` aborts on the first package failure, so a root typecheck may stop at nldc-mobile before nldc even reports.

**How to apply:** if you did not touch the test/config files, this is not your regression. Verify your changed source with `pnpm --filter @workspace/<pkg> run typecheck` and grep the output for YOUR files; trust the `test-*` workflows as the real signal. Safe to use as a `skip_validation_reason` for the typecheck validation when only these pre-existing test-file errors remain.
