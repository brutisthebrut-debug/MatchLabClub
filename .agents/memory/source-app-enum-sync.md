---
name: Source-app list sync points
description: Where the dating-app source list must stay in lockstep when adding or removing an app
---

Adding or removing a dating app from the "source app" lists touches several
decoupled places that do not import from each other. Update ALL of them together
or the UI, validation, and contract drift apart.

**The sync points:**
- Frontend report picker: `Report.tsx` `SOURCE_APPS`.
- Backend correction validation: `audits.ts` `VALID_SOURCE_APPS` (gates the
  correct-source-app route; must match `SOURCE_APPS` exactly).
- OpenAPI spec: `MatchExternalReadInput.source` is a **typed enum** in
  `lib/api-spec/openapi.yaml` — editing the dropdown options requires editing the
  enum AND running `pnpm --filter @workspace/api-spec run codegen` (regenerates
  `MatchExternalReadInputSource` + zod). `CorrectSourceAppInput.correctedApp` is a
  free string whose **description** lists the apps; keep that doc current too.
- UI surfaces that hardcode the list for display/dropdowns: Footer, Matching,
  SelfHub, Integrations, Wizard.

**Why:** the source field on external reads is contract-typed, so a UI-only edit
fails typecheck or silently rejects the new value server-side. The lists are
intentionally inclusive (mainstream + gay apps like Grindr/Feeld/HER).
