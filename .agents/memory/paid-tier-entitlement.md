---
name: Paid tier entitlement gating
description: How paid tiers are detected for entitlements and why provisioning stays manual.
---

`usersTable.tier` is an unconstrained varchar (observed values: null / "free" / "reset" / "wingman"). Gate any paid-only benefit (e.g. the higher AI daily cap) behind an explicit allowlist of paid values (`reset`, `wingman`) — never a `tier !== "free"` or `tier != null` check.

**Why:** the column has no DB enum constraint, so a stale or future value ("trial", "cancelled") would silently unlock paid benefits under a non-free check. The column also documents that tier is granted MANUALLY by the founder during beta, so `stripeReconcile.ts` deliberately records a paid `purchase_interest` row but does NOT set the tier.

**How to apply:** when wiring a new paid perk, read `usersTable.tier` and match the allowlist; fail open to the free / un-entitled path on a read error. Do not add auto-grant to `stripeReconcile.ts` (or the webhook handler) without an explicit founder decision to end the manual-grant beta policy.
