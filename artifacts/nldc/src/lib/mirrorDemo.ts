import type {
  MirrorPortrait,
  UserJourneySummary,
  UserAchievements,
  SignalMap,
} from "@workspace/api-client-react";

// Sample momentum shown to signed-out visitors so the recap card is never empty.
// Real accounts always get their own counts from their own journey events.
export const DEMO_MOMENTUM: UserJourneySummary = {
  signalsFedThisWeek: 4,
  readinessGainedThisWeek: 11,
  toolsCompletedThisWeek: 3,
  hasHistory: true,
};

// Shown when the visitor is signed out (portrait endpoint 401s) or while a
// signed-in user's first portrait is still loading. Real accounts always get
// their own computed portrait; this only keeps surfaces from looking empty,
// clearly labelled as a sample where it is shown.
export const DEMO_PORTRAIT: MirrorPortrait = {
  readinessScore: 48,
  stage: "forming",
  stageLabel: "Forming",
  stageBlurb:
    "The picture is taking shape. A few strong signals are in, and several lanes are still blank.",
  coveragePercent: 42,
  headline:
    "I can see how you show up in writing and how steady your week feels. I cannot see your spending rhythm or your real date outcomes yet.",
  known: [
    {
      key: "wellness",
      label: "Emotional readiness",
      coverage: 80,
      confidence: 72,
      insight:
        "Your check-ins read steady and self-aware. You name what you want without spiraling.",
      dimensions: ["self-awareness"],
    },
    {
      key: "compass",
      label: "Values compass",
      coverage: 55,
      confidence: 60,
      insight:
        "You lean toward depth over novelty, and you say so plainly.",
      dimensions: ["values"],
    },
  ],
  blindSpots: [
    {
      key: "spending",
      label: "Spending rhythm",
      why: "No financial signal is connected yet, so I cannot see how your day-to-day choices line up with what you say you want.",
      actionLabel: "Connect spending",
      href: "/connections",
    },
    {
      key: "postDate",
      label: "Real date outcomes",
      why: "You have not logged a date debrief yet, so I am still guessing at what actually happens when you meet someone.",
      actionLabel: "Log a debrief",
      href: "/copilot/debrief",
    },
  ],
  nextSignal: {
    key: "postDate",
    label: "Log your next date",
    detail:
      "One honest debrief teaches me more than ten audits. It is the single fastest way to sharpen this picture.",
    href: "/copilot/debrief",
    points: 12,
  },
  outcomeHeadline: "No real date outcomes logged yet.",
  totalDates: 0,
  eligible: false,
  threshold: 60,
  engineVersion: "sample",
};

// Sample unlock board shown while a signed-in user's first board loads, or if the
// board endpoint hiccups, so the unlocks section is never empty. Real accounts
// always get their own board computed from their own progress. Clearly labelled
// as a sample where it is shown.
export const DEMO_ACHIEVEMENTS: UserAchievements = {
  unlockedCount: 4,
  totalCount: 10,
  achievements: [
    { id: "first-signal", title: "First signal", description: "Teach the machine its first thing about you.", icon: "Sparkles", tier: "bronze", unit: "signals", target: 1, progress: 1, unlocked: true },
    { id: "signal-10", title: "Signal stacker", description: "Feed ten signals into your second brain.", icon: "Layers", tier: "silver", unit: "signals", target: 10, progress: 7, unlocked: false },
    { id: "signal-25", title: "Open book", description: "Feed twenty-five signals and keep going.", icon: "BookOpen", tier: "gold", unit: "signals", target: 25, progress: 7, unlocked: false },
    { id: "streak-3", title: "Warming up", description: "Show up three days in a row.", icon: "Flame", tier: "bronze", unit: "days", target: 3, progress: 3, unlocked: true },
    { id: "streak-7", title: "Week strong", description: "Keep a seven-day streak alive.", icon: "Flame", tier: "gold", unit: "days", target: 7, progress: 3, unlocked: false },
    { id: "tools-3", title: "Toolkit", description: "Finish three tools across the app.", icon: "Wrench", tier: "bronze", unit: "tools", target: 3, progress: 3, unlocked: true },
    { id: "lanes-3", title: "Portrait forming", description: "Map three areas of your Mirror.", icon: "Compass", tier: "silver", unit: "areas", target: 3, progress: 3, unlocked: true },
    { id: "lanes-6", title: "Wide open", description: "Map six areas so the picture gets sharp.", icon: "Telescope", tier: "gold", unit: "areas", target: 6, progress: 3, unlocked: false },
    { id: "ready-25", title: "Off the ground", description: "Climb to twenty-five readiness.", icon: "TrendingUp", tier: "bronze", unit: "readiness", target: 25, progress: 25, unlocked: true },
    { id: "match-ready", title: "Match ready", description: "Reach the readiness that opens introductions.", icon: "Heart", tier: "gold", unit: "readiness", target: 60, progress: 48, unlocked: false },
  ],
};

