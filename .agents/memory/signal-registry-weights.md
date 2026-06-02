---
name: Signal registry weights are not pre-normalized
description: SIGNAL_REGISTRY raw weights sum to well over 1.0 (grows as lanes are added); always normalize before deriving percentages, and mirror that in every hand-built demo/UI of a derived endpoint.
---

# Signal registry weights are not pre-normalized

The raw `weight` fields in `SIGNAL_REGISTRY` (api-server `signalRegistry.ts`) sum
to **well over 1.0**, and the total keeps growing every time a lane is added
(each new connector/quiz/import is its own lane per founder direction). Do NOT
hardcode or reason from a specific raw total — it is mutable. Compute it from the
registry. Several old code comments claim "default weights already sum to 1.0" —
that is **stale/inaccurate**; do not trust them.

**Why:** readiness scoring divides by the live total. `normalizedWeights()` and
`effectiveBaseWeights(controls)` (with no founder overrides) both return
`weight / sum`, so the effective weights used to score readiness DO sum to 1, but
the per-lane raw weights do not. A lane's true "percent of the picture" is
`weight / rawTotal`, not its raw weight.

**How to apply:**
- Any feature that surfaces a per-signal weight percentage must use the
  normalized/effective weights, never the raw `c.weight`.
- When hand-building demo/fallback data for a derived endpoint (e.g.
  `DEMO_SIGNAL_MAP` in nldc `mirrorDemo.ts`), it must mirror the backend
  derivation EXACTLY or it will contradict a signed-in view: normalized weight
  percentages, the same sort order (active-first by coverage, then blind spots by
  weight with registry order breaking ties), and the same `topBlindSpot`
  selection (heaviest empty lane; ties resolved to the earliest in registry
  order). Guard these invariants with a static test on the demo constant.
- Adding a lane is a registry edit PLUS an OpenAPI `MatchReadinessBreakdown`
  edit PLUS codegen. The matching page (`Matching.tsx`) has a compile-time drift
  guard: `BREAKDOWN_ROWS` uses `satisfies readonly BreakdownRow[]` and a
  `keyof MatchReadinessBreakdown extends BreakdownRowKey ? true : never` assertion,
  so omitting a row for any lane stops the build. Keep registry + OpenAPI + the
  Matching rows + every hand-written breakdown fallback object in lockstep.
