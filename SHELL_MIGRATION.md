# Member shell migration

Last updated: 2026-08-26

This file tracks the production migration from the legacy route-heavy shell to
the approved MatchLab v1 information architecture.

## Founder decision

Shell migration is proceeding while Stripe remains deferred. This does not open
checkout, activate a paid product, or permit a real-member paid cutover.
Checkout remains fail-closed behind the existing server allowlist. Stripe test
mode, release configuration, and founder/legal approval remain separate release
gates.

## Migration completion standard

A destination is not complete merely because it links to an older page. Each
capability is complete only when:

- the canonical destination owns the live data path and member-facing workflow;
- saved work is reopenable, and version/provenance history is preserved;
- source storage, Echo use, confirmed learning, and matching use remain
  distinguishable;
- duplicate entry points redirect only after their behavior is absorbed;
- regression evidence proves records and deep links were not orphaned.

Legacy links inside a canonical destination are explicitly transitional until
those conditions are met.

## Segment 1: navigation spine and destination hubs

State: merged to `main` and verified.

Verification: PR #5 merged as `4c579649`; GitHub Actions run `32771160856`
passed typecheck, lint, schema drift, voice lint, 29 web test files with 228
tests, ordered migrations through `0045`, and 99 API test files with 911 tests
on clean Postgres 16. The 8 skipped API tests are the optional OCR suites.

The authenticated shell now has five member destinations:

1. Today
2. Matches
3. My MatchLab
4. Journey
5. Play

Trust & Data is directly accessible, and Echo remains persistent across the
authenticated shell. The global numeric match-path bar and sidebar readiness
level have been removed from the shell.

Existing routes and records are not deleted. Legacy pages remain reachable from
curated cards while later segments absorb their workflows into the canonical
destinations.

## Route migration matrix

| New destination | Preserved legacy capabilities | Segment 1 disposition |
| --- | --- | --- |
| Today | Echo, message coaching, rehearsal, date preparation, immediate next actions | Canonical hub live; legacy workflows linked and highlighted as Today |
| Matches | matching state, considered introductions, match threads, photos, verification, future connections | Existing Matches lifecycle retained; related legacy routes highlighted as Matches |
| My MatchLab | Mirror, profile audit and reader, profile/photo work, archetype, connection style, care dialect, wellness context | Canonical hub live; legacy workflows linked and highlighted as My MatchLab |
| Journey | journal, date notes, debriefs, timeline, wins, experiments, follow-up, weekly reflection | Canonical hub live; legacy workflows linked and highlighted as Journey |
| Play | Quiz Lab, This or That, Would You Rather, Daily Spark, scenarios, prediction, time capsule, Cosmic | Canonical hub live; legacy workflows linked and highlighted as Play |
| Trust & Data | connections, imports, vault, user control, account, sessions, privacy, export, deletion | Canonical hub live; controls remain directly accessible |

## Compatibility rules

- Old URLs continue to resolve to their existing pages.
- The canonical navigation state follows the destination that owns each legacy
  route, including the most specific nested routes.
- Completing or skipping onboarding now lands on Today.
- Public marketing, legal, partner, feedback, and checkout routes remain outside
  the authenticated member shell.
- Quiz Lab and Gallery can use the authenticated shell for signed-in members
  while remaining publicly reachable for guests.

## Segment 2: consent-first onboarding

State: merged to `main` and verified.

- Starter answers are explicitly submitted as coaching-only.
- Onboarding no longer displays a readiness score, points, a readiness climb, or
  a percentage of the member "mapped."
- The source step explains storage, Echo use, confirmed learning, and matching
  use as four separate choices.
- Echo's initial portrait is framed as a draft reflection, not confirmed
  learning.
- Skipping and completing onboarding both return to Today.
- Regression coverage proves onboarding capture cannot infer matching, research,
  or all-use consent.
- PR #7 merged as `54c6491c`; GitHub Actions run `32772997609` passed
  typecheck, lint, schema drift, voice lint, 30 web files with 231 tests,
  ordered migrations through `0045`, and 99 API files with 911 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3A: My MatchLab record and Profile Project core

State: merged to `main` and verified.

- My MatchLab now reads the live member portrait, member-authored wellness
  answers, saved profiles, and imported-source records. It does not substitute
  demo-member data when a signed-in query fails or has no result.
- Working Echo themes, direct member statements, profile versions, and source
  permissions are presented as different record types.
- Profile Project now uses the canonical saved-profile API for durable,
  reopenable versions and the server profile-rewrite API for Echo rewrites.
