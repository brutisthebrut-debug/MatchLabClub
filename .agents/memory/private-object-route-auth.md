---
name: Private object-serving route ships open
description: The /storage/objects template route has auth/ACL commented out by default; private uploads leak by path unless you enforce a domain access check.
---

The object-storage scaffold's `GET /storage/objects/*` route (artifacts/api-server/src/routes/storage.ts) ships with its auth + ACL block commented out as an "example". As written it streams any object to anyone who knows the path. Object keys are unguessable UUIDs, so it is a path-knowledge leak rather than enumeration, but it still fails any real privacy promise.

**Rule:** any feature that stores PRIVATE objects through this route (profile photos, receipts, etc.) MUST enforce, in the route, both: (1) `req.user?.id` present (401 otherwise), and (2) a domain access check before streaming. Use the generic ACL (`canAccessObjectEntity`, covers owner + public + explicit grants) AND a feature-specific DB check that mirrors that feature's own consent/visibility gate.

**Why:** the GCS-metadata ACL group system (`objectAcl.ts`) has NO implemented `ObjectAccessGroupType` cases, so cross-user grants (e.g. a matched counterpart viewing reveal-card photos) cannot be expressed as ACL rules — they throw. The owner case works via ACL metadata, but every cross-user grant must be DB-driven.

**How to apply (profile photos here):** allow read if viewer is the owner, else if there is an ACTIVE `match_connections` row for the ordered pair AND the owner's `match_pool_membership.reveal_consent` is true. This mirrors the reveal-card endpoint in `routes/connections.ts` exactly, so a photo is viewable in chat precisely when it is allowed on the reveal card and never otherwise. Keep the OpenAPI entry's 401/403 + session params in sync when you turn the gate on.
