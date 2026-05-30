---
name: CSRF origin guard vs. local smoke tests
description: Why POST/PUT/DELETE smoke tests get a false 403 unless they originate from the real Replit domain
---

# False 403 on write requests during smoke testing

The api-server has a CSRF Origin guard (in `app.ts`, before the router): for any
non-safe method (POST/PUT/PATCH/DELETE), if the request carries an `Origin`
header that is **not** in the allowlist, it is rejected with `403 {"error":
"Cross-origin request rejected"}` before any route handler runs (~1ms response).
Requests with **no** Origin (curl, native mobile, server-to-server) pass through.

The allowlist is built from the Repl domains (`REPLIT_DOMAINS`, the REPL_ID-based
dev domain, and the Expo domain).

**Why this matters:** A browser-based smoke test (Playwright) pointed at
`http://localhost:80` (the shared proxy) sends `Origin: http://localhost`, which
is NOT in the allowlist, so every write returns 403 even though the feature is
fine. This looks exactly like a broken anonymous-audit funnel but is purely a
test-origin artifact.

**How to apply:** When smoke-testing write endpoints with a real browser, set the
Playwright `baseURL` / navigation origin to `https://${REPLIT_DEV_DOMAIN}` so the
`Origin` header is allowlisted. Confirmed: from the dev domain the full anonymous
funnel (wizard → real `/report/:id`) returns 201 and renders. The quiz "Reveal My
Result" still logs a separate 403 from the optional `useEnhanceAi()` Claude layer
(anon has no content consent); that one is by-design and falls back to the
deterministic archetype result, not a bug.
