# MatchLab Club Delivery Roadmap

Last updated: 2026-08-21

This is the canonical delivery roadmap. `VISION.md` holds the long-range strategy;
this file controls what the team is building now. Update this document and the
README in the same change whenever the active milestone, destination model, or
definition of done changes.

## Active milestone

**Close the full-beta integration gaps in the approved Echo-led experience, then
prove the same build in a connected runtime.**

The approved journey is:

> Get known → understand yourself → know who you really want → wait honestly →
> receive one considered introduction → meet → learn afterward.

The design contract remains frozen: Today, Matches, My MatchLab, Journey, and
Play are the only primary destinations; Echo owns guidance; pages execute work
and preserve the durable record. The landing page is the final alignment pass,
after the signed-in journey and backend claims are accepted.

This milestone is no longer allowed to use “complete” without a qualifier:

- **Code-proven** means the branch compiles and the relevant automated repository
  tests pass.
- **Runtime-proven** means the real hosted web, API, OIDC/session, Postgres, and
  Stripe path passed end to end.
- **Accepted** means Daniel and Lissa reviewed that same connected build.
- **Parked** means intentionally excluded from beta with a written reason.

## Current truth audit — 2026-08-21

This snapshot supersedes ambiguous completion language in the historical batch
log below. The audit reviewed all 115 files changed by draft PR #2, the mounted
API and web entry points, 55 API routers exposing 276 route handlers, 108 web
route nodes, the selected database schemas, runtime/operations documentation,
and the final CI logs.

Repository evidence on audit head `fc341c6`:

- API: 101 test files passed, 2 provider-dependent OCR files skipped; 995 tests
  passed and 8 skipped against Postgres 16.
- Web: 31 test files and all 219 tests passed.
- Full monorepo typecheck, lint, schema drift, Echo voice lint, and the production
  web build passed.
- The review-artifact upload did **not** pass: GitHub rejected it because the
  repository artifact quota was full. The workflow marks that step
  best-effort, so the overall run remained green.
- Green repository tests are not browser E2E evidence and do not prove hosted
  OIDC, cookies, Stripe callbacks, background jobs, backups, or human acceptance.

### Authoritative beta capability matrix

| Member job / platform area   | Actual code truth                                                                                                                                                                                                                                                    | Status now                                  | Blocking proof or work                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Echo orchestration           | Companion API owns one next move across proposals, unread conversations, commitments, reviewed learning, and profile uncertainty. Confirm/correct/dismiss writes use the existing wellness record.                                                                   | **Code-proven; runtime pending**            | Prove a hosted Echo-directed journey and verify every selected write refreshes My MatchLab/Journey across devices.                                                        |
| Signed-in shell              | Five overview destinations exist. The audit found persistent numeric readiness, reward, and competing matching-action components plus a broad legacy “Show all” drawer. Batch 8E removed those active-shell conflicts and kept only deliberate secondary workspaces. | **Code-proven; route disposition ongoing**  | Prove the corrected shell in the connected runtime; then complete the remaining route disposition ledger instead of exposing legacy route parity.                         |
| My MatchLab / Mirror         | Account summary, Mirror, wellness, journal, photos, imports, consent, matching, and billing contracts are durable. My MatchLab reads real account state.                                                                                                             | **Partial**                                 | Consolidate the selected sources into one understandable member model; prove correction, permission changes, and cross-device visibility.                                 |
| Quiz Lab and bounded Play    | Quiz results persist/dedupe/claim and write Journey events; six selected Play families have durable records represented in Journey; selected Play deletion is tested.                                                                                                | **Code-proven; runtime and export pending** | Hosted signup/claim/retake proof, explicit wellness-save acceptance, and export parity.                                                                                   |
| Matches                      | Proposal decisions, mutual yes, reveal consent, connections, messages, unmatch, report/block, reveal-safe profile, starters, date ideas, persisted date completion, private debrief, and confirm-before-learning are implemented.                                    | **Code-proven; runtime pending**            | Prove the proposal-to-learning journey in the connected runtime.                                                                                                          |
| Commercial plans and billing | Member/Insight/Match/Guided catalog, Match/Guided search entitlement, Stripe lifecycle reconciliation, Checkout, status, and Portal exist; Guided selling is disabled.                                                                                               | **Code-proven; runtime pending**            | Configure real test-mode Prices/webhook/OIDC/domains and prove purchase, cancellation, payment recovery, and founder-grant behavior.                                      |
| Privacy and member control   | Batch 9B adds one registry used by export and both deletion paths, explicit retention/consent dispositions, secret sanitization, AI-revocation cleanup, and schema drift detection.                                                                                  | **Code-proven; runtime pending**            | Prove export, consent revocation, and deletion against one hosted account; object-storage deletion and operational retention evidence remain open.                        |
| Production operations        | Connected-beta startup validation exists and fails closed on key config errors.                                                                                                                                                                                      | **Pending; full-beta blocker**              | Move jobs out of API replicas, use versioned migrations, add headers/CSP/rate limits/body scopes, prove backup/restore, monitoring/rollback, and staff safety escalation. |
| Connected acceptance         | No hosted build currently proves signup through debrief, billing recovery, account claim, deletion/export, or Daniel + Lissa review.                                                                                                                                 | **Not proven**                              | Deploy one canonical runtime and execute the blocking browser journeys against it.                                                                                        |
| Landing page                 | Earlier copy was partially aligned, but final promise/design alignment is intentionally deferred.                                                                                                                                                                    | **Deferred by founder decision**            | Update only after the signed-in backend-connected experience is accepted.                                                                                                 |

