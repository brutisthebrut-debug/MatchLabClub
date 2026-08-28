# MatchLab production status

Last verified: 2026-08-28

This is the source of truth for what is in the repository versus what has only
been approved in the v1 prototype. It prevents prototype decisions from being
mistaken for production behavior.

## Approved v1 contract

- Five member destinations: Today, Matches, My MatchLab, Journey, and Play.
- Echo is persistent and guides capture, interpretation, and next actions.
- Pages preserve the scannable record: "Echo guides the work. Pages preserve
  the record."
- A member confirms proposed learning before it becomes part of My MatchLab.
- Saving a source, allowing Echo use, confirming a learning, and allowing use
  for matching are separate decisions.
- Matching begins with an honest controlled-pilot waiting state. It must not
  imply fabricated member availability.
- Product language should make a member feel known without assigning a numeric
  human score or suggesting that they must earn access to another person.

## Repository reality

Production shell migration is underway under a capability-consolidation
standard: a destination is not complete merely because it links to an older
page. Segment 1 installs the five canonical destinations, keeps Trust & Data
directly accessible, and preserves Echo across the authenticated shell. Segment
2 makes onboarding consent-first. Segment 3A makes My MatchLab a live member
record and Profile Project the durable, versioned owner of profile editing and
Echo rewrite acceptance. Duplicate rewrite routes now redirect only after that
behavior was absorbed. Profile Project owns evidence-validated own-profile source capture,
report generation and regeneration, durable audit-report viewing, historical
report versions, the persistent private photo collection, and immutable Photo
Lab analyses that can be reopened or deleted. The standalone Photo Lab and
own-profile audit routes now redirect only after their signed-in workflows were
absorbed; durable report ids survive the compatibility redirect. Profile Reader
remains separate because it interprets another person's profile. My MatchLab
now also owns the durable boundary between Echo's grounded working themes,
proposed learning, member confirmation/correction/dismissal, and a separate
reversible matching-use grant.
The first Communication consolidation slice replaces the relationship-language
link list with live saved Care Dialect and relationship-standard context. Either
source can enter the same confirmed-learning review without automatic consent.
Matches date/debrief recovery is implemented on
`codex/matches-date-debrief-learning`: shared plan/completion state leads into
Journey's canonical guided debrief, while the saved note and tentative Echo
learning remain private to the author and require later member confirmation.
This slice is not part of the verified merged baseline until exact-head checks
execute and pass.
See `SHELL_MIGRATION.md` for the completion standard, route matrix, and
segment plan.

## Phase 0: trust and state repair

| Workstream | State | Evidence / next condition |
| --- | --- | --- |
| Complete export and deletion | Implemented; DB regression verified | The live Account page uses email-confirmed transactional delete. Export includes all current user-facing product families while excluding reusable auth/OAuth/push/export secrets. Transactional deletion covers Journey, Play, Wingman, Cosmic, verification, and Mirror preferences. The clean-Postgres lifecycle suite passes; verify the production migration and release environment before launch. |
| Founder authorization | Implemented; DB regression verified | Founder routes re-check the authenticated user's persisted `founder`/`admin` role. The shared browser key and `x-founder-key` authorization path are removed. Authorized requests append actor, route, response status, IP, and user-agent metadata to `founder_action_logs`. The Postgres-backed auth and audit suite passes; apply migration `0041` in the release environment before launch. |
| Consent separation | Implemented; DB regression verified | Wellness answers default to coaching-only. Every `imported_sources` row keeps storage, Echo use, confirmed learning, and matching use independent and default-closed. Matching counts exclude sources without explicit matching permission; Echo enrichment requires source-level Echo permission and cannot write after revocation. The Postgres-backed permission suite passes; apply migrations `0042` and `0043` in the release environment. |
| Quiz identity and scoring | Implemented | The web app and API share one canonical Quiz Lab catalog/scorer. The API accepts only a known slug plus valid answer indexes, derives archetype/name/dimensions server-side, ignores forged derived fields, and never stores raw answers. Authority regression coverage passes. |
| Founder review vs. member introduction | Implemented; DB regression verified | `founder_review_status`, private founder notes, review actor/time, and `introduced_at` are separate from the member proposal lifecycle. Internal/concierge candidates stay hidden and non-actionable until a founder sends them; member APIs never serialize founder review fields. The Postgres-backed transition suite passes; apply migration `0044` in the release environment. |
| Payments and entitlement | Implemented; DB regression verified; Stripe gate remains | Authenticated server-owned Checkout, signed/idempotent direct Stripe webhooks, canonical `billing_entitlements`, renewal/cancellation/payment-failure/refund transitions, customer portal access, and account-deletion renewal stop are implemented. Manual tier mutation is retired. Checkout also stays closed unless a canonical product is explicitly founder-approved in `BILLING_LIVE_PRODUCTS`; Price IDs alone cannot open sales. Apply migration `0045`, configure server-only keys/Price IDs, register events, and pass the database-backed Stripe test-mode suite before release. |
| Legal and service language | Implemented; founder/legal approval required before activating an offer | Terms, privacy, pricing, checkout/success/cancel, Account billing, partner/waitlist pages, and introduction states now describe the same limited controlled-introduction service, source permissions, processor retention boundary, and non-guaranteed outcomes. The server allowlist prevents copy or Stripe configuration from opening an unapproved product. |

