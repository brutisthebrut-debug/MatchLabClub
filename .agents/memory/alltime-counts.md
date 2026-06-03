---
name: All-time counts use SQL aggregates
description: Why "all-time" journey/event totals must use DB-side filtered aggregates, not a capped row fetch + JS count, and that the in-memory test harness supports those aggregate shapes.
---

When you need an all-time count (e.g. a user's lifetime `signal_fed` / `tool_completed`
events to drive achievement unlocks), compute it with a DB-side filtered aggregate,
not by selecting rows with a `.limit(N)` and counting them in JS.

**Why:** A `.limit(5000)` (or any cap) silently undercounts a high-activity user once
older rows fall outside the first N selected — the count plateaus and a threshold-gated
unlock gets stuck forever, with no error. A capped fetch is never an "all-time" count.

**How to apply:** Use the filtered-aggregate shape, e.g.
`count(*) filter (where <col> = 'value')::int`, in a single `db.select({...}).from(...).where(eq(userId))`
with no limit and no groupBy. The api-server in-memory test harness
(`artifacts/api-server/src/lib/testDb.ts`) understands these shapes: `computeAggregate`
matches `count(*) filter (where {{COL:x}} = 'lit')::int`, `count(*)`, `count(*) filter (... in (...))`,
and `max(...) filter (...)`, and a projection with any aggregate spec returns a single
projected row even without `groupBy`. So the same query works in both prod Postgres and tests.
Add a regression test that records well past any old cap (e.g. >5000 rows) and asserts the
exact count, so "all-time" cannot regress back into a capped fetch.

**Windowed counts (e.g. a 7-day "this week" recap) have the same trap, with a twist:**
the test harness stores `createdAt` as a fake `Date`, but `testDb.gte` only matches numeric
columns and the `sql` aggregate fake cannot evaluate `now() - interval '7 days'` or json
(`props->>'x'`) math. So a windowed per-user recap that must filter by time/json typically
aggregates in JS. That JS aggregation MUST fetch the user's rows with NO `.limit(N)` — scope
to one user with `eq(userId)` only — then apply the time cutoff in JS. A `.limit(500)` (or any
cap) silently undercounts a user who logs more than N events inside the window. Same fix shape,
same regression test: insert >cap rows in-window and assert the exact count.
