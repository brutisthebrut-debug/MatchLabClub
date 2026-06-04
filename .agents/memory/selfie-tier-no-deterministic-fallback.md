---
name: Selfie tier has no deterministic fallback
description: Why the selfie verification tier is the one hybrid-AI surface whose fallback awards nothing.
---

# Selfie verification tier: fallback never awards the tier

The selfie / photo-match verification tier (anti-catfish, between phone and ID)
is awarded ONLY by a live Claude vision "consistent" verdict. Every other path
(consent off, daily cap hit, client/model/schema failure) returns an honest
"unclear" verdict with `mode: "fallback"` and persists nothing.

**Why:** Unlike every other hybrid-AI tool in this product, a face-likeness
comparison has NO deterministic equivalent in `aiEngine.ts`. The standard hybrid
contract ("deterministic baseline always-on, Claude layered on top") cannot
apply here because there is no honest deterministic way to compare two faces. So
the always-on baseline is an honest "could not run", never a synthetic pass. A
fallback that awarded the tier would be claiming a check it never performed.

**How to apply:** When adding any verification/trust signal that depends on a
capability only the AI layer has, do NOT mirror the usual "fallback still
produces a result" pattern. The fallback must degrade to "no result, no tier",
and the copy must say so. Keep the verdict strictly: only `verdict ===
"consistent"` AND `mode === "live"` may flip a persisted boolean. The check is a
SOFT consistency signal, never identity/liveness/spoof proof, and never a gate.
Images are read in the moment and never stored; persist only the result boolean
and the timestamp.

**No persisted photo source exists (do not "harden" by storing photos):** dating
profile photos are NEVER stored anywhere in this product. The photo critique
flows (`photoLab.ts`, `audits.ts`, `comparePhotosVision`/`analyzeProfilePhotos`
in `aiService.ts`) all take `imageBase64` from the request body in the moment.
The selfie check deliberately mirrors that pattern: client supplies selfie +
profile photos in one request, both read in the moment, nothing stored. A
reviewer may flag "the selfie should be compared against the user's STORED
profile photos, fetched server-side, so it can't be gamed" — that is impossible
here and would break the product's #1 privacy promise. The integrity tradeoff is
intentional: this is a soft, labeled, never-a-gate signal, not identity proof.
Do not add server-side photo fetching/storage to satisfy that critique.