## Verified baseline

- The retired Photo Lab, Signal Check, and Diagnosis page implementations are
  deleted after their signed-in behavior moved into Profile Project and their
  old URLs became compatibility redirects. The API logger also uses the
  callable named `pino-http` export. PR #83 merged as `ae896838`; Actions run
  `33000690949` passed 52 web files with 309 tests and 111 API files with 983
  tests on clean Postgres. Eight optional OCR tests remained skipped.
- The 15-page unrouted implementation audit is complete. Six absorbed shells
  were removed: Dating Wins Log and Glow Up in PR #86 (`0d655fd2`), then
  standalone experiments, follow-ups, Quiz Lab catalog, and audit Wizard in
  PR #87 (`6179f951`). Actions runs `33002422151` and `33002915260`
  passed both lanes; the latter recorded 52 web files with 301 tests and 111
  API files with 983 tests, with eight optional OCR tests skipped. Eight
  apparently unrouted files were retained because My MatchLab or Play embeds
  their experiences. PR #89 then moved complete current/saved report
  presentation and copy controls into Profile Project and deleted the final
  duplicate `Report.tsx`. Exact-head Actions run `33004308126` passed 51 web
  files with 287 tests and 111 API files with 983 tests; eight optional OCR
  tests remained skipped. All 15 audited implementations are now resolved.
- Authenticated mobile pages now have persistent bottom navigation for the five
  canonical destinations, with account and Trust & Data controls under the
  profile control. Echo and page content respect the mobile safe area. PR #78
  and Actions run `32981344186` passed both verification lanes.
- Persistent Echo now projects qualitative observations and next actions
  without member-facing readiness totals, deltas, thresholds, lane percentages,
  or points. PR #79 and Actions run `32982408409` passed both verification
  lanes.
- Canonical Matches owns authenticated consideration state, deliberately sent
  proposals, mutual-consent responses, conversation state, consideration
  membership, and saved matching preferences. The legacy `/matching` URL is a
  compatibility redirect; numeric readiness, ranking, and algorithmic discovery
  are not routed member surfaces. PR #75 and Actions run `32979060118` passed
  both required verification lanes.
- Production shell migration Segment 1 adds Today, My MatchLab, Journey, Play,
  and Trust & Data routes; the existing Matches lifecycle remains canonical.
- Consent-first onboarding keeps capture, Echo use, confirmed learning, and
  matching use distinct and removes readiness scoring from the member path.
- Segment 3A makes My MatchLab use live member data without a demo fallback.
  Profile Project owns durable, reopenable profile versions and server-backed
  rewrites; accepting a rewrite creates a traceable new version without
  changing the source. `/glow-up` and `/copilot/profile` now redirect to the
  canonical workflow.
- Profile Project now reopens current and historical audit reports with source
  provenance and no numeric member grading. It also manages the durable private
  photo collection.
- Profile Project now owns durable, owner-scoped Photo Lab runs with source-photo
  provenance, immutable history, member deletion, account export/deletion
  coverage, and a canonical score-free presentation. Raw image bytes are used
  only during the request and are not stored with the run.
- The standalone `/photo-lab` member page redirects to Profile Project after
  workflow absorption. The anonymous ranking API remains compatibility-only.
- Profile Project now owns evidence-validated audit capture and generation.
  Weak, placeholder, wrong-format, implausible-age, or directly contradictory
  sources return an explicit insufficient-evidence response and cannot
  manufacture a report. Generated reads remain proposed coaching observations.
- `/start`, `/signal-check`, and `/diagnosis` redirect to canonical capture;
  `/report/:id` preserves the durable audit id in canonical history.
- TypeScript project references and the API and web app typechecks pass.
- Web suite: 36 files, 250 tests passed.
- Full API suite on a clean Postgres 16 service: 101 files and 932 tests passed;
  2 files and 8 optional OCR tests skipped.
