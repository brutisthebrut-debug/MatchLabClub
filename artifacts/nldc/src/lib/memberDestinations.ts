import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  HeartHandshake,
  LibraryBig,
  Route,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export type MemberDestinationId =
  | "today"
  | "matches"
  | "my-matchlab"
  | "journey"
  | "play"
  | "trust-data";

export type MemberDestination = {
  id: MemberDestinationId;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const MEMBER_DESTINATIONS: readonly MemberDestination[] = [
  {
    id: "today",
    label: "Today",
    href: "/today",
    icon: CalendarDays,
    description: "What matters now and the next honest step.",
  },
  {
    id: "matches",
    label: "Matches",
    href: "/matches",
    icon: HeartHandshake,
    description: "Considered introductions and active conversations.",
  },
  {
    id: "my-matchlab",
    label: "My MatchLab",
    href: "/my-matchlab",
    icon: LibraryBig,
    description: "The understanding you have chosen to build and keep.",
  },
  {
    id: "journey",
    label: "Journey",
    href: "/journey",
    icon: Route,
    description: "Dates, reflections, experiments, and what changed.",
  },
  {
    id: "play",
    label: "Play",
    href: "/play",
    icon: Sparkles,
    description: "Low-pressure ways to discover more about yourself.",
  },
];

export const TRUST_DESTINATION: MemberDestination = {
  id: "trust-data",
  label: "Trust & Data",
  href: "/trust-data",
  icon: ShieldCheck,
  description: "Sources, permissions, privacy, and account controls.",
};

const ROUTE_DESTINATION_PREFIXES: readonly [
  string,
  MemberDestinationId,
][] = [
  ["/copilot/debrief", "journey"],
  ["/copilot/weekly-plan", "journey"],
  ["/copilot/what-changed", "journey"],
  ["/mirror/journal", "journey"],
  ["/mirror/dates", "journey"],
  ["/progress", "journey"],
  ["/reflection", "journey"],
  ["/milestones", "journey"],
  ["/journey", "journey"],

  ["/copilot/profile", "my-matchlab"],

  ["/compatibility-compass", "matches"],
  ["/future-connections", "matches"],
  ["/verification", "matches"],
  ["/match-path", "matches"],
  ["/matching", "matches"],
  ["/matches", "matches"],
  ["/photos", "matches"],

  ["/connection-style", "my-matchlab"],
  ["/profile-reader", "my-matchlab"],
  ["/care-dialect", "my-matchlab"],
  ["/signal-check", "my-matchlab"],
  ["/your-mirror", "my-matchlab"],
  ["/my-matchlab", "my-matchlab"],
  ["/photo-lab", "my-matchlab"],
  ["/archetype", "my-matchlab"],
  ["/blueprint", "my-matchlab"],
  ["/glow-up", "my-matchlab"],
  ["/wellness", "my-matchlab"],
  ["/dashboard", "my-matchlab"],
  ["/mirror", "my-matchlab"],
  ["/style-map", "my-matchlab"],
  ["/scan", "my-matchlab"],
  ["/start", "my-matchlab"],
  ["/me", "my-matchlab"],

  ["/games", "play"],
  ["/quizzes", "play"],
  ["/this-or-that", "play"],
  ["/flags", "play"],
  ["/cosmic", "play"],
  ["/quiz", "play"],
  ["/play", "play"],

  ["/connections", "trust-data"],
  ["/integrations", "trust-data"],
  ["/life-context", "trust-data"],
  ["/voice-intro", "trust-data"],
  ["/user-control", "trust-data"],
  ["/trust-data", "trust-data"],
  ["/receipts", "trust-data"],
  ["/imports", "trust-data"],
  ["/account", "trust-data"],
  ["/privacy", "trust-data"],
  ["/terms", "trust-data"],
  ["/trash", "trust-data"],
  ["/vault", "trust-data"],

  ["/date-safety", "today"],
  ["/next-message", "today"],
  ["/rehearsal", "today"],
  ["/copilot", "today"],
  ["/coach", "today"],
  ["/echo", "today"],
  ["/today", "today"],
].sort((a, b) => b[0].length - a[0].length) as [
  string,
  MemberDestinationId,
][];

function normalizePath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] || "/";
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean;
}

export function destinationIdForPath(
  path: string,
): MemberDestinationId | null {
  const normalized = normalizePath(path);
  const match = ROUTE_DESTINATION_PREFIXES.find(
    ([prefix]) =>
      normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
  return match?.[1] ?? null;
}

export function memberDestinationById(
  id: MemberDestinationId,
): MemberDestination {
  if (id === "trust-data") return TRUST_DESTINATION;
  const destination = MEMBER_DESTINATIONS.find((item) => item.id === id);
  if (!destination) {
    throw new Error(`Unknown member destination: ${id}`);
  }
  return destination;
}
