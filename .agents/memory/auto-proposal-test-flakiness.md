---
name: Background jobs pollute idempotency assertions
description: Why some internal-match idempotency tests intermittently fail under the full api-test suite but pass in isolation, and the general lesson.
---

Idempotency tests that assert an exact row count (e.g. "exactly 1 proposal per user") can fail under the full `pnpm --filter @workspace/api-server run test` run with an off-by-one ("expected 1, got 2") while passing when run alone.

**Why:** a background sweep that mints the same kind of rows runs concurrently with the test (the auto-proposal sweep logs "Auto-proposal sweep minted internal matches" interleaved with test output), so extra rows land between the test's setup and its assertion. The failing tests are marked retryable, which is the tell that they are racing a background writer rather than exercising a real bug.

**How to apply:** an idempotency assertion is only trustworthy when nothing else can write the same rows during the test window. If exact-count tests flake, first re-run the suspects in isolation before assuming your change broke them; a real fix gates or disables the background sweep during those tests rather than reshuffling the production logic the test covers.
