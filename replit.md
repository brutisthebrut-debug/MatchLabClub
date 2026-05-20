# Next Level Dating Club

AI-powered dating profile and messaging coaching web app that audits profiles, rewrites bios, coaches messages, and surfaces communication patterns — all without any external AI API.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nldc run dev` — run the frontend (dynamic port via $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + TanStack Query + Framer Motion + Recharts
- UI: shadcn/ui components, Tailwind v4, Plus Jakarta Sans + Playfair Display fonts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nldc/` — React+Vite frontend (previewPath: `/`)
- `artifacts/api-server/` — Express API server (previewPath: `/api`)
- `artifacts/api-server/src/lib/aiEngine.ts` — deterministic AI engine (no external API)
- `lib/api-spec/` — OpenAPI spec source of truth
- `lib/api-client-react/src/generated/` — generated hooks and Zod schemas (do not edit)
- `lib/db/src/schema.ts` — Drizzle schema source of truth

## Architecture decisions

- **No external AI API** — the coaching engine is entirely deterministic, built on structured prompt-to-output logic in `aiEngine.ts`. Ships without API keys, never fails from rate limits.
- **Consent-first integrations** — Integrations page is UI-only (coming soon), with explicit consent toggles and clear "what we access / never touch" breakdowns.
- **Demo data as fallback** — Every page has hardcoded demo data so the UI never looks empty, even before a user completes their first audit.
- **Contract-first API** — OpenAPI spec → Orval codegen → typed hooks. Server and client share Zod schemas.
- **Revenue-first product** — Pricing page with three tiers ($0 / $97 / $197), podcast promo code, waitlist with early listener perks.
- **Cross-device anonymous claim** — Anonymous audits are tagged with a server-issued token kept in the `anon_claim` cookie. On login, `POST /api/claim-anonymous` reassigns them. For users who switch devices or clear cookies, `POST /api/claim-anonymous/handoff/issue` mints a short-lived (15 min) HMAC-signed token they can carry to another browser, and `POST /api/claim-anonymous/handoff/redeem` claims with that token instead of the cookie. Optional env `ANON_CLAIM_HANDOFF_SECRET` overrides the default signing key (derived from `REPL_ID`).

## Product

- **Landing page** — hero, social proof, privacy promise, final CTA
- **Intake wizard (5 steps)** — name/age/gender, goal, bio paste, message sample, review + submit
- **Dashboard** — score ring, score history sparkline, strengths/risks badges, recent audits, quick actions
- **Report page** — full audit with score, bio critique, AI rewrite, prompt rewrites, photo checklist, action plan
- **Message coach** — paste conversation, get 3 reply options (Playful/Direct/Warm) with rationale
- **Email insights** — paste message history, get communication patterns, attachment style, profile tips
- **Integrations settings** — consent-first UI for Gmail, Calendar, screenshot upload, social import (coming soon)
- **Pricing** — 3-tier pricing with podcast discount, FAQ accordion
- **Waitlist** — live count, signup form, early listener perks

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not run `pnpm dev` at the workspace root — use workflow restart instead
- `pnpm --filter @workspace/nldc run typecheck` for frontend type checking (not `build`)
- CSS: Google Fonts `@import url(...)` must appear at the very top of `index.css` (before Tailwind imports)
- All API hooks from `@workspace/api-client-react`; mutations use `mutate({ data: { ... } })`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
