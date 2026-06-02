import type {
  MirrorPortrait,
  UserJourneySummary,
  UserAchievements,
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