- An accepted rewrite saves as a new traceable version and leaves the source
  version unchanged.
- The duplicate Profile Glow-Up and Improve My Profile routes redirect into
  Profile Project after their shared rewrite capability was absorbed.
- Full audit reports and Photo Lab remain transitional links. They are not
  marked consolidated until their saved results are owned by Profile Project.
- PR #9 merged as `d6e1d6e9`; GitHub Actions run `32775412763`
  passed typecheck, lint, schema drift, voice lint, 31 web files with 238 tests,
  ordered migrations through `0045`, and 99 API files with 911 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3B1: durable Profile Project records

State: merged to `main` and verified.

- Profile Project now lists the member's live audit records and reopens both the
  current report and every saved report version.
- The canonical view preserves audit source/app provenance while presenting
  strengths, cautions, the written read, suggested bio, and action plan without
  displaying the legacy readiness score or grade.
- Profile Project now owns the persistent private photo collection: members can
  add and remove the actual account-backed photos from the canonical workflow.
- Storage remains separate from mutual-match reveal consent.
- Audit capture/generation, compatibility report routes, and Photo Lab ranking
  remain transitional. No route is retired in this slice because Photo Lab
  ranking results are still session-only and cannot yet be reopened.
- Regression helpers prove historical report versions reopen exactly and the
  member projection does not expose numeric grading.
- PR #11 merged as `c918569c`; GitHub Actions run `32778893927` passed
  typecheck, lint, schema drift, voice lint, 32 web files with 241 tests,
  ordered migrations through `0045`, and 99 API files with 911 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3B2: durable Photo Lab service

State: merged to `main` and verified.

- Profile Project now owns lineup configuration, analysis, saved run history,
  reopening, and member-directed deletion for the member's persistent photos.
- Every run is immutable and owner-scoped. It preserves source photo ids,
  member-declared composition inputs, the written result, provenance, and its
  timestamp so earlier analyses are not silently rewritten.
- Optional raw image bytes are used only during the request and discarded. They
  are never copied into the durable analysis record.
- Photo storage, analysis, and mutual-match reveal remain separate permissions;
  saving an analysis does not grant matching use.
- The canonical member view presents ordered roles, rationale, notes, and
  checklist guidance without the engine's numeric score or appearance grading.
- Photo Lab history is included in member data export and both account-deletion
  paths.
- The standalone `/photo-lab` page now redirects to Profile Project because
  its signed-in workflow and durable results have been absorbed. The anonymous
  ranking API remains as a compatibility capability rather than a second saved
  member surface.
- PR #13 merged as `adbbe4b3`; GitHub Actions run `32781612723` passed
  typecheck, lint, schema drift, voice lint, 33 web files with 242 tests,
  ordered migrations through `0046`, and 99 API files with 914 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3B3: evidence-validated Profile Project reads

State: merged to `main` and verified.

- Profile Project now owns the member's own-profile source capture, evidence
  validation, report generation, regeneration, saved record, and immutable
  report-version history.
- The canonical server operation validates the source before saving or
  generating. Missing, placeholder, wrong-format, implausible-age, and directly
  contradictory evidence returns an explicit `insufficient_evidence` response
  and cannot manufacture a score or conclusion.
- Failure states do not substitute a sample or leave a newly claimed result on
  screen. Earlier durable records remain unchanged and clearly historical.
- Generated reads remain proposed coaching observations. Saving or generating
  one does not confirm Mirror learning or grant matching use.
- `/start`, `/signal-check`, and `/diagnosis` redirect to the canonical
  capture. `/report/:id` preserves the audit id while reopening the same
  durable record in Profile Project history.
- Legacy source files remain for one redirect-monitoring cycle. Profile Reader
  is intentionally retained because it interprets another person's profile,
  rather than duplicating the member's own-profile audit.
- PR #15 merged as `9023e565`; GitHub Actions run `32783616570` passed
  typecheck, lint, schema drift, voice lint, 35 web files with 247 tests,
  ordered migrations through `0046`, and 100 API files with 925 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3C1: confirmed Mirror learning lifecycle

State: merged to `main` and verified.

- My MatchLab now owns an owner-scoped durable learning record with explicit
  source type, source reference, evidence label, observation, proposed text,
  member-confirmed text, confidence, and decision timestamps.
- Refreshing current grounded Mirror themes creates or updates proposals still
  under review. It never overwrites a confirmed or dismissed member decision.
- Confirmation, correction, dismissal, and returning a confirmation to review
  are distinct server transitions. A correction returns to proposed rather
  than silently becoming truth.
