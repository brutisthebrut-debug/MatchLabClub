---
name: Shareable readiness card privacy contract
description: What the public-facing share card is allowed to expose, and why
---

The readiness Share Card (`artifacts/nldc/src/pages/ShareCard.tsx`, route `/share-card`) is the product's viral acquisition loop: a user generates a beautiful card of their Match Readiness and shares it, and each share carries a QR / invite link back to the site.

**The rule:** the card may only show *derived* values: the overall readiness score, a derived stage word (e.g. "Match ready"), and the top lane labels with their percentages. It must NEVER render anything the user wrote, pasted, or uploaded, who they talk to or matched with, or their name/location/raw signal data.

**Why:** the brand is consent-first and privacy-first (see replit.md's privacy paragraph). A share artifact is the easiest place to accidentally leak raw content, and a leak here would break the core promise and the trust the founder cares about most. Keeping the card to derived aggregates also makes public sharing safe by construction.

**How to apply:** if you extend sharing (e.g. Wave 2 public share links with link-preview / OG image generation, or a server-rendered card), carry this same derived-only contract into the backend. A public unauthenticated route must compute the card from the score + lane labels only, gated behind explicit opt-in, never echoing stored content.
