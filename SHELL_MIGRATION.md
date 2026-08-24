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

State: implemented in code, pending CI and merge.

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

## Next segments

1. Absorb full audit reports and Photo Lab results into Profile Project,
   preserving history and source records before retiring their duplicate
   surfaces.
2. Consolidate Mirror trends, relationship-language tools, and confirmed
   learning into the My MatchLab record.
3. Consolidate dates, journal, debrief, experiments, and reflections into a
   durable Journey record.
4. Consolidate games and quizzes into Play with confirmed-learning handoff.
5. Complete the controlled Matches lifecycle, authenticated walkthroughs,
   accessibility checks, and mobile regression evidence.
