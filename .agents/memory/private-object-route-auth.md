---
name: Private object-serving route (scaffold ships open; closed here)
description: The /storage/objects template route ships with auth/ACL commented out. This app has closed it; keep that pattern for any new private object type.
---

The object-storage scaffold's `GET /storage/objects/*` route (artifacts/api-server/src/routes/storage.ts) ships from the template with its auth + ACL block commented out as an "example", which would stream any object to anyone who knows the path. Object keys are unguessable UUIDs, so it is a path-knowledge leak rather than enumeration, but it still fails any real privacy promise.

**Current state in this repo: CLOSED.** The route now (1) 401s when `req.user?.id` is absent, (2) runs the generic ACL (`canAccessObjectEntity`, owner + explicit grants), and (3) falls through to a feature-specific check (`canViewStoredObject` / the consented-match photo-reveal gate), returning 403 otherwise. Do NOT reopen it. If a future memory or reviewer claims this route "ships open", verify against the live file first; that claim is stale.

**Rule for any NEW private object type added through this route:** keep the same two-layer gate: ACL for owner/explicit grants, plus a DB check that mirrors that feature's own consent/visibility rule.

**Why the DB layer is required:** the GCS-metadata ACL group system (`objectAcl.ts`) has NO implemented `ObjectAccessGroupType` cases, so cross-user grants (e.g. a matched counterpart viewing reveal-card photos) cannot be expressed as ACL rules and must be DB-driven. The owner case works via ACL metadata; every cross-user grant does not.

**How profile photos do it (the reference pattern):** allow read if viewer is the owner, else if there is an ACTIVE `match_connections` row for the ordered pair AND the owner's `match_pool_membership.reveal_consent` is true, mirroring the reveal-card endpoint in `routes/connections.ts` exactly. Keep the OpenAPI entry's 401/403 + session params in sync with the route.
