---
name: Living signal registry
description: How readiness/matching signals are registered and consumed; how to add a new signal source correctly.
---

# Living signal registry

`artifacts/api-server/src/lib/signalRegistry.ts` is the single source of truth for every
readiness/matching signal. Each signal is one `SignalContributor` entry in `SIGNAL_REGISTRY`
(id, countKey, label, dimensions, weight, confidence, normalize {count|binary}, optional
decayHalfLifeDays, `describe(coverage)` prompt line, and UI `action` copy).

## The rule
To add a new signal source (a connector, quiz, import), add ONE entry to `SIGNAL_REGISTRY`
plus the DB count for it. Do NOT hand-edit weights/denominators/prompt/action copy in
multiple files like before.

- `readiness.ts` consumes the registry: `computeBreakdown`, `scoreFromBreakdown`,
  `computeNextActions` all derive from it. `ReadinessBreakdown`/`SignalCounts` are defined
  in the registry and re-exported from `readiness.ts` (keeps existing imports working,
  avoids a circular import).
- `matching.ts` external-read injects `describeActiveSignals(readiness.breakdown)` into the
  Echo prompt, so a new signal auto-appears in the AI's reasoning with no prompt rewrite.
- `proposeWeightAdjustments` is the "breathing" layer: bounded (`ADJUST_CAP`), deterministic
  outcome-driven re-weighting. It is intentionally NOT wired into live scoring, so behavior
  is unchanged until we choose to act on it.

**Why:** previously adding a signal meant synchronized edits across readiness math, the
matching query, and UI, and weights had to be re-balanced by hand to keep `sum == 1.0`.
`normalizedWeights` now auto-normalizes, so adding a contributor never breaks the invariant.

## How to apply / gotchas
- `normalizedWeights` keys the output `Record` by `contributor.id`, so **every id must be
  unique**. A duplicate id collides and silently drops a weight from the sum (this is what
  broke an early test). When adding a contributor for a new breakdown key, widen the
  `ReadinessBreakdown`/`SignalCounts` interfaces in `signalRegistry.ts`.
- Day-one weights already sum to 1.0, so normalization is an identity and readiness scores
  are byte-for-byte preserved. `readiness.test.ts` is the behavior-preservation guard.
- Voice rules apply to `describe()` and `action` copy (no em dashes, no AI-tell words).
- Prompt augmentation only sends aggregate coverage percentages + generic descriptions,
  never raw user content / PII. Keep it that way.
