---
name: testDb fake SQL harness gotchas
description: Non-obvious limits of the in-memory testDb fake used by api-server route tests (raw sql predicates, transactions, secure cookies).
---

The api-server route tests mock `@workspace/db` with `src/lib/testDb.ts`, an in-memory
store. Three non-obvious limits bite when a route uses anything beyond plain
`eq/and/isNull` query builders:

- **Raw `sql` fragments used as WHERE predicates are no-ops by default.** The fake `sql`
  tag returns an always-false row predicate unless the reconstructed string matches a
  pattern the fake explicitly understands. JSONB path equality
  (`parsedSummary->>'key' = 'value'`) is now supported; anything else (other operators,
  functions) silently matches nothing. If a route's filter/dedupe relies on a raw `sql`
  predicate, you must teach the fake that pattern or the test won't exercise the logic.
  **Why:** the fake has no SQL engine; it pattern-matches reconstructed strings.

- **`db.transaction` / `db.execute` exist but are inert.** `transaction(cb)` just runs
  `cb(db)` against the same store (no isolation), and `execute()` returns `{ rows: [] }`.
  So advisory locks (`pg_advisory_xact_lock`) and any `db.execute` SQL do nothing in
  tests. The fake `db` is explicitly typed via a `FakeDb` interface so `transaction`'s
  callback param doesn't create a circular `typeof db` (TS7022).

- **The `anon_claim` cookie is `secure`, so supertest's `request.agent` drops it over
  plain HTTP.** Multi-request anon flows that must share the same anon owner cannot rely
  on `request.agent` cookie persistence; extract the `set-cookie` from the first
  response and forward it manually with `.set("Cookie", "anon_claim=...")`.
  **How to apply:** any route test chaining anon requests that must hit the same owner row.
