---
name: Account-deletion dual path parity
description: Two GDPR delete paths exist in account.ts; both must wipe every user-scoped table or the confirmation path orphans rows.
---

# Account deletion has two divergent paths

`routes/account.ts` exposes two account-deletion endpoints:
- `DELETE /account` — the live in-app delete (no confirmation body).
- `POST /me/account/delete` — the GDPR confirmation-based delete (POST so request bodies survive proxies; verifies the typed confirmation equals the account email; runs inside one `db.transaction`).

**Rule:** every user-scoped table wiped by one path MUST be wiped by the other. They are maintained as separate code and silently drift.

**Why:** a change added trust & safety writes (the report-and-block flow writes `user_blocks`/`user_reports`) and only the live `DELETE /account` path purged them; the confirmation path left them orphaned (including free-text report notes), breaching GDPR erasure.

**How to apply:** when you add any table keyed to a user (or written on a user's behalf), add the delete to BOTH paths, in both directions where the row references two users (reporter/reported, blocker/blocked, low/high). The confirmation path records per-table counts in its `tables` map; add the count there too. Cover both paths with a real-DB test (see `account.safety-purge.test.ts`).
