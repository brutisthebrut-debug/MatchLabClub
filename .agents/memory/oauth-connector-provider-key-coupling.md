---
name: OAuth connector provider-string / signal-source-key coupling
description: Why an oauth_tokens provider string must equal the signal registry source key, and the parity that keeps purge correct.
---

# OAuth connector provider-string == signal-source-key

For the per-user OAuth connectors (Strava, Fitbit, Exist), the string stored in
`oauth_tokens.provider` MUST be identical to the signal-source key used by the
signal registry (a lane `countKey`, or one entry of a broadened lane's
`sources[]`). Example: Strava + Fitbit feed the `vitality` lane through its
`sources[] = ["vitality-paste","strava","fitbit"]`; Exist is its own lane keyed
`"exist"`.

**Why:** the trust-ledger purge transaction deletes tokens with
`delete(oauth_tokens) where inArray(provider, ds.sources ?? [ds.source])`. If the
provider string and the source key drift apart, the purge silently leaves
orphaned tokens (a privacy-parity break), and the derived count summary and the
token row stop referring to the same source.

**How to apply:** when adding or renaming an OAuth provider, change the provider
string, the lane/source key, and the CONNECTOR_CATALOG id in lockstep. Keep the
existing purge parity too: `oauth_tokens` must be deleted on every path that
purges a user's derived data — trust-ledger purge, connector disconnect, and
BOTH GDPR delete paths in `account.ts` (Promise.all path + confirmed-tx path).
Only a per-source `{counts:{items}}` summary is ever persisted; raw provider
payloads are reduced in-process (`fetchAndReduce`) and discarded, so nothing
downstream (matching prompt, founder view) can leak raw content or PII.
