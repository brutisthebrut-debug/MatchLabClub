---
name: Signal lane id stability vs user-facing relabel
description: Why signal-registry lane ids/countKeys must stay stable even when the product repositions a feature, and how to relabel safely.
---

# Signal lane ids are stable identifiers, not display strings

When repositioning a feature (e.g. the Hinge-only import becoming a generic
"dating app import"), KEEP the `SIGNAL_REGISTRY` lane `id`/`countKey` unchanged
(the import lane id stayed `hingeImport`). Relabel only the user-facing strings.

**Why:** lane ids flow into the OpenAPI spec, Orval-generated client code, and
multiple frontend files + backend tests (signalRegistry.test asserts the exact id
and weight). Renaming the id cascades a breaking change across all of them for
zero user benefit. The label is what users see; the id is plumbing.

**How to apply:**
- Change `label`/UI copy/registry `action` text only; leave `id` and `countKey`.
- To make one lane count multiple data sources, broaden its `importRows`
  dataSource with an optional `sources[]` array and have `signalCounts.ts` sum
  across sources (recency = most recent across sources). Do not split into new
  lanes unless you want a new weight/denominator.
- Leave a short code comment noting the legacy id so future readers don't "fix" it.
