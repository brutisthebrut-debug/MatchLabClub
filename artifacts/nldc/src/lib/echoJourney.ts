export type PrimaryDestinationId =
  | "today"
  | "matches"
  | "matchlab"
  | "journey"
  | "play";

export type PrimaryDestination = {
  id: PrimaryDestinationId;
  name: string;
  href: string;
  question: string;
  routePrefixes: readonly string[];
};

export const PRIMARY_DESTINATIONS: readonly PrimaryDestination[] = [
  {
    id: "today",
    name: "Today",
    href: "/today",
    question: "What should I do next?",
    routePrefixes: [
      "/today",
      "/echo",
      "/coach",
      "/next-message",
      "/rehearsal",
      "/copilot",
      "/wingman",
    ],
  },
  {
    id: "matches",
    name: "Matches",
    href: "/matching",
    question: "Who should I meet?",
    routePrefixes: [
      "/matching",
      "/matches",
      "/match-path",
      "/date-safety",
      "/photos",
      "/future-connections",
      "/verification",
    ],
  },
  {
    id: "matchlab",
    name: "My MatchLab",
    href: "/your-mirror",
    question: "How well does MatchLab know me?",
    routePrefixes: [
      "/your-mirror",
      "/me",
      "/mirror",
      "/wellness",
      "/life-context",
      "/connections",
      "/voice-intro",
      "/imports",
      "/profile-reader",
      "/style-map",
      "/blueprint",
      "/glow-up",
      "/photo-lab",
      "/start",
      "/dashboard",
      "/report",
      "/scan",
      "/insights",
      "/integrations",
      "/receipts",
      "/lab",
      "/archetype",
      "/connection-style",
      "/care-dialect",
      "/compatibility-compass",
      "/share-card",
    ],
  },
  {
    id: "journey",
    name: "Journey",
    href: "/progress/timeline",
    question: "What am I learning?",
    routePrefixes: [
      "/progress",
      "/milestones",
      "/reflection",
      "/user-control",
    ],
  },
  {
    id: "play",
    name: "Play",
    href: "/quiz",
    question: "Can I add useful signal without homework?",
    routePrefixes: [
      "/quiz",
      "/quizzes",
      "/games",
      "/this-or-that",
      "/cosmic",
      "/flags",
    ],
  },
] as const;

export type JourneyChapter = {
  name: string;
  destination: PrimaryDestinationId;
  href: string;
};

export const JOURNEY_CHAPTERS: readonly JourneyChapter[] = [
  { name: "Arrive", destination: "today", href: "/today" },
  { name: "First read", destination: "matchlab", href: "/your-mirror" },
  { name: "Play", destination: "play", href: "/quiz" },
  { name: "Confirm", destination: "matchlab", href: "/your-mirror" },
  { name: "Waiting", destination: "matches", href: "/matching" },
  { name: "Introduction", destination: "matches", href: "/matches" },
  { name: "Date", destination: "matches", href: "/date-safety" },
  { name: "Reflect", destination: "journey", href: "/progress/timeline" },
] as const;

function routeMatches(location: string, prefix: string): boolean {
  return location === prefix || location.startsWith(`${prefix}/`);
}

export function destinationForLocation(
  location: string,
): PrimaryDestinationId | null {
  for (const destination of PRIMARY_DESTINATIONS) {
    if (
      destination.routePrefixes.some((prefix) =>
        routeMatches(location, prefix),
      )
    ) {
      return destination.id;
    }
  }
  return null;
}

export function chapterForLocation(location: string): number {
  const destination = destinationForLocation(location);
  if (!destination) return 0;
  const exact = JOURNEY_CHAPTERS.findIndex(
    (chapter) => routeMatches(location, chapter.href),
  );
  if (exact >= 0) return exact;
  return JOURNEY_CHAPTERS.findIndex(
    (chapter) => chapter.destination === destination,
  );
}
