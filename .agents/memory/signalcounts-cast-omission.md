---
name: collectSignalCounts cast hides omitted keys
description: why a computed count can silently fail to lift its readiness lane
---

In `collectSignalCounts` (api-server), the returned object is built as an object
literal and `as SignalCounts` cast. The cast does NOT verify every registry
countKey is present, so a count can be computed locally yet never added to the
returned object. The lane then reads `counts[countKey] ?? 0` in `computeBreakdown`
and stays flat at 0 forever, even when the underlying data exists.

**Why:** this exact failure shipped once (a verification count was computed but
omitted from the returned literal, masked by the cast), so the lane never lifted
readiness.

**How to apply:** when adding a new signal contributor, add its computed value to
the returned counts literal in `collectSignalCounts`, not just compute it. Prefer
narrowing/removing the broad `as SignalCounts` cast over trusting it.

`collectSignalCounts` is NOT unit-testable under the fake testDb: it calls
`.groupBy()` (import-backed counts) which the fake query builder does not implement,
so the call throws before returning. Lane math is covered instead by the
`computeBreakdown` unit test feeding explicit count inputs.
