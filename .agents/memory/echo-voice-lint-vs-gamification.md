---
name: Echo voice lint vs gamification unlocks
description: detectAiTells bans words the founder's gamification copy intentionally uses
---

`detectAiTells` (lib/echo/src/voice.ts AI_TELL_WORDS) flags "unlock" and
"leverage" as banned AI-tell words. But the founder explicitly wants gamification
framed as "unlocks" (replit.md user preferences), so strings like "Momentum
Unlocked" are intentional product copy, not violations.

**Why:** A naive voice-lint sweep that strips every "unlock" would fight the
founder's standing gamification ask. "leverage" has no such carve-out and is
always a real violation (e.g. "Highest Leverage Next Move" -> "Your Best Next
Move").

**How to apply:** When sweeping copy through detectAiTells, treat gamification
"unlock(ed)" as allowed reward language; fix "leverage" and the rest.
