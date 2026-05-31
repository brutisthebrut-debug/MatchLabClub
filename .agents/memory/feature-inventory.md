---
name: MatchLab feature inventory (what is already built)
description: End-to-end map of built backend routes, DB tables, jobs, signals, web pages, mobile screens, and roadmap status. CHECK THIS FIRST before building anything to avoid redundant work.
---

# What is already built (read before building)

**Why this exists:** the product is wide and a LOT is already shipped. Repeatedly we
"discover" a feature already exists mid-build. Use this as the first stop to avoid
redundant work, then VERIFY against current code before acting — a named route/file
here is a claim it existed when written, not a guarantee it still does. Update this
file whenever you build something new or find this stale.

## Backend routes (`artifacts/api-server/src/routes/`)
- **account.ts** — sessions list/revoke; account summary/export (+email export); delete account; AI-content consent get/set; consent list.
- **ai.ts** — AI provider status; deterministic fallback-rate; internal LLM test; enhance-prompt.
- **audits.ts** — audit CRUD + summary; trash (list/expiring/empty/restore-all/restore/purge/bulk-delete); (re)generate analysis; versions; `extract-screenshot` (OCR); `from-screenshot` (OCR+analyze); correct-source-app.
- **auth.ts** — Replit OIDC login/callback/logout; current user; mobile-auth exchange/logout.
- **claim.ts** — claim-anonymous; cross-device handoff issue/redeem/status.
- **coachFollowUps.ts** — record check-in response; timeline; stats.
- **compass.ts** — Compatibility Compass: extract-screenshot; create read; list/detail reads.
- **datingWins.ts** — list/create/delete dating wins (`/api/me/dating-wins`).
- **founder.ts** — founder admin: stats, wellness-stats, AI usage today, AI metrics, purge-trash, referrals, geoip refresh, OCR mismatches/rules/learn, AI thresholds, founder copilot ask.
- **health.ts** — `/api/healthz`.
- **imports.ts** — `POST /api/imports/calendar` (.ics parse → imported_sources); list imports; delete import. (Hinge import also lands in imported_sources; see meImports/parser.)
- **insights.ts** — list insights; rollup ("weekly growth"); create; analyze one.
- **journal.ts** — journal entries list/create/patch/soft-delete.
- **leads.ts** — submit lead; founder list.
- **lifePulse.ts** — record/list mood "pulse" checks.
- **matching.ts** — matching state (incl. `computeReadiness`); preferences PUT; pool-membership PUT (cohort opt-in); external-read (analyze an outside profile); proposals.
- **meImports.ts** — `POST /api/me/instagram-paste` (Instagram tone extraction).
- **messages.ts** — list/create messages; `:id/coach` (reply coaching).
- **meta.ts** — engine version for cache-busting.
- **mirror.ts** — `/api/mirror/trends` long-term behavioral trends.
- **postDateNotes.ts** — list/create post-date reflections.
- **profiles.ts** — profile versions list/create/patch; `:id/rewrite` (AI bio/prompt rewrite).
- **push_tokens.ts** — register/unregister Expo push token.
- **waitlist.ts** — join; stats.
- **wellness.ts** — answers list/create; tags; aggregate wellness/readiness profile.

## DB tables (`lib/db/src/schema/`)
users, sessions, audits, audit_report_versions, compatibility_reads, profiles, messages,
message_coaching_sessions, insights, journal_entries, post_date_notes, dating_wins,
life_pulses, coach_follow_ups, wellness_answers, wellness_tags, imported_sources,
matching_preferences, matching_pool_membership, match_proposals, matching_readiness_snapshots,
matching_nudge_state, leads, waitlist, purchase_interest, referrals, push_tokens,
login_notifications, handoff_token_redemptions, handoff_rate_limit_hits, data_export_tokens,
geoip_alert_state, founder_settings, job_heartbeats, ocr_learned_rules, ocr_rule_review_log,
ai_request_metrics, ai_request_metrics_daily, ai_usage_counters, ai_tool_alert_state,
ai_alert_thresholds, ai_alert_threshold_changes.

## Background jobs (`artifacts/api-server/src/lib/`)
aiMetricsRetention (roll raw→daily, purge), aiReliabilityAlerts (founder breach emails),
auditTrashPurge (>30d), auditTrashPushJob (expiry reminders), auditVersionPurge,
dataExportTokenCleanup, geoipUpdateJob, handoffRedemptionCleanup, matchingNudgeJob,
ocrLearningJob, jobHeartbeat (monitors all jobs).

## Match Readiness signal registry (`signalRegistry.ts`) — 7 contributors
Raw weights sum to 1.10; `normalizedWeights()` divides by the raw total so adding one
never breaks sum-to-1. ids → weight (countKey):
- wellness 0.22 (wellnessDistinct), compass 0.20 (compass), hingeImport 0.16 (hingeImport),
  postDate 0.16 (postDateReflected), journal 0.14 (journal), wins 0.12 (wins),
  calendar 0.10 (calendarEvents).
