---
name: AI tool schema registration is required to activate the Claude lane
description: Why a new hybrid-AI tool silently stays deterministic-only unless its toolName is registered in aiToolSchemas
---

When adding a new Claude-backed (hybrid) tool that calls `generate({ expectJson: true, context: { toolName } })`, the deep-AI lane will silently never activate unless you register a schema for that exact `toolName` in `lib/ai-schemas/src/index.ts` (`aiToolSchemas` map).

**Why:** `generate()` only sets `validated: true` when `getAiToolSchema(toolName)` finds a schema. Routes that promote AI output only when `!isFallback && validated && output` will therefore always fall through to the deterministic baseline (`isFallback: true`) even with consent on and the provider healthy. This is dead code that passes typecheck, lint, and most tests, because the deterministic path still returns valid output. The architect catches it, not the compiler.

**How to apply:** For every new hybrid tool: (1) add a zod schema in `ai-schemas` and register it under the literal `toolName` key, (2) make sure the route's `context.toolName` string matches that key exactly, (3) add a route test that mocks `generate` returning `{ isFallback:false, validated:true, output }` and asserts the AI output is promoted (`isFallback:false` in the response), plus tests for the fallback/anonymous/throw/unvalidated paths. Optionally also `safeParse` the JSON in the route as defense in depth, but registration is what makes the lane live.
