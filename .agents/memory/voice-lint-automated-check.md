---
name: Automated Echo voice lint over nldc copy
description: How off-voice copy is auto-caught, what it scans, and the carve-outs
---

`artifacts/nldc/src/lib/voiceLint.test.ts` is the automated guard that runs the
`@workspace/echo` voice helpers (`detectAiTells`, `countEmDashes`) over web copy.
Also registered as the `voice-lint` validation step.

**What it scans (precision over recall on purpose):** it parses every non-test
`.ts/.tsx` under `artifacts/nldc/src` with the TS compiler and lints ONLY
user-facing copy: JSX text nodes, an allowlist of copy-bearing JSX attributes
(title/label/placeholder/alt/description/...), copy-bearing object property
values (title/description/headline/cta/message/...), and toast/notification
string args. It deliberately ignores classNames, testids, CSS, imports, code
identifiers, and comments.

**Why precision:** a whole-file scan false-positives badly. The `glass-elevated`
utility class and `risk: "elevated"` both contain the AI-tell "elevate"; em
dashes live in code comments and regexes (`useMeta.ts`). Linting all strings
would never pass.

**Carve-outs:** "unlock" is removed from the linted AI-tell set (gamification
reward language is intentional per replit.md). "the machine" and the brand
tagline contain no banned words, so they pass without special-casing.

**How to apply:** when adding a new copy surface that the extractor doesn't
cover (a new copy prop key, a new notification helper), extend the allowlist
sets in the test, not the global helpers. If a new genuine violation appears,
fix the copy; do not weaken the lint. Does NOT cover the mobile app or backend
user-facing strings.