### Roadmap reconciliation delta — 2026-08-21

| Before this audit                                                | After this audit                                                                               | Why                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| “Complete” often mixed code, runtime, and acceptance             | Every status is qualified as code-proven, runtime-proven, accepted, partial, or parked         | Prevent reassurance from substituting for evidence                                              |
| Matches was described as a complete waiting-to-debrief lifecycle | Proposal-to-connection is real; date/debrief persistence is explicitly open                    | The UI sequence was ahead of the data model                                                     |
| Echo pages were qualitative, so shell drift was assumed closed   | Persistent shell score/reward and competing-action code was found and moved into Batch 8E      | Echo must drive the whole signed-in experience, not only Today and `/echo`                      |
| Five primary links were treated as consolidation                 | 108 web route nodes and a legacy tool drawer require an explicit disposition/decommission pass | Hiding route parity behind “Show all” is not consolidation                                      |
| Green CI was summarized as successful artifact publication       | Build success and upload failure are reported separately                                       | GitHub artifact quota currently blocks a fresh exact-build review download                      |
| Controlled-beta foundations were the active lane                 | Full-beta integration closure plus connected proof is the active lane; landing remains last    | Cofounder launch expectations require selected features and safety gates, not a shell-only beta |

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

## Roadmap implementation delta — 2026-08-21, connected runtime safety

The milestone and product direction did not change. This slice converts the
connected-beta environment from a documented checklist into an enforced startup
contract.

| Area               | Previous roadmap                                                                                                  | Updated implementation contract                                                                                                                                                                   | Why                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Connected runtime  | Required variables were documented, but a deployment could boot with migration fallbacks or missing beta settings | `CONNECTED_BETA=true` fails startup unless production mode, public origins, non-Replit OIDC, Postgres, Stripe test mode, canonical Price IDs, secure cookies, and the handoff secret are explicit | A controlled beta must fail closed instead of appearing healthy while auth or billing silently uses the wrong environment. |
| Development auth   | `NODE_ENV !== production` enabled the seeded test-login                                                           | Development auth requires both non-production mode and `ALLOW_DEV_AUTH=true`; connected beta rejects the flag                                                                                     | An unset or mistaken `NODE_ENV` must never expose an auth bypass.                                                          |
| Product and design | Echo Journey, five destinations, and capability consolidation were protected                                      | Unchanged                                                                                                                                                                                         | Runtime hardening serves the approved experience; it does not restore legacy pages or expand visible feature count.        |
| Live evidence      | Hosted runtime proof remained open                                                                                | Still open after code validation                                                                                                                                                                  | Preflight proves configuration coherence, not a real signup, payment, cancellation, or recovery.                           |

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

Disposition is not route parity. The original feature set is intentionally too
large for the beta. A useful behavior may be absorbed into Echo's orchestration,
combined with adjacent tools into one coherent job, shown only at the moment it
is relevant, or parked entirely. Do not recreate the old tool drawer inside new
cards, keep a legacy route merely because it exists, or measure migration by the
number of old pages still visible.

