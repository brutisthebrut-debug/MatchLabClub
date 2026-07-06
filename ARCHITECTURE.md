# MatchLab Club — Architecture Overview

> Start here. This is the guided map of the codebase for a first-time reviewer.
> It explains what the product is, how the monorepo fits together, how a request
> flows end to end, and where each subsystem lives. For the production migration
> off Replit, read `MIGRATION.md` (it is the authoritative migration plan).

## Document map

Read these in the order that matches your goal:

| If you want to... | Read |
|---|---|
| Understand the layout and how pieces connect (you are here) | `ARCHITECTURE.md` |
| Review the plan to move off Replit infrastructure | `MIGRATION.md` |
| Understand the product vision and north star | `VISION.md`, `replit.md` |
| See the full feature/product specification | `PROJECT_SPECIFICATION.md` |
| Know what CI checks gate a merge | `CI.md` |
| Run operational tasks (Stripe, GeoIP, monitoring) | `OPERATIONS.md` |
| See the marketing/positioning handoff | `MARKETING_HANDOFF.md`, `seo_strategy.md` |

## What the product is

MatchLab Club is an AI companion that sits alongside dating apps (Tinder, Hinge,
Bumble). Its north star is readiness first, matching as the payoff: help a person
become genuinely relationship-ready, then match them (AI-driven, radius-based)
with people they would not find on their own. The optimize-your-existing-apps
tools (profile audits, message coaching, bio rewrites, quizzes) provide immediate
value and, at the same time, feed one rising Match Readiness meter that gates
matching.

The AI is hybrid. A deterministic engine runs on every account by default with no
keys and no external calls. Anthropic Claude is layered on top, opt-in per account,
for semantic depth. When consent is off or a provider fails, the deterministic
engine handles the request and nothing breaks.

## Tech stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 (strict)
- Frontend: React 19 + Vite + Wouter + TanStack Query + Framer Motion + Recharts
- UI: shadcn/ui, Tailwind v4
- API: Express 5
- Database: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API contract: OpenAPI spec, Orval codegen (typed hooks + Zod schemas)
- Mobile: Expo / React Native
- Build: esbuild (API), Vite (web)

## Monorepo layout

The repo is a pnpm workspace. Deployable apps live under `artifacts/`, shared code
lives under `lib/`. Artifacts never import each other; shared logic is promoted to
a lib. See the `pnpm-workspace` skill notes in `replit.md` for the workspace rules.

```
matchlab-club/
├── artifacts/            deployable applications
│   ├── nldc/             React + Vite web app (previewPath: /)
│   ├── api-server/       Express API server (previewPath: /api)
│   ├── nldc-mobile/      Expo / React Native mobile app
│   └── mockup-sandbox/   design/canvas preview harness (not a shipped product)
├── lib/                  shared libraries (composite TS packages)
│   ├── api-spec/         OpenAPI spec — the API contract source of truth
│   ├── api-client-react/ generated TanStack Query hooks (do not edit generated/)
│   ├── api-zod/          generated Zod schemas (do not edit generated/)
│   ├── ai-schemas/       shared AI request/response schemas
│   ├── db/               Drizzle schema + migrations (source of truth for DB)
│   ├── echo/             the "Echo" companion voice/proactivity logic
│   ├── integrations-anthropic-ai/  Anthropic client wiring
│   └── replit-auth-web/  Replit Auth (OIDC) web helpers
├── e2e/                  Playwright end-to-end tests
├── scripts/             shared utility scripts (post-merge, etc.)
├── MIGRATION.md         production migration plan (off Replit)
├── PROJECT_SPECIFICATION.md, VISION.md, OPERATIONS.md, CI.md
└── replit.md            project README + conventions + gotchas
```

## How a request flows

The API is contract-first. The OpenAPI spec is the single source of truth; the
client hooks and the shared Zod schemas are generated from it.

```
lib/api-spec/openapi.yaml   (contract: the source of truth)
        │  pnpm --filter @workspace/api-spec run codegen  (Orval)
        ├──────────────► lib/api-client-react/src/generated/  (React Query hooks)
        └──────────────► lib/api-zod/src/generated/           (Zod schemas)

Browser (artifacts/nldc)
  useX() generated hook  ──HTTP──►  Express (artifacts/api-server)
                                      route validates with shared Zod schema
                                      │
                                      ├─► aiEngine.ts   (deterministic, always on)
                                      ├─► aiService.ts  (Claude, opt-in + capped)
                                      └─► Drizzle ORM ──► PostgreSQL (lib/db schema)
```

