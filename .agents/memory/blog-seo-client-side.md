---
name: Blog SEO is client-side only
description: Why blog/post meta + JSON-LD are applied at runtime, and what that means for crawlers
---

Blog SEO (per-post title/meta/description, OG/Twitter tags, canonical, JSON-LD)
is applied **client-side at runtime** via `useMeta` (hooks/useMeta.ts) and the
`JsonLd` component (components/seo/JsonLd.tsx). There is no SSR or prerender.

**Why:** the whole nldc app is a Vite SPA and every page already sets meta this
way (useMeta has ~80+ callers). Adding SSR/static prerender for `/blog` and
`/blog/:slug` is an app-wide architecture change, deliberately out of scope for a
frontend content task. Google renders JS so it sees the tags; non-JS unfurl bots
(some social cards) only see `index.html` defaults. Default OG image + brand OG
tags live in `index.html` as the baseline fallback.

**How to apply:** if social-card previews per post matter, the fix is
prerender/SSR for blog routes, not more client-side meta. Until then, keep
`index.html` defaults sensible. JSON-LD dates must be ISO — `seo.ts#toIsoDate`
normalizes human dates ("May 2026") and callers omit the field when unparseable.
