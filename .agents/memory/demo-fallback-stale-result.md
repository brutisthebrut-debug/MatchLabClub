---
name: Demo-fallback tool pages must clear result on a failed real run
description: The showResult=result??DEMO / isDemo=!result pattern silently shows stale live output under an error banner unless the catch clears the result.
---

Many anon-friendly tool pages (Lab, Coach, StyleMap, ProfileReader, MirrorProfile, GlowUp, etc.) derive their view as:

```
const showResult = result ?? DEMO_RESULT;
const isDemo = !result;
```

The demo result is an **anonymous baseline so the page never looks empty**, NOT a mask for a failed real run.

**Rule:** when a real run (logged-in user clicked the button) fails, the catch must `setResult(null)` (clear any prior live result) AND set an explicit error flag that renders a visible failure notice. Only setting the error flag is a bug: a *previous* successful result stays in `result`, so `isDemo` stays false, the confidence label stays, and the error banner ("the example below…") lies on top of stale real output.

**Why:** product principle is "fail loudly, no silent fallbacks." A catch that quietly does `setResult(DEMO_RESULT)` (or that leaves a stale live result) makes a failed call look like a real, current answer. An architect review caught exactly this stale-result-after-a-later-failure case in Lab.tsx.

**How to apply:** in the runLab/runTool catch: `setResult(null); setError(true);`. Render a non-blocking error notice; the page then correctly falls back to the clearly-labeled demo baseline. Guard it with a regression test: success shows live output, a later rejected call shows the error testid, the stale live text is gone, and the "Example output" demo label returns (see the "Chemistry Lab failure handling" test in aiToolWelcomePanels.test.tsx).