- GitHub Actions run 32747162456 passed both required jobs on PR #4: frozen
  install, typecheck, lint, schema drift, voice lint, web tests, the complete
  ordered migration chain (`0000` through `0045`) on clean Postgres 16, and the
  complete Postgres-backed API suite.
- GitHub Actions run 32771160856 passed both required jobs on PR #5 for
  production shell migration Segment 1: 29 web files and 228 tests, the ordered
  migration chain through `0045`, and 99 API files with 911 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32772997609 passed both required jobs on PR #7 for
  consent-first onboarding: 30 web files and 231 tests, the ordered migration
  chain through `0045`, and 99 API files with 911 tests on clean Postgres 16.
- GitHub Actions run 32775412763 passed both required jobs on PR #9 for the
  My MatchLab record and Profile Project core: 31 web files and 238 tests, the
  ordered migration chain through `0045`, and 99 API files with 911 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32778893927 passed both required jobs on PR #11 for
  durable Profile Project records: 32 web files and 241 tests, the ordered
  migration chain through `0045`, and 99 API files with 911 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32781612723 passed both required jobs on PR #13 for the
  durable Photo Lab service: 33 web files with 242 tests, the ordered migration
  chain through `0046`, and 99 API files with 914 tests on clean Postgres 16.
  The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32783616570 passed both required jobs on PR #15 for
  evidence-validated Profile Project reads: 35 web files with 247 tests, the
  ordered migration chain through `0046`, and 100 API files with 925 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32786262672 passed both required jobs on PR #17 for the
  confirmed Mirror learning lifecycle: 36 web files with 250 tests, the ordered
  migration chain through `0047`, and 101 API files with 930 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32787235430 passed both required jobs on PR #20 for the
  saved Communication record: 36 web files with 250 tests, the ordered
  migration chain through `0047`, and 101 API files with 932 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32789073048 passed both required jobs on PR #22 for
  durable Connection Style and Personal Blueprint source records: 36 web files
  with 250 tests, the ordered migration chain through `0048`, and 102 API files
  with 936 tests on clean Postgres 16. The 8 skipped API tests remain the
  optional OCR suites.
- GitHub Actions run 32795941566 passed both required jobs on PR #24 for the
  canonical My MatchLab Communication home: 37 web files with 253 tests, the
  ordered migration chain through `0048`, and 102 API files with 936 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32797576360 passed both required jobs on PR #26 for the
  member-governed Mirror change record: 38 web files with 255 tests, the
  ordered migration chain through `0049`, and 102 API files with 937 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32798465856 passed both required jobs on PR #28 for the
  persistent seeded-demo flag: 39 web files with 256 tests, the ordered
  migration chain through `0049`, and 102 API files with 937 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32801706555 passed both required jobs on PR #29 for the
  canonical Journey record foundation: 40 web files with 258 tests, the
  ordered migration chain through `0049`, and 102 API files with 939 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32802950036 passed both required jobs on PR #31 for native
  Journey reflection/date capture and editing: 40 web files with 261 tests, the
  ordered migration chain through `0049`, and 102 API files with 939 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32803866085 passed both required jobs on PR #33 for
  recoverable Journey removal: 40 web files with 263 tests, the ordered
  migration chain through `0049`, and 102 API files with 941 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32864197737 passed both required jobs on PR #35 for guided
  date-debrief absorption into Journey: 41 web files with 265 tests, the
  ordered migration chain through `0049`, and 102 API files with 941 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32865345421 passed both required jobs on PR #37 for safe
  Journey source-route retirement: 41 web files with 267 tests, the ordered
  migration chain through `0049`, and 102 API files with 941 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32880218089 passed both required jobs on PR #39 for
  durable win absorption into Journey: 41 web files with 270 tests, the
  ordered migration chain through `0049`, and 103 API files with 944 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32894920735 passed both required jobs on PR #41 for
  durable Journey experiments: 41 web files with 273 tests, the ordered
  migration chain through `0050`, and 104 API files with 948 tests on clean
  Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- GitHub Actions run 32896879027 passed both required jobs on PR #43 for
  durable, source-linked Journey follow-ups: 41 web files with 276 tests, the
  ordered migration chain through `0051`, and 105 API files with 951 tests on
  clean Postgres 16. The 8 skipped API tests remain the optional OCR suites.
- Schema-drift check passes using the workspace-pinned `drizzle-kit` binary and
  no network fallback.
- OpenAPI was updated first and Orval regenerated the React client and Zod
  contract for the expanded export.
- Founder authorization is role-based. `FOUNDER_EMAILS` is an optional,
  server-only comma-separated bootstrap allowlist; persisted database roles are
  authoritative. Browser-provided headers and query parameters cannot grant
  founder access.
