# MatchLab Club — Vision: The Operating System for Your Dating Life

> A living, consent-first psychological profile that gets sharper the more honest signals it sees.
> Dating apps see your swipes. We see the whole human — but only what they choose to share. That's the moat.

This document preserves the long-range product strategy. `ROADMAP.md` is the delivery source of truth for the current milestone and overrides older phase language below whenever the two conflict. The active milestone is the simplified Echo-led v1 shell, not a broad redesign or connector expansion.

---

## 1. The Frame

**What we sell today:** A deterministic AI audit of bios and message threads.
**What we should sell:** *"NLDC knows you better than any dating app — and uses that to help you actually find someone."*

The shift is from **one-shot audit tool** → **always-on coaching system fed by the user's real life**.

The user moves through three depths, each opt-in:

1. **Surface** — what they type into the wizard (current state).
2. **Self-reported** — what they tell us about how they live (Life Pulse, weekly check-ins, mood logs).
3. **Connected** — what their tools tell us about how they live (Calendar, Gmail, Plaid, Spotify, Health, SMS, social).

Each layer multiplies the value of the previous one. A bio rewrite is a parlor trick. A bio rewrite that knows you only sleep 5 hours on Wednesdays and spent $340 on going out last week is a service worth $97/month.

---

## 2. The Connector Map (every tool, in priority order)

Each row maps to a **psychological signal** that feeds the Wellness Center dimensions
(Emotional / Physical / Social / Intellectual / Spiritual / Occupational / Financial / Environmental).

| # | Tool | What it tells us (signal) | Dimension(s) | Auth path | Effort | Sensitivity |
|---|---|---|---|---|---|---|
| **P0** | Manual Life Pulse (daily 5-question slider) | Sleep, energy, social fuel, money stress, headspace | Phys / Soc / Fin / Emo | None | **Shipped this session** | Low |
| 1 | **Google Calendar** (read, tagged events) | Dating rhythm: frequency, gaps, recovery time, time-of-week | Phys / Soc | Replit Google integration | S | Low |
| 2 | **Apple/Google Health** (sleep, steps, HRV) | Sleep debt vs. date energy; nervous-system regulation | Phys / Emo | Native Health API (mobile only) | M | Medium |
| 3 | **Spotify** | Mood arcs (audio features), genre drift around relationship events | Emo | OAuth | S | Low |
| 4 | **Gmail** (read, dating labels only) | Ghosting timing, response latency, subscription churn (Hinge/Bumble receipts) | Soc / Fin | Replit Google integration | M | High |
| 5 | **Plaid** | Dating spend, subscription stacking, "going out" cadence, financial wellness as anxiety signal | Fin / Occ | Plaid OAuth (paid) | L | High |
| 6 | **Apple/Google Photos** (selected only) | Profile pic quality scoring, location/setting diversity, recency | Soc / Env | Native picker | S | Medium |
| 7 | **iMessage / SMS** (on-device only, summary upload) | Attachment style across ALL relationships — not just dates. Avoidant vs anxious vs secure language. | Emo | Mobile share extension | XL | **Very high** |
| 8 | **Instagram / TikTok** (read, own activity) | Self-presentation vs. private self gap, content cadence, parasocial intake | Soc / Emo | Meta OAuth (gated) | L | High |
| 9 | **LinkedIn** | Occupational identity, career inflection points (anxiety markers) | Occ | LinkedIn OAuth | M | Low |
| 10 | **Strava / Workout apps** | Discipline cadence, social fitness, recovery patterns | Phys | OAuth | S | Low |
| 11 | **Sleep apps (Oura, Whoop, 8sleep)** | High-fidelity recovery + readiness, period tracking | Phys / Emo | OAuth | M | High |
| 12 | **Google/Apple Maps timeline** | Going-out radius, novelty-seeking, "third places" | Soc / Env | Native | M | High |
| 13 | **Meditation apps (Headspace, Calm, Insight)** | Mindfulness adherence, anxiety triggers | Emo / Spi | OAuth | M | Low |
| 14 | **Hinge / Bumble / Tinder export ZIP** | Their own data, decoded: match→message→date funnel by them | Soc | User upload | S | Medium |
| 15 | **Therapy notes (Bring-Your-Own, encrypted)** | Self-reported themes, growth edges | Emo / Spi | Manual encrypted blob | L | Highest |

