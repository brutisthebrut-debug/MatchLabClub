/**
 * Echo's strategic playbook. Append-only decision log. Each entry is a
 * strategic call that has been made and shouldn't be re-litigated without
 * explicit founder reversal. Future agents read this before proposing
 * pivots so the project doesn't drift every session.
 *
 * When you add an entry, include the date, the decision, the reasoning,
 * and what would have to change for the decision to flip.
 */

export interface PlaybookEntry {
  /** ISO date (YYYY-MM-DD) the decision was made. */
  date: string;
  /** Short slug for cross-reference. */
  id: string;
  /** One-line summary. */
  decision: string;
  /** Multi-paragraph reasoning. */
  rationale: string;
  /** Concrete signal that should trigger a revisit. */
  revisitWhen: string;
}

export const PLAYBOOK: readonly PlaybookEntry[] = [
  {
    date: "2026-05-28",
    id: "companion-not-matching",
    decision: "Build the companion product. Do not build a matching platform yet.",
    rationale: `Tinder, Hinge, and Bumble already have the users we want to help. A matching product would ask those users to leave the apps where their matches actually live, and we'd inherit the two-sided cold-start problem without VC money or the time to outlast it. The companion product wedges in next to those apps with a clear value prop: audit the profile, coach the messages, run the compass read, surface what your patterns mean. Every interaction in companion mode feeds wellness_answers and the per-user moat that table represents. After roughly six months of dense companion usage, the same users have a wellness profile no dating platform has, and matching becomes a credible v3 launched to a warm, profiled audience instead of a cold marketplace. Matching first, profile later is a dead start. Profile first, matching later is a natural escalation.`,
    revisitWhen: `We have ten thousand weekly active companion users with a median of twelve or more wellness dimensions answered, AND the founder has staffed identity verification, harassment response, and trust-and-safety workflows.`,
  },
  {
    date: "2026-05-28",
    id: "hybrid-ai-with-consent",
    decision: "Hybrid AI architecture: deterministic aiEngine baseline always-on, Anthropic via Replit AI Integration layered for semantic depth, per-account consent gate, graceful fallback.",
    rationale: `The deterministic engine guarantees the product works for every user even when the LLM is down, rate-limited, or the user has consent off. The Anthropic layer gives the product semantic depth on the small set of features that genuinely need it (bio rewrites, compass synthesis, Hinge import summaries, Instagram tone extraction, message coaching nuance). Per-account consent means we can be honest in marketing: users opt in, they see what's analyzed, they can revoke. Reliability monitoring is already wired so we know when a provider breaches its threshold, and the fallback path is exercised in production.`,
    revisitWhen: `Anthropic costs exceed forty percent of gross margin per paying user, OR a second provider becomes obviously better for our specific structured-output workload.`,
  },
  {
    date: "2026-05-28",
    id: "echo-as-code-not-daemon",
    decision: "Echo persists as a codified persona (voice.ts, playbook.ts, systemPrompt.ts) rather than as a stateful background agent.",
    rationale: `The founder asked for Echo to "live in the system" so it survives platform migrations. The honest implementation is durable files in the repo, not a long-running process. Persona, voice rules, and strategic memory expressed as code travel with the codebase to any host (Replit, Vercel, self-hosted) and any AI provider (Anthropic today, anyone tomorrow). A background daemon would couple Echo to one platform and one provider, which is the opposite of what was asked for. Any future "Echo copilot" feature in the founder dashboard reads from these same files, so Echo's behavior is always consistent across surfaces.`,
    revisitWhen: `The product genuinely needs cross-request stateful agent behavior (multi-turn long-running planning) that can't be modeled as stateless calls with the persona prompt.`,
  },
  {
    date: "2026-05-28",
    id: "anon-first-write-paths",
    decision: "Every user-data write path must accept anonymous traffic and stamp an anonymous_claim_token. Authenticated-only writes are the exception, not the default.",
    rationale: `The funnel from landing page to first valuable interaction is the most precious moment in the product. Forcing signup before someone can take a quiz, paste a bio, or run a compass read kills conversion. The anon_claim cookie plus the claim-anonymous reassignment flow lets people experience the product first and own their data after, which both converts better and matches the privacy-respecting story we tell in marketing. The audit on 2026-05-28 confirmed 11 of 11 user-data tables follow this pattern. Only wellness_tags is auth-only, by design (tag taxonomy is a logged-in surface).`,
    revisitWhen: `We discover an abuse vector that depends on anonymous writes, OR a regulator requires identity binding before any write.`,
  },
  {
    date: "2026-05-28",
    id: "no-em-dashes-in-prose",
    decision: "Echo's voice never uses em dashes in user-facing prose. Hyphens between words and parenthetical commas are the replacements.",
    rationale: `Em dashes have become a signature AI tell. The founder explicitly flagged them. Removing them from generated prose is the single highest-signal lift for making content not read as AI. The voice rule lives in voice.ts and the detectAiTells / countEmDashes utilities give us a CI check for blog drafts.`,
    revisitWhen: `Em dashes stop being a reliable AI tell in the broader web, AND the founder explicitly relaxes the rule.`,
  },
  {
    date: "2026-05-28",
    id: "echo-share-attribution-first-touch",
    decision: "Referral attribution uses first-touch wins. The mlc_ref cookie is set once on landing and never overwritten by subsequent shares.",
    rationale: `First-touch matches the human intuition of "who actually brought this person here." Last-touch would let any share clobber the original credit, which incentivises spam-sharing and obscures which surfaces actually drive signup. The cookie lasts sixty days, which covers the typical consideration window for a $97-$197 product. On signup, users.invited_by_user_id and users.invited_at are stamped on row INSERT only, never on the onConflictDoUpdate path, so returning users keep their original attribution.`,
    revisitWhen: `Founder wants to A/B test last-touch or multi-touch attribution to compare conversion lifts.`,
  },
];

