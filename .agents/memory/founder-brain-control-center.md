---
name: Founder brain control center
description: How founder-tunable knobs layer over the signal registry without breaking day-one behavior.
---

# Founder brain control center

`brainConfig.ts` (api-server) is the single accessor for every founder-tunable knob:
readiness threshold, matching radius, cohort min size, AI daily caps, reweighting
mode, raw signal-weight overrides, connector toggles. Persisted in the
`founder_brain_config` key/value jsonb table (`founder_curation` holds good/bad verdicts).

**Day-one invariant:** an empty config row reproduces the exact registry
normalization. `effectiveBaseWeights(controls)` returns `normalizedWeights()` when
there are no overrides. Overrides are RAW weights keyed by signal id, re-normalized
to sum to 1.0 alongside non-overridden signals.

**Why:** the registry is the source of truth for weights; the control center tilts
*around* it, never replaces it. So adding a registry signal still works and turning
all knobs back to default restores original scoring exactly.

**How to apply:**
- All reads fail-open to `defaultControls()` so a missing table / read error never
  breaks scoring or AI calls.
- `reweightingMode` is a 3-state safe-rollout dial: "hold" = base weights for
  everyone (live path skips the outcome fetch + tilt entirely); "shadow" = tilt is
  computed for observability but the served score stays on base (nothing a user
  sees changes); "applied" = tilt served, but ONLY to users inside the rollout
  cohort. `reweightedWeights()` always computes the tilt; `effectiveWeightsForUser`
  is the mode+cohort-gated wrapper. Mirror this hold/shadow/applied dial when
  rolling out any other scoring change (decay, confidence, geo).
- Cohort gating: `inReweightingCohort(controls,userId)` buckets a stable FNV-1a
  hash of the userId into 0-99, in-cohort when bucket < `reweightingCohortPercent`.
  Normalize the hash UNSIGNED (`h >>> 0`), not `Math.abs`, before `% 100`. Pure +
  deterministic so a user never flips between scorings; 100=all, 0=none.
- Observability is an on-demand founder endpoint only (`/founder/brain/reweighting-impact`,
  capped fan-out, derived deltas only). Do NOT write per-`computeReadiness` journey
  rows for this — the hot path would flood. When sampling a capped population,
  `orderBy` the distinct key so the truncated window is stable across calls.
- `proposeWeightAdjustments` rounds `adjustedWeight` to 4 decimals, so applied-mode
  weight sums can drift ~0.0001 per signal (don't assert `toBeCloseTo(1, 6)` on
  applied-mode sums; use precision 2).
- Connector toggles are persisted control + founder UI only; public
  ConnectionCenter does NOT yet enforce them (downstream wave).
- New founder routes must be added to the auth arrays in `founder.auth.test.ts`
  (GET/POST/PUT) or they ship un-asserted.
