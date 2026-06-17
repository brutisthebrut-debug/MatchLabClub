---
name: Mirror Profile UI relabel vs stable route/toolName
description: The /mirror tool's UI reads "Profile Reflection" but its route, export, and backend toolName stay "Mirror Profile" on purpose; do not "finish" the rename.
---

The one-off bio/profile analysis tool at route `/mirror` was relabeled in all user-facing copy from "Mirror Profile" to "Profile Reflection" to end the name collision with `/your-mirror` (the signed-in home/spine).

Three things were deliberately NOT renamed and must stay stable:
- the route `/mirror` (deep links, nav hrefs)
- the component export (`MirrorProfile`)
- the backend correlation key `toolName="Mirror Profile"` passed to `FallbackRateBadge` (and the matching server-side tool name)

**Why:** the toolName is a join key for AI fallback-rate telemetry; relabeling the UI is cosmetic, but renaming toolName silently decouples the badge from its backend stats. A future agent grepping for "Mirror Profile" will see what looks like a half-finished rename and may try to "complete" it, breaking correlation.

**How to apply:** when repositioning/renaming any tool, change UI copy only; keep route, export name, and toolName/correlation keys fixed unless you migrate the backend + telemetry in lockstep. Same principle as signal-lane-id-stability, different surface (tool telemetry, not signal lanes).