- Matching use is a separate default-closed, reversible grant available only
  after confirmation. Revoking that grant, rewriting, dismissing, or
  unconfirming pauses active candidacy server-side for review; confirmation
  never resumes candidacy automatically.
- My MatchLab presents the review workflow without sample fallback or a human
  worth/readiness score. The durable records are covered by member export and
  both account-deletion paths.
- No old relationship-language route was retired in this sub-segment because
  its behavior and saved record have not yet been fully absorbed.
- PR #17 merged as `ac48203c`; GitHub Actions run `32786262672` passed
  typecheck, lint, schema drift, voice lint, 36 web files with 250 tests,
  ordered migrations through `0047`, and 101 API files with 930 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3C2A: saved Communication context

State: merged to `main` and verified.

- My MatchLab replaces its relationship-language link list with one contextual
  Communication record backed by the member's real saved Care Dialect and
  relationship standards.
- Signed-in reads do not substitute demo profiles. Missing source records are
  shown honestly and keep their existing capture route available.
- Either saved source can create a proposed learning through the same durable
  confirmed-learning service. Derivation is server-side and owner-scoped;
  neither confirmation nor matching use is granted automatically.
- Existing confirmed or dismissed decisions are not overwritten by a later
  send from Communication.
- Care Dialect and Flags routes remain available for source capture. Connection
  Style and Personal Blueprint remain explicitly transitional until their
  result storage, capture, and deep links are absorbed.
- PR #20 merged as `a392bcb8`; GitHub Actions run `32787235430` passed
  typecheck, lint, schema drift, voice lint, 36 web files with 250 tests,
  ordered migrations through `0047`, and 101 API files with 932 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3C2B1: durable Communication lens sources

State: merged to `main` and verified.

- Connection Style and Personal Blueprint now save their complete validated
  inputs and full member-visible results in one owner-scoped Communication
  source table rather than relying on browser-only state.
- Returning members rehydrate those saved results. Authenticated Personal
  Blueprint users also migrate a legacy browser result into the server record
  before local state is removed.
- My MatchLab's Communication capability renders both saved sources and can
  send either into the existing review-only Mirror learning lifecycle. Nothing
  is auto-confirmed and matching use remains a separate grant.
- Removing a source also removes its derived learning. If that learning had
  matching approval, active candidacy is paused before removal.
- Communication sources are included in member export and both account-deletion
  paths. OpenAPI covers read, save, delete, and proposal behavior.
- The `/connection-style` and `/blueprint` deep links remain available because
  their capture forms have not yet been embedded in My MatchLab. This segment
  does not claim those routes are retired.
- PR #22 merged as `f73c486e`; GitHub Actions run `32789073048` passed
  typecheck, lint, schema drift, voice lint, 36 web files with 250 tests,
  ordered migrations through `0048`, and 102 API files with 936 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3C2B2: canonical Communication lens home

State: merged to `main` and verified.

- The real Connection Style and Personal Blueprint capture and result
  experiences now render inside My MatchLab's Communication capability.
- Saved-source cards open the correct embedded tool in place. Canonical query
  links reopen the same experience directly.
- `/connection-style` and `/blueprint` are now compatibility redirects into My
  MatchLab, so saved links survive without maintaining duplicate page ownership.
- Durable save, rehydration, legacy Blueprint migration, removal, export,
  confirmed-learning review, and separate matching permission remain unchanged.
- The Communication record refreshes immediately after a source is saved or
  removed. The obsolete Connection Style handoff into unrelated legacy tools
  was removed.
- PR #24 merged as `c5c214c2`; GitHub Actions run `32795941566` passed
  typecheck, lint, schema drift, voice lint, 37 web files with 253 tests,
  ordered migrations through `0048`, and 102 API files with 936 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3C3: member-governed Mirror changes

State: merged to `main` and verified.

- My MatchLab now owns a real Changes over time record grounded in durable
  Mirror learnings rather than the legacy audit score aggregation.
- Every current item retains source type, source reference, label, confidence,
  review status, and independent matching-use approval.
- Low-confidence and unconfirmed proposals remain visibly uncertain. A small,
  deterministic set of possible tensions is framed as contextual questions,
  never diagnoses or human-worth scores.
- Migration `0049` adds append-only proposal, refresh, confirmation,
  correction, dismissal, matching-permission, and source-removal history.
- The authenticated API is owner-scoped, fails closed, and the history is
  included in member export and account deletion.
- The founder-only `/copilot/demo` route and component are removed. Founder and
  administrative operations remain unchanged; any future public demo will use
  a normal demo profile on the main product surface after core migration.
