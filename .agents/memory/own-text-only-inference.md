---
name: Self-inference reads own-authored text only
description: Passive signal/wellness inference must never read two-sided or counterpart-authored columns.
---

# Self-inference reads own-authored text only

Any feature that infers facts about THE USER from their existing data (passive
wellness inference, future "second brain" extractors) must read only columns the
user themselves authored. Never feed two-sided / counterpart-authored fields into
the inference, on either the deterministic or the Claude lane.

Known two-sided / counterpart-bearing columns to exclude:
- `message_coaching_sessions.conversationContext` (contains the match's words) —
  read only `yourLastMessage` (the user's own line).
- `email_insights.pastedContent` (pasted message history, both sides).

**Why:** these columns mix the counterpart's text with the user's. Inferring the
user's own wellness/personality signal from a match's words is both wrong and a
privacy leak (counterpart text re-surfaced as the user's profile). An architect
review failed T2 specifically for reading `conversationContext`.

**How to apply:** when adding a source to an inference route, ask "did the user
author every word in this column?" If not, exclude it or project only the
own-authored subcolumn. The deterministic `inferWellnessSignals` and the Claude
`buildInferenceUser` prompt share ONE `sources` array, so fixing the source list
covers both lanes at a single chokepoint. Regression guard pattern: seed a row
where a dimension keyword exists ONLY in the excluded column and assert that
dimension is absent from the candidates.
