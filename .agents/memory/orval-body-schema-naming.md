---
name: Orval requestBody schema naming collision
description: A requestBody component schema named operationId+"Body" collides with the generated zod const.
---

# Orval requestBody schema naming collision

If a requestBody references (or inlines) a component schema whose name resolves to
`<OperationId>Body`, Orval emits BOTH a zod const and a TS types interface with the
same identifier, producing TS2308 duplicate-identifier errors in the generated
output.

**Why:** Orval derives the zod const name from the operationId + "Body", so a
component schema already named that exact thing collides with the auto-generated
const.

**How to apply:** give the requestBody a distinctly-named component schema (e.g.
`WellnessInferenceConfirmInput`, not `ConfirmWellnessInferenceBody`) and `$ref` it;
the zod const then auto-names itself `ConfirmWellnessInferenceBody` with no clash.
Also note: `orval`'s `clean` step does NOT clean the generated `types` folder, so
when you rename a schema, manually `rm` the stale generated file or the old name
lingers.
