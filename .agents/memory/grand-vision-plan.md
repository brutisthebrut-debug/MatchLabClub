---
name: Grand vision plan (matching-first showcase, integrations, founder control)
description: The sequenced "make it grand" roadmap the founder asked to capture — marketing showcase, surfacing hidden tools, Connection Center / integrations expansion, full founder control, test-user preview. Source material for future project tasks.
---

# Grand vision plan

Captured because the founder asked to commit the big scope to memory rather than build it all at once. The product already has deep functionality; the gap is that it is **hidden, unmarketed, and not visibly pointed at the one goal: getting people matched inside our system.** Build these as cohesive WAVES, one at a time (see growth-waves-roadmap.md), each shippable standing alone, each tested + voice-clean (no em dashes, no AI-tell words, no emojis, inclusivity intact).

**Framing for whoever picks this up:** wear five hats at once — dating expert, psychologist, growth hacker, CMO, CFO. Every surface must answer "how does this get me matched with people I'd never find, near me?" Readiness leads, matching is the payoff. Do NOT reposition the outside-app tools (audits, coaching, rewrites) as the headline.

## Diagnosis (why this is needed)
- The app is gated behind login; the left sidebar (`AppSidebar.tsx`) is a wall of 60+ links with no journey. Tools like Your Mirror, Wingman Studio, Compatibility Compass are buried, so the founder literally could not find what was just built.
- Marketing (landing, Integrations "Platform Map") describes features, not the matching promise or how the background brain turns signals into matches.
- Connection Center exists but connectors are mostly status cards; the data→signal→match pipeline is not yet real for most sources.
- No way to walk the real populated user experience (only demo fallback or your own fresh account).

## Wave A — Show the brain, sell the brain (flagship marketing showcase)
- **A1 "How it works" showcase page** (the centerpiece the founder is missing). One scrollytelling page that tells the whole story end to end: you feed signals → the brain (Your Mirror) builds an evolving understanding of you → Match Readiness rises → you get matched with people you'd never find, near you. Animated, elite, grand. Visualize the machine: signals flowing in, understanding forming, matches as the payoff. Use the real deterministic demo portrait so it is honest, not mocked.
- **A2 Reframe landing + global copy** around the matching promise, not "optimize your profile." Hero, social proof, privacy, CTA all funnel to "get matched."
- **A3 Integrations as a story, not a list.** Rewrite `/integrations` Platform Map to show how each connected source sharpens matching, with honest live/building/researching labels.
- **CMO note:** the showcase page is the top-of-funnel asset; instrument it and route it to pricing.

## Wave B — Make Your Mirror the visible spine (findability + journey)
- **B1 Nav information architecture overhaul.** Collapse the 60+ link wall into a journey: "See yourself" (Mirror) → "Build readiness" (tools, surfaced as the Mirror's next-signal handoffs) → "Get matched." Group/collapse the tool sprawl under the Mirror + Wingman hubs. This is the single biggest "everything feels hidden" fix.
- **B2 Promote Your Mirror to the hero of `/me` (Home)** and the top of nav. It is the spine; treat it like one.
- **B3 Onboarding that routes a new user straight into the Mirror + their first signal**, with the readiness climb visible immediately (gamification: the founder repeatedly wants this).
- **B4 "Next signal" call-to-action everywhere** — every tool ends by pointing back to the Mirror and the next highest-value signal.

## Wave C — Connection Center: the data engine, no limits (integrations)
- **C1 Make the data→signal→match pipeline real per connector.** Each connector must: pull/accept data → derive an aggregate signal (registry entry) → feed readiness + the Mirror portrait + matching reasoning. The founder's ask: "use the data from each one to build better matches and profile info."
- **C2 Expand connectors (no limits, consent-first):** Spotify (taste), Instagram (tone/aesthetic), calendar .ics (rhythm, shipped), Plaid (spending values), forwarding inbox (subject-only receipts), photo upload, location/radius, health/Strava (lifestyle), LinkedIn/career (life context), Letterboxd/Goodreads (taste), contacts cadence. Add each as ONE `SIGNAL_REGISTRY` entry + DB count (see Living signal registry decision).
- **C3 Keep the consent contract** (what we'll see / never touch, one toggle purges). Sensitive sources stay subject/category-level only.
- **C4 Widen the multi-app surface everywhere** inclusively: Hinge, Tinder, Bumble, Grindr, Feeld, HER, Facebook Dating, OkCupid, others. `MatchExternalReadInput.source` is a label only (non-breaking to extend).

## Wave D — Full founder control + understand the brain (admin/ops)
- **D1 Founder control center audit.** Ensure every lever is controllable from `/founder`: signal weights, readiness thresholds, matching knobs (radius, cohort), connector enable/disable, daily AI caps, the "breathing" `proposeWeightAdjustments` (currently NOT wired to live scoring — decide when to act).
- **D2 Founder curation tooling** for matches and signals (north star requires the founder curate good/bad). 
- **D3 A founder-readable map of the background brain:** the jobs in `index.ts`, the signal registry, readiness, matching/Echo. Make the invisible machine legible to the operator.

## Wave E — Matching is the payoff, make it real (core loop)
- **E1 Strengthen the matching flow:** cohort opt-in, radius (25/35/45 mi), Echo's AI match reasoning, founder curation, real intros. 
- **E2 Tie every tool completion to a visible readiness gain + a concrete step toward a match**, so the loop always points at the payoff.

## Wave F — See it as a user (test/preview) — DO THIS EARLY, it unblocks the founder
- **F1 Dev-only seeded test account + safe test-login** so the founder can walk the real, populated (non-demo) experience without going through full OIDC. Must be dev-gated and never reachable in production (auth bypass is security-sensitive).
- **F2 Optional: a "view as new user" / "view as power user" preview toggle** for the founder.
- **Interim answer (no build needed):** log in via the "Log in" button (Replit Auth). A plain login is the true user view; `/founder` is key-gated and separate. Demo data makes every page look populated; running any tool starts populating real signals. Your Mirror is at `/your-mirror`.

## Wave G — Revenue (CFO hat)
- Tie the three tiers ($0/$97/$197) to readiness/matching unlocks; the showcase page (A1) drives to pricing; instrument the full funnel (visit → signal → readiness → match → pay).

## Guardrails (apply to every wave)
- Hybrid AI contract on any new AI surface (deterministic baseline + Claude opt-in behind consent + daily cap + fallback; register toolName in aiToolSchemas or the Claude lane is dead code).
- Real signals only, aggregate/derived to prompts, never raw PII.
- Never orphan existing pages; reorganize, do not delete.
- Validation green (typecheck, api-tests, lint, codegen, schema-drift) + architect PASS per wave.