Rules that keep this consistent:

- The contract changes first. Edit the OpenAPI spec, run codegen, then implement.
  Do not hand-write client hooks or drift route responses from the spec.
- Server and client share the same Zod schemas, so validation is symmetric.
- All frontend data access goes through the generated hooks from
  `@workspace/api-client-react`.

## Key subsystems and where they live

Files below are under `artifacts/api-server/src/` unless noted.

- **AI, hybrid.** `lib/aiEngine.ts` is the deterministic, always-on baseline (no
  keys, never rate-limited). `lib/aiService.ts` is the provider-routing layer that
  adds Anthropic Claude on top, gated per account by `ai_content_consent` and a
  daily cap. Consent off or provider failure falls back to the engine.
- **Signal registry.** `lib/signalRegistry.ts` is the single source of truth for
  every readiness/matching signal (id, weight, confidence, normalization, prompt
  line, UI copy). Readiness scoring and the matching prompt both derive from it,
  so a new data source is one registry entry plus its DB count, not edits spread
  across files.
- **Readiness and matching.** `lib/readiness.ts` derives the Match Readiness
  score/breakdown/next-actions from the registry. `lib/matching.ts` handles
  radius-based matching and injects aggregate signal coverage (never raw content).
- **Auth.** `routes/auth.ts` + `lib/auth.ts` + `middlewares/authMiddleware.ts`
  implement Replit OIDC today. `routes/devAuth.ts` is a dev-only bypass. The
  anonymous-claim flow (`lib/anonClaimToken.ts`, `lib/handoffToken.ts`) lets
  anonymous audits be reassigned on login and carried across devices. Migration
  off Replit OIDC is Phase 1 in `MIGRATION.md`.
- **Payments.** `lib/stripeClient.ts`, `lib/initStripe.ts`, `lib/stripeReconcile.ts`,
  `lib/webhookHandlers.ts` run Stripe through the Replit-managed integration today.
  Migration to the direct Stripe SDK is Phase 2a in `MIGRATION.md`.
- **Object storage.** `lib/objectStorage.ts` talks to a Replit sidecar today; the
  abstraction is clean and only the credential helpers change on migration
  (Phase 2b).
- **Email.** `lib/mailer.ts` already supports a direct Resend key or SMTP, so it
  is portable as-is.
- **Background jobs.** Started from `index.ts` via timers (auto-proposal, nudges,
  digest, GeoIP, OCR learning, trash purge, token cleanups). They assume a single
  instance; moving to a queue worker for autoscale is Phase 4a in `MIGRATION.md`.
- **Frontend shell.** `artifacts/nldc/src/components/layout/AppLayout.tsx` chooses
  between the authenticated sidebar and the marketing top-nav per route. See the
  Gotchas section of `replit.md` before touching navigation.

## Data model

The Drizzle schema under `lib/db/src/schema/` is the source of truth. Migrations
are committed under `lib/db/drizzle/`. In development, `pnpm --filter @workspace/db
run push` applies schema changes directly. A `check-schema-drift` validation
verifies the committed migrations match the schema. Production should apply
migrations with `drizzle-kit migrate`, not `push` (see `MIGRATION.md` Phase 4b).

## Running it locally

```bash
pnpm install                                        # install workspace deps
pnpm --filter @workspace/api-server run dev         # API on port 8080
pnpm --filter @workspace/nldc run dev               # web on $PORT
```

Required env: `DATABASE_URL` (Postgres). Most other env vars have safe defaults
or degrade gracefully; the full inventory is in `MIGRATION.md` section 3 and
`OPERATIONS.md`.

## Quality gates

These run in CI and should pass before merge (see `CI.md` for the authoritative list):

```bash
pnpm run typecheck                                  # all packages
pnpm --filter @workspace/api-server run test        # API test suite
pnpm --filter @workspace/nldc run test              # web test suite
pnpm --filter @workspace/db run check-schema-drift  # migrations match schema
pnpm run lint
```

## Conventions worth knowing before you read code

- Contract-first: change the OpenAPI spec and regenerate; never edit files under
  any `generated/` directory by hand.
- One signal source = one `SIGNAL_REGISTRY` entry; do not hand-tune weights,
  denominators, or the matching prompt across files.
- Every page ships with demo/fallback data so the UI is never empty.
- Voice: no em dashes and no AI-tell words in user-facing copy; a `voice-lint`
  check enforces this.
- Full conventions, gotchas, and non-obvious pitfalls are documented in `replit.md`.
