# Member shell migration

Last updated: 2026-08-24

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

## Next segments

1. Consolidate Mirror trends, relationship-language tools, and confirmed
   learning into the My MatchLab record.
2. Consolidate dates, journal, debrief, experiments, and reflections into a
   durable Journey record.
3. Consolidate games and quizzes into Play with confirmed-learning handoff.
4. Complete the controlled Matches lifecycle, authenticated walkthroughs,
   accessibility checks, and mobile regression evidence.