| Original capability family                                                                    | Beta home                     | Disposition                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matching, Future Connections, proposals, reveal, safety, date, debrief                        | **Matches**                   | Consolidate into the honest lifecycle; keep deep preferences secondary.                                                                            |
| Profile, readiness evidence, wellness, life context, photos, voice, verification, permissions | **My MatchLab**               | Preserve under the member model and detailed workspace.                                                                                            |
| Timeline, journal, patterns, scorecard/trends, wins, weekly plan                              | **Journey**                   | Use server-backed history; preserve working tools contextually.                                                                                    |
| Quizzes, games, results                                                                       | **Play**                      | Preserve through the bounded catalog and saved outcomes.                                                                                           |
| Echo, coaching, preparation, reply help, reflection                                           | **Today / persistent Echo**   | Reuse the working contracts through one next action; do not restore a tool dashboard.                                                              |
| Signal Audit, Dating Reset, Wingman public checkout                                           | **Canonical billing surface** | Retired commercial presentation. Must be replaced by authenticated Insight/Match checkout before beta; legacy links cannot grant canonical access. |
| Referrals/sharing, broad integrations, Experiments, audio-native claims                       | **None in beta**              | Explicitly parked until the core journey produces evidence.                                                                                        |

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

Status: **Proposal-to-connection code-proven; date/debrief state integration pending**

- Present controlled-pilot waiting, proposal, mutual reveal, date, and debrief as
  one legible lifecycle. The visual sequence exists, but date planned/completed
  and debrief are not yet persisted on the connection lifecycle.
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
  **Partial earlier pass; final alignment deferred by founder decision.** Public
  copy separates readiness from availability, but final promise/design alignment
  waits for acceptance of the connected signed-in experience.
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

Status: **Complete in `agent/echo-shell-phase-0`; validated by CI run #79**

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

Status: **Backend and approved-design UI hookup validated by CI run #91; connected-runtime evidence pending**

- Create authenticated canonical-plan Checkout Sessions with member and plan
  metadata; legacy public Payment Links must not assign beta packages.
  **Implemented in code.** Only Insight and Match use server-owned Price IDs;
  Guided remains disabled, founder grants cannot be double-sold, and an existing
  live/recovery subscription routes to account management instead of creating a
  duplicate.
- Add account billing status and Stripe Billing Portal controls for cancellation,
  payment recovery, and invoice history. **Implemented as authenticated API
  controls and wired into My MatchLab. The canonical pricing surface reads the
  server-owned catalog, opens authenticated Insight/Match Checkout Sessions, and
  keeps Guided unavailable.**
- Replace the retired Signal Audit, Dating Reset, and Wingman presentation
  without recreating it inside the new shell. **Implemented in the UI batch:**
  legacy checkout URLs hand into one canonical package decision; success waits
  for server-confirmed subscription truth; cancellation preserves the member's
  current access; My MatchLab owns billing status and Portal access.
- Replace the runtime's hard dependency on the Replit OIDC client ID and request
  host with explicit `OIDC_CLIENT_ID`, `API_PUBLIC_URL`, and `WEB_PUBLIC_URL`
  settings while retaining documented migration fallbacks. **Implemented in
  code; provider and domain validation remain open.**
- Run web, API, session/auth, Postgres, and Stripe test mode together on the
  connected beta domain. **Pending deployment evidence.**

##### Connected runtime safety slice — 2026-08-21

Status: **Complete in `agent/echo-shell-phase-0`; validated by CI run #102**

- Opt a hosted beta into strict validation with `CONNECTED_BETA=true`.
- Refuse startup when API/web origins, non-Replit OIDC, Postgres, Stripe test
  mode, canonical Price IDs, secure cookies, or the anonymous-handoff signing
  secret are absent or inconsistent.
- Require `ALLOW_DEV_AUTH=true` in addition to a non-production environment
  before the seeded development login can mount.
- Keep Guided billing disabled and reject it in the connected-beta contract.
- Preserve provider choice as an environment decision; no hosting vendor is
  silently selected by this code slice.
- Keep the live signup → checkout → entitlement → cancellation/recovery journey
  open until it is executed against the deployed runtime.

#### Batch 7C — Guided operations and cohort evidence

Status: **Pending**

- Define Guided capacity, scheduling, async-support limits, and overflow behavior
  before selling it.
- Seed a controlled cohort with explicit Match beta grants, then validate one
  real journey from signup through debrief.
- Record Daniel + Lissa acceptance evidence and select the next milestone from
  observed gaps.

### Batch 8 — Full-beta feature integration and acceptance

Status: **In progress in `agent/echo-shell-phase-0`; integration audit opened 2026-08-21**

A green repository and a coherent connected runtime are necessary, but they do
not prove that every feature selected for the beta works as one product. Full
beta therefore has a feature-integration gate in addition to the controlled-beta
runtime gate.

- Maintain one authoritative beta capability matrix. Every original capability
  remains consolidated, contextual, or parked; only capabilities explicitly
  selected for beta must pass the full integration contract.
- For each included member job, prove: canonical entry point, authenticated or
  anonymous ownership as intended, durable server persistence, safe retry or
  deduplication, account-claim behavior where applicable, visible effect in
  My MatchLab/Mirror or Journey, intentional matching use or non-use,
  consent/export/deletion behavior, and automated end-to-end acceptance.