- The old `/mirror/trends` endpoint remains temporarily for compatibility and
  is not used by the canonical My MatchLab surface.
- PR #26 merged as `4e8e472c`; GitHub Actions run `32797576360` passed
  typecheck, lint, schema drift, voice lint, 38 web files with 255 tests,
  ordered migrations through `0049`, and 102 API files with 937 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Review access checkpoint

- The existing development-only `/api/dev` seeded preview remains protected by
  both conditional mounting and handler-level production guards.
- Seeded preview identities now carry a persistent global Demo account flag on
  every screen. There is no shared password and no production auth bypass.
- PR #28 merged as `ffa99e75`; GitHub Actions run `32798465856` passed all
  required checks with 39 web files / 256 tests and 102 API files / 937 tests.

## Segment 3D1: canonical Journey record foundation

State: merged to `main` and verified.

- `/journey` now owns a real, authenticated chronological record rather than a
  generic card hub.
- Active journal reflections and post-date notes appear in one searchable,
  filterable thread with source provenance and durable source links.
- The owner-scoped API excludes deleted records and every other member's data,
  fails closed for anonymous callers, and does not substitute sample content.
- The existing weekly derived summary and its high-volume and isolation tests
  remain intact.
- Journal, date, and debrief routes remain available until their capture and
  editing behavior is fully embedded in Journey; this segment does not claim
  those workflows are retired.
- PR #29 merged as `c7dc7743`; GitHub Actions run `32801706555` passed
  typecheck, lint, schema drift, voice lint, 40 web files with 258 tests,
  ordered migrations through `0049`, and 102 API files with 939 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D2A: embedded Journey capture and editing

State: merged to `main` and verified.

- Journey now creates reflections and date debriefs directly inside the
  canonical record and persists them through the existing durable APIs.
- Every visible item retains its source id and full editable fields, so in-place
  edits update the original record rather than creating a duplicate or lossy
  shadow copy.
- Successful saves reload the unified record; failed saves remain visible and
  never claim success.
- The legacy journal/date pages and durable source links remain available until
  guided debrief and trash/restore parity are complete.
- PR #31 merged as `ead434e1`; GitHub Actions run `32802950036` passed
  typecheck, lint, schema drift, voice lint, 40 web files with 261 tests,
  ordered migrations through `0049`, and 102 API files with 939 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D2B1: recoverable Journey removal

State: merged to `main` and verified.

- Journey now exposes explicit active and Recently removed views over the same
  durable journal and post-date-note records.
- Removal is always soft and recoverable. Restore targets the exact source id,
  so it never creates a duplicate or shadow record.
- Both views require authentication, remain owner-scoped, and reject unknown
  view values. Mutation failures remain visible to the member.
- The OpenAPI contract and regression coverage now include active/trash
  separation, other-member isolation, removal, and restore endpoint routing.
- PR #33 merged as `1eebf6b`; GitHub Actions run `32803866085` passed
  typecheck, lint, schema drift, voice lint, 40 web files with 263 tests,
  ordered migrations through `0049`, and 102 API files with 941 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D2B2: guided date-debrief absorption

State: merged to `main` and verified.

- Journey now owns guided date debrief, with optional date/person/platform
  context, simplified reflection chips, outcome, and follow-up intent.
- The canonical post-date note saves before coaching output appears. A grounded
  deterministic result remains when optional AI enhancement is unavailable,
  while failed persistence never displays a false saved state.
- Anonymous note ids remain available for login claim handoff.
- `/copilot/debrief` is a compatibility redirect into Journey. The old component
  no longer owns a route.
- PR #35 merged as `679d7bd1`; GitHub Actions run `32864197737` passed
  typecheck, lint, schema drift, voice lint, 41 web files with 265 tests,
  ordered migrations through `0049`, and 102 API files with 941 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D2C: canonical Journey source-route retirement

State: merged to `main` and verified.

- `/mirror/journal` and `/mirror/dates` are compatibility redirects after their
  create, edit, search, kind filter, trash/restore, and guided capture behavior
  was absorbed by Journey.
- Redirects preserve search text, active/trash state, record kind, and exact
  durable source ids. Invalid ids are ignored instead of opening a different
  member record.
- Canonical source links now point directly into Journey and reopen the original
  active record for editing. Durable APIs and source data remain in place.
- PR #37 merged as `2f6babb5`; GitHub Actions run `32865345421` passed
  typecheck, lint, schema drift, voice lint, 41 web files with 267 tests,
  ordered migrations through `0049`, and 102 API files with 941 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D3A: durable win absorption

