---
name: Echo voice — "the machine" vs first-person friend
description: Where copy says "the machine" vs Echo's first-person "I", and why the boundary exists
---

The friend-first Echo pivot replaced clinical "the machine"/"the engine" phrasing with Echo's first-person voice ("I'll surface...", "what I understand about you", "the picture I have of you") on the **interactive tool pages and their empty states / result handoffs** (the WelcomePanel callers, ToolHandoff `fedLine`s, quiz intro/all-done copy, copilot tool pages).

**Boundary that intentionally stays clinical / keeps "the machine":**
- Marketing + explainer pages where precise positioning earns trust: Pricing, Privacy, HowItWorks, Landing's deep sections, Matching, MatchPath, Waitlist.
- Hub / data-management pages: ConnectionCenter, DataVault, SelfHub, WellnessCenter, Account, Imports, SourcePaste, QuizPlay, Milestones, ShareCard, Flags.
- Code comments (not user-facing).

**Why:** replit.md names "the more the machine knows you, the better it matches you" as the product's unifying line, so "the machine" is deliberate positioning language in marketing/hub copy. But on a tool the user is actively using, Echo should sound like a friend doing the work, not a lab readout. Do NOT bulk-replace every remaining "the machine" with "Echo" — the ones left are intentional. Do NOT revert tool-page copy back to "we'll"/"the machine".

**How to apply:** new interactive tool pages and their empty states should speak as Echo ("I'll..."). New marketing/positioning copy may keep "the machine". Lint new copy with detectAiTells + countEmDashes; "unlock(ed)" is allowed (gamification), "leverage"/"highest-leverage" is not.