- Reconcile Play before full beta:
  - Canonical Quiz Lab results already persist derived archetypes and dimensions,
    dedupe retakes, survive anonymous claim, record Journey activity, and feed
    the quiz signal lane.
  - Wellness-mapped quiz answers currently enter the wellness profile only when
    the member explicitly saves them; this interaction and its language require
    connected-runtime acceptance.
  - Care Dialect is server-scored and participates in compatibility reasoning.
  - The legacy standalone `/quiz` was browser-only and pointed at a retired
    offer. **Consolidated in Batch 8A:** the URL now redirects into canonical
    Quiz Lab instead of preserving a second quiz system.
  - Browser-local result badges are a convenience cache, not the source of
    member truth. **Implemented in Batch 8A:** the catalog reads server-owned
    derived quiz rows and uses the browser cache only as a labeled degraded
    fallback.
- Run the same integration audit across the bounded Play games, My MatchLab
  profile sources, Echo handoffs, Journey events, and the complete Matches
  lifecycle. Presence of a route or a readiness counter alone does not pass.
- Add blocking connected-runtime journeys for the chosen beta paths, including
  signup/claim, quiz-to-profile, package checkout, search/proposal/reveal,
  report/block, date/debrief, cancellation, and account deletion/export.
- Complete cofounder acceptance against the same deployed build and cohort
  policy that beta members will use.

#### Batch 8A — Canonical quiz record and consolidation

Status: **Complete in code; validated by CI run #115. Connected-runtime evidence remains pending.**

- Make the server-owned derived result the Quiz Lab history across devices;
  browser storage remains a degraded display fallback only.
- Keep automatic model updates limited to the derived archetype and informed
  dimensions. Preserve the member's explicit choice before writing granular
  wellness-answer mappings.
- Show saving, confirmed, and failed profile-sync states honestly. Never claim
  the Mirror learned a result that the server did not accept.
- Redirect the browser-only legacy `/quiz` into Quiz Lab and remove its retired
  package handoff from the beta journey.
- Remove numeric readiness and point rewards from the quiz result so Play follows
  the same evidence-without-worth-scoring contract as the primary experience.
- Add focused result-history regression tests. Connected signup → quiz → account
  claim → Mirror/Journey proof remains open until the hosted runtime exists.
- Validation evidence: CI run #115 passed full monorepo typecheck, lint, schema
  drift, voice lint, web tests/build, artifact packaging, and the complete
  Postgres-backed API suite.

#### Batch 8B — Play record-to-Journey integration

Status: **Complete in code; validated by CI run #117. Connected-runtime evidence remains pending.**

- Keep the bounded six-activity Play catalog unchanged. This batch integrates the
  selected member jobs; it does not restore retired games or add navigation.
- Read Daily Spark, This or That, Scenario Reels, Would You Rather, Quiz Lab, and
  Time Capsule history from their durable server records into the Journey
  timeline, with links back to the canonical activity.
- Record direct Play saves as Journey signal events so weekly summaries and the
  visible record agree that a saved activity happened.
- Count Daily Spark, Green/Red Flags, and Care Dialect activity in the shared
  consistency-day source of truth; their profile contribution no longer moves
  without the corresponding day being recognized.
- Keep answer content out of generic Journey event metadata. The member can open
  the owning activity to review the detailed record.
- Add a focused six-family history regression. CI run #117 passed full monorepo
  typecheck, lint, schema drift, voice lint, web tests/build, artifact packaging,
  and the complete Postgres-backed API suite.
- Connected signup/claim and cross-device Journey proof remain open. Play-table
  export/deletion parity remains a blocking Batch 9 privacy item.

##### Roadmap delta — 2026-08-21 (Batch 8B)

| Decision        | Before                                                                                             | After                                                                                           | Why                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Play completion | A route and signal count could be mistaken for a complete activity integration                     | Every activity in the bounded catalog now has a durable record represented in Journey           | Members need to see what became part of their MatchLab history              |
| Consistency     | Daily Spark, Flags, and Care Dialect could move profile evidence without counting the activity day | Those sources now share the same activity-day truth as the other selected games                 | The product should not contradict itself about whether the member showed up |
| Scope           | Audit could be misread as permission to restore old games                                          | Catalog and navigation remain unchanged                                                         | Consolidation, not route parity, remains binding                            |
| Remaining proof | Repository health could be read as full completion                                                 | Hosted account claim, cross-device history, privacy export/deletion, and E2E evidence stay open | Code truth and launch evidence are separate gates                           |