**Principle:** every row above P0 ships as a single "tile" in a redesigned Life Signals hub. Each tile has the same anatomy: *what we read, what we'll never touch, how often, one-tap disconnect, a real-time preview of what NLDC will see before the user confirms.*

---

## 3. How signals become value

Every signal feeds **one of three engines**:

1. **The Living Profile** — `WellnessCenter` becomes a real-time dashboard. Each dimension's score is a weighted blend of all signals routed to it. Dimensions decay over time so stale signals lose weight.
2. **The Pre-Date Brief** — 2 hours before a calendared date, NLDC pushes a personalized brief: *"You've slept 5h avg this week, you swiped Hinge 47 times yesterday (high anxiety signal), and the last 3 dates with this archetype went well when you didn't drink. Recommendation: walk-and-talk, coffee, not bar."*
3. **The Pattern Detector** — over weeks, surfaces hidden patterns: *"Every time you spend > $200 on a date you don't get a second one. Every time you initiate within 24h of a low-sleep night, the reply rate drops 60%."*

---

## 4. Monetization — make it pay

Current pricing tiers ($0 / $97 / $197) are decoupled from value. Re-anchor pricing on **depth of profile**, not feature gates:

| Tier | Name | Connectors allowed | Pre-date briefs | Price |
|---|---|---|---|---|
| Free | Audit | 0 connectors | — | $0 |
| Pulse | Self-aware | Life Pulse + manual logs only | 2/mo | **$19/mo** (was $97 one-time — recurring beats one-shot) |
| Connected | Living Profile | Up to 3 connectors | Unlimited | **$49/mo** |
| Inner Circle | Full system | All connectors + monthly human-reviewed session | Unlimited + texts | **$199/mo** or **$1490/yr** |

**Why this prints money:**
- Recurring revenue replaces one-shot. LTV up 5–10×.
- Connectors become the upgrade ladder, not features.
- "Inner Circle" gives a credible reason to charge $200/mo (human review + cap on supply).
- Each connector unlock is a natural upgrade prompt: *"You're 1 connector away from the Pre-Date Brief."*

**Secondary revenue:**
- White-label the engine to dating coaches (B2B). They bring clients, we run the OS, they get a co-branded report. $500/coach/mo + per-client.
- Partner referral fees to **non-dating-app** dating sources (matchmakers, real-world events, Shebangs already partial integration). Help them move clients *off* the apps.
- Anonymized aggregate insights (consented, never sold to apps) — published as the *NLDC Dating Index*, a press hook.

---

## 5. UX & UI — what a redesign actually means

Today: dark glass, violet/teal orbs, Plus Jakarta + Playfair. It's pretty but it's *generic dark SaaS*. A psychology-first product should feel like:

**Color theory — proposed direction: "Warm Clinical"**

- **Base:** warm off-white `#FAF7F2` (light) / deep teal-charcoal `#0E1A1F` (dark) — not pure black. Black is for crypto bros.
- **Primary accent:** terracotta/coral `#E07856` — earthy, embodied, opposite of every dating-app red/pink.
- **Secondary:** sage `#7AA88A` — calm, present, growth.
- **Insight color:** soft gold `#D4A85C` — signals matter without alarming.
- **Risk/red flag:** muted clay `#B0594B` — never tomato red; never punitive.
- **Typography:** keep Playfair for headings (the wisdom voice). Swap Plus Jakarta → **Inter Tight** or **Söhne** for UI — both read more "considered" than Jakarta's slight cuteness.

**Why this palette wins:**
- It looks **adult**. Dating apps look like teenagers. We look like a therapist's waiting room with a great architect.
- Coral + sage + gold is the palette of every premium wellness brand (Aesop, Outdoor Voices, Headspace). It signals trust + warmth + agency simultaneously.
- High contrast with competitors. Bumble = yellow, Hinge = red, Tinder = pink/orange, Match = blue. Nobody owns earthy-warm in dating.

**Layout principles:**
- One number per screen. The current Wellness Center shows 8 dimensions stacked; redesign shows *one focal dimension* with the rest as a peripheral wheel.
- Conversation > dashboard. Replace "score cards" with *"NLDC said today:"* — a single short paragraph that changes based on signals.
- Mobile-first; the daily Life Pulse should feel like a 10-second ritual (Apple Health style sliders, no labels until you touch).

**This redesign is a multi-week effort and is filed as task #545 below — not in this session's code.**

---

## 6. Phased Roadmap

