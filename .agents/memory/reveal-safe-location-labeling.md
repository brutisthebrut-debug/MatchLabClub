---
name: Reveal-safe location labeling
description: How any connection feature may reference a counterpart's location without leaking PII; the single-chokepoint rule.
---

# Reveal-safe location labeling

A counterpart's city (free-text `cityHint`) is PII and must never appear to a
viewer who has not earned it. Any connection-scoped feature that wants to
reference "where you both are" must route ALL of its generators (deterministic
templates, the Claude prompt, and any external places/maps lookup) through ONE
label-building chokepoint, so there is a single place to audit for leaks.

The label ordering that is allowed to name a city:
1. counterpart reveal consent ON and they have a city -> name THEIR city ("in {City}")
2. both gave the same canonical city -> name it ("in {City}"); naming a shared city reveals nothing new
3. else the viewer has a city -> name only the VIEWER's own city, framed as "near you in {City}"
4. else fully generic ("near both of you")

**Why:** city is coarse PII; the product already discloses coarse distance in
compatibility summaries, so naming a *shared* city (case 2) is an accepted,
intentional disclosure, but naming a *hidden, non-shared* counterpart city is a
real leak. Routing every generator through one label means a leak can only ever
come from one function, not from N scattered string builds.

**How to apply:** when adding a location-aware connection feature (date ideas,
date-spot suggestions, the long-term "vicinity" matching idea), build the label
once, pass ONLY that label + aggregate score + provider-supplied venue names
into both the deterministic generator and the Claude prompt. Tell any external
provider only a SAFE city (counterpart city only when revealed, else the
viewer's own). Fail soft to null when the provider is unconfigured (Stripe
null-when-unconfigured pattern). Test the leak rule by asserting the hidden
city string is absent from the entire serialized response, not just one field.

Such endpoints are POST/user-initiated, so they are not client-pre-gated like
the starters GET, but they still consent+cap-gate Claude server-side and must
guard on `connection.status !== "active"` (409) so a stale tab cannot spend a
deep-AI-lane token on a closed/reported thread.
