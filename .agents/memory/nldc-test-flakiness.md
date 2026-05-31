---
name: nldc test suite flakiness
description: The full @workspace/nldc vitest run can flake on a test that passes alone; how to confirm a real failure.
---

# nldc test suite flakiness

The full `pnpm --filter @workspace/nldc run test` run is heavy (200s+ import, 60s+ total) and can intermittently time out a `waitFor` in an integration test (e.g. `src/integration/staleReportPicker.test.tsx`) under parallel load, even when nothing is wrong.

**Why:** these jsdom integration tests render large component trees and the full suite runs them concurrently, so a slow worker can blow a `waitFor` timeout that is comfortably met in isolation.

**How to apply:** before treating an nldc suite failure as a real regression, rerun just the failing file with `cd artifacts/nldc && pnpm exec vitest run <path>`. If it passes alone and your change does not touch that area, it is a flake, not a break.