### ✅ Phase 0 — *Walk* (shipped this session)
- **Life Pulse** — daily 5-question check-in widget on Wellness Center (sleep / energy / social / money / headspace).
- Persisted per user (or anon claim token) in `life_pulses` table.
- Wellness Center dimensions read from the latest pulse — they actually move.
- 14-day sparkline for each metric.
- Zero OAuth, zero external API, zero new keys to manage.

### Phase 1 — Foundation (next 1–2 weeks)
1. Google Calendar connector (read, tagged events) → Dating Rhythm panel.
2. Redesigned **Life Signals hub** (replaces "Integrations" page) — real toggles backed by `user_connections` table.
3. Weekly digest email summarizing pulse + signals.
4. Recurring pricing migration ($19/$49/$199 monthly).

### Phase 2 — Depth (weeks 3–6)
5. Gmail (dating labels) → ghosting + subscription detection.
6. Spotify → mood arc panel.
7. Pre-Date Brief v1 (calendar-triggered).
8. Apple Health (mobile) → sleep debt overlay on Wellness Center.

### Phase 3 — Money (weeks 7–10)
9. Plaid → dating spend + financial wellness dimension.
10. Inner Circle tier launch (human review monthly).
11. White-label B2B portal for coaches.

### Phase 4 — Power (weeks 11+)
12. SMS / iMessage on-device summary uploader.
13. Instagram/TikTok activity.
14. Pattern Detector engine (cross-signal regressions).
15. NLDC Dating Index publication.

---

## 7. Gaps the cofounder should hear

These are the honest holes in the current product that block the vision. Each is a future task.

1. **No real user identity across devices.** Anonymous claim + handoff work, but there's no concept of "this human" that survives across connectors. Need a stable `user_profile_id` that connectors hang from.
2. **Wellness Center is hardcoded.** Dimensions, blurbs, experiments — all literal strings. Even after this session, only one dimension cluster is dynamic. Need a `dimension_signals` table where every signal-producer writes scores with weights + timestamps, and dimensions are computed views.
3. **No signal-decay model.** A pulse from 4 weeks ago should not weigh the same as today's. Need a half-life per signal type.
4. **No event bus.** Connectors will need to fire events ("new calendar event detected", "Plaid txn matched 'restaurant' on a Saturday") that the audit engine subscribes to. Today everything is request/response.
5. **No background job framework.** We have `job_heartbeats` for individual cron tasks but no general worker pool. Plaid sync, Gmail sync, etc. need a queue (BullMQ + Redis, or pg-boss for now).
6. **Pricing is one-shot.** No subscriptions, no Stripe Customer Portal, no proration. Need Stripe Billing properly wired before charging $19/mo.
7. **No mobile parity.** Mobile app exists but doesn't expose Wellness Center, Life Context, or Integrations. Life Pulse on mobile is the right *first* mobile primary surface (10-second daily ritual).
8. **Privacy story is a marketing page, not enforced.** Need a `data_access_log` table — every read of user signal data writes a row. Then a "Privacy ledger" page where the user sees every read of their data, with timestamp + purpose + reversal button. Nothing on the market has this. It's the single biggest trust unlock.
9. **No "delete everything" button that actually deletes.** Today data export exists but cascading hard-delete across all tables doesn't. Required for GDPR/CCPA + the trust story.
10. **Color/UX is generic.** See §5. The current look is fine but doesn't signal "psychology-first" — it signals "AI startup template."
11. **No feedback loop from outcomes.** We coach but never ask "did this work?" Need a lightweight "Did you go on the date? How did it feel? 1–5?" 30 seconds after the calendared event. That's the data that proves NLDC actually works.
12. **The funnel from dating apps in is implicit, not explicit.** No CTA anywhere that says *"Bring your Hinge / Bumble export here, we'll show you a year of patterns in 60 seconds."* That's the lead magnet.

---

## 8. The One-Page Pitch (for the cofounder, post-redesign)

> **NLDC is the operating system for your dating life.**
> Dating apps want your time. We want your truth.
> Connect what you trust — your calendar, your sleep, your messages — and NLDC builds a living psychological profile that coaches you in real time, before each date, after each ghost, and across the patterns no app can see.
> Cancel anytime. Delete everything in one tap. Nothing is shared, nothing is sold.
> **Move from the apps to a relationship. Bring your life with you.**

---

*This document is the canonical plan. Update it when priorities shift. Sub-features live as tasks in the project task list and reference back to this file.*
