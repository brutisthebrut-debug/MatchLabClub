---
name: nldc web vitest conventions
description: How to write passing tests in artifacts/nldc — globals off, no jest-dom, manual cleanup.
---

The `artifacts/nldc` vitest setup is deliberately minimal: `globals: false`, jsdom env, NO `setupFiles`, NO `@testing-library/jest-dom`.

**Rules for any new test there:**
- Explicitly import `{ describe, it, expect, beforeEach, afterEach, vi }` from `"vitest"` — no globals are injected.
- Import `{ cleanup }` from `"@testing-library/react"` and call it in `afterEach`. There is NO auto-cleanup, so renders accumulate across tests and `getByTestId` then throws "multiple elements found".
- Assert presence with `expect(queryByTestId(...)).not.toBeNull()` / `.toBeNull()`. Do NOT use `toBeInTheDocument` — jest-dom is absent, so it fails typecheck (TS2339) and is undefined at runtime.

**Why:** writing `toBeInTheDocument` typechecks-fails and the missing `cleanup()` causes cross-test DOM bleed; both cost real iterations to diagnose.

**How to apply:** mirror an existing suite (e.g. `aiToolWelcomePanels.test.tsx`) when starting a new nldc test rather than copying a jest-dom-style template.