- Wellness capture no longer grants every downstream use automatically. The
  permission regression suite verifies coaching-only capture, explicit matching
  opt-in, scope changes, and coaching-only confirmation of proposed learning.
- Quiz Lab identity and scoring are server-authoritative. The API regression
  suite covers canonical scoring, retakes, forged result fields, unknown slugs,
  incomplete submissions, and out-of-range option indexes.
- Imported-source permissions now default closed and remain independent. The
  Imports screen exposes separate controls, the owner-scoped API preserves
  untouched states, matching filters unapproved sources, and enrichment writes
  are guarded by live Echo permission.
- Founder review no longer writes internal statuses into the member proposal
  lifecycle or appends private notes to member-facing summaries. Internal and
  concierge candidates remain private until `introduced_at` is set by the
  founder send transition; the database-backed regression test covers hidden,
  reviewed, sent, and private-note behavior.
- Paid access is no longer granted by a browser redirect or founder tier flip.
  Direct signed Stripe events write an idempotency ledger and canonical
  entitlement records, then synchronize the legacy user-tier cache. Checkout,
  renewal, end-of-period cancellation, payment failure, subscription deletion,
  and fully refunded one-time purchase behavior are explicit. Account billing
  opens Stripe's customer portal, and account deletion first stops renewal.

## Active Echo integration stack

- PR #99 adds safe intent-to-capability guidance across Today, Matches, My MatchLab, Journey, Play, Quiz Lab, and Trust & Data. Echo proposes navigation only; it cannot silently write member learning, change consent, message another member, or activate matching.
- PR #100 moves capability selection into the server response, validates canonical destinations, and persists the capability offered with each Echo turn. It is intentionally stacked on PR #99.
- PR #101 adds consent-gated bounded conversation memory: eight recent turns, 800 characters per turn, 6,000 characters total, 20 hydrated durable turns, and an authenticated Echo → Quiz Lab → saved result browser path. It is intentionally stacked on PR #100.
- The three pull requests remain open and mergeable. Required Phase 0 runs `33030535683`, `33029753200`, and `33031091579` failed before runner assignment. A 2026-08-28 retry created nine replacement jobs; all nine again completed immediately with zero steps. This is unexecuted infrastructure failure, not green verification and not evidence of a code regression.
- Do not merge the Echo stack until exact-head verification actually executes and passes. Once infrastructure is available, verify and merge #99, retarget #100 to `main`, verify and merge #100, then retarget, verify, and merge #101.

## Active shell recovery slice

- `codex/matches-date-debrief-learning` adds migration `0057`, shared date
  planning/completion, canonical Journey debrief capture, owner-private linked
  notes, and pending Echo learning.
- The API regression suite covers shared lifecycle state, private debrief
  visibility, membership/completion guards, duplicate prevention, and tentative
  learning creation. The Journey route parser has focused UUID handling
  coverage.
- This is implemented evidence, not release evidence. It must not merge until
  exact-head GitHub Actions actually receives a runner and passes both required
  lanes.

## Hosting reality

- The connected Vercel team currently contains one MatchLab project, rooted at
  `artifacts/api-server`. It is an Express API deployment, not the visual
  member application in `artifacts/nldc`.
- The repository now contains a verified visual-project configuration at
  `artifacts/nldc/vercel.json`. Its production build creates 67 prerendered
  route shells and the Phase 0 gate rebuilds it on every change.
- Vercel still needs a separate project created with `artifacts/nldc` as its
  root. Until that external project exists, no Vercel URL should be described
  as the current member experience.
- Authenticated desktop and phone walkthroughs already run against the real web
  and API applications on every pull request; they do not depend on a hosted
  preview.

## Release gate

Do not represent the current repository as production-ready. The last merged
baseline was verified, but the open Echo integration stack does not yet have
executed exact-head Phase 0 evidence because GitHub rejected every job before
runner assignment. The founder has authorized shell migration to continue while
Stripe remains deferred. Checkout stays fail-closed and no paid
product or real-member paid cutover may be activated. The remaining release
gates include applying migrations `0041` through `0057` in the release
environment, provisioning the separate visual web preview, migrating the
remaining `REPL_ID` and `REPLIT_DOMAINS` compatibility names, then exercising
Checkout/webhooks, renewal, cancellation, failure, and refund behavior in
Stripe test mode and obtaining founder/legal approval before any live offer.
PR #95 adds a value-safe pre-production environment contract and CI coverage;
it deliberately rejects any non-empty `BILLING_LIVE_PRODUCTS` value.
