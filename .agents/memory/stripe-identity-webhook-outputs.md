---
name: Stripe Identity webhook verified_outputs
description: Why the Identity webhook must re-retrieve the session with expand to read DOB/age
---

Stripe Identity `identity.verification_session.*` webhook event payloads do NOT
include `verified_outputs` (the verified document fields like `dob`). That field
is only populated when explicitly expanded, and webhook event objects are never
expanded.

**Why:** If the webhook handler trusts `event.data.object` directly, a verified
session lands with `idVerified=true` but `verified_outputs` null, so any derived
fact (e.g. `ageOver18`) is silently false/missing. The on-demand poll path is
unaffected because it already retrieves with `{ expand: ["verified_outputs"] }`.

**How to apply:** In `handleIdentityWebhook` (artifacts/api-server/src/lib/identityVerification.ts),
take only the session id from the event, then re-retrieve via
`stripe.identity.verificationSessions.retrieve(id, { expand: ["verified_outputs"] })`
before applying the result. Read DOB in the moment, derive the age boolean, then
discard the DOB. Never persist the document, image, or raw DOB.