/**
 * Look up a single playbook entry by id. Returns undefined if not found.
 */
export function getPlaybookEntry(id: string): PlaybookEntry | undefined {
  return PLAYBOOK.find(e => e.id === id);
}

/**
 * Echo decision helpers used by the founder dashboard copilot (T122).
 *
 * The PLAYBOOK above is the strategic decision log (long-form, dated entries
 * for the founder). These helpers are the per-user inference layer: given the
 * signals the founder dashboard has on a single user, what would Echo
 * actually do next? They are deliberately small and deterministic so the
 * founder can read them, debug them, and trust them. When a decision needs
 * to become a real product mutation, lift it out of here into a proper
 * service. For now this is the read-only Echo copilot's brain.
 */

export interface EchoUserSignals {
  email: string;
  tier: "free" | "reset" | "wingman" | null;
  createdAt: string | null;
  ageDays: number | null;
  auditCount: number;
  lastAuditAt: string | null;
  wellnessAnswerCount: number;
  lifePulseCount: number;
  consentGranted: boolean;
  invitedByUserId: string | null;
  invitedAt: string | null;
}

export interface EchoDecision {
  /** Name of the playbook function that produced this decision. */
  fn: string;
  /** Short title (founder-facing). */
  title: string;
  /** One to three sentences, Echo voice, paste-ready. */
  body: string;
}

/**
 * What Echo would do next for this user. Returns one concrete next action.
 */
export function nextStepForUser(s: EchoUserSignals): EchoDecision {
  const fn = "nextStepForUser";
  const age = s.ageDays ?? 0;
  if (s.tier === "wingman") {
    return {
      fn,
      title: "Mark for concierge intro this week",
      body: "Wingman tier. They paid for human contact. Add to the concierge intro queue and reach out personally within seven days.",
    };
  }
  if (s.tier === "reset" && s.wellnessAnswerCount >= 6) {
    return {
      fn,
      title: "Offer the Wingman upgrade conversation",
      body: "Reset tier with a meaningful wellness profile. The product moat is now built. Worth a low-pressure Wingman conversation.",
    };
  }
  if (s.tier === null && s.auditCount >= 2 && age >= 3) {
    return {
      fn,
      title: "Send the Day-3 nudge",
      body: "Two or more audits run, three or more days in, still unpaid. Send the Day-3 nudge that points back to their own readiness score.",
    };
  }
  if (s.tier === null && s.auditCount === 0 && age >= 1) {
    return {
      fn,
      title: "Send the empty-account ping",
      body: "Signed up, no audits run. Send the gentle ping with the sample report link so they can see the value before committing to their own data.",
    };
  }
  if (s.tier === null && s.auditCount >= 1 && age < 3) {
    return {
      fn,
      title: "Wait. They are still in the first 72 hours.",
      body: "First three days are the user's, not ours. Let the product do its job. Re-check on Day 3.",
    };
  }
  return {
    fn,
    title: "Wait 7 days, no action",
    body: "Nothing in their signals warrants an interruption. Re-read next week.",
  };
}

