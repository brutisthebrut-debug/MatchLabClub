---
name: Running api-server tests
description: How to run the api-server vitest suite reliably in this Replit container.
---

Running the api-server test suite directly from bash (`pnpm --filter @workspace/api-server run test`, or `vitest run` inside the package) intermittently dies with exit code -1 and **no output** — the sandbox kills the process on thread/resource creation (errno=11) under load.

**Why:** the container caps OS threads; vitest's default worker pool spins up more than the sandbox allows when other workflows are also running.

**How to apply:** run the dedicated `api-tests` workflow (restart it) and read its result from `/tmp/logs/api-tests_*.log` (look for the `Test Files` / `Tests` summary line). A healthy baseline is `37 passed | 2 skipped` files, `413 passed | 8 skipped` tests. The workflow runner manages resources where a raw bash invocation does not. CLI flags like `--pool=forks --poolOptions...` are rejected by this vitest's CAC parser, so don't bother trying to tune the pool from the command line.

## Fake testDb harness limits (lib/testDb.ts)

The in-memory fake `db` used by route tests does NOT implement everything drizzle does. Two known gaps: there is **no `db.transaction(cb)` method**, and **`DeleteChain` has no `.returning()`** (delete resolves to void). So any route that does `db.transaction(...)` or `db.delete(t).where(...).returning({...})` cannot be exercised through the fake harness as-is.

**How to apply:** route tests that hit a transactional or delete-returning path must either use the REAL db like `account.test.ts` (imports `db`/`pool` from `@workspace/db`, seeds + cleans real rows), or you must extend the fake (add a `transaction: async (cb) => cb(db)` stub and a `DeleteChain.returning()` that returns deleted rows) — but the fake transaction can't verify true rollback, only the happy path. Prefer the real-db pattern when rollback semantics matter.
