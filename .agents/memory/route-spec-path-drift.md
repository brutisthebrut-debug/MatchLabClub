---
name: Hand-written route vs OpenAPI path drift
description: Server Express routes can silently diverge from the OpenAPI path, breaking the generated client; plus testDb table registration for routes that mutate new tables.
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

**Related testDb gotcha:** a route that deletes/updates a table only reachable
through that route (e.g. the block route purging `match_proposals`) needs that table
registered in `testDb.ts` (`ensureStore(name)` then `makeTable(name)` when it has no
defaults entry), or the route 500s under the testDb mock with "Cannot read
properties of undefined (reading 'defaults')".
