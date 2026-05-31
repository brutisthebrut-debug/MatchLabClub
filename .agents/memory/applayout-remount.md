---
name: Per-route layout remounts in nldc web
description: Why cross-navigation React state must live at App root, not in AppLayout
---

In `artifacts/nldc`, every page component renders `AppLayout` itself (the shell
is conditional per route). Consequence: `AppLayout` and anything mounted inside
it unmounts and remounts on every route change.

**Rule:** A component that must persist state across navigation (e.g. a watcher
that tracks a value's delta across query refetches via a `useRef` baseline) must
be mounted once at the App root (`App.tsx`, near `Toaster`), NOT inside
`AppLayout`.

**Why:** The readiness reward watcher tracked the previous readiness score in a
ref to celebrate only genuine increases. Mounted in `AppLayout`, the ref reset on
every navigation, so a gain that landed around a route change was treated as a
fresh baseline and silently skipped. Hoisting to the App root keeps the baseline
alive across navigation while still not celebrating on initial load (first
observed value just sets the baseline).

**How to apply:** For any "compare against previous value across the session"
UI in the web app, mount at App root and gate internally (e.g. on auth), rather
than relying on a layout/page-level mount.
