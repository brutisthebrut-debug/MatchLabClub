---
name: Runtime voice gate on generated copy
description: Decisions behind keeping AI-generated user-facing copy on-voice after generation
---
The source-copy voice lint only guards hand-written strings; copy generated at runtime (bio rewrites, coaching, Mirror synthesis, import summaries) had no on-voice guard. `aiService.generate()` now post-polices live output through an `enforceVoice` helper in `@workspace/echo`.

Durable decisions:
- Em dashes are treated as mechanical and auto-cleaned in place (replaced with a comma). This is intentionally applied even to JSON outputs: em dashes only ever appear inside string values, so the JSON stays valid.
- Banned AI-tell words are NOT auto-rewritten (no safe substitution). They get one correction round, then the deterministic fallback. **Why:** shipping silently-mangled live copy is worse than the known-good deterministic fallback.
- A forced voice-violation fallback must report `validated:false` for JSON tools — it is deterministic fallback text, not schema-validated model output. Don't let a stale `validated:true` from the regen leak through.
- "unlock(ed)" stays allowed (gamification reward language), mirroring the source-copy lint carve-out. Keep the two carve-outs in sync.

**How to apply:** only live, non-fallback output is policed. The correction round calls generateInner once, which itself may schema-retry for JSON tools, so a structured correction can cost more than one extra provider call / Anthropic cap slot; the gate never loops. The vision path (`analyzeProfilePhotos`) is separate and is NOT yet policed.
