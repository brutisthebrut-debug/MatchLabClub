---
name: Canonical account ownership path
description: Account export and deletion share one schema-guarded ownership inventory; deletion only runs through the confirmed transactional endpoint.
---

# Account deletion has one canonical path

`routes/account.ts` exposes one account-deletion endpoint:

- `POST /me/account/delete` verifies that the typed confirmation equals the
  signed-in account email and performs the full delete in one transaction.

The old `DELETE /account` path and generated client were retired because they
were weaker, non-transactional, and repeatedly drifted from the confirmed path.
Web, mobile, and Data Vault all use the confirmed endpoint.

**Rule:** `lib/accountOwnership.ts` is the ownership registry. Every table with
a `user_id` column is deleted by iterating that registry.
`accountOwnership.test.ts` compares it with the live Drizzle schema, so adding a
new user-owned table without deletion coverage fails CI.

Tables owned through another key still require an explicit relational or email
handler in `routes/account.ts`, including audit versions, connection messages,
reports/blocks, referrals, and pre-account lead/waitlist/checkout rows.

Account export uses the same inventory. Credential-bearing rows (OAuth tokens,
export tokens, push tokens, and raw session payloads) stay out of the export;
sessions and verification data use safe projections.
