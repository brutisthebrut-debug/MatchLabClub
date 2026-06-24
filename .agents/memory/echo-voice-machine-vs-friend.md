---
name: Echo voice — "the machine" vs first-person friend
description: Where copy says "the machine" vs Echo's first-person "I", and why the boundary exists
---

The friend-first Echo pivot replaced clinical "the machine"/"the engine"/"we'll"/"we read" phrasing with Echo's first-person voice ("I'll surface...", "what I understand about you", "the picture I have of you") on the **interactive tool pages AND the hub / data-management pages** (WelcomePanel callers, ToolHandoff `fedLine`s, quiz intro/all-done copy, copilot tool pages, plus ConnectionCenter, DataVault, SelfHub, WellnessCenter, Account, Imports, SourcePaste, QuizPlay, Milestones, ShareCard, Flags). ShareCard is user first-person share copy, so its "the machine" became "Echo" (not "I").

**Boundary that intentionally stays clinical / keeps "the machine":**
- Marketing + explainer pages where precise positioning earns trust: Pricing, Privacy, HowItWorks, Landing's deep sections, Matching, MatchPath, Waitlist.
- Code comments (not user-facing).
- Backend source-of-truth copy (e.g. `signalRegistry.ts` connector blurbs/access lists in api-server): a UI-relabel task touches only the nldc page files, never the backend registry strings, even when the wording is duplicated.

**Why:** replit.md names "the more the machine knows you, the better it matches you" as the product's unifying line, so "the machine" is deliberate positioning language in *marketing* copy. But on any page the user actively works in (tools and hubs alike), Echo should sound like a friend doing the work, not a lab readout. Do NOT bulk-replace every remaining "the machine" with "Echo" — the ones left in marketing/backend/comments are intentional. Do NOT revert hub/tool-page copy back to "we'll"/"the machine".

**How to apply:** new interactive tool/hub pages and their empty states should speak as Echo ("I'll..."). Keep routes, toolNames, schema ids, testIds, telemetry, and demo-content strings stable when relabeling voice. New marketing/positioning copy may keep "the machine". Lint new copy with detectAiTells + countEmDashes; "unlock(ed)" is allowed (gamification), "leverage"/"highest-leverage" is not.
