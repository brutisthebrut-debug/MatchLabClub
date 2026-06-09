---
name: Matching automation default-on
description: Why the matching background sweeps default ON and how the env/stored-row precedence works.
---

The three matching background sweeps default ON: `autoProposalEnabled`,
`proposalExpiryEnabled`, and `matchingNudgeEnabled` are seeded in
`defaultControls()` (brainConfig.ts) via `envBoolDefaultTrue(name)` — unset or
`""` => true; only an explicit `0/false/no/off` => false. Echo proactivity
(`companionNudgeEnabled`) deliberately stays OFF (still `envTruthy`).

**Why:** the founder decided to turn matching automation on by default.
`envBoolDefaultTrue` is the INVERSE of the older `envTruthy` seeds, so "unset now
means ON" — do not reintroduce off-by-default assumptions for these three.

**How to apply:**
- Each background job (autoProposalJob/proposalExpiryJob/matchingNudgeJob) ALWAYS
  schedules its timer; the per-tick `*Tick()` re-reads the live brain controls and
  gates the sweep, so the founder toggles it with no redeploy. Keep the sweep fn
  itself ungated so direct/test callers are never blocked.
- `coerceControls` falls back to the seeded default for any field a stored
  founder_brain_config row omits — so an existing prod row missing
  `matchingNudgeEnabled` inherits ON. But an explicitly stored `false` (e.g. an
  old autoProposal/proposalExpiry false) WINS over the new default; the founder
  must flip those in the prod control center.
- All three job names are in `KNOWN_JOB_NAMES` (jobHeartbeat.ts). The heartbeat
  panel still marks a no-heartbeat job stale, so a sweep the founder turns OFF
  reads as "stale" — it cannot yet distinguish disabled from broken.
