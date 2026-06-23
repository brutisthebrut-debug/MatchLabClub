---
name: Unified hub-and-tabs refactor
description: How the MatchLab IA consolidation works (HubTabs sub-nav, canonical routes, single behavioralGrowth lane) and why
---

# Unified experience refactor (MatchLab/nldc)

## Hub-and-tabs is a route-based sub-nav, NOT hub container components
- Unification uses `components/layout/HubTabs.tsx` (config in `lib/hubs.ts`). Each clustered page renders `<HubTabs hub="..." />` as the FIRST child inside its own `<AppLayout>`.
- **Why:** every page renders its own `AppLayout` (the conditional sidebar/marketing shell). A hub *container* that renders child pages would double-nest `AppLayout`. A shared route-based tab strip gives the unified feel with zero layout duplication and keeps code-splitting + deep links.
- **How to apply:** legacy routes stay live as tabs (orphan nothing). No hard redirects except the pre-existing `/diagnosis` → `/signal-check`. Adding a tool to a cluster = one `lib/hubs.ts` entry, not new routes.

## Four hubs + canonical (sidebar) routes
- audit → `/signal-check` (tabs: signal-check, scan, profile-reader)
- mirror → `/your-mirror` (tabs: your-mirror, /me, /mirror, /mirror/journal, /mirror/dates). Keep `/mirror` route + export + toolName "Mirror Profile" STABLE (telemetry/fallback), only UI label is "Profile Reflection".
- messages → `/coach` (tabs: coach, next-message, lab, copilot, rehearsal, wingman)
- growth → `/progress/readiness` (tabs: readiness, scorecard, wins, timeline, patterns, experiments, followup, companion). Cluster has ~13 pages; tab strip is curated, sidebar keeps the full index.

## Dead-end tools wire into ONE new lane `behavioralGrowth`
- Single first-party lane (not several) to minimize normalized-weight drift. `behavioral_growth_events` is type-discriminated (one `type` varchar per event, no soft-delete column), so events are HARD-deleted; both GDPR paths must purge it since it has no FK cascade on user_id.
- Sources: ProgressExperiments tried/helped, WhatChanged save, PatternBreaker completed action, ProgressFollowUp saved reflection, Companion Workspace only on completed commitment (never page view). ProgressScorecard stays derived/private with copy "summarizes signals, does not add new signal by itself".
- **Why/How:** adding a first-party lane ripples (DB+migration, route, OpenAPI→Orval, ReadinessBreakdown+SignalCounts, SIGNAL_REGISTRY, collectSignalCounts return literal, trust-ledger purge handler, real-DB route tests). Expect snapshot/readiness % to shift; update fixtures intentionally.
