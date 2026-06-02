---
name: Signal registry weights are not pre-normalized
description: SIGNAL_REGISTRY weights sum to ~1.81, not 1.0; always normalize before deriving percentages, and mirror that in any hand-built demo of a derived endpoint.
---

# Signal registry weights are not pre-normalized

The raw `weight` fields in `SIGNAL_REGISTRY` (api-server `signalRegistry.ts`) sum
to roughly **1.81**, not 1.0. Several code comments claim "default weights already
sum to 1.0" or "the raw weights sum to 1.0" — that is **stale/inaccurate**. Do not
trust those comments.

**Why:** readiness scoring divides by the total. `normalizedWeights()` and
`effectiveBaseWeights(controls)` (with no founder overrides) both return
`weight / sum`, so the effective weights used to score readiness DO sum to 1, but
the per-lane raw weights do not. A lane's true "percent of the picture" is
`weight / 1.81`, e.g. `wellness` 0.22 → ~12%, not 22%.

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
