---
name: Trust ledger held/purgeable vs readiness signal
description: Why a data-vault/trust surface must base "held" and "purgeable" on stored rows, not the readiness signal count.
---

In any user-facing "what data do you hold about me" surface (the trust ledger / DataVault, and any future export/delete view), `held` and `purgeable` must be derived from the **actual stored rows a purge would remove**, NOT from the readiness/derived signal count.

**Why:** the readiness signal count is deliberately narrower than stored data. Examples that are stored-but-not-counted: a journal entry under the substantive-length threshold, a post-date note with no reflection/outcome filled in, an import whose parsed-summary number resolves to 0 while `imported_sources` rows still exist. Keying `held`/`purgeable` off the signal count hides real stored data and removes the user's one-tap purge for it, breaking the trust promise ("you can remove anything the machine holds").

**How to apply:** compute a `storedCount` = exactly the number of rows the purge targets (filter by userId/source only, no readiness narrowing). Pair each source's count reader and purge writer so they hit the same rows, and assert `held === (storedCount > 0) === purgeable`. Keep the readiness signal count as a separate field (it drives the coverage bar), but never let it gate visibility or deletion.
