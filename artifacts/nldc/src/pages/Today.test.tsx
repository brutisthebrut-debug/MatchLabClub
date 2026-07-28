import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  CompanionState,
  MatchingState,
  SignalMap,
} from "@workspace/api-client-react";
import { TodayView } from "./Today";

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { firstName: "Daniel" },
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetCompanionQueryKey: () => ["companion"],
  getGetMatchingStateQueryKey: () => ["matching-state"],
  getGetMySignalMapQueryKey: () => ["signal-map"],
  useGetCompanion: () => ({ data: undefined }),
  useGetMatchingState: () => ({ data: undefined }),
  useGetMySignalMap: () => ({ data: undefined }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/SignalOfTheDay", () => ({
  SignalOfTheDay: () => <div data-testid="signal-of-day" />,
}));

const companion = {
  personaLabel: "Your witty sibling",
  greeting: "Morning.",
  read: "You are clearer than you were last week, but you are still dodging the profile rewrite.",
  challenge: "Specific beats impressive. Your bio is still trying to win a committee vote.",
  nextMove: null,
  readinessScore: 42,
  threshold: 60,
  eligible: false,
  observations: [],
  commitments: [],
  unreadCount: 0,
  settings: {
    persona: "witty_sibling",
    candor: 2,
    inApp: true,
    email: false,
    sms: false,
  },
} satisfies CompanionState;

const matching = {
  preferences: null,
  poolStatus: "building",
  tier: null,
  readiness: {
    score: 42,
    breakdown: {},
  },
  eligible: false,
  readinessThreshold: 60,
  cityDensity: 0,
  totalPoolCount: 0,
  nextActions: [
    {
      key: "profile",
      label: "Rewrite one profile prompt",
      detail: "Give the engine something specific to work with.",
      points: 8,
      href: "/glow-up",
    },
  ],
  history: [],
  outcomeInsight: {
    totalDates: 0,
    anotherDate: 0,
    noMore: 0,
    ghosted: 0,
    unsure: 0,
    headline: "No dates logged yet.",
  },
} as unknown as MatchingState;

const signalMap = {
  densityPercent: 36,
  lanesActive: 5,
  totalLanes: 15,
  lanes: [],
  topBlindSpot: null,
} satisfies SignalMap;

describe("Today", () => {
  it("leads with Echo, one next move, and the three supporting destinations", () => {
    render(
      <TodayView
        firstName="Daniel"
        companion={companion}
        matching={matching}
        signalMap={signalMap}
      />,
    );

    expect(screen.getByText("Hey, Daniel.")).toBeTruthy();
    expect(screen.getByText(companion.read)).toBeTruthy();
    expect(screen.getByText("Rewrite one profile prompt")).toBeTruthy();
    expect(screen.getByText("My MatchLab")).toBeTruthy();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(screen.getByText("Journey")).toBeTruthy();
    expect(screen.getByTestId("signal-of-day")).toBeTruthy();
  });

  it("tells the truth when the member is ready for introductions", () => {
    render(
      <TodayView
        companion={{ ...companion, eligible: true, readinessScore: 66 }}
        matching={{
          ...matching,
          eligible: true,
          readiness: { ...matching.readiness, score: 66 },
          nextActions: [],
        }}
        signalMap={signalMap}
      />,
    );

    expect(screen.getByText("Ready for introductions")).toBeTruthy();
    expect(screen.getByText("Open matches")).toBeTruthy();
    expect(screen.getByText("You are match ready")).toBeTruthy();
  });
});
