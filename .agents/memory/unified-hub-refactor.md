---
name: Unified hub-and-tabs refactor
description: How the MatchLab signed-in IA is consolidated (sidebar front doors + HubTabs sub-nav over 7 hubs, orphan-nothing rule) and why
---

# Unified experience refactor (MatchLab/nldc)

## Hub-and-tabs is a route-based sub-nav, NOT hub container components
- Unification uses `components/layout/HubTabs.tsx` (config in `lib/hubs.ts`). Each clustered page renders `<HubTabs hub="..." />` as the FIRST child inside its own `<AppLayout>`.
- **Why:** every page renders its own `AppLayout` (the conditional sidebar/marketing shell). A hub *container* that renders child pages would double-nest `AppLayout`. A shared route-based tab strip gives the unified feel with zero layout duplication and keeps code-splitting + deep links.
- **How to apply:** legacy routes stay live as tabs (orphan nothing). No hard redirects except the pre-existing `/diagnosis` → `/signal-check`. Adding a tool to a cluster = one `lib/hubs.ts` entry, not new routes.

## The sidebar is a short spine of FRONT DOORS, not a flat dump
- **Why:** the founder felt the signed-in app was overwhelming (~80 flat sidebar links). The rail is now ~9 Overview front doors (one per hub plus Echo and Audit history) + 4 collapsible sections (Get Matched, More tools, Founder & Beta, Account). The full index is NOT the rail; sibling tools live behind the in-page HubTabs strip.
- **How to apply (orphan-nothing invariant):** every non-marketing route must stay reachable via a front door, a hub tab (`lib/hubs.ts`), OR a sidebar section primary/more entry. Intentionally excluded from the sidebar: `/founder`, `/onboarding`, `/diagnosis` (redirect), `/report/:id`, `/matches/:id`, `/connections/add/:source`, and marketing pages. When you add/remove a route, re-check this mapping.
- `navigationCatalog.ts` (PACKAGES) feeds ONLY `FeatureHub.tsx` (the Dashboard "all tools" discovery grid), NOT the sidebar. Keep it comprehensive on purpose; it is a discovery surface, not the rail.

## Seven hubs + their front-door (canonical) routes
HubId values are STABLE internal keys (feed tests/telemetry); `label` is the only user-facing name and is safe to relabel. `growth` keeps its key but presents as "Progress".
- audit → `/start` (label "Signal Audit"; tabs: /start, /signal-check, /scan, /profile-reader). Product-wide canonical name is "Signal Audit" / "Profile Signal Audit"; keep sidebar front door and hub label aligned to "Signal Audit", not "Profile Audit".
- mirror → `/your-mirror` (tabs: /your-mirror, /me, /mirror, /archetype, /connection-style, /care-dialect). Keep `/mirror` route + export + toolName "Mirror Profile" STABLE (telemetry/fallback); only the UI label is "Profile Reflection".
- messages → `/coach` (tabs: /coach, /next-message, /insights, /style-map, /lab, /rehearsal, /copilot, /wingman). `/wingman` is a messages tab, so do NOT also list it in the sidebar "More tools" (redundant).
- growth (label "Progress") → `/progress/readiness` (tabs include readiness, scorecard, milestones, timeline, patterns, feed, control, insights-roadmap, weekly-plan, what-changed, reflection). Cluster is large; tab strip is curated, sections carry the rest.
- journal → `/mirror/journal` (tabs: /mirror/journal, /mirror/dates, /progress/wins, /copilot/debrief).
- games → `/quiz` (tabs: /quiz, /this-or-that, /games/*, /cosmic).
- connections → `/connections` (tabs: /connections, /integrations, /imports, /receipts, /life-context, /voice-intro, /vault, /user-control, /wellness).

## Games shell: `/quiz` must NOT be in MARKETING_PREFIXES
- `/quiz` is removed from `MARKETING_PREFIXES` in `AppLayout.tsx` so authenticated users get the app shell (sidebar) on the Games hub; `/quizzes` (marketing) STAYS in the list.
- **Why safe:** `isMarketingRoute` matches exact OR `location.startsWith(prefix + "/")`, so `/quiz` and `/quizzes` never prefix-collide. Re-adding `/quiz` would put signed-in Games back under the marketing top-nav.

## Dead-end tools wire into ONE new lane `behavioralGrowth`
- Single first-party lane (not several) to minimize normalized-weight drift. `behavioral_growth_events` is type-discriminated (one `type` varchar per event, no soft-delete column), so events are HARD-deleted; both GDPR paths must purge it since it has no FK cascade on user_id.
- Sources: ProgressExperiments tried/helped, WhatChanged save, PatternBreaker completed action, ProgressFollowUp saved reflection, Companion Workspace only on completed commitment (never page view). ProgressScorecard stays derived/private with copy "summarizes signals, does not add new signal by itself".
- **Why/How:** adding a first-party lane ripples (DB+migration, route, OpenAPI→Orval, ReadinessBreakdown+SignalCounts, SIGNAL_REGISTRY, collectSignalCounts return literal, trust-ledger purge handler, real-DB route tests). Expect snapshot/readiness % to shift; update fixtures intentionally.
