---
name: drizzle-kit push ignores unique-index predicate changes
description: Why a partial->non-partial unique index change in schema didn't take effect via push, and the latent NOT NULL + set-null FK trap on a previously-empty table
---

# drizzle-kit push does not recreate an index when only its WHERE predicate changes

`pnpm --filter @workspace/db run push` (drizzle-kit push) diffs by index NAME. If you
change a unique index from partial (`.where(sql\`... IS NOT NULL\`)`) to non-partial (or
vice versa) while keeping the same index name, push leaves the OLD index in place. The
DB then still has the partial index even though the schema and the generated migration
SQL say non-partial.

**Why it bites:** `insert(...).onConflictDoNothing({ target: col })` fails with
Postgres `42P10 "there is no unique or exclusion constraint matching the ON CONFLICT
specification"` because a PARTIAL unique index can only be used as an ON CONFLICT
arbiter if you also pass a matching `targetWhere` predicate. Symptom looks like the
index is missing, but `\di` shows it present — check `pg_indexes.indexdef` to see the
stale `WHERE` clause.

**How to apply:** after changing an index predicate, either rename the index, or
manually `DROP INDEX <name>` then re-run push so it recreates from the current schema.
Always verify with `SELECT indexdef FROM pg_indexes WHERE indexname='<name>'`. Also,
when regenerating a migration after editing the schema definition, delete the stale
`drizzle/NNNN_*.sql`, remove its `meta/NNNN_snapshot.json`, and drop its entry from
`meta/_journal.json` before re-running `drizzle-kit generate`, or you get a spurious
follow-up migration.

**Prefer non-partial unique index for "unique when set" columns:** Postgres treats
NULLs as distinct in a plain unique index, so a non-partial `uniqueIndex().on(col)` on a
nullable column already allows many NULL rows while enforcing uniqueness on non-null
values — and it works as an ON CONFLICT arbiter with just `{ target: col }`, no
`targetWhere` needed.

# Populating a long-empty table can surface latent FK contradictions

`referrals.inviter_user_id` is declared `NOT NULL` but its FK uses
`onDelete: "set null"` — a contradiction that lay dormant because nothing ever inserted
into the table. Once rows exist, deleting an inviter user triggers the FK's SET NULL on
a NOT NULL column and raises `23502`. The live account-deletion path is safe because it
deletes the user's referral rows explicitly first; only direct user deletes (e.g. test
cleanup) trip it, so delete referral rows before users in any teardown.
**Why:** before relying on cascade/set-null behavior of a table you are newly
populating, audit that its FK onDelete actions are actually consistent with column
nullability.
