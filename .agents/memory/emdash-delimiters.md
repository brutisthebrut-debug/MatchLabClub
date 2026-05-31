---
name: Em dashes double as functional delimiters
description: Why a blanket em-dash copy cleanup can break engine logic, and how to do it safely
---

The product has a HARD voice rule: no em dashes (U+2014) in user-facing copy. But em dashes are NOT only display copy in this codebase — some are functional delimiters and standalone placeholders.

**The rule:** Before doing any global em-dash replacement, account for these non-display uses:
- **Delimiters consumed by `.split("—")`** — the deterministic engine's `attachmentStyles` array stored entries as `"Label — description"` and extracted the short label via `.split("—")[0]`. A blanket `" — " -> ", "` replacement silently breaks this (the split no longer finds the delimiter and returns the whole phrase). Fix: repoint the split to the new delimiter (`.split(",")`).
- **Standalone `"—"` placeholders** — empty-value UI displays (e.g. score bubbles, input placeholders). Replace with `"-"`, not `", "`.
- **Sanitizer regex char-classes** — e.g. a title cleaner regex that includes `—` to strip it from `<title>`. KEEP these; they exist to remove em dashes.
- **Code comments** — not user-facing, out of scope of the voice rule; leave them or change them, but they are not violations.

**Why:** All the functional landmines were the NON-spaced form (`split("—")`, `"—"`, `>—`), while display-copy violations were the spaced `" — "` form. So a perl pass on the spaced form only (`s/ \x{2014} /, /g`) is provably safe against the landmines, and the handful of non-spaced cases get hand-fixed. After any such change, grep for remaining `.split("—")`/`includes("—")`/`indexOf("—")` to confirm no delimiter logic was orphaned, and restart the API server before curl-verifying (the bundled build does not hot-reload).

**How to apply:** Any future voice/copy sweep that touches em dashes must check for these four categories first. The attachmentStyles label extraction lives in `aiEngine.ts` (insight summary) and `routes/insights.ts` (rollup) — both split on the same delimiter and must stay in lockstep.
