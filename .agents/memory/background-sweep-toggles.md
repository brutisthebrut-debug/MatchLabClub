---
name: Background sweep founder toggles
description: How env-flagged background sweeps were promoted to live founder-dashboard toggles without breaking on-demand/test paths.
---

# Background sweep founder toggles

Background sweeps that used to be gated only by a boot-time env flag (e.g.
auto-proposal, companion/Echo nudge) are now controllable as live founder
dashboard switches via boolean fields on the brain controls blob.

## The rule
- Gate the **scheduled tick wrapper**, not the sweep function itself. The timer
  always schedules; the tick reads the DB control each run and skips when off.
  The underlying `run*Sweep` stays ungated so direct/on-demand/test callers (and
  the discover route) are never blocked.
- The env flag (`*_ENABLED`) only **seeds the default** in `defaultControls()` via
  an `envTruthy()` helper. The dashboard toggle is the live source of truth.
- In `coerceControls`, preserve the env-seeded default for legacy stored blobs:
  use `typeof v.flag === "boolean" ? v.flag : base.flag`, never `Boolean(v.flag)`
  (which would silently coerce a missing field to false and lose the env seed).
- On enable from the founder PUT route, fire one immediate tick
  (`void someTick()`) so the switch takes effect now instead of after the next
  interval. Ticks self-gate, so the immediate call is safe and idempotent.

**Why:** the founder wanted in-dashboard switches the cofounder can flip with no
redeploy, but existing deploys, tests, and on-demand matching had to behave
identically day one. Gating the tick (not the sweep) is the seam that satisfies
both. A dead switch that does nothing for 6-12h reads as broken, hence the
immediate tick on enable.

**How to apply:** when adding any new scheduled sweep that should be founder
toggleable, add one boolean to BrainControls (seeded from its env flag), gate the
tick, expose it in `BrainControlsPatch` + the frontend `BrainControls` type + the
"Background automation" section in Founder.tsx, and fire an immediate tick on
enable.
