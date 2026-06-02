---
name: Import enrichment durability
description: Non-obvious rules for retrying/recovering stranded Hinge/Instagram AI enrichment rows
---

# Import enrichment durability

AI enrichment for imported sources (Hinge GDPR export, Instagram tone) is kicked
off fire-and-forget after upload. A background recovery sweep re-runs rows that
got stranded. Two non-obvious rules keep "durable" from quietly meaning "never
recovers":

## 1. A daily cap must NOT consume the per-row retry budget
When a Claude call hits the daily cap, the enrichment writes the row to
`status:fallback` with `aiError:"daily_cap_exceeded"`. This is a time-window
condition, not a defect in the row. If you increment the row's `aiRetryCount`
on a cap hit, a row that bumps the cap a few times in one window will exhaust
`MAX_ENRICH_RETRIES` and then never recover after the next-day reset.
**Rule:** "non-consuming" fallback reasons (currently just `daily_cap_exceeded`)
hold `aiRetryCount` steady; only genuine transient defects increment it. The
capped call short-circuits before any real API request, so re-running it is cheap.

## 2. The recovery cooldown and the DB prefilter must key off the SAME timestamp
The sweep does a DB prefilter, applies `LIMIT batch`, then a pure
`shouldRecoverRow` check. If the DB prefilter keys fallback eligibility off
`uploadedAt` but the cooldown check keys off `processedAt`, the batch fills with
old rows that were *recently* retried (still in cooldown) and starves rows that
are actually eligible. **Rule:** prefilter and order fallback candidates by
`coalesce(processedAt, uploadedAt)` so the DB-side filter matches the in-memory
cooldown logic. Pending (crash-recovery) rows correctly key off `uploadedAt`.

## aiError taxonomy gotcha
The `aiError` strings persisted to `parsedSummary` are NOT the same set as
`generate()`'s internal terminal-retry classes. Persisted values include:
`consent_not_granted` (mapped from `consent_required`), `daily_cap_exceeded`,
`no_output`, `json_parse_failed`, `schema_validation_failed`, `unknown_error`,
or a raw `err.message`. Recovery's terminal-skip set must be written against the
*persisted* names. Instagram never lands in `fallback` (it always completes with
a deterministic read), so only Hinge rows are fallback-recoverable.

**Why:** caught in code review; both were silent strand-forever bugs.
**How to apply:** any new enrichment source or recovery rule must preserve both
invariants and target persisted `aiError` names.
