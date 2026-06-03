# SEO Strategy

## In scope
- Public marketing pages
- Pricing, waitlist, blog, quizzes, and other public acquisition surfaces
- Public legal pages
- Social sharing and AI crawler visibility for public routes

## Out of scope
- Authenticated dashboard and member-only routes once signed in
- Founder/admin surfaces
- API-only routes unless they directly power crawlability assets such as robots.txt or sitemap.xml

## Target audience
- People looking for dating coaching, profile help, message coaching, and compatibility insights

## Primary keywords
- Unknown — likely around dating coaching, profile audit, message coaching, compatibility, and dating quizzes

## Dismissed categories
- None yet

## Notes
- Frontend is a Vite + React + Wouter SPA under `artifacts/nldc/`.
- Public routes currently depend heavily on client-side `useMeta()` and `JsonLd()` updates.
- Static crawl assets need review for sitemap.xml and llms.txt coverage.