/**
 * The thing Echo would explicitly avoid doing for this user. Pairs with
 * nextStepForUser to keep the founder from over-reaching.
 */
export function whatEchoWouldNotDo(s: EchoUserSignals): EchoDecision {
  const fn = "whatEchoWouldNotDo";
  if (s.tier === "wingman") {
    return {
      fn,
      title: "Do not auto-email this user",
      body: "Wingman customers get human contact only. Generic broadcasts erode the tier's promise. If something automated needs to go out, exclude this address.",
    };
  }
  if (s.tier === null && (s.ageDays ?? 0) < 1) {
    return {
      fn,
      title: "Do not pitch pricing yet",
      body: "Less than a day in. They have not seen enough of the product to evaluate the offer. A pricing email now reads as a shakedown.",
    };
  }
  if (s.auditCount === 0) {
    return {
      fn,
      title: "Do not send a results email",
      body: "No audits on file. There is no result to reference. Any results-shaped email will land hollow.",
    };
  }
  return {
    fn,
    title: "Do not broadcast at them this week",
    body: "Their signal is steady. A generic newsletter blast at this account adds noise and erodes future open rates.",
  };
}

/**
 * Paste-ready Echo voice line the founder can drop into an email or DM. No
 * em dashes (voice rule). One short, specific sentence the founder could
 * legitimately send.
 */
export function voiceNoteForTomorrow(s: EchoUserSignals): EchoDecision {
  const fn = "voiceNoteForTomorrow";
  if (s.tier === "wingman") {
    return {
      fn,
      title: "Send tomorrow",
      body: "I want to set up a thirty minute intro this week. Bring one screenshot you would like me to look at first.",
    };
  }
  if (s.tier === "reset") {
    return {
      fn,
      title: "Send tomorrow",
      body: "You have been steady with the audits. If you want a sharper read on patterns, I can do a Wingman style session this month. No pressure either way.",
    };
  }
  if (s.tier === null && s.auditCount >= 2) {
    return {
      fn,
      title: "Send tomorrow",
      body: "Two audits in. The pattern I would watch for next is whether the same line keeps showing up in different bios. If it does, that is the one to rewrite first.",
    };
  }
  if (s.tier === null && s.auditCount === 0 && (s.ageDays ?? 0) >= 1) {
    return {
      fn,
      title: "Send tomorrow",
      body: "If you do not have a screenshot handy, the sample report shows the format. Tell me which section you would want sharper on your own bio and I will start there.",
    };
  }
  return {
    fn,
    title: "Hold for now",
    body: "Nothing to send tomorrow. The right note will write itself once they take the next action.",
  };
}

/**
 * Whether Echo thinks a pricing nudge is currently appropriate. Returns null
 * when the answer is no (i.e. do not surface a card).
 */
export function pricingNudgeForUser(s: EchoUserSignals): EchoDecision | null {
  const fn = "pricingNudgeForUser";
  if (s.tier !== null) return null;
  if (s.auditCount < 3) return null;
  if ((s.ageDays ?? 0) < 5) return null;
  return {
    fn,
    title: "Pricing nudge is on the table",
    body: "Three or more audits, five or more days, still unpaid. Reset at ninety seven dollars is the natural ask. Wingman is not the right pitch yet.",
  };
}

/**
 * Whether to flag this user for concierge attention regardless of tier.
 * Returns null when no flag is warranted.
 */
export function conciergeFlagForUser(s: EchoUserSignals): EchoDecision | null {
  const fn = "conciergeFlagForUser";
  if (s.tier === "wingman") {
    return {
      fn,
      title: "Concierge queue",
      body: "Wingman tier always flags for concierge. Add to this week's intro list if not already there.",
    };
  }
  if (s.tier === "reset" && s.wellnessAnswerCount >= 8 && s.lifePulseCount >= 3) {
    return {
      fn,
      title: "Concierge worth a look",
      body: "Reset customer with a deep wellness profile and consistent life pulses. They are behaving like a Wingman without paying for it. Worth one personal note.",
    };
  }
  return null;
}