State: merged to `main` and verified.

- Journey now owns capture, editing, search/filter, exact deep links, removal,
  and restoration for dating wins while preserving `dating_wins` as the single
  durable source of truth.
- Win mutations are authenticated and owner-scoped. Removal remains soft and
  recoverable, and editing updates the original row instead of creating a
  shadow copy.
- `/progress/wins` is now a compatibility route into the canonical Journey
  wins view. The underlying API and account export/deletion behavior remain.
- Experiments and follow-up reflections were deliberately not folded in: their
  current screens still hold demo state and thin counter events rather than a
  complete durable content model.
- PR #39 merged as `4cfbdeb4`; GitHub Actions run `32880218089` passed
  typecheck, lint, schema drift, voice lint, 41 web files with 270 tests,
  ordered migrations through `0049`, and 103 API files with 944 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D3B: durable experiment absorption

State: merged to `main` and verified.

- Browser-only demo experiment cards are replaced by account-backed Journey
  experiment records with planned, tried, helped, and did-not-help states.
- Journey owns experiment capture, starter suggestions, editing, results,
  search/filter, exact deep links, recoverable removal, and restoration.
- The existing matching-readiness action is recorded exactly once when an
  experiment first crosses from planned into an attempted state; later edits
  cannot inflate it.
- Experiments are owner-scoped and included in member export and both account
  deletion paths. Migration `0050` and its Drizzle snapshot define the source.
- `/progress/experiments` now redirects to the canonical Journey experiment
  view because lifecycle parity is complete.
- PR #41 merged as `44cdf0fe`; GitHub Actions run `32894920735` passed
  typecheck, lint, schema drift, voice lint, 41 web files with 273 tests,
  ordered migrations through `0050`, and 104 API files with 948 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3D3C: durable follow-up reflection absorption

State: merged to `main` and verified.

- The browser-only demo follow-up list is replaced by account-backed Journey
  follow-up records linked to an owned reflection, date debrief, win, or
  experiment. The server validates that the source is active and member-owned.
- Journey owns creation from an exact source moment, starter questions,
  pending/answered/skipped states, editing, search/filter, exact deep links,
  recoverable removal, and restoration.
- A `follow_up_logged` readiness signal is written exactly once on the first
  answered state. Skipping, reopening, or editing an answer cannot inflate it.
- Follow-ups are included in member export and both account-deletion paths.
  Migration `0051` and its Drizzle snapshot define the durable source.
- `/progress/followup` now redirects to the canonical Journey follow-up view.
  Existing Echo recommendation send-through telemetry remains separate.
- PR #43 merged as `69d383a3`; GitHub Actions run `32896879027` passed
  typecheck, lint, schema drift, voice lint, 41 web files with 276 tests,
  ordered migrations through `0051`, and 105 API files with 951 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.

## Segment 3E1: Quiz Lab absorption into Play

State: merged to `main` and verified.

- Play now owns the complete quiz catalog and the signed-in member's durable
  server-scored result history. Anonymous results remain device-local until
  claim during sign-in.
- Account history is owner-scoped and excludes deleted or malformed sources.
  A failed authenticated read does not substitute device or demo data.
- Raw answer indexes are not stored. Saved result, confirmed learning, Echo use,
  and matching use remain separate states controlled through the existing
  source-permission workflow.
- `/quizzes` redirects to Play's quiz section only after catalog and history
  parity. Stable `/quizzes/:slug` play links remain available.
- PR #45 merged as `d064ffa9`; GitHub Actions run `32898492683` passed
  typecheck, lint, schema drift, voice lint, web/API tests, and ordered
  migrations on clean Postgres 16. Stripe remains deferred and fail-closed.

## Segment 3E2A: This or That absorption into Play

State: merged to `main` and verified.

- The complete This or That capture flow now renders inside Play and preserves
  the existing anonymous-claimable `preferences-paste` source path.
- `/this-or-that` is a compatibility redirect to the canonical embedded game,
  with an exact query deep link that reopens the same workflow.
- Saving choices remains storage-only. Confirmed learning, Echo use, and
  matching use are separate member-controlled permissions.
- The obsolete readiness-climb framing and matching-state invalidation were
  removed from this storage-only action.
- PR #48 merged as `179bb532`; GitHub Actions run `32923437513` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite. Stripe remains deferred and fail-closed.

## Segment 3E2B1: Would You Rather permission boundary

State: merged to `main` and verified.

- Migration `0052` separates private answer storage from Echo use, confirmed
  learning, and matching use. Every downstream permission defaults closed,
  including for existing rows after migration.
