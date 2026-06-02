---
name: Accumulating-row advisory lock key
description: When one logical row is mutated via multiple lookup paths, every path must lock on the same owner-derived key.
---

When a single accumulating row (counts + capped recent list, e.g. an
`imported_sources` connector row) can be mutated through more than one path that
locates it by *different* identifiers, every path MUST acquire its
`pg_advisory_xact_lock` on the SAME key, or concurrent writes both read the prior
summary and overwrite each other, dropping entries and undercounting.

**Why:** the receipts inbox had a manual-paste path keyed by owner
(`receipts:${userId ?? anonToken}`) and an inbound webhook keyed by handle
(`receipts-handle:${handle}`). Same row, two lock namespaces, so a concurrent
manual+forward could lose an update. Caught in code review.

**How to apply:** pick one canonical key derived from the row owner. Paths that
only know a secondary identifier (the webhook only knows the handle) must do a
cheap non-locking pre-read to resolve the owner, compute the canonical key, then
take the lock and re-read authoritatively inside the transaction. The fake testDb
runs single-threaded and ignores advisory locks, so this race cannot be
reproduced there; assert the single-row invariant across paths instead and reason
about the lock key by hand.