// Sample signal-density map shown while a signed-in user's first map loads, or
// to signed-out visitors, so the density section is never empty. Real accounts
// always get their own map computed from their own coverage, and it is clearly
// labelled as a sample where it is shown. This fallback mirrors the real API
// derivation exactly so it never contradicts a signed-in view: weightPercent
// values are the normalized registry weights (each weight / sum of all
// weights), lanes are sorted active-first by coverage then blind spots by
// weight (registry order breaks ties), densityPercent is the weighted coverage
// of the active lanes, and topBlindSpot is the heaviest empty lane.
export const DEMO_SIGNAL_MAP: SignalMap = {
  densityPercent: 26,
  lanesActive: 5,
  totalLanes: 14,
  topBlindSpot: {
    id: "hingeImport",
    label: "Hinge import",
    coverage: 0,
    weightPercent: 9,
    confidence: 70,
    dimensions: ["real-world dating behavior", "texting style"],
    hasSignal: false,
    action: {
      label: "Import your Hinge data",
      detail: "One export fills a whole signal lane at once.",
      href: "/imports",
    },
  },
  lanes: [
    {
      id: "wellness",
      label: "Wellness dimensions",
      coverage: 78,
      weightPercent: 12,
      confidence: 90,
      dimensions: ["all 18 wellness dimensions"],
      hasSignal: true,
      action: {
        label: "Answer a few wellness prompts",
        detail: "Cover more of the 18 dimensions so your profile reads fuller.",
        href: "/wellness",
      },
    },
    {
      id: "audits",
      label: "Profile audits",
      coverage: 67,
      weightPercent: 9,
      confidence: 75,
      dimensions: ["self-presentation", "how their profile actually reads"],
      hasSignal: true,
      action: {
        label: "Run a profile audit",
        detail: "Scan your profile or a screenshot. Each audit teaches the engine how you show up.",
        href: "/scan",
      },
    },
    {
      id: "compass",
      label: "Compass reads",
      coverage: 60,
      weightPercent: 11,
      confidence: 80,
      dimensions: ["compatibility instincts", "what they are drawn to"],
      hasSignal: true,
      action: {
        label: "Run a compass read",
        detail: "Score someone you are already talking to. Each read adds real signal.",
        href: "/compatibility-compass",
      },
    },
    {
      id: "coaching",
      label: "Message coaching",
      coverage: 40,
      weightPercent: 7,
      confidence: 65,
      dimensions: ["how they communicate", "texting style"],
      hasSignal: true,
      action: {
        label: "Coach a conversation",
        detail: "Paste a chat and get real reply options. Each session is signal on your style.",
        href: "/coach",
      },
    },
    {
      id: "quizzes",
      label: "Quiz instincts",
      coverage: 25,
      weightPercent: 6,
      confidence: 60,
      dimensions: ["self-knowledge", "values and instincts"],
      hasSignal: true,
      action: {
        label: "Play a quiz",
        detail: "Each quick quiz adds a new angle on how you connect, and feeds your Mirror.",
        href: "/quizzes",
      },
    },
    {
      id: "hingeImport",
      label: "Hinge import",
      coverage: 0,
      weightPercent: 9,
      confidence: 70,
      dimensions: ["real-world dating behavior", "texting style"],
      hasSignal: false,
      action: {
        label: "Import your Hinge data",
        detail: "One export fills a whole signal lane at once.",
        href: "/imports",
      },
    },
    {
      id: "postDate",
      label: "Post-date notes",
      coverage: 0,
      weightPercent: 9,
      confidence: 85,
      dimensions: ["what actually fits in person", "date outcomes"],
      hasSignal: false,
      action: {
        label: "Add a post-date note",
        detail: "Reflect on a recent date. Outcomes teach the engine what fits you.",
        href: "/mirror/dates",
      },
    },
    {
      id: "journal",
      label: "Journal entries",
      coverage: 0,
      weightPercent: 8,
      confidence: 60,
      dimensions: ["self-awareness", "how they process feelings"],
      hasSignal: false,
      action: {
        label: "Write a journal entry",
        detail: "A real reflection counts. One-liners do not.",
        href: "/mirror/journal",
      },
    },
    {
      id: "wins",
      label: "Dating wins",
      coverage: 0,
      weightPercent: 7,
      confidence: 50,
      dimensions: ["courage", "momentum"],
      hasSignal: false,
      action: {
        label: "Log a dating win",
        detail: "Small moments of courage count as signal now, not just a private note.",
        href: "/progress/wins",
      },
    },
    {
      id: "calendar",
      label: "Calendar rhythm",
      coverage: 0,
      weightPercent: 6,
      confidence: 55,
      dimensions: ["how full their life is outside dating"],
      hasSignal: false,
      action: {
        label: "Paste your calendar",
        detail: "Drop in your .ics export. We read your rhythm, never the raw file.",
        href: "/imports",
      },
    },
    {
      id: "instagram",
      label: "Instagram tone",
      coverage: 0,
      weightPercent: 6,
      confidence: 60,
      dimensions: ["public-facing personality", "tone of voice"],
      hasSignal: false,
      action: {
        label: "Share your Instagram tone",
        detail: "Paste a few captions. We read the tone, never your account.",
        href: "/me",
      },
    },
    {
      id: "lifePulse",
      label: "Life pulse",
      coverage: 0,
      weightPercent: 4,
      confidence: 55,
      dimensions: ["energy and headspace over time"],
      hasSignal: false,
      action: {
        label: "Log a life pulse",
        detail: "A quick check-in on sleep, energy, and headspace. Patterns become signal.",
        href: "/mirror",
      },
    },
    {
      id: "taste",
      label: "Taste signature",
      coverage: 0,
      weightPercent: 4,
      confidence: 55,
      dimensions: ["cultural taste", "what they actually love"],
      hasSignal: false,
      action: {
        label: "Share your taste",
        detail: "List the music, film, shows, and books you love. We read the overlap, never judge the list.",
        href: "/connections/add/taste",
      },
    },
    {
      id: "lifestyle",
      label: "Lifestyle rhythm",
      coverage: 0,
      weightPercent: 4,
      confidence: 55,
      dimensions: ["how they spend a normal week", "lifestyle and pace"],
      hasSignal: false,
      action: {
        label: "Describe your lifestyle",
        detail: "List the activities and rituals that make up a normal week. We read the rhythm, never the detail.",
        href: "/connections/add/lifestyle",
      },
    },
  ],
};
