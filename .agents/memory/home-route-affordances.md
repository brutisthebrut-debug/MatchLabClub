---
name: Signed-in home affordances
description: The signed-in "home" route is duplicated across several chrome surfaces that must change in lockstep.
---

# Signed-in home route affordances

The signed-in "home" destination in the nldc web app is not defined in one
place. It is re-stated independently across at least these surfaces:

- `components/layout/AppSidebar.tsx` — the desktop sidebar logo `Link` and the
  first OVERVIEW entry.
- `components/layout/AppLayout.tsx` — the **mobile** app-shell header logo
  `Link` (easy to miss; it is separate from the sidebar logo).
- `components/layout/Navbar.tsx` — the authenticated shortcut, in BOTH the
  desktop and the mobile menu blocks.
- `pages/Onboarding.tsx` — `finish()` and `skipAll()` redirect targets.
- `App.tsx` — `ONBOARDING_ENTRY_ROUTES` (the first-run gate only fires on home
  surfaces; the new home must be added or brand-new users bypass onboarding).

**Why:** when the home was moved to `/your-mirror`, the desktop sidebar logo,
navbar shortcut, and onboarding redirects were updated but the mobile
`AppLayout` header logo was left pointing at `/dashboard`, so mobile and desktop
disagreed on "home." A code review caught it.

**How to apply:** any time the signed-in home route changes, grep the chrome for
the OLD route (`href="/<old>"`) across AppSidebar, AppLayout, and Navbar, plus
the Onboarding redirects and `ONBOARDING_ENTRY_ROUTES`, and update them all
together. The onboarding completion flag (`markOnboardingComplete()` runs before
the redirect) prevents a redirect loop even when the new home is in the gate set.
