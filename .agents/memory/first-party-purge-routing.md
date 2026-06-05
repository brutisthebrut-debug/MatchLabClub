---
name: First-party signal purge routing
description: Where GDPR/account-delete purge lives for first-party signal lanes, and the boot guard that enforces it.
---

# First-party signal purge routing

GDPR/account-delete purge for every first-party signal lane lives in `routes/trustLedger.ts`
under the `FIRST_PARTY_SOURCES` record (each entry pairs a `countStored` reader with a `purge`
writer, both filtered by `userId` only). It does NOT live in `routes/account.ts`.

**Why:** the trust ledger is the single hub that both displays "what we hold / what a purge would
remove" and performs the purge, so counts and deletes can never disagree. Adding purge logic to
`account.ts` would duplicate and risk drift.

**How to apply:** when you add a new first-party signal lane (new table + SIGNAL_REGISTRY entry),
add a matching `FIRST_PARTY_SOURCES` entry in `trustLedger.ts`. A boot-guard test in
`trustLedger.test.ts` ("registers a purge handler for every first-party signal source") fails if a
first-party lane lacks a purge handler, so you do not need a separate per-lane purge test.

**Watch out:** a code reviewer that is only shown `account.ts` (and not `trustLedger.ts`) will
falsely report "account deletion does not purge the new table." Verify against `trustLedger.ts`
before acting on such a finding.
