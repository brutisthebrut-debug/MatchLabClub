# MatchLab Club Delivery Roadmap

Last updated: 2026-08-04

This is the canonical delivery roadmap. `VISION.md` holds the long-range strategy;
this file controls what the team is building now. Update this document and the
README in the same change whenever the active milestone, destination model, or
definition of done changes.

## Active milestone

**Connect the approved Echo-led experience to the minimum backend foundations
required for a controlled beta.**

The approved journey is:

> Get known → understand yourself → know who you really want → wait honestly →
> receive one considered introduction → meet → learn afterward.

The shell-consolidation work remains protected and still needs Daniel + Lissa
acceptance on a connected build. The active implementation lane has advanced to
beta foundations: authenticated runtime, durable plan/entitlement state,
subscription lifecycle, and controlled-cohort evidence. It is not permission
for a broad redesign, new destination, or connector expansion.

## Roadmap delta — 2026-08-04

This change records an intentional milestone advance, not a silent rewrite.

| Area                       | Previous roadmap                                                         | Updated roadmap                                                                             | Why                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Active implementation lane | Complete and approve the simplified v1 shell                             | Connect that approved shell to controlled-beta foundations                                  | Batches 0–5 are implemented and green; the remaining product gap is live authenticated integration, not another shell pass. |
| Commercial model           | Legacy `free` / `reset` / `wingman` tier fields remained in backend code | Canonical Member / Insight / Match / Guided plan contract with explicit legacy mapping      | The approved commercial ladder was not represented in the runtime contract.                                                 |
| Matching access            | Readiness and pool opt-in could initiate discovery                       | Candidate-pool opt-in remains available from Member; active search requires Match or Guided | Profile evidence, candidate availability, paid service activation, and an actual introduction must remain separate states.  |
| Design scope               | Echo Journey and five destinations protected                             | Unchanged                                                                                   | Backend work must serve the approved experience and cannot reintroduce the legacy dashboard.                                |
| Acceptance gate            | Daniel + Lissa review plus pilot evidence                                | Unchanged and still open                                                                    | Code and static visual review do not prove authenticated beta behavior.                                                     |

## Roadmap implementation delta — 2026-08-04, Batch 7A

The milestone did not change. Batch 7 was decomposed so backend progress can be
validated without implying that checkout or the connected runtime already exist.

| Area                | Previous wording                                             | Updated implementation contract                                                                                                              | Why                                                                                                       |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Stripe lifecycle    | One pending bullet combined checkout, lifecycle, and runtime | Signed event handling and current-customer reconciliation are Batch 7A; authenticated checkout/portal and runtime deployment remain Batch 7B | Webhook truth can be completed and tested independently from deployment credentials and account controls. |
| Beta grants         | Replace founder-only plan grants                             | Stripe controls non-beta paid access; founder grants remain explicit controlled-cohort overrides                                             | Removing the only safe beta-access path before live billing acceptance would block testing.               |
| Payment failure     | Undefined                                                    | `past_due` preserves existing access but never grants or upgrades; `unpaid`, paused, canceled, and failed activation revoke                  | This distinguishes a retry window from terminal nonpayment without creating free upgrades.                |
| Refunds and credits | Undefined                                                    | Reconcile current subscription truth; refund alone is not cancellation                                                                       | Billing adjustments and service termination are different events.                                         |
| Guided sales        | Package named, operational limits pending                    | Stripe reconciliation rejects Guided unless capacity is explicitly enabled                                                                   | The package cannot be sold honestly before staffing, scheduling, and overflow rules exist.                |

## Commercial package contract

These are commercial packages, not numbered progress levels. Product progress
describes what MatchLab understands; packages describe which outcome the member
is buying.

| Package     | Outcome                                                       | Price                     | Progression prompt                                 |
| ----------- | ------------------------------------------------------------- | ------------------------- | -------------------------------------------------- |
| **Member**  | Build a profile that reflects the real member                 | Free                      | See your full Mirror                               |
| **Insight** | Understand dating patterns and actual needs                   | $14.99/month or $99/year  | Turn on active matching                            |
| **Match**   | Actively find and evaluate compatible people                  | $49/month or $129/quarter | Work through this with a coach                     |
| **Guided**  | Add bounded human judgment from someone who knows the history | $249–$499/month           | Final package; human capacity is explicitly capped |

