---
name: Publish build runs the Expo Metro export
description: Why the autoscale web+api publish can fail right after the build step, before promote — the bundled Expo mobile Metro export.
---

The autoscale deployment (router="application") builds ALL registered artifacts in one
publish, including the Expo `nldc-mobile` artifact. Its production build
(`artifacts/nldc-mobile/scripts/build.js`) runs a full Metro export of BOTH iOS and
Android bundles (2000+ modules each, sequential), then `server/serve.js` serves the
Expo Go manifests/landing page. This Metro export is the dominant, highly variable
cost of the whole publish (roughly 2 to 8 minutes depending on infra).

**Failure signature:** build log shows every artifact compiling to completion
("Build complete! Deploy to: ..." + pnpm store prune's "Removed all cached metadata
files"), but the build is marked `failed` with ZERO promote-phase lines (a healthy
build continues into "Security Scan Complete", "Pushing pid1 binary layer",
"Creating Autoscale service", "Waiting for service to be ready", "Deployment
successful"). No promote lines == the build overran its time window / hit a transient
infra issue and was cut off before promote. There is NO code defect in this case.

**How to diagnose:** compare the failed build's tail against the last successful
build's tail via getDeploymentBuild — the success has the promote sequence, the
failure stops at the build step. Check duration: a failed run is much longer (e.g.
~10 min vs ~4 min) for identical work. Look for early infra blips like
"Security scan skipped: connection lost".

**Fix path:**
1. First just re-publish — this is usually a transient slow-build/infra failure;
   many prior publishes with the identical mobile artifact succeeded.
2. If it recurs, the durable fix is a scope/product decision for the founder:
   decouple the heavy Expo Metro export from the web+api publish (build/serve the
   mobile companion separately) so the web publish no longer depends on Metro
   finishing inside the build window. Do NOT rip the mobile artifact out unilaterally
   (orphan-nothing rule) — confirm with the user first.

**Why:** the Vite "Error when using sourcemap" lines and the "[Metro Error] ... should
be updated for best compatibility" version-mismatch lines in the build log are
non-fatal warnings, not the failure cause; chasing them wastes time.
