---
name: Preview port-8080 race + benign screenshot 403
description: Why the API Server workflow intermittently shows FAILED in dev, and why the screenshot tool always logs a 403 on /api/events
---

# Dev preview port-8080 collision (NOT a production issue)

At cold boot, the `e2e-founder-ocr-trend` validation workflow starts its OWN
Playwright `webServer` copy of the API server on port 8080, racing the standalone
`artifacts/api-server: API Server` workflow for the same port. Whichever binds
first wins; the loser dies with `EADDRINUSE: address already in use 0.0.0.0:8080`
and shows FAILED. While e2e runs, the preview's API works (served by e2e's temp
server). The moment e2e finishes, Playwright tears that server down, port 8080 is
left with no listener, and the preview's backend goes dark — this is the
intermittent "preview is broken" symptom.

**Fix:** after e2e has finished (port 8080 free), restart the
`artifacts/api-server: API Server` workflow so it owns 8080 cleanly. Do NOT restart
it while e2e still holds the port — it will just EADDRINUSE again. With Playwright's
`reuseExistingServer: true`, once the standalone server owns 8080, future e2e runs
reuse it instead of starting their own.

**Why it is not a publish blocker:** deployments run only the app services (web +
API), never the e2e/validation workflows, and each service gets its own isolated
port in production. The race cannot happen there.

# Benign 403 on POST /api/events from the screenshot tool

The CSRF origin guard in `app.ts` lets through requests with no Origin header but
403s any non-safe (POST/PUT/etc.) request whose `Origin` is not in
`allowedOrigins` (built from `REPLIT_DOMAINS` + the Expo dev domain). The
screenshot tool's headless browser loads the app via `localhost:80`, so its
fire-and-forget analytics beacon `POST /api/events` carries a `localhost` origin
that is not in the allowlist → 403 in the browser console.

**This is a screenshot-tool artifact only.** Real preview users (iframe on the
`.replit.dev` domain) and production visitors send a matching origin and get 202.
The events route handler itself always returns 202 (never 403); the 403 comes from
the middleware. Don't chase this 403 as a real bug when it appears in a
screenshot's console log.
