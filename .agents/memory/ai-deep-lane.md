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
Claude was layered on. Now wired through the consent-gated Anthropic lane: message coach
(`/messages/:id/coach`), audit/bio rewrite (both `audits.ts` call sites + `/audits/from-screenshot`,
via `enhanceBioRewriteWithAi`, overlays only `rewrittenBio`+`bioAudit`, never the score), email
insights (`/insights/:id/analyze` via `enhanceEmailInsightWithAi`, overlays descriptive fields but
NOT `sourceApp`, which is persisted and drives the rollup grouping), and Compatibility Compass
(via the `/ai/enhance` server-side allowlist below). Verify current state with grep before trusting
this list.

## The /ai/enhance shared-endpoint trap (Compass)

`/ai/enhance` (`ai.ts`) is a generic coaching endpoint many tools hit; it defaults to OpenAI and
is NOT consent-gated by default. Compatibility Compass historically used it and relied only on the
*client* gating the call on consent, so a direct API caller could ship two people's profile/message
content to a hosted LLM with no server check. Fix pattern: keep a server-side `CONTENT_SENSITIVE_TOOLS`
set and, for those tool names only, pass `provider:"anthropic"`, `requireContentConsent:true`,
`userId:req.user?.id` into `generate`. Non-sensitive tools keep the prior default-provider behavior.
**Why:** the gate must live on the server (fail-closed) — client-only gating on a shared endpoint is
bypassable. **How to apply:** add any new tool that ships raw user content through `/ai/enhance` to
that set, or give it a dedicated route.

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
