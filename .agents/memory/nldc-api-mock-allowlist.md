---
name: nldc api-client-react vi.mock allowlist
description: Frontend integration tests mock @workspace/api-client-react with an explicit hook allowlist, so any new hook used by a tested page must be added or the suite throws.
---

The nldc frontend integration tests (e.g. `src/integration/aiFallback.test.tsx`,
`src/integration/aiToolWelcomePanels.test.tsx`) `vi.mock("@workspace/api-client-react", ...)`
with a hand-written object listing ONLY the hooks/query-key helpers each test needs.
It is NOT a partial mock (no `importOriginal` spread), so it is a strict allowlist.

**Rule:** when a page rendered by one of these tests starts calling a new generated hook
(e.g. adding `useGetCompassSignalContext` to `CompatibilityCompass.tsx`), you MUST add that
hook (and its `getX...QueryKey`) to every test mock that renders the page, or vitest throws
`No "useX" export is defined on the "@workspace/api-client-react" mock`.

**Why:** the error surfaces as an uncaught render exception in an unrelated-looking component
and can be mistaken for a flaky/pre-existing failure.

**How to apply:** before finishing a frontend change that adds a hook, grep the test files
that render the changed page and extend their mock objects. To find which tests render a page:
`rg -l "PageName" artifacts/nldc/src --glob "*.test.tsx"`.

**Separately pre-existing (NOT yours):** `test-claim-client` fails because
`NextBestActionCoach.tsx` calls `useGetMatchingState`, which is missing from the
aiFallback / aiToolWelcomePanels / insightsRollupCard mocks. Unrelated to Compass work.
