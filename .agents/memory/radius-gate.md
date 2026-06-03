---
name: Radius hard gate semantics
description: When the matching radius gate hard-filters a pair vs. degrades to pass, and why a default radius is intentionally NOT applied.
---

# Radius hard gate (matchEngine `radiusGatePasses` / `gatesPass`)

The matching engine has TWO distance concepts that must not be conflated:
- A graded `proximity` component inside `scoreCompatibility` that only nudges the score.
- A HARD radius gate inside `gatesPass` that excludes a pair entirely.

The hard gate fires only when a measured great-circle distance exists AND at least
one member expressed a radius. Rules:
1. City unresolvable (`proximityBetween().distanceMiles == null`) -> gate PASSES.
2. Neither side set a radius -> gate PASSES (no implicit cap).
3. Otherwise -> require `distance <= min(a.radiusMiles, b.radiusMiles)`.

**Why:** radius preferences are stored as `distanceKm` and converted to miles
(`MILES_PER_KM`); the engine reasons in miles. An earlier version applied
`DEFAULT_RADIUS_MILES` (35) when NEITHER side set a radius, which silently
hard-excluded resolvable long-distance pairs that the discover route previously
never blocked. That is a surprising compatibility change, so we only hard-filter
on a preference a member actually expressed. Using `min` of both radii keeps the
gate symmetric (a hard invariant: `scoreCompatibility(a,b) === scoreCompatibility(b,a)`).

**How to apply:** if you ever want an implicit default radius for the matching
pool, make it an explicit product decision and apply it where preferences are
loaded/seeded, NOT inside the pure gate (the gate must stay "honor what was set").
Tests that need to exercise the gate must set `prefs.radiusMiles` (or seed
`distanceKm`) AND use cities that resolve to coordinates (e.g. New York / Los
Angeles / Philadelphia all geocode).
