---
name: Internal match proposal mirror + uniqueness
description: Why internal matches are two ordered rows per pair, and the uniqueness/dedup invariant that keeps the discover engine race-safe.
---

# Internal match proposals: mirror design + uniqueness

The internal matching engine stores each pairing as TWO rows in `match_proposals`:
A->B and B->A (each `source='internal'`, mirrored score/summary). This is intentional
so each member sees and responds to their own proposal independently, and the
`mutual_yes` "it's a match" transition fires when both reciprocal rows reach `user_yes`.

## The invariant
Uniqueness is on the ORDERED pair, not the unordered pair: partial unique index
`(user_id, proposed_to_user_id) WHERE source='internal'`. This permits exactly one row
per direction (so the mirror's two rows are both valid and distinct) while blocking
duplicate same-direction inserts.

**Why:** without it, two concurrent `POST /me/matching/discover` runs could both pass the
"does a proposal already exist?" pre-check and double-insert. The discover insert uses
`.onConflictDoNothing()` against this index to stay idempotent and race-safe. The
`mutual_yes` reciprocal `.limit(1)` lookup is only correct because this index guarantees
at most one row per direction.

**How to apply:** do NOT make the index unordered (`LEAST/GREATEST`) — that would reject
the second mirror row and break the design. Any future migration that adds such a
uniqueness constraint to a table that previously allowed duplicates MUST dedupe first
(keep newest per ordered pair by created_at then id) before `CREATE UNIQUE INDEX`, or the
index creation fails on existing data. See migration `0018_amused_jack_power.sql`.

## Gender gating reality
There is no first-class gender/orientation/age on profiles; the gate reads the latest
`audits` row. UI offers `trans-women`/`trans-men` preferences, mapped onto the women/men
umbrella in `bucketGenderPreference` (a trans woman is a woman). Unknown/unreadable
preference or unknown target gender = open, so a missing audit never hard-blocks a match
(it only lowers confidence). Follow-up worth doing: promote gender/orientation/age +
coarse location to first-class profile fields for reliable gating and real radius.