### Batch 9 — Production safety and launch operations

Status: **Pending; required before an unrestricted full-beta launch**

#### Batch 9A — Play deletion parity

Status: **Complete in code; validated by CI run #119. Full export/retention parity remains pending.**

- Route both account-deletion endpoints through one typed Play-data purge registry
  so the legacy and confirmed GDPR paths cannot drift apart.
- Hard-delete direct Would You Rather, Daily Spark, Flags, Scenario, Prediction,
  Time Capsule, Care Dialect, and Journey-event rows. Quiz Lab and This or That
  remain covered by the existing imported-source purge.
- Return per-table deletion counts only on the confirmed receipt; never place raw
  answer or reflection content in deletion logs.
- Add a Postgres-backed regression that seeds every selected Play record family,
  deletes the account, and proves every first-party row is gone.
- Keep the larger privacy gate open: the downloadable export currently omits
  Play and other first-party families, and retention/consent-revocation coverage
  still needs a complete table registry and blocking drift test.

##### Roadmap delta — 2026-08-21 (Batch 9A)

| Decision                | Before                                                                             | After                                                                                           | Why                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sequencing              | Privacy deletion parity sat entirely behind the broader production-hardening batch | Play deletion parity moved forward immediately after Play became a beta-selected durable record | A beta feature cannot be considered integrated while account deletion can orphan its data |
| Deletion implementation | Two deletion paths maintained overlapping table lists independently                | One shared Play purge registry serves both paths                                                | The old structure made silent privacy drift likely                                        |
| Privacy completion      | Export, deletion, retention, and consent were one open line                        | Play deletion is complete; export and broader retention/consent parity stay explicitly open     | Passing one privacy operation must not be presented as passing all of them                |
| Product scope           | Selected Play activities remained bounded                                          | Unchanged                                                                                       | This is safety integration, not feature expansion                                         |

A small founder-controlled cohort may run on one explicitly constrained API
instance while this batch is completed. It must not be described or operated as
a horizontally scaled public beta.

- Move scheduled matching, proposal, Echo, import, retention, cleanup, and digest
  work out of every API process into a single-executor worker or queue. Prove
  idempotency and duplicate-delivery safety before adding API replicas.
- Replace production `drizzle-kit push` and the current post-merge schema push
  with committed, versioned migrations plus a reviewed deploy/rollback
  procedure.
- Add production HTTP hardening: security headers and Content Security Policy,
  global and sensitive-route rate limits, and a small default request-body limit
  with larger limits scoped only to real upload endpoints.
- Configure automated Postgres backups, retention, and a restore drill. A backup
  is not accepted until a restore has been tested.
- Verify error monitoring, job-failure alerts, health checks, and an incident
  response/rollback runbook on the deployed environment.
- Reconcile account export, account deletion, admin deletion, retention jobs,
  and consent revocation against every table that stores member data. Add a
  blocking guard when a new first-party table is missing from export or purge.
- Staff report/escalation handling and define response ownership before inviting
  members outside the founder-controlled cohort.
- Run a launch rehearsal with rollback, lost-webhook recovery, database restore,
  duplicate-job, and safety-report scenarios.

### Roadmap delta — 2026-08-21 (full-beta clarification)

| Decision             | Before this audit                                                                | After this audit                                                                                                                             | Why                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Release claim        | Green code plus a connected runtime could be read as the remaining beta boundary | Those gates qualify a controlled beta only; full-feature beta additionally requires Batch 8 integration evidence                             | CI proves contracts compile and tests pass, not that every selected member job forms a complete product journey            |
| Feature completeness | Original capability disposition was tracked at the family level                  | Every beta-included capability now needs a route-to-record-to-learning acceptance row                                                        | The quiz audit found a healthy canonical server path alongside a local-only legacy path and local-only result presentation |
| Quiz truth           | “Quizzes, games, results” could be read as uniformly complete                    | Canonical Quiz Lab and Care Dialect are partially/strongly integrated; legacy `/quiz` and server-backed result history remain open decisions | We must not tell beta members or founders that all quizzes update the profile when they do not                             |
| Scope                | Preserve useful original capability without route parity                         | Unchanged                                                                                                                                    | This is a verification and consolidation gate, not permission to restore the old tool drawer                               |

### Roadmap note — 2026-08-04 (Batch 7B)

- **Milestone change:** none. The active lane remains connected-beta foundations.
- **Scope clarification:** beta completeness now includes a route-capability
  ledger so original functionality cannot disappear during consolidation.
