---
name: Connector status labels must mirror Connection Center grouping
description: The landing connector teaser duplicates connector statuses and must match the source-of-truth grouping
---

The Connection Center page (`artifacts/nldc/src/pages/ConnectionCenter.tsx`) is the single source of truth for every connector's maturity. It groups connectors into three arrays: `LIVE`, `BUILDING`, and `RESEARCHING` (type `Status = "live" | "building" | "researching"`). The maturity is NOT an inline field on each connector object, it is implied by which array the connector sits in.

The marketing landing page (`artifacts/nldc/src/pages/Landing.tsx`) has its own compact connector teaser grid with a hardcoded `status` per item. This DUPLICATES the maturity claim, so the two can drift.

**The rule:** when you add, remove, or re-stage a connector, update BOTH places, and make the landing status match the Connection Center array the connector lives in. Roadmap connectors framed with a "Research question:" / "Open question:" blurb belong in `RESEARCHING`, not `BUILDING`. Beat-numbered roadmap items (forwarding inbox, Plaid, Spotify) are `BUILDING`.

**Why:** an architect honesty review caught the landing labeling Letterboxd, Strava, and Goodreads as "Building" while Connection Center had them under `RESEARCHING`. Overstating roadmap maturity violates the product's "nothing fake" / honesty-first rule even when it is not a "live" overclaim.

**How to apply:** after any connector change, grep both files and reconcile the status. The landing also uses extra display-only statuses ("Import" / "Paste" / "Upload") for live-but-manual sources (Hinge export, Calendar .ics, Instagram) to avoid implying a live API sync, those are intentional and correct.
