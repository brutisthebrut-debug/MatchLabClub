---
name: Wellness capture consent policy
description: Why wellness answers are always captured at consentLevel "all" and how the server enforces it
---

# Wellness capture is fixed at consentLevel "all"

Every wellness answer is stored at `consentLevel = "all"` and used across all purposes
(coaching, matching, research). There is no per-answer consent picker in the UI, and the
API does NOT honor a caller-supplied `consentLevel`: the POST `/wellness/answers` route
hard-overrides it to `"all"`, and the PATCH route never changes it. Capture is "assumed by
use" and stated in Terms.

**Why:** Founder wants comprehensive, frictionless capture so the matching engine gets the
most signal ("the more the machine knows you, the better it matches you"). Per-answer consent
fragmented the data and added friction. User control is preserved through delete/export in the
Data Vault, not through pick-your-use consent.

**How to apply:**
- Do not reintroduce a consent picker or let any write path set `consentLevel` to anything but `"all"`.
- The `WellnessConsentLevel` enum still includes legacy values `coaching`/`matching`/`research`
  because old rows carry them. Keep these valid for reads; only new writes are `"all"`.
- Any query that counts "matching-eligible" wellness data must include BOTH `'matching'` and
  `'all'` (legacy + new), e.g. founder wellness-stats. Filtering on `'matching'` alone silently
  under-counts every post-policy row.
- Keep user-facing copy (Terms, Wellness Center, Data Vault) consistent: comprehensive capture,
  used for coaching + matching, deletable anytime. No "used only for coaching unless you approve
  matching" language.
