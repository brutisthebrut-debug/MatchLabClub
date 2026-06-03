---
name: Dashboard pending-audit-delete dual executors
description: Why Dashboard delete uses BOTH an unmount mutate and an on-mount drain, and what each test contract demands.
---

Dashboard's "delete with 5s undo" persists each pending delete to localStorage and
reconciles it through two deliberately redundant executors. Do not "simplify" to one.

**The contracts (tests are the wiring spec):**
- trashFlow test deletes then `unmount()`s with NO remount and asserts the server
  recorded the DELETE. So the unmount cleanup MUST itself issue the delete.
- undoFlow "refreshing mid-undo-window" deletes, `unmount()`s, then REMOUNTS and
  asserts the row is gone server-side AND localStorage is cleared. The comment in
  the test says "either unmount-cleanup OR on-mount drain" may do it.

**Why both paths exist:**
React-query `mutate()` fired inside an unmount cleanup races the remount re-fetch
and frequently loses (the GET re-fetch resolves before the teardown DELETE lands),
so the row reappears. The reliable executor for the remount case is the on-mount
**drain** effect: it reads persisted ids, issues a direct `deleteAuditRequest`,
`await`s it (allSettled), THEN invalidates queries, so the re-fetch always sees the
deleted state. trashFlow has no remount, so it depends on the unmount mutate.

**The persistence rule (the real, untested double-delete bug):**
- `finalizePending` (the 5s timer path, runs while mounted) MUST clear the
  localStorage entry before mutating. Otherwise the id lingers and the NEXT mount's
  drain re-deletes an already-gone id (stale double-delete across visits).
- The unmount cleanup MUST NOT clear localStorage. It mutates but leaves the entry
  so the remount drain can reconcile the race. This is the one intentional
  redundancy; it is required by the two contracts above.

**Why:** A "make it strictly single-delete" refactor (clear localStorage on unmount,
or route unmount through finalizePending) passes each test alone but fails undoFlow
in a combined run, because the drain safety net is removed and the racy unmount
mutate loses to the remount re-fetch.

**How to apply:** If you touch the delete/undo flow, keep finalizePending clearing
persistence (timer/preemption paths) and keep the unmount cleanup mutating WITHOUT
clearing. Run trashFlow + dashboardUndoFlow together (same process), not just alone.
localStorage key is `nldc:pending-audit-deletes` (lib `pendingAuditDeletes.ts`).
