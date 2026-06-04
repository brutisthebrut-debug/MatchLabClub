---
name: Boot-time guards escape the api unit suite
description: Why a green api-test run can still ship a server that crashes on boot, and the trust-ledger purge-handler contract for new signal lanes.
---

Module-top-level guards that throw (e.g. the trust ledger's "every first-party
signal source must have a purge handler" check) only run when the **full server
boots via `index.ts`**. The api-server vitest suite imports individual routers
directly and never imports `index.ts`, so such a guard never executes in unit
tests. Result: a missing handler can pass the entire unit suite (hundreds of
tests green) yet crash the published server at start with a hard throw.

**Why:** A new first-party `SIGNAL_REGISTRY` lane was added without a matching
`FIRST_PARTY_SOURCES` entry in `routes/trustLedger.ts`. Unit tests stayed green;
the built `pnpm run build && pnpm run start` (and the e2e webserver) crashed on
boot. The fix added the handlers AND a `trustLedger.test.ts` whose first
assertion `await import("./trustLedger")` runs the guard inside the suite.

**How to apply:**
- Every new `dataSource.kind === "firstParty"` lane needs a `FIRST_PARTY_SOURCES`
  handler pairing `countStored` with `purge`; both must target exactly the same
  rows (userId only, no readiness narrowing) so `held`/`purgeable` can't drift
  from what a delete removes. This is also the privacy contract (one toggle
  purges the source).
- Derived meta-lanes with no table of their own (e.g. `consistency`, recomputed
  from other sources via `activityDays.ts`) use a no-op handler: `countStored`
  returns 0, `purge` returns 0. Honest `held:false`, nothing to delete.
- After adding any module with a boot-time guard, verify via an actual server
  restart or an `await import(...)` assertion in a test, not just unit tests.
- testDb gotcha: its `DeleteChain` historically had no `.returning()`, and only a
  subset of tables are registered. Adding a route that purges a new table needs
  the table registered in `testDb.ts` (and `.returning()` support) before a
  DB-backed purge test will run.
