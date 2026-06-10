---
name: Gate cap-consuming client queries
description: A client query that hits a daily-capped Claude endpoint must enable only when its result will actually render, or it silently drains the cap.
---

# Gate cap-consuming client queries on render condition

Any TanStack Query that calls a hybrid endpoint backed by a daily-capped Claude
lane (e.g. `GET /me/connections/:id/starters`, message coach, mirror ask) must
set its `enabled:` predicate to the EXACT condition under which its result is
rendered, not just `isAuthenticated && id`.

**Why:** the first cut of the per-match starters query enabled on every
authenticated thread open, but the StartersCard only renders on an active thread
with zero messages. For consent-on users that fired a Claude call (and burned a
daily-cap token) on every closed thread and every ongoing conversation, for a
card that never showed. It is a silent cost/cap-drain, invisible in tests
because the deterministic fallback still returns 200.

**How to apply:** when wiring a client query whose backend can consume a
per-account daily AI cap, gate `enabled` on the render gate of the component
that consumes it. For thread/starters this was
`connectionQuery.isSuccess && status !== "closed" && messagesQuery.isSuccess && messages.length === 0`.
Mirror the server-side render condition; do not fetch eagerly "just in case".
The deterministic baseline masks the waste, so this won't surface as a test
failure — catch it at review time.
