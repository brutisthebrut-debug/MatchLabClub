---
name: OAuth connector library + adding a readiness lane
description: The end-to-end checklist for adding a real OAuth provider and/or a new readiness lane, and the cross-file literals that break typecheck if missed.
---

# Adding a real OAuth provider
Backbone lives in `oauthConnectors.ts` (`OAUTH_PROVIDERS`). Each provider is ONE entry:
real `fetchAndReduce` (real API call, reduce to `{counts:{items}}`), `providerConfigured()`
gate (both CLIENT_ID + CLIENT_SECRET), and token quirks via config flags: `tokenAuth`
basic/body, `tokenContentType` json, `tokenHeaders` (User-Agent), `refreshNeedsRedirectUri`,
`extraAuthParams`. Keep `cfg.source === cfg.id`.

Frontend: add the id to `OAUTH_PROVIDER_IDS` in `ConnectionCenter.tsx` (this alone makes the
card render the generic `OAuthConnectorPanel` connect button, no per-provider panel code) AND
add one LIVE card whose `id` equals the provider id. Card copy MUST describe what
`fetchAndReduce` actually reads. Also promote/add the id in `brainConfig.ts` `CONNECTOR_CATALOG`
(status "live").

**Purge parity is automatic** when `cfg.source === cfg.id`: trustLedger lane purge, per-connector
disconnect, and both GDPR delete paths all key off registry `sources`/`source`. No trustLedger or
account.ts edits needed for a new provider on an existing lane.

# Adding a new readiness lane (e.g. "communities")
- One new `SIGNAL_REGISTRY` entry in `signalRegistry.ts` (weight, denominator, `sources[]`,
  summaryPath `["counts","items"]`). A lane with multiple `sources[]` is summed generically by
  `signalCounts.ts` (latest per-source count) — no per-lane count code, no signalCounts.ts edit.
- Add the lane key to `ReadinessBreakdown` + a count key to `SignalCounts` (both in signalRegistry.ts).
- OpenAPI: add to `MatchReadinessBreakdown` schema (required array + property) and regenerate codegen.
- Add a row in `readinessLanes.ts` (`BREAKDOWN_ROWS`; `_allLanesHaveRows` enforces keyof coverage).

**Gotcha that breaks frontend typecheck:** every hardcoded `MatchReadinessBreakdown` literal must
list the new lane key. The demo-fallback breakdown object in `Matching.tsx` (`state.data?.readiness.breakdown ?? {...}`)
is one such literal — grep for other `vitality: 0` style demo objects and add the new key to each,
or `tsc` fails with "Property 'X' does not exist" at the `BREAKDOWN_ROWS.map` index.

**Test fixtures:** `readiness.test.ts` (all-zeros + all-100 input/expected) and
`signalRegistry.test.ts` (raw weight total, per-id normalized weight, zeroBreakdown) hardcode the
lane set and the raw weight sum — update both when weights change.

# Paste vs OAuth copy on a shared lane
When a lane has both a paste card and a live OAuth card (music/Spotify, film/Trakt), the paste
card's "excludes" must not claim "no OAuth access to <provider>" once the OAuth card is live on the
same page — scope it to the paste flow ("no login/OAuth for this paste flow") to avoid two trust
surfaces contradicting each other.
