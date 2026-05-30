---
name: Anonymous claim/handoff signal wiring
description: Every new anonymous signal type must be wired through many places across BOTH web and mobile, in BOTH the cookie-claim and the cross-device handoff paths.
---

# Anonymous claim/handoff signal wiring

Adding a new anonymous data type (audits, profiles, messageSessions, insights, followUps, journalEntries, postDateNotes, ...) that should survive anonymous→login claim requires wiring it through ALL of these, or rows are silently dropped:

Web (`artifacts/nldc`):
- `lib/anonymousIds.ts` — KEYS, `readAnonymousIds`, `hasAnyAnonymousIds`
- `lib/handoffLink.ts` — `PendingHandoff` interface + every sanitize/decode/read block (encode, decode, readPendingHandoff)
- `hooks/useClaimAnonymousOnLogin.tsx` — claim AND redeem mutate payloads, success summary/toast, dashboard query invalidation, analytics events
- the producer components that create the rows (e.g. `WeeklyGrowthPlan`, `DebriefWhatHappened`) — call `rememberAnonymousId` in onSuccess

Mobile (`artifacts/nldc-mobile`):
- `lib/anonymousIds.ts` — KEYS, `readAnonymousIds`, `hasAnyAnonymousIds`
- `lib/handoffLink.ts` — `PendingHandoff` interface + `buildMobileHandoffShareUrl` payload (easy to miss; the cookie-claim path and the handoff path are separate)
- `lib/useClaimAnonymousOnLogin.ts` — claim payload + query invalidation
- the producer screens (e.g. `journal.tsx`, `dates.tsx`) — call `rememberAnonymousId` in onSuccess

**Why:** A code review caught that the mobile *handoff* path was wired for cookie-claim but NOT for the cross-device share URL, so journal/post-date rows were lost on device switches. The two paths look similar but must both be updated.

**Symmetry note:** Web carries `followUpIds`; mobile deliberately sends `followUpIds: []` (follow-ups are out of scope on mobile). The server (`claim.ts`) and generated API types already accept all fields, so the constraint is purely client-side completeness.

**How to apply:** When asked to add an anonymous signal, grep for an existing field name (e.g. `insightIds`) across both artifacts and mirror it everywhere it appears, including test fixtures that assert exact mutate `vars` and the cleared-state `readAnonymousIds()` shape.
