---
name: AI deep lane (Claude) wiring
description: How the documented "Deep AI lane" maps to actual Claude call sites, and the house pattern for adding a Claude lane to a tool.
---

# Deep AI lane: docs vs. reality

The `replit.md` "Deep AI lane" paragraph lists tools Claude "enhances" (bio rewrites,
message coaching, Compatibility Compass synthesis, Hinge import, IG tone). That list is
aspirational, not a guarantee that every tool calls Claude. **Before trusting the docs,
grep for `generate(` with `provider: "anthropic"` to see which routes are actually wired.**

**Why:** Several flagship tools historically ran deterministic-only while the docs implied
Claude was layered on. Now wired: message coach (`/messages/:id/coach`) and audit/bio rewrite
(both `audits.ts` call sites + `/audits/from-screenshot`, via `enhanceBioRewriteWithAi` which
overlays only `rewrittenBio`+`bioAudit`, never the score). Remaining gaps as of this writing:
email insights (`insights.ts`, no AI at all) and Compass synthesis (routes through the generic
`/ai/enhance`, which is OpenAI-default and NOT consent-gated — a privacy inconsistency). Verify
current state with grep before trusting this list.

## House pattern for adding a Claude lane to a tool

1. Compute the deterministic baseline first (it is the guaranteed fallback).
2. Only call the LLM for authenticated users (`req.user?.id`); anon callers skip it.
3. Call `generate({ provider: "anthropic", expectJson: true, requireContentConsent: true,
   userId, context: { toolName: "<Name>" } }, "")`. The consent gate runs first inside
   `generate`, so no-consent never burns the daily cap.
4. Register the output Zod schema in `@workspace/ai-schemas` (`aiToolSchemas`) under a key
   that **exactly matches** `context.toolName` — that is what turns on structured
   validation + one repair retry inside `generate`.
5. Use the AI result only when `!isFallback && validated && output` (parse `output`, which
   is `JSON.stringify(value)`); otherwise keep deterministic.
6. Wrap the whole `generate` call in try/catch and fall back to deterministic on any throw.
   `generate` returns fallback for provider/model errors, but defense-in-depth keeps the
   endpoint from ever 500-ing on an unexpected throw (consent DB lookup, parse, etc.).

**How to apply:** `matching.ts` (`/me/matching/external-read`) and `messages.ts`
(`/messages/:id/coach`) are the reference implementations. Keep the response contract
(generated Zod) unchanged — the AI lane must produce the same shape as the deterministic one.

`@workspace/ai-schemas` exports `./src/index.ts` directly (no dist build), so schema edits
are picked up on the next api-server workflow restart.
