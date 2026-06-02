---
name: Outcome re-weighting modes and the user-facing learning read
description: What shadow/hold/applied mean for readiness scoring, why shadow is the default, and the privacy contract for surfacing the outcome-driven tilt to users.
---

# Outcome re-weighting modes + learning read

`brainConfig.ts` `reweightingMode` has three states that govern whether date
outcomes tilt the readiness score:

- **hold** — no observation computed at all (`reweighting` is undefined).
- **shadow** (the default) — the tilted score is computed for observation, but the
  *served* score and matching eligibility stay on the unchanged base score. Day-one
  gate behavior is preserved exactly.
- **applied** — the tilted score is served, but only to users inside
  `reweightingCohortPercent` (the deliberate founder cohort toggle). Outside the
  cohort, base score is served.

**Why shadow is the default:** the founder chose to turn the feedback loop on in
*observation* before ever acting on it, so the machine starts learning which signals
predict real connections without moving anyone's gate. Eligibility must never silently
change from flipping the default.

**How to apply:**
- When checking eligibility, always read the served score, not the tilted/preview
  score. In shadow and out-of-cohort applied, `score === reweighting.baseScore`.
- The user-facing learning read (`buildReadinessLearning` in `routes/matching.ts`,
  surfaced on `/matching` as "What your dates are teaching your brain") is
  **derived-only**: counts, baseScore, observedScore, delta, and registry lane
  *labels* (`leaningInto`). It must NEVER carry raw post-date note text. A privacy
  test in `matching.reweighting.test.ts` locks the exact key allowlist and asserts no
  raw text leaks.
- UI copy must not claim the readiness gate moved while in shadow. Say it is
  observational / score unchanged. If you ever wire an `applied`-aware UI, make that
  sentence mode-aware.
