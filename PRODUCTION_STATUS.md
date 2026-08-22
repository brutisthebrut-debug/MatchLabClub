# MatchLab production status

Last verified: 2026-08-21

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
| Consent separation | Partial | Account-level hosted-AI consent and some matching consent exist. Source storage, Echo use, confirmed learning, and matching-use permissions are not yet a complete canonical state machine. |
| Quiz identity and scoring | Not complete | Canonical quiz identity and server-authoritative scoring require an audit and regression coverage. |
| Founder review vs. member introduction | Not complete | Founder curation and member proposal state still need explicit separation and transition tests. |
| Payments and entitlement | Blocked for release | Tier assignment is still manual and public refund/renewal/cancellation language is inconsistent. Stripe webhook entitlement and access revocation must ship before a paid launch. |
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

## Release gate

Do not represent the current repository as production-ready. The next safe
milestone is completion of Phase 0, with particular priority on permissions and
quiz authority, database-backed lifecycle/auth tests, payments/entitlements,
and synchronized legal copy. Install the approved five-destination shell only after those trust promises
are true in the real system.
