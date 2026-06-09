---
name: Shared match pool pollutes idempotency assertions
description: Why internal-match idempotency tests fail under the full api-test suite but pass in isolation, and the durable fix (pair-scope the assertions).
---

Idempotency tests that assert an exact per-user row count (e.g. "exactly 1 internal proposal for user A") can fail under the full `pnpm --filter @workspace/api-server run test` run with an off-by-one ("expected 1, got 2") while passing when run alone.

**Why:** the matching pool is ONE shared Postgres table, and sibling test files seed their own "ready" members. When fixtures set no radius, the radius hard gate is inactive, so members from different files can legitimately cross-match (e.g. a discover-test member and an auto-proposal-test member satisfy each other on gender/age) and each side mints a mirror proposal. A raw per-user count then sees the in-file pair PLUS the cross-file pair. A background auto-proposal sweep can add the same kind of noise, but the dominant cause here was cross-file fixture matching, not the sweep. The dev API server running during the suite is NOT the polluter (the job alone passes with it up).

**How to apply:** idempotency of internal matches is a property of the PAIR, guaranteed by the partial unique index on the ordered (user_id, proposed_to_user_id). Assert it that way: filter rows/response items to the specific A<->B pair (`proposedToUserId === USER_B` / `=== USER_A`) instead of counting all rows for a user. This is robust to any pool pollution from sibling files or background writers and still proves the real invariant. Also pick paired rows explicitly (`.find(r => r.proposedToUserId === USER_B)`, not `rows[0]`) in tests that act on a proposal, since `[0]` can be a cross-file row. Adding a radius to fixtures only isolates pairs when BOTH sides set one and is fragile against other no-radius files, so prefer pair-scoping the assertions.
