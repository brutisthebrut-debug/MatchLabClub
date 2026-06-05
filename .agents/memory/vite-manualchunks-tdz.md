---
name: Vite manualChunks prod-only TDZ white screen
description: Why isolating recharts/d3 into their own vendor chunk white-screened the live build, and the rule for splitting vendor chunks safely.
---

# Vite manualChunks cross-chunk temporal-dead-zone crash

Isolating `recharts` + `d3` into their own `vendor-charts` manualChunk
white-screened the PRODUCTION build only (dev preview was fine). The live
console showed `ReferenceError: Cannot access 'Lp' before initialization` thrown
from the charts vendor file, and `#root` stayed empty so the whole SPA never
mounted.

**Why:** `recharts`/`d3` circularly reference other third-party modules. When
those partners land in a *different* chunk (`vendor-misc`), the minified
prod bundle's chunk init order can run the charts chunk before the partner
chunk's bindings are initialized, hitting a temporal-dead-zone. Vite dev serves
unbundled ESM so the cycle resolves lazily and the bug is invisible there. This
is a class of bug, not a one-off `Lp` symbol.

**How to apply:**
- Do NOT give a circularly-entangled library family its own id-matched
  manualChunk. Keep `recharts`/`d3` falling through to the catch-all
  `vendor-misc` so the cycle stays co-located in one chunk.
- Safe to split: leaf-ish, non-cyclic vendors (`framer-motion`, `@tanstack`,
  `react`/`react-dom`/`scheduler`, `@radix-ui`).
- After ANY change to `manualChunks` (or a chart/d3 dependency bump), verify the
  real prod build mounts before publishing: `vite build`, serve `dist/public`
  statically, load it headless, and assert `#root` is non-empty + no
  `pageerror`. typecheck/lint will NOT catch this — it only appears in the
  bundled artifact.
- "Preview works but live is a blank page" with a clean server boot ⇒ suspect a
  client bundle runtime error first (fetch the live JS / capture the browser
  console), not the server.
