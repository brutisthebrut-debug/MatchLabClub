---
name: Routes that call computeReadiness need a real-DB test harness
description: Why mocked-drizzle route tests cannot drive computeReadiness, and how to test such routes
---

Any API route that calls `computeReadiness` (e.g. cosmic weather, matching) pulls in the
WHOLE readiness graph: `collectSignalCounts` plus every `SIGNAL_REGISTRY` lane's tables and
aggregate operators (count/sum/gt/lte/between/groupBy, not just eq/and/or).

**Rule:** test the happy path of such a route against a REAL database (mirror
`matching.discover.test.ts`: import real `db`/`pool` from `@workspace/db`, seed + cleanup,
`pool.end()` in afterAll). A mocked-drizzle harness that only stubs a subset of operators
will 500 inside `computeReadiness` — that is a harness gap, NOT a product bug. Keep the
mocked harness only for cheap edges that never reach readiness (401 / 404 / validation).

**Why:** the cosmic weather happy-path test 500'd purely because `cosmic.test.ts`'s drizzle
mock lacked operators the readiness graph uses. Splitting it into `cosmic.weather.test.ts`
(real DB) fixed it without touching product code.

**Also:** adding any new readiness lane breaks the hardcoded fixtures in
`signalRegistry.test.ts` (raw-weight `total`) and `readiness.test.ts` (`computeBreakdown`
expects EVERY lane key). When adding a lane, bump the registry raw-weight total and add the
new lane key (0 in the empty-user case, full in the clamp-at-100 case) to both breakdown
fixtures, or the suite fails.