- The owner-scoped API updates any of the three permissions independently
  without changing the saved answer. Cross-member updates return not found.
- Matching signal counts now include only answers with explicit matching
  permission; creating or changing a private answer alone cannot move matching.
- PR #50 merged as `2d268612`; GitHub Actions run `32924064090` passed
  typecheck, lint, schema drift, voice lint, web tests, migration `0052`, and
  the clean-Postgres API suite.

## Segment 3E2B2: Would You Rather absorption into Play

State: merged to `main` and verified.

- Play now owns the complete Would You Rather capture flow and the member's
  owner-scoped durable answer history.
- Each saved answer exposes independent confirmed-learning, Echo-use, and
  matching-use controls. Answer creation invalidates only answer history;
  matching state changes only after a permission update.
- Signed-out visitors retain a local sample board. Signed-in loading and failure
  states never substitute sample history, and capture waits for account history
  so an existing answer cannot be duplicated accidentally.
- `/games/would-you-rather` redirects to the exact embedded Play experience.
- PR #51 merged as `6a562910`; GitHub Actions run `32924406308` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations
  through `0052`, and the clean-Postgres API suite. Stripe remains deferred
  and fail-closed.

## Segment 3E2B3: indirect readiness consent guard

State: merged to `main` and verified.

- The shared activity-day query now requires matching permission before Would
  You Rather answers can affect the consistency readiness lane.
- Imported sources follow the same rule and deleted imports are excluded, so a
  private or removed source cannot raise readiness through an indirect path.
- A query-level regression test guards both predicates.
- PR #53 merged as `0dbdbac0`; GitHub Actions run `32924957724` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3E2C1: Daily Spark permission boundary

State: merged to `main` and verified.

- Migration `0053` separates private answer storage from Echo use, confirmed
  learning, and matching use. Every downstream permission defaults closed.
- The owner-scoped API updates the three permissions independently and returns
  not found for cross-member attempts.
- Daily Spark readiness counts include only answers with explicit matching
  permission; saving or changing a private answer alone cannot move matching.
- PR #54 merged as `9b9197ad`; GitHub Actions run `32925223014` passed
  typecheck, lint, schema drift, voice lint, web tests, migration `0053`, and
  the clean-Postgres API suite.

## Segment 3E2C2: Daily Spark absorption into Play

State: merged to `main` and verified.

- Play now owns Daily Spark capture and owner-scoped durable answer history.
- Each saved answer exposes separate confirmed-learning, Echo-use, and
  matching-use controls. Storage-only capture no longer animates or invalidates
  matching readiness.
- Signed-in history loading and failure remain fail-closed; guest sample picks
  are never substituted for account data.
- Legacy, hub, and readiness links converge on
  `/play?game=daily-spark`, while the former game URL remains a compatibility
  redirect.
- PR #55 merged as `ecf294f7`; GitHub Actions run `32925581147` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations
  through `0053`, and the clean-Postgres API suite. Stripe remains deferred
  and fail-closed.

## Segment 3E2D1: Scenarios permission boundary

State: merged to `main` and verified.

- Migration `0054` separates private scenario-response storage from Echo use,
  confirmed learning, and matching use, with all permissions default closed.
- Owner-scoped permission updates reject cross-member access.
- Both the direct scenario lane and shared consistency lane require explicit
  matching permission, so private play has no indirect readiness path.
- PR #57 merged as `18a42414`; GitHub Actions run `32947150166` passed
  typecheck, lint, schema drift, voice lint, web tests, migration `0054`, and
  the clean-Postgres API suite.

## Segment 3E2D2: Scenarios absorption into Play

State: merged to `main` and verified.

- Play now owns Scenario reels capture and owner-scoped durable history.
- Each response exposes separate confirmed-learning, Echo-use, and matching-use
  controls. Storage-only capture does not animate or invalidate readiness.
- Signed-in loading and failure remain fail-closed; guest sample responses are
  never substituted for account data.
- Legacy, hub, and readiness links converge on `/play?game=scenarios`.
- PR #58 merged as `a7270198`; GitHub Actions run `32947415971` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations
  through `0054`, and the clean-Postgres API suite. Stripe remains deferred
  and fail-closed.

## Segment 3E2E1: Predict Yourself permission boundary

State: merged to `main` and verified.

- Migration `0055` separates private prediction-round storage from Echo use,
  confirmed learning, and matching use, with every permission default closed.
- Owner-scoped updates reject cross-member access and preserve the saved counts.
- Both the direct self-awareness lane and shared consistency lane require
  explicit matching permission.
