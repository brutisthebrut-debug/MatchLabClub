# MatchLab production status

Last verified: 2026-08-22

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

The approved v1 shell has been completed as a prototype, but it has not yet
replaced the route-heavy production web shell. The current app still exposes
legacy readiness, coaching, progress, and matching routes. Existing data models
and workflows are valuable inputs to the migration; their present navigation is
not the approved final information architecture.

## Phase 0: trust and state repair

| Workstream | State | Evidence / next condition |
| --- | --- | --- |
| Complete export and deletion | In progress, materially hardened | The live Account page now uses the email-confirmed transactional delete. Export includes all current user-facing product families while excluding reusable auth/OAuth/push/export secrets. Transactional deletion now covers Journey, Play, Wingman, Cosmic, verification, and Mirror preferences. Requires a Postgres-backed CI run before release. |
| Founder authorization | Implemented; DB-backed release verification required | Founder routes now re-check the authenticated user's persisted `founder`/`admin` role. The shared browser key and `x-founder-key` authorization path are removed. Authorized requests append actor, route, response status, IP, and user-agent metadata to `founder_action_logs`. Apply migration `0041` and run the database-backed auth suite before release. |
| Consent separation | Implemented; DB-backed release verification required | Wellness answers default to coaching-only. Every `imported_sources` row now keeps storage, Echo use, confirmed learning, and matching use independent and default-closed. Matching counts exclude sources without explicit matching permission; Echo enrichment requires source-level Echo permission and cannot write after revocation. Apply migrations `0042` and `0043`. |
| Quiz identity and scoring | Implemented | The web app and API share one canonical Quiz Lab catalog/scorer. The API accepts only a known slug plus valid answer indexes, derives archetype/name/dimensions server-side, ignores forged derived fields, and never stores raw answers. Authority regression coverage passes. |
| Founder review vs. member introduction | Implemented; DB-backed release verification required | `founder_review_status`, private founder notes, review actor/time, and `introduced_at` are separate from the member proposal lifecycle. Internal/concierge candidates stay hidden and non-actionable until a founder sends them; member APIs never serialize founder review fields. Apply migration `0044` and run the database-backed transition regression before release. |
| Payments and entitlement | Implemented; migration and Stripe test-mode verification required | Authenticated server-owned Checkout, signed/idempotent direct Stripe webhooks, canonical `billing_entitlements`, renewal/cancellation/payment-failure/refund transitions, customer portal access, and account-deletion renewal stop are implemented. Manual tier mutation is retired. Apply migration `0045`, configure server-only keys/Price IDs, register events, and pass the database-backed Stripe test-mode suite before release. |
| Legal and service language | Blocked for release | Terms, privacy, pricing, checkout, and product states must describe the same controlled-introduction service. |

## Verified baseline

- TypeScript project references and the API and web app typechecks pass.
- Web suite: 28 files, 211 tests passed.
- API suite without Postgres: 59 files and 623 tests passed; 38 database-backed
  suites could not start because no `DATABASE_URL`/Postgres service was
  available in the verification environment.
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

Do not represent the current repository as production-ready. The next safe
milestone is completion of Phase 0, with particular priority on the outstanding
database-backed lifecycle/auth/introduction/billing tests, Stripe test-mode
operations, and synchronized legal copy. Install the approved five-destination shell only after
those trust promises are true in the real system.