Member includes candidate-pool opt-in but not an active search. Insight deepens
the Mirror, Journey, Echo, Play, and selected sources. Match activates the
matching service only where honest geography and affinity supply exist. Guided
adds bounded human support and may attach to Insight or Match operationally.
Paid access never creates priority, entitlement to another person, or a promise
that a compatible introduction exists.

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

## Original capability disposition

Beta completeness is measured against the original product, not only the five
primary screens. Every working capability must have one explicit disposition:
integrated into a primary hub, preserved as a secondary tool, or parked with a
reason.

| Original capability family | Beta home | Disposition |
| --- | --- | --- |
| Matching, Future Connections, proposals, reveal, safety, date, debrief | **Matches** | Consolidate into the honest lifecycle; keep deep preferences secondary. |
| Profile, readiness evidence, wellness, life context, photos, voice, verification, permissions | **My MatchLab** | Preserve under the member model and detailed workspace. |
| Timeline, journal, patterns, scorecard/trends, wins, weekly plan | **Journey** | Use server-backed history; preserve working tools contextually. |
| Quizzes, games, results | **Play** | Preserve through the bounded catalog and saved outcomes. |
| Echo, coaching, preparation, reply help, reflection | **Today / persistent Echo** | Reuse the working contracts through one next action; do not restore a tool dashboard. |
| Signal Audit, Dating Reset, Wingman public checkout | **Canonical billing surface** | Retired commercial presentation. Must be replaced by authenticated Insight/Match checkout before beta; legacy links cannot grant canonical access. |
| Referrals/sharing, broad integrations, Experiments, audio-native claims | **None in beta** | Explicitly parked until the core journey produces evidence. |

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

Status: **In progress in `agent/echo-shell-phase-0`**

- Align landing promises and signed-in language around the same journey.
  **Complete in code.** Public copy now separates readiness from availability and
  ends at the signed-in Today destination.
- Remove numeric readiness from primary member-facing surfaces and avoid any
  language that frames access, disclosure, or completion as earning a person.
  **Complete in code after visual checkpoint QA.** Landing and Today now use
  qualitative evidence states, and commercial copy separates paid depth from
  worth, priority, or entitlement.
- Tune Echo's voice with a dedicated copy pass. **Initial pass complete in code.**
  Echo states uncertainty and challenges without cruelty or false intimacy.
- Run Daniel + Lissa acceptance review against the canonical build.
- Capture pilot evidence and the next decision before expanding scope.

Repository validation is now executable through `.github/workflows/ci.yml` on
every pull request and push to `main`. The same workflow packages the exact web
build used for the canonical visual checkpoint. Human acceptance and pilot
evidence remain open even when CI is green.

### Batch 5 — Connected beta acceptance

Status: **In progress in `agent/echo-shell-phase-0`**

- Keep the approved Echo Journey visual system on every primary and companion
  surface. Backend integration must not reintroduce legacy dashboard framing.
- Remove the remaining numeric readiness and point-reward treatment from Echo;
  show profile evidence, search activity, and nearby availability as separate
  qualitative states.
- Make Today choose its one useful move from real proposal and unread
  conversation data before falling back to general matching guidance.
- Allow an explicit beta web origin through the API's credentialed CORS and CSRF
  boundary while retaining existing Replit development origins.
- Validate the authenticated frontend, API, session, and database together on a
  connected beta deployment. A static web artifact does not satisfy this gate.

### Batch 6 — Commercial plans and matching entitlement boundary

Status: **Implemented in `agent/echo-shell-phase-0`; repository validation pending**

- Establish Member, Insight, Match, and Guided as one backend-owned catalog with
  the approved prices, included outcomes, entitlements, and progression prompts.
- Expose the canonical plan catalog through the API so pricing surfaces do not
  invent their own package definitions.
- Resolve historical `free`, `reset`, and `wingman` records through an explicit
  compatibility map while new founder beta grants store canonical plan keys.
- Keep candidate-pool opt-in available to Member, but require Match or Guided to
  initiate active discovery.
- Return canonical plan assignment and active-search state separately from
  profile readiness and pool membership.
- Preserve Guided's bounded human-review routing without restoring legacy
  Wingman presentation.

### Batch 7 — Live beta runtime and subscription lifecycle

Status: **In progress in `agent/echo-shell-phase-0`**

