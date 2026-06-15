---
name: Hand-written route vs OpenAPI route/status drift
description: Server Express routes can silently diverge from the OpenAPI path OR status code, breaking/violating the generated client; plus testDb table registration for routes that mutate new tables.
---

In this contract-first repo the OpenAPI spec is the source of truth and the React
client is generated from it. Express routes are hand-written, so a route path can
silently drift from the spec. The generated client then calls the spec path while
the server serves a different one, producing a 404 that typecheck and codegen do
NOT catch.

**Concrete trap seen:** the safety blocks-list endpoint was specced (and generated)
as `GET /me/safety/block` (collection GET sharing the same path as the item `POST`),
but the Express route was written as `GET /me/safety/blocks` (plural). The list call
404'd. Fix was to align the server to the spec path, not the other way around.

**Why:** OpenAPI is the contract; align the server to it. Watch singular/plural and
collection-vs-item path shapes when a GET list and a POST create share a base path.

**How to apply:** after adding a hand-written route, grep the generated client
(`lib/api-client-react/src/generated/api.ts`) for the operation's path string and
confirm it matches the Express route literal exactly.

**Status-code drift is invisible to all green checks:** a POST that returns 201
while the OpenAPI documents the success as 200 (or vice-versa) still passes
codegen, typecheck, lint, AND the api-test suite, because Orval's generated client
returns `response.data` for any 2xx and the route's own test just asserts whatever
the route happens to return. The contract is silently violated even though
everything is green. For an idempotent upsert endpoint, 200 is the correct status
(retake updates, it does not create), so align the route to the specced 200 rather
than bumping the spec to 201.

**Why:** the spec is the contract; "all tests green" does not prove the
implementation matches it when the mismatch is a 2xx-vs-2xx status code.

**How to apply:** when you add or review a hand-written route, eyeball the
`res.status(...)` against the spec's documented response code for that operation,
not just the path. Do not rely on the test suite to flag a 2xx status mismatch.

**Related testDb gotcha:** a route that deletes/updates a table only reachable
through that route (e.g. the block route purging `match_proposals`) needs that table
registered in `testDb.ts` (`ensureStore(name)` then `makeTable(name)` when it has no
defaults entry), or the route 500s under the testDb mock with "Cannot read
properties of undefined (reading 'defaults')".
