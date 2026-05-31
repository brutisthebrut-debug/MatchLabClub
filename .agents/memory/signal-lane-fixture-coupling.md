---
name: Adding a weighted signal lane breaks exact-weight fixtures
description: Where to update tests/fixtures when you add a contributor to SIGNAL_REGISTRY with a non-zero weight
---

Adding a new contributor to `SIGNAL_REGISTRY` with a non-zero weight re-normalizes
every existing lane's weight (weights divide by the new raw-weight total), so a
few tests with hardcoded expectations break and MUST be updated in lockstep:

- `signalRegistry.test.ts` "reflects the current registry weights" — bump the
  hardcoded `total` (raw-weight sum) and add a `toBeCloseTo(rawWeight / total)`
  line for the new lane.
- `readiness.test.ts` `computeBreakdown` "all zeros" and "clamps each signal"
  expected objects — add the new breakdown id (e.g. `taste: 0` / `taste: 100`),
  and in the clamp test add the new countKey to the INPUT (e.g.
  `tasteItems: 50`) so it actually clamps.

**Why:** day-one scores intentionally drift down a hair when a lane is added
(re-normalization), and the registry test pins the exact proportions on purpose.
The drift is accepted design, not a regression.

**How to apply:** `computeBreakdown` defaults a missing countKey to 0
(`counts[contributor.countKey] ?? 0`) so a partial counts object never yields
NaN; rely on that instead of having to pass every key. The real matching.ts path
populates import-backed counts generically from each contributor's
`dataSource` descriptor (importRows = grouped count by source; importSummaryCount
= latest non-deleted row's `parsedSummary` number), so a new paste/import
connector is a registry entry + a capture route, never new counting logic.