#### Batch 7A — Stripe subscription truth

Status: **Complete in `agent/echo-shell-phase-0`; validated by CI run #82**

- Accept explicit Stripe API/webhook credentials outside Replit while preserving
  the connector as a temporary migration fallback.
- Register the webhook from an explicit public API URL rather than requiring a
  Replit-generated domain.
- Recalculate entitlement from the customer's current Stripe subscriptions after
  signed subscription, invoice, checkout, refund, credit, pause, and cancellation
  events. Duplicate and out-of-order delivery must converge safely.
- Grant active/trialing plans, preserve but never upgrade on `past_due`, and
  revoke Stripe-managed access on paused, unpaid, canceled, or failed activation.
- Preserve founder beta grants and legacy tier history as explicit overrides;
  Stripe must not silently rewrite controlled testers or old purchases.
- Reconcile a bounded customer cohort on startup to recover missed webhooks.
- Keep Guided billing disabled until the human-service contract is approved.

#### Batch 7B — Authenticated billing and connected runtime

Status: **Backend slice implemented and validated by CI run #87; approved-design UI hookup and connected-runtime evidence pending**

- Create authenticated canonical-plan Checkout Sessions with member and plan
  metadata; legacy public Payment Links must not assign beta packages.
  **Implemented in code.** Only Insight and Match use server-owned Price IDs;
  Guided remains disabled, founder grants cannot be double-sold, and an existing
  live/recovery subscription routes to account management instead of creating a
  duplicate.
- Add account billing status and Stripe Billing Portal controls for cancellation,
  payment recovery, and invoice history. **Implemented as authenticated API
  controls; the approved Echo Journey account surface still needs the final UI
  hookup.**
- Replace the runtime's hard dependency on the Replit OIDC client ID and request
  host with explicit `OIDC_CLIENT_ID`, `API_PUBLIC_URL`, and `WEB_PUBLIC_URL`
  settings while retaining documented migration fallbacks. **Implemented in
  code; provider and domain validation remain open.**
- Run web, API, session/auth, Postgres, and Stripe test mode together on the
  connected beta domain. **Pending deployment evidence.**

#### Batch 7C — Guided operations and cohort evidence

Status: **Pending**

- Define Guided capacity, scheduling, async-support limits, and overflow behavior
  before selling it.
- Seed a controlled cohort with explicit Match beta grants, then validate one
  real journey from signup through debrief.
- Record Daniel + Lissa acceptance evidence and select the next milestone from
  observed gaps.

### Roadmap note — 2026-08-04 (Batch 7B)

- **Milestone change:** none. The active lane remains connected-beta foundations.
- **Scope clarification:** beta completeness now includes a route-capability
  ledger so original functionality cannot disappear during consolidation.
- **Commercial correction:** legacy Signal Audit, Dating Reset, and Wingman
  checkout pages are recorded as retired presentation, not alternate ways to
  grant Member/Insight/Match/Guided access.
- **Completion rule:** backend billing code, approved-design UI hookup, and live
  runtime evidence are tracked separately; none substitutes for the others.

## Definition of done

The milestone is complete when:

- Only the five approved primary destinations appear in signed-in navigation.
- Echo is persistent and provides a useful next action without overclaiming.
- No working legacy route is orphaned.
- Readiness, search activity, and market availability are visibly distinct.
- Member, Insight, Match, and Guided are represented by one backend contract;
  Match/Guided search access is enforced server-side.
- Stripe lifecycle events idempotently grant, preserve, or revoke non-beta paid
  access without overriding founder grants or selling unstaffed Guided service.
- Landing and signed-in experiences tell the same story.
- Automated typecheck, web tests, API tests, schema drift, lint, and voice lint
  pass on the final branch.
- Daniel and Lissa complete an acceptance review of the same canonical build.
- A connected beta proves web, API, auth/session, Postgres, and plan assignment
  together; a static artifact does not satisfy this gate.
- The next milestone is selected from evidence, not from feature enthusiasm.

## Explicitly parked during this milestone

- Broad visual reinvention.
- New primary navigation destinations.
- Dating-app OAuth.
- After-dark mode.
- Connector expansion that does not directly unblock the approved v1 journey.
- Monetization changes unrelated to validating the simplified shell.
- Selling or reviving the legacy Signal Audit, Dating Reset, or Wingman offers as
  canonical beta packages.