- **Commercial correction:** legacy Signal Audit, Dating Reset, and Wingman
  checkout pages are recorded as retired presentation, not alternate ways to
  grant Member/Insight/Match/Guided access.
- **Completion rule:** backend billing code, approved-design UI hookup, and live
  runtime evidence are tracked separately; none substitutes for the others.
- **Migration clarification:** accounting for original functionality does not
  mean preserving every page or feature. Capabilities are consolidated around a
  better member job, made contextual, or parked; visible route count is not a
  beta-completeness metric.
- **Validation evidence:** CI run #91 passed full monorepo typecheck, lint,
  schema drift, voice lint, web tests/build, and the complete Postgres-backed API
  suite on the canonical package UI and typed billing contract.
- **Runtime-safety evidence:** CI run #102 passed the complete gate on the
  fail-closed beta preflight and explicit development-auth boundary. The web
  production build remains blocking; its downloadable artifact is best-effort
  when GitHub account storage is full.

## Batch 8C — Echo-owned orchestration

Status: **Complete and green**

Goal: make Echo the backend-owned guide for the signed-in experience instead of
letting individual pages independently decide what matters next.

- The companion endpoint now owns the single next move across the member
  journey. The priority is a pending proposal, an unread mutual conversation,
  an overdue commitment, then the highest-value profile uncertainty.
- Today consumes Echo's next move directly. It no longer fetches proposals,
  connections, and profile actions to assemble a separate client-side answer.
- Echo's member-facing companion language is qualitative. Internal coverage
  calculations may still detect that evidence changed, but members are not shown
  readiness points, threshold crossings, “matching is open,” or language saying
  profile work earned access to a person.
- The reusable next-action card now presents “Echo's suggestion,” removes point
  rewards, and distinguishes a meaningful profile review from match access or
  market availability.
- Deterministic policy tests lock the journey priority and prove profile
  suggestions cannot carry score rewards.

### Roadmap delta — 2026-08-21 (Echo ownership)

| Decision            | Before this batch                                                                            | After this batch                                                         | Why                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| One next move       | Today independently combined proposals, conversations, and matching-state actions            | Echo's backend chooses the move and Today renders that decision          | Echo cannot drive the experience if pages invent competing priorities                  |
| Progress language   | Companion reactions and answers still exposed score/threshold and “earned matching” language | Evidence changes are described as clearer or less certain understanding  | Profile depth is evidence, not human worth, package access, or entitlement to a person |
| Page responsibility | Pages could behave like separate tools under a persistent Echo widget                        | Echo directs; pages execute the workflow and preserve the durable record | This is the product's governing interaction model                                      |
| Scope               | Five destinations and the selected beta capability set                                       | Unchanged                                                                | This consolidates orchestration; it does not restore the old tool drawer               |

