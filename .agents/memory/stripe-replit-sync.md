---
name: Stripe webhook via stripe-replit-sync
description: Non-obvious gotchas wiring Stripe webhooks with stripe-replit-sync (things the stripe skill template gets wrong)
---

# Stripe webhook with stripe-replit-sync — non-obvious lessons

Operational details live in `replit.md` ("Stripe webhook + reconciliation"). Keep only what is NOT discoverable from code or that doc here.

## The stripe skill's code-templates are stale vs the installed package
When the skill template and the installed `.d.ts` disagree, trust the `.d.ts`.
**Why:** `stripe-replit-sync@1.0.0` types differ from the skill's `code-templates.md`, which caused TS2353/TS2339 on first pass:
- `runMigrations` takes NO `schema` option (the package always uses the `stripe` schema).
- `findOrCreateManagedWebhook` returns the `WebhookEndpoint` directly, not `{ webhook }`.
**How to apply:** read `node_modules/.pnpm/stripe-replit-sync@*/.../dist/index.d.ts` before adapting any snippet.

## stripe deps resolve from the workspace root, not the api-server package
`stripe` + `stripe-replit-sync` are installed at the repo root and resolve via pnpm hoisting; api-server typechecks fine without them in its own package.json. Do not "fix" this by re-adding them.