- PR #60 merged as `251006b9`; GitHub Actions run `32948026397` passed
  typecheck, lint, schema drift, voice lint, web tests, migration `0055`, and
  the clean-Postgres API suite.

## Segment 3E2E2: Predict Yourself absorption into Play

State: merged to `main` and verified.

- Play now owns the full prediction flow and signed-in durable round history.
- Completion reveal waits for successful persistence. Failed saves remain
  visible and do not claim a durable account update.
- Each round exposes independent confirmed-learning, Echo-use, and matching-use
  controls. Storage-only capture does not animate or invalidate readiness.
- Signed-in loading/failure remains fail-closed, while guest samples stay local.
  Legacy, hub, and readiness links converge on `/play?game=predict`.
- PR #61 merged as `c1f6310f`; GitHub Actions run `32948424537` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations
  through `0055`, and the clean-Postgres API suite. Stripe remains deferred
  and fail-closed.

## Segment 3E2F1: Time Capsule permission boundary

State: merged to `main` and verified.

- Migration `0056` separates private capsule storage from Echo use, confirmed
  learning, and matching use, with every permission default closed.
- Owner-scoped updates reject cross-member access. Matching consumes only an
  approved capsule count; raw note text remains owner-only.
- Both the direct Time Capsule signal and shared activity/consistency lane
  require explicit matching permission.
- PR #63 merged as `c343fdc3`; GitHub Actions run `32951478614` passed
  typecheck, lint, schema drift, voice lint, web tests, migration `0056`, and
  the clean-Postgres API suite.

## Segment 3E2F2: Time Capsule absorption into Play

State: merged to `main` and verified.

- Play now owns capsule capture and signed-in, owner-scoped history.
- Each note exposes independent confirmed-learning, Echo-use, and matching-use
  controls. Storage-only capture does not animate or invalidate readiness.
- Signed-in loading and failure remain fail-closed; guest samples are never
  substituted for account history.
- Legacy, hub, and readiness links converge on `/play?game=time-capsule`.
- PR #64 merged as `7d0d1a1d`; GitHub Actions run `32952173816` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations
  through `0056`, and the clean-Postgres API suite.

## Segment 3F1: authenticated Matches read states

State: merged to `main` and verified.

- The canonical Matches list now distinguishes guest sample, loading, failed,
  successfully empty, and ready account reads. An authenticated connection-list
  failure cannot appear as “No matches yet.”
- A conversation metadata failure cannot appear as “not found.” Both surfaces
  expose retry without mutating account state.
- PR #66 merged as `3689418c`; GitHub Actions run `32953169354` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3F2: authenticated message-history read states

State: merged to `main` and verified.

- Message history now distinguishes loading, failed, stale, successfully empty,
  and ready reads. A first-load failure cannot appear as a brand-new empty
  conversation.
- If polling fails after a successful read, the last trusted messages remain
  visible and are explicitly marked stale. Sending and read-state mutation stay
  paused until the latest read succeeds.
- Both failed and stale states expose an explicit retry path. Resolver regression
  coverage guards the empty-state boundary.
- PR #67 merged as `9267a558`; GitHub Actions run `32974401809` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3F3: remaining thread read and mutation outcomes

State: merged to `main` and verified.

- Profile reveal and conversation-starter reads now distinguish disabled,
  loading, failed, and ready states. Failures are explicit and retryable; no
  profile details are substituted.
- A starter failure leaves member-authored messaging available. Date-idea
  failure is explicit and retryable.
- Failed unmatch and report mutations now state that account and conversation
  state did not change instead of failing silently.
- PR #69 merged as `fe660bb5`; GitHub Actions run `32975076322` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3F4: controlled-pilot waiting and proposals

State: merged to `main` and verified.

- Canonical Matches now owns the member's real consideration state and an honest
  waiting state. It never implies a hidden queue or available members when no
  introduction has been sent.
- Only server-sent proposals appear. Consideration and proposal reads fail
  closed, remain retryable, and do not substitute a sample or empty state.
- Members can independently say yes or pass from Matches. A conversation opens
  only after a deliberate send and two independent yeses.
- The canonical proposal view removes compatibility percentages, readiness
  scores, and machine-ranking language. The legacy `/matching` route remains
  temporarily available for preferences and pool controls.
- PR #71 merged as `dce5647c`; GitHub Actions run `32976310572` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3F5: canonical consideration membership

State: merged to `main` and verified.

- An eligible member can join controlled consideration directly from canonical
  Matches, and a participating member can leave from the same state card.
