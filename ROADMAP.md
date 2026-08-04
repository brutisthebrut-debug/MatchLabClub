# MatchLab Club Delivery Roadmap

Last updated: 2026-08-04

This is the canonical delivery roadmap. `VISION.md` holds the long-range strategy;
this file controls what the team is building now. Update this document and the
README in the same change whenever the active milestone, destination model, or
definition of done changes.

## Active milestone

**Complete and approve the simplified v1 MatchLab shell.**

The approved journey is:

> Get known → understand yourself → know who you really want → wait honestly →
> receive one considered introduction → meet → learn afterward.

This is a consolidation milestone. It is not permission for a broad redesign,
new destination, or connector expansion.

## Product contract

- Five primary signed-in destinations only: **Today, Matches, My MatchLab,
  Journey, Play**.
- Echo is the persistent companion and guides capture, interpretation, and the
  next useful action.
- Existing features stay reachable through contextual hubs or secondary
  navigation. Do not delete or orphan working capability.
- Profile readiness, search activity, and market availability are distinct.
  Profile-ready must never imply that a match or introduction is available.
- The landing experience and signed-in shell should feel like one continuous
  journey.
- All genders and orientations remain first-class. Consent and user control are
  non-negotiable.

## Delivery batches

### Batch 0A — Canonical handoff and freeze

Status: **Complete in `agent/echo-shell-phase-0`**

- Record the approved milestone and five-destination contract in-repo.
- Point the README to this roadmap before architecture and migration material.
- Mark `VISION.md` as long-range strategy rather than the current delivery queue.
- Freeze new primary destinations until this milestone is accepted.

### Batch 0B — Five-destination navigation shell

Status: **Complete in `agent/echo-shell-phase-0`**

- Reduce the signed-in rail to Today, Matches, My MatchLab, Journey, and Play.
- Make Echo the companion-first rail CTA.
- Preserve legacy tools under More MatchLab and existing in-page hubs.
- Keep account, privacy, beta, and founder surfaces secondary.

### Batch 0C — Truthful matching-state language

Status: **Complete in `agent/echo-shell-phase-0`**

- Replace “points to your first match” with “points to profile ready” in the
  persistent matching bar.
- Show profile readiness, search activity, and nearby market density separately
  in the persistent bar and Today home.
- Route members to matching settings without promising an available match.

### Batch 1 — Today as the Echo-led home

Status: **Complete in `agent/echo-shell-phase-0`**

- Turn Today into a single clear conversation with Echo, not a dashboard dump.
- Show one current read, one honest next action, and the member's waiting/search
  state.
- Reuse the existing companion and matching-state contracts before adding API
  surface.
- Preserve the approved Echo Journey visual language; tighten, do not reinvent.

### Batch 2 — Matches lifecycle consolidation

Status: **Complete in `agent/echo-shell-phase-0`**

- Present controlled-pilot waiting, proposal, mutual reveal, date, and debrief as
  one legible lifecycle.
- Use seeded/demo states for product review without confusing them with real
  member availability.
- Keep safety, consent, blocking, and reveal controls explicit.
- Keep signed-out review to a clearly labeled process preview. Never render fake
  people, messages, or availability as though they are active matches.
- Bring real proposals and mutual introductions into Matches while preserving
  the deeper matching-preferences route as a secondary settings surface.

### Batch 3 — My MatchLab, Journey, and Play

Status: **Complete in `agent/echo-shell-phase-0`**

- My MatchLab: **Complete.** Profile model, data sources, permissions, and
  readiness evidence now share one decision view; the detailed legacy profile
  workspace remains reachable at `/me/details`.
- Journey: **Complete.** The primary destination now renders durable server-backed
  history of meaningful signals, introductions, dates, and learning afterward.
  The client-local experimental timeline remains reachable at
  `/progress/timeline` but no longer stands in for member history.
- Play: **Complete.** The primary destination is a catalog of bounded activities
  that states duration, what each activity teaches Echo, and the saved outcome.
  Existing games and quiz routes remain intact behind the catalog.

### Batch 4 — Landing-to-app continuity and acceptance

Status: **Planned**

- Align landing promises and signed-in language around the same journey.
- Tune Echo's voice with a dedicated copy pass.
- Run Daniel + Lissa acceptance review against the canonical build.
- Capture pilot evidence and the next decision before expanding scope.

## Definition of done

The milestone is complete when:

- Only the five approved primary destinations appear in signed-in navigation.
- Echo is persistent and provides a useful next action without overclaiming.
- No working legacy route is orphaned.
- Readiness, search activity, and market availability are visibly distinct.
- Landing and signed-in experiences tell the same story.
- Automated typecheck, web tests, API tests, schema drift, lint, and voice lint
  pass on the final branch.
- Daniel and Lissa complete an acceptance review of the same canonical build.
- The next milestone is selected from evidence, not from feature enthusiasm.

## Explicitly parked during this milestone

- Broad visual reinvention.
- New primary navigation destinations.
- Dating-app OAuth.
- After-dark mode.
- Connector expansion that does not directly unblock the approved v1 journey.
- Monetization changes unrelated to validating the simplified shell.
