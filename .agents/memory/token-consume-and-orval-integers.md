---
name: Single-use token consume + Orval integer gap
description: Two durable correctness traps for token-redeemed write endpoints and for any integer-typed request body in this contract-first stack.
---

## Single-use redeem must wrap stamp + dependent write in ONE transaction

A "redeem once" flow that (a) conditionally stamps a row as consumed
(`UPDATE ... WHERE consumed_at IS NULL`) and then (b) inserts the dependent
payload row MUST do both inside a single `db.transaction`. Otherwise a failed
insert (DB/network blip) leaves the invite/token permanently stamped-consumed
with no payload recorded: the credit (e.g. readiness signal) never lands and
retry is blocked forever.

**Why:** the conditional stamp is the race guard (two redeemers can't both win),
but on its own it commits before the payload, so a partial failure is
unrecoverable. Wrapping both in a transaction makes the stamp roll back on
insert failure, so the token stays redeemable.

**How to apply:** any endpoint that consumes a single-use token/invite and then
writes a dependent row — wrap the conditional stamp + insert in
`db.transaction(async (tx) => { ...; return committed })` and return 409 only
when the conditional stamp matched zero rows. `testDb.transaction` runs the
callback inline (no real isolation), so unit tests still exercise the path.

## Orval emits `zod.number()` for OpenAPI `type: integer` (no `.int()`)

The OpenAPI source can correctly say `type: integer, minimum, maximum`, but the
generated Zod body schema is `zod.number().min().max()` with NO integer
constraint. Fractional values pass validation, then blow up at the integer DB
column as a 500.

**Why:** Orval does not translate `type: integer` into `.int()`. Regenerating
will not fix it; this is a generator limitation, not a spec bug.

**How to apply:** for any integer-typed request body, add a route-level guard
(`Number.isInteger(...)` over the fields) after `safeParse` and return a clean
400. Do not assume the generated Zod enforces wholeness.

## testDb needs explicit registration per new table

A new route test that hits new tables 500s until the table is registered in
`artifacts/api-server/src/lib/testDb.ts`: add a `stores.<table_name>` entry (or
`ensureStore("<table_name>")`) with its column defaults AND export a
`makeTable("<table_name>")` const. Without both, inserts/selects throw.
