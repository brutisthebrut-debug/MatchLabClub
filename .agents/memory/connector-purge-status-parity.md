---
name: Connector status must stay in lockstep with its derived rows
description: Any readiness lane fed by a live connector must mark the connector disconnected on every path that purges the lane's derived rows
---

A readiness lane can be backed by BOTH manual input and a live connector (e.g. the
`calendar` lane = pasted `.ics` + a live `google-calendar` sync). The connector's
lifecycle row (status connected/disconnected) lives in one table; the derived
signal lives in the imported-sources table. These are two tables that can drift.

**The rule:** every path that removes a lane's derived rows must also mark the
matching connector row disconnected, not just the explicit disconnect route, but
ALSO the trust-ledger per-source purge and any GDPR delete. Do it in the same
transaction as the row delete.

**Why:** an architect review caught a purge path that deleted the connector's
derived imported-source rows but left the connector row saying "connected", so the
connectors status endpoint reported connected with a null derived count, a lie
about live state (no GDPR leak, but a consistency/honesty bug).

**How to apply:** when you add a new live connector, audit EVERY deletion path for
its derived source (disconnect, trust-ledger purge, both account-delete paths) and
make each flip the connector row to disconnected. The provider string matches the
imported-source string, so an `inArray(provider, purgedSourceKeys)` filter covers
multi-source lanes generically.