NOTE: the readiness signals are NOT the same set as the Connection Center connector cards.
Photo scan / Instagram tone are connectors but are NOT readiness contributors.

## AI layer
- `aiEngine.ts` = deterministic baseline (rule/keyword heuristics), always on, no keys, never capped.
- `aiService.ts` = router to Anthropic Claude via Replit AI Integration; per-user daily cap (~30);
  gated behind per-account `ai_content_consent`. Falls back to aiEngine on no-consent / cap / failure.
- Claude-eligible tools: audit generation, message coaching, profile (bio/prompt) rewrite,
  Compass reads, insight analysis, founder copilot, Instagram tone. All have deterministic fallback.

## Web pages (`artifacts/nldc/src/pages/`, routes in `App.tsx`)
Marketing/public: Landing(/), Pricing, Waitlist, Blog + BlogPost, Quizzes + QuizPlay, Quiz,
Gallery, SampleReport, Roadmap, Privacy, Terms, ShebangsPartner(/partners/shebangs),
SignalCheck, Diagnosis, Checkout + CheckoutSuccess/Cancel.
Core app: Dashboard, Report(/report/:id), Coach, Insights, Scan, GlowUp, CompatibilityCompass,
Wizard(/start), Onboarding, SelfHub(/me), Account + Sessions, Trash, Matching, FutureConnections.
Readiness/progress cluster (/progress/*): readiness, scorecard, timeline, wins(DatingWinsLog),
patterns, feed, followup, experiments, pattern-breaker, companion, control, insights-roadmap.
Mirror/reflection cluster: MirrorProfile(/mirror), YourMirror(/your-mirror), journal(/mirror/journal),
dates(/mirror/dates), Reflection, Blueprint, Archetype, ConnectionStyle, StyleMap, ProfileReader,
NextMessage, Lab, WhatChanged.
Connections/data: ConnectionCenter(/connections), Integrations, Imports, LifeContext, WellnessCenter,
DataVault(/vault), UserControl.
Wingman Studio (/copilot/*): Copilot hub + reset, reply, profile, debrief, weekly-plan, prep,
flirt, what-changed, demo(FounderDemoJourney).
Internal: Founder(/founder), Feedback.
Nav lives in `AppSidebar.tsx` (authed) vs `Navbar.tsx` (marketing); many app pages are reachable
only via "More" disclosures or deep links (Report, QuizPlay, BlogPost, CheckoutSuccess, Onboarding).

## Mobile (`artifacts/nldc-mobile/`, Expo)
All screens wired to real backend via `@workspace/api-client-react` hooks; each has DEMO_* zero-state.
Tabs: index(home), scan(OCR audit), matches, coach, insights, profiles(vault), self-hub, account.
Stack: audit/[id], dates(post-date notes), journal, compass, trash, sessions, imports.
Auth: OIDC via expo-auth-session, token exchange `/api/mobile-auth/exchange`, secure-store; anon
mode + claim-on-login handoff. Mobile-only: push notifications, camera OCR, native share.

## Connector roadmap (Beats) — actual status
- Beat 1 Connection Center repositioning — BUILT.
- Beat 2 forwarding inbox (`{handle}@receipts.matchlab.club`) — NOT built (placeholder card "building").
- Beat 3 Plaid spending — NOT built (placeholder "building"; no plaid dep). Secrets PLAID_CLIENT_ID/PLAID_SECRET are referenced as missing.
- Beat 4 insight stream on /me — PARTIAL (/me + basic metrics exist; full stream not realized).
- Beat 5 calendar .ics — BUILT end-to-end AND wired into readiness (calendar lane).
- Beat 6 signal-density viz — NOT built.
- Beat 7 matching cohort opt-in — BUILT (pool-membership route + table).
Connector cards genuinely built: Hinge GDPR zip, Instagram tone, message paste, photo scan,
wellness, calendar paste, matching cohort. Placeholders: forwarding inbox, Plaid, Spotify.

## Known claim-vs-build gaps (fix copy or build before promising)
- "Photo Scan" card implies visual photo critique; reality = OCR of bio/prompts + a STATIC photo
  checklist in aiEngine, no real image analysis.
- Hinge/Tinder/Bumble OAuth marketed ("coming") — NO OAuth infra exists.
- replit.md privacy paragraph implies Claude always does Instagram tone; reality = deterministic by
  default, Claude only with consent.
- Stripe: replit.md says "no webhook"; `purchase_interest` + Checkout.tsx are pre-wired for
  stripe_session_id/paid status but no webhook endpoint exists yet.
- Built but under-marketed: dating wins log (is a readiness signal), the large /progress + /copilot
  surfaces.
