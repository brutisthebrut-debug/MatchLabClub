import type {
  MirrorPortrait,
  UserJourneySummary,
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
