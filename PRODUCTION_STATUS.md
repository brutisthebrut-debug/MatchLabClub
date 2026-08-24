# MatchLab production status

Last verified: 2026-08-24

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

Production shell migration is underway. Segment 1 installs the five canonical
destinations, keeps Trust & Data directly accessible, and preserves Echo across
the authenticated shell. Segment 2 makes onboarding consent-first: starter
answers are explicitly coaching-only, downstream uses remain separate, and
readiness scores, points, climb language, and percent-mapped language are
removed. Existing legacy routes and records remain reachable while later
segments consolidate the underlying workflows. See `SHELL_MIGRATION.md` for
the route matrix and segment plan.

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

- Production shell migration Segment 1 adds Today, My MatchLab, Journey, Play,
  and Trust & Data routes; the existing Matches lifecycle remains canonical.
  Legacy URLs continue to resolve and map to the owning destination.
- TypeScript project references and the API and web app typechecks pass.
- Web suite: 30 files, 231 tests passed.
- Full API suite on a clean Postgres 16 service: 99 files and 911 tests passed;
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

## Release gate

Do not represent the current repository as production-ready. Automated Phase 0
verification is green, and the founder has authorized shell migration to
continue while Stripe remains deferred. Checkout stays fail-closed and no paid
product or real-member paid cutover may be activated. The remaining release
gates include applying migrations `0041` through `0045` in the release
environment, completing the shell migration and authenticated walkthroughs,
then exercising Checkout/webhooks, renewal, cancellation, failure, and refund
behavior in Stripe test mode and obtaining founder/legal approval before any
live offer.
