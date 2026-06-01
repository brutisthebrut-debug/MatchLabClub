---
name: testDb aggregate limits
description: What the api-server in-memory testDb mock can and cannot evaluate in SQL, and how summary helpers must be structured to stay testable.
---

# testDb aggregate + grouping limits

`artifacts/api-server/src/lib/testDb.ts` is the in-memory `@workspace/db` mock used by route/lib tests (via `vi.mock("@workspace/db", ...)` + a `drizzle-orm` operator shim). It is a predicate-based fake, not a real SQL engine.

It supports only a fixed set of `sql` aggregate shapes in `computeAggregate`: `count(*)`, `count(*) filter (where col = 'x')`, `count(*) filter (where col in (...))`, and the `max(...)` equivalents. It has **no `groupBy`** on the select chain and **cannot evaluate interval/date predicates** like `count(*) filter (where created_at >= now() - interval '7 days')` (those fall through to `null`).

**Rule:** a summary helper that computes time-window counts (today/7d/30d) AND a recent feed must put the counts query and the feed query in **separate, independent fail-open try/catch blocks**, not one shared try. In testDb the counts/groupBy path throws or returns nulls; if they share a try, the recent feed is skipped too and any feed assertion fails.

**Why:** `summarizeJourneyEvents` originally wrapped both in one try; under testDb the count query's `.groupBy(...)` / interval filter blanked the whole summary. Splitting them keeps the feed testable and is also genuinely more robust in prod (one failing aggregate never blanks the other section).

**How to apply:** when adding a new founder summary endpoint with time-window counts, (1) split counts vs feed into independent fail-open blocks, (2) if the table is new, add its `makeTable("...")` export plus any enum constants the module imports to `testDb.ts` (the mock must export everything the module-under-test imports from `@workspace/db`), and (3) assert on the feed / per-type presence rather than exact window numbers, which testDb cannot compute.