Validation evidence: [CI run #123](https://github.com/brutisthebrut-debug/MatchLabClub/actions/runs/32520056215)
passed full monorepo typecheck, lint, schema drift, voice lint, web tests and
production build, plus the complete Postgres-backed API suite.

Remaining Echo integration work is explicit: proposed learnings still need a
member confirmation/correction step before becoming profile truth; every
selected Play result must prove its structured write reaches Mirror/Journey; and
the connected runtime must prove the Echo-directed route through a real browser
session.

## Batch 8D — Echo-confirmed learning and loading integrity

Status: **Complete and green**

Goal: consolidate the existing confirm-before-write inference capability into
Echo's primary flow and ensure signed-in navigation never substitutes a blank
route or sample account data while real data is loading.

- Echo's backend next-move policy now detects pending member learnings after
  relationship activity and overdue commitments, but before generic profile
  work. The member is brought back to one confirm, correct, or dismiss decision.
- The existing wellness-inference table and endpoints remain the only write
  path. Confirmation writes the member's accepted or corrected wording through
  the normal wellness-answer contract; dismissal never changes profile truth.
- Echo's learning surface now has explicit loading, error, empty, confirmation,
  correction, dismissal, and mutation-failure states. Signed-in empty/error
  states no longer display example inferences.
- Confirmation refreshes Echo, wellness, matching-state, and Journey-summary
  caches together so the same durable write is visible across the experience.
- The router now renders a neutral Echo loading shell while lazy page code loads
  instead of temporarily replacing the whole application with a blank screen.
- The landing page remains intentionally untouched. Its final alignment is
  scheduled after the signed-in backend-connected journey is accepted.

Validation evidence: [CI run #128](https://github.com/brutisthebrut-debug/MatchLabClub/actions/runs/32522225255)
passed full monorepo typecheck, lint, schema drift, Echo voice lint, every web
test, the production web build, and the complete Postgres-backed API suite.
Artifact upload was attempted but rejected by GitHub's storage quota; that
best-effort step did not invalidate the code gate.

### Signed-in loading audit

| Destination | Account-backed inputs                                                    | Loading and failure contract                                                                                 |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Today       | Echo companion and matching state                                        | Waits for both; never builds a sample next move                                                              |
| Matches     | Matching state, proposals, and mutual connections                        | Waits for all three; never inserts sample people                                                             |
| My MatchLab | Account summary, matching, AI consent, and billing                       | Core account failure is explicit; billing degrades in its own bounded state                                  |
| Journey     | Durable insights, journal, dates, connections, Play records, and imports | Waits for every selected record family; never replaces history with a demo feed                              |
| Play        | Bounded activity catalog                                                 | Static catalog is immediately usable; each activity owns its account write state                             |
| Echo        | Companion, matching, notifications, and pending learnings                | Companion state remains primary; tentative learnings load and fail independently without sample substitution |

### Roadmap delta — 2026-08-21 (confirmed learning and loading)

| Decision                | Before this batch                                                                                    | After this batch                                                       | Why                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Confirm-before-write    | Backend and older wellness UI already supported it, but Echo did not prioritize the pending decision | Echo directs the member to the existing confirm/correct/dismiss record | Consolidation means moving a working capability into the right member job, not rebuilding it      |
| Cross-surface refresh   | Confirmation refreshed wellness and matching only                                                    | Echo and Journey summary refresh from the same durable write           | Every page must reflect one shared member record                                                  |
| Empty and loading truth | Pending-inference loading could look like example content; lazy routes could be blank                | Explicit loading/error/empty states and a router-level Echo loader     | A signed-in member should always know whether real account data is loading, empty, or unavailable |
| Landing page            | Could be changed while backend integration was still moving                                          | Explicitly deferred to the final alignment pass                        | The front door should describe the accepted product, not chase an unfinished backend              |

Remaining work after this batch: prove the confirm/correct journey in the
connected runtime, extend the same reviewed-learning contract to any additional
structured Echo inference selected for beta, and complete the route-to-record-
to-learning matrix before the final landing-page alignment.

## Batch 8E — Audit reconciliation and Echo shell truth

Status: **Code-proven; validated by CI run #133. Runtime acceptance pending**

Goal: make the persistent signed-in shell obey the same Echo-owned, qualitative
contract already applied to Today and the Echo page.

- Remove the global readiness reward watcher from the active application.
- Remove the persistent points-to-ready Match Path bar from the active shell.
- Make the sidebar suggestion read Echo's server-owned `nextMove`, not the
  matching endpoint's independent next-action list.
- Remove the broad legacy “Show all” tool drawer from signed-in navigation while
  retaining the small set of deliberately secondary workspaces.
- Remove numeric readiness, lane deltas, “matching is open,” and point rewards
  from the persistent Echo panel.
- Keep internal evidence scores available to deterministic backend logic and
  diagnostics; do not present them as worth, progress toward a person, or an
  entitlement unlock.
- Fix the toast test harness so accessibility metadata does not leak onto a DOM
  element and hide real React warnings.

Validation evidence: [CI run #133](https://github.com/brutisthebrut-debug/MatchLabClub/actions/runs/32524782792)
passed full monorepo typecheck, lint, schema drift, Echo voice lint, all 219 web
tests, the production web build, and the complete Postgres-backed API suite. The
obsolete DOM warning is gone. Recharts still emits zero-size warnings under
jsdom; that is tracked as test-harness cleanup and is not connected-browser
loading evidence. GitHub again rejected best-effort artifact upload because the
repository quota remains full.

After this code-proven correction, the next implementation slice is the persisted
Matches date/debrief state machine, followed by the complete privacy registry
and connected-runtime acceptance. The landing page remains last.

## Batch 8F — Persisted date, debrief, and Echo learning

Status: **Code-proven; connected-runtime acceptance pending**

Goal: close the gap where Matches presented date and debrief stages that the
connection record could not remember.

- Persist one shared first-date plan and completion state on the mutual
  connection; both members see the same relationship fact.
- Keep each debrief private to its author by linking the existing post-date note
  to the connection without exposing it to the counterpart.
- Derive the member's connection stage from durable records: connected, date
  planned, date completed, or debrief saved.
- Let Echo prioritize a completed date that still needs a debrief, after a real
  proposal or unread mutual conversation and before generic profile work.
- Create one bounded, deterministic tentative learning from the member's saved
  debrief. It remains pending until the existing confirm/correct/dismiss path
  resolves it; saving a debrief never writes profile truth directly.
- Reuse the existing Journey event, post-date note, wellness inference, Matches,
  and Echo contracts instead of adding a parallel date product.
- Replace the linked debrief's remaining Wingman-era handoff and legacy routes
  with Echo, Matches, Journey, and the approved confirmation flow.
- Add Postgres-backed regression coverage for shared plan/completion, private
  debrief visibility, tentative learning, ownership, premature writes, and
  duplicate protection.

### Roadmap delta — 2026-08-21 (Batch 8F)

| Decision          | Before                                                                                                      | After                                                                                     | Why                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Date lifecycle    | Date ideas and UI stages existed without connection-level state                                             | Plan and completion are durable shared connection facts                                   | The product must remember the action it tells members to take                |
| Debrief ownership | Generic post-date notes were durable but disconnected from a MatchLab introduction                          | A debrief can be privately linked to the member's mutual connection                       | The counterpart must never see someone else's reflection                     |
| Echo learning     | Post-date coverage affected derived readiness, but the connection flow did not create a reviewable learning | A linked debrief creates a tentative inference that still requires member approval        | Echo should learn from real dates without silently rewriting the profile     |
| Product surface   | The debrief still returned to Wingman-era tools                                                             | The flow returns to Echo, Matches, and Journey                                            | Consolidation means preserving the capability inside the approved experience |
| Scope             | A general multi-date relationship tracker was not selected for beta                                         | The beta state machine covers the first considered introduction through its first debrief | Close the promised journey without expanding into relationship management    |

CI run #138 passed full monorepo typecheck, lint, schema drift, voice lint, web
tests/build, the complete Postgres-backed API suite, and the versioned migration.
The next lane is the authoritative first-party privacy registry, followed by
connected-runtime acceptance. The landing page remains last.

## Batch 9B — Authoritative first-party privacy registry

Status: **Code-proven; connected-runtime acceptance pending**

- Declare each first-party member-data table once with its ownership rule,
  export treatment, retention class, and AI-consent disposition.
- Build downloadable export datasets from that registry while omitting OAuth
  and one-time secrets and sanitizing session, push, verification, and Stripe
  references.
- Use the same registry as a final hard-delete safety net in both account
  closing paths, preserving the existing member receipt while catching tables
  added after the legacy lists.
- Remove unconfirmed wellness inference and undismissed Echo observations when
  account-level AI content consent is revoked; future AI calls remain blocked
  by the existing consent gate.
- Discover directly user-linked Drizzle tables in a drift test and fail when a
  new table has no privacy disposition.
- Prove deletion for previously uncovered Wingman ratings, Cosmic charts,
  verification state, and Mirror digest preferences with Postgres coverage.

This is an engineering completeness control, not a legal-certification claim.
Connected acceptance, object-storage deletion evidence, and scheduled retention
operations remain separate launch gates.

CI run #141 passed full monorepo typecheck, lint, schema drift, Echo voice lint,
web tests/build, and the complete Postgres-backed API suite, including the new
registry drift and previously uncovered deletion regressions.

## Definition of done

The milestone is complete when:

- Only the five approved primary destinations appear in signed-in navigation.
- Echo is persistent and provides a useful next action without overclaiming.
- Every original capability has an explicit integrated, contextual, or parked
  disposition; no working behavior disappears silently.
- Every capability selected for beta passes its route-to-record-to-learning
  matrix, including persistence, ownership/claim, profile or Journey effect,
  consent/deletion, and connected end-to-end acceptance.
- No browser-local result or readiness counter is treated as proof of durable
  profile integration.
- Readiness, search activity, and market availability are visibly distinct.
- Member, Insight, Match, and Guided are represented by one backend contract;
  Match/Guided search access is enforced server-side.
- Stripe lifecycle events idempotently grant, preserve, or revoke non-beta paid
  access without overriding founder grants or selling unstaffed Guided service.
- Landing and signed-in experiences tell the same story.
- Automated typecheck, web tests, API tests, schema drift, lint, and voice lint
  pass on the final branch.
- Daniel and Lissa complete an acceptance review of the same canonical build.
- A connected beta refuses to boot unless its provider-neutral runtime, non-Replit
  OIDC, secure origin boundary, Postgres, Stripe test mode, and canonical Price IDs
  pass the startup preflight.
- A connected beta proves web, API, auth/session, Postgres, and plan assignment
  together; a static artifact does not satisfy this gate.
- Full beta runs scheduled work through a single-executor model, deploys only
  versioned database migrations, and has verified HTTP hardening, monitoring,
  backup/restore, privacy export/deletion, and staffed safety operations.
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
