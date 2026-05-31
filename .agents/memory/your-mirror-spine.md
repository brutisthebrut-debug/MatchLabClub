---
name: Your Mirror spine
description: Durable design decisions behind the "Your Mirror" unifying self-portrait feature
---

# Your Mirror — durable decisions

`/your-mirror` is the unifying spine: the conversational, evolving model of the user that every tool/signal feeds. It answers "what does the machine actually know about me," is honest about blind spots, and points to the next signal to feed.

**Why it exists:** the product's north star is readiness-first; the Mirror is the single surface that makes accumulated signal legible to the user and ties it back to Match Readiness. It is a synthesis layer over existing signals, not a new data source.

## Decisions to keep consistent
- **Real signals only.** The portrait is built purely from accumulated real coverage (registry-lane counts, stage, readiness, derived summaries). Blind spots are honestly surfaced as gaps, never papered over. Do not invent strengths the data does not support.
- **Same hybrid contract as every Claude tool.** Deterministic baseline always-on; Claude opt-in behind `ai_content_consent` + daily cap; deterministic fallback on consent-off/failure/cap. The ask endpoint must register its toolName in `aiToolSchemas` or the Claude lane is dead code (see ai-tool-schema-registration.md).
- **Only aggregate/derived coverage goes to Claude, never raw content/PII.** Grounding shown to the user is server-deterministic, never model-authored.
- **Demo fallback must not lie.** Anon (401) gets a clearly-labelled sample portrait with chat disabled. A *signed-in* user hitting a non-auth error must see an explicit error state, NOT a silent sample. Distinguish "not signed in" from "server error" — do not collapse both into `!portrait`.
- **Never orphan the older Mirror pages.** `/mirror`, `/mirror/journal`, `/mirror/dates` stay reachable; trend views are demoted to a subsection of `/your-mirror`, not deleted.

## Multi-app surface
`MatchExternalReadInput.source` is a label only (no switch logic on its value), so widening the enum (e.g. adding `facebookDating`) is non-breaking: extend the OpenAPI enum, regen codegen, add the SelectItem, update copy. Keep app lists inclusive.