- The server remains authoritative for eligibility and membership. The member
  surface shows no numeric readiness score and never implies that joining
  guarantees an introduction or reveals the member to someone else.
- Failed changes leave the prior state intact and say so explicitly.
- PR #73 merged as `78f584ae`; GitHub Actions run `32976767997` passed
  typecheck, lint, schema drift, voice lint, web tests, ordered migrations, and
  the clean-Postgres API suite.

## Segment 3F6: canonical matching preferences

State: merged to `main` and verified.

- Canonical Matches now owns the member's saved age range, distance, gender,
  city or area, must-have, and deal-breaker preferences.
- Preference reads remain part of the authenticated matching-state request.
  Validation is explicit, failed writes leave the saved record unchanged, and
  successful changes use the existing owner-scoped mutation.
- Preferences guide controlled consideration without creating a member-facing
  readiness score, compatibility percentage, ranking, candidate inventory, or
  promise of an introduction.
- The legacy `/matching` URL now redirects to Matches with the absorbed panel
  open. Its duplicate profile read, self read, numeric readiness, and
  algorithmic discovery controls are no longer routed member surfaces.
- PR #75 merged as `f0beaeac`; GitHub Actions run `32979060118` passed
  typecheck, lint, schema drift, voice lint, the full web suite, ordered
  migrations, and the clean-Postgres API suite.

## Segment 3G1: canonical mobile member navigation

State: merged to `main` and verified.

- Authenticated mobile pages now keep Today, Matches, My MatchLab, Journey, and
  Play persistently available in the approved bottom navigation.
- The current destination remains explicit for canonical and compatibility
  routes. Trust & Data and account controls remain under the profile control.
- Page content, Echo's floating presence, and Echo's open panel reserve the
  device safe area and do not sit behind the bottom navigation.
- Accessible landmark, destination order, and compatibility-route activation
  have regression coverage.
- PR #78 merged as `6fc92577`; GitHub Actions run `32981344186` passed
  typecheck, lint, schema drift, voice lint, the full web suite, ordered
  migrations, and the clean-Postgres API suite.

## Segment 3G2: score-free persistent Echo

State: merged to `main` and verified.

- Persistent Echo no longer renders internal readiness totals, deltas, lane
  percentages, thresholds, or points as a measure of the member.
- Echo retains its real conversation, notices, message review, qualitative
  observations, and contextual next action.
- An internal eligibility transition now invites the member to review
  controlled consideration in Matches. It no longer claims that matching has
  opened or implies access to another person.
- Analytics records only the qualitative reaction tone, never the internal
  aggregate or member content.
- A projection boundary and regression tests prove the member-facing reaction
  contains only a title, optional detail, and honest action.
- PR #79 merged as `71ba5068`; GitHub Actions run `32982408409` passed
  typecheck, lint, schema drift, voice lint, the full web suite, ordered
  migrations, and the clean-Postgres API suite.

## Segment 3G3: retired Profile Project compatibility implementations

State: merged to `main` and verified.

- Deleted the unrouted `PhotoLab.tsx`, `SignalCheck.tsx`, and
  `Diagnosis.tsx` implementations after Profile Project absorbed their signed-in
  workflows and the old URLs became tested compatibility redirects.
- Removed obsolete Signal Check welcome-panel drivers while retaining the shared
  audit-context mocks required by still-routed coaching pages.
- Updated the API logger import to the callable named `pino-http` export so the
  repository remains compatible with stricter deployment compilers.
- PR #83 merged as `ae896838`; GitHub Actions run `33000690949` passed
  typecheck, lint, schema drift, voice lint, 52 web files with 309 tests, the
  ordered clean-Postgres migration chain, and 111 API files with 983 tests.
  Eight optional OCR tests remained skipped.
- The Vercel connection currently targets only the Express API subproject, not
  the visual web app. Its preview remains failed because the framework compiler
  pulls browser-only shared code into the server build, so no Vercel URL is
  represented as the current member experience.

## Next segments

1. Complete the evidence audit of the 15 remaining unrouted top-level page
   implementations and retire only the first duplicate cluster whose behavior
   and durable links are already owned by a canonical destination.
2. Run authenticated desktop and mobile walkthroughs plus accessibility checks
   across Today, Matches, My MatchLab, Journey, Play, Trust & Data, and Echo.
3. Provision a separate visual web project rooted at `artifacts/nldc`; keep the
   API deployment architecture and environment work explicit rather than
   treating the current API-only Vercel project as the product preview.
4. Execute the release-environment migration, Stripe test-mode, and
   founder/legal release gates.
