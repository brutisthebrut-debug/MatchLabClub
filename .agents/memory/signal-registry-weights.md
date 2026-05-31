---
name: Signal registry weight assertions
description: Why adding a contributor to SIGNAL_REGISTRY forces a test update, and how readiness weights normalize.
---

# Adding a signal to the living registry (`signalRegistry.ts`)

Adding a contributor to `SIGNAL_REGISTRY` is mostly a one-entry edit, and `readiness.ts`
(`computeBreakdown`/`scoreFromBreakdown`/`computeNextActions`) plus the matching prompt all derive
from the registry automatically. But three things still need hand updates, and missing them breaks tests:

- The `ReadinessBreakdown` interface (add the new id) and `SignalCounts` interface (add the raw count
  key). These are structural; TS will fail without them, including every `computeBreakdown({...})` call
  site in `readiness.test.ts` (each input object must include the new count key) and the
  `zeroBreakdown`/expected-breakdown objects (must include the new id).
- `signalRegistry.test.ts` has a test that asserts each normalized weight to a hardcoded number.

**Why the weight test breaks:** `normalizedWeights()` divides each raw weight by the raw total. The
shipped registry's raw weights happened to sum to 1.0, so the test asserted the raw values directly.
Adding a contributor with weight `W` makes the raw total `1.0 + W`, so EVERY existing normalized weight
becomes `raw / (1.0 + W)`. You must re-derive all the hardcoded assertions (e.g. divide by 1.1 when the
new weight is 0.1) and add an assertion for the new id. `normalizedWeights()` still sums to 1.0 — that
invariant never breaks; only the per-signal hardcoded numbers shift.

**How to apply:** when adding a registry signal, update both interfaces, every `computeBreakdown` input
and expected object in the tests, and re-normalize the hardcoded per-weight assertions by the new raw
total. Verify "hinge import is the single biggest next-action step" still holds (it has the largest
`contributorStep` because it is binary with a high weight; a small new count-signal won't dethrone it).

**Frontend coupling:** `artifacts/nldc/src/pages/Matching.tsx` independently hardcodes the breakdown
keys in a `BreakdownRow` union, a `BREAKDOWN_ROWS` lane array, and a default-breakdown fallback object.
A new readiness lane must be added there too (and to the OpenAPI `MatchReadinessBreakdown` schema, then
codegen) or it won't render / won't typecheck.
