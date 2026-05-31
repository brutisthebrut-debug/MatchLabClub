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
- `reweightingMode`: "hold" = base weights for everyone; "applied" = bounded
  per-user outcome tilt (`proposeWeightAdjustments`) layered on the base.
- `proposeWeightAdjustments` rounds `adjustedWeight` to 4 decimals, so applied-mode
  weight sums can drift ~0.0001 per signal (don't assert `toBeCloseTo(1, 6)` on
  applied-mode sums; use precision 2).
- Connector toggles are persisted control + founder UI only; public
  ConnectionCenter does NOT yet enforce them (downstream wave).
- New founder routes must be added to the auth arrays in `founder.auth.test.ts`
  (GET/POST/PUT) or they ship un-asserted.
