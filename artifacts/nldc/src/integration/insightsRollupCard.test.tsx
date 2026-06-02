import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({
  useMeta: () => {},
}));

vi.mock("@/lib/anonymousIds", () => ({
  rememberAnonymousId: () => {},
  readAnonymousIds: () => ({
    auditIds: [],
    profileIds: [],
    messageSessionIds: [],
    insightIds: [],
    followUpIds: [],
  }),
}));

type RollupData = {
  totalAnalyzed: number;
  sources: {
    sourceApp: string;
    count: number;
    attachmentStyle: string;
    traits: { warmth: number; curiosity: number; verbosity: number; humor: number };
    signaturePattern: string;
    summary: string;
  }[];
  comparisons: {
    trait: "warmth" | "curiosity" | "verbosity" | "humor";
    leader: string;
    laggard: string;
    delta: number;
    sentence: string;
  }[];
} | null;

let mockRollup: RollupData = null;
let mockIsAuthenticated = false;

vi.mock("@workspace/api-client-react", () => ({
  useListInsights: () => ({ data: [], isLoading: false }),
  useCreateInsight: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnalyzeInsight: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetInsightsRollup: () => ({ data: mockRollup }),
  useDeleteInsight: () => ({ mutate: vi.fn(), isPending: false }),
  getListInsightsQueryKey: () => ["insights"],
  getGetInsightsRollupQueryKey: () => ["insights-rollup"],
  useGetMatchingState: () => ({
    data: { eligible: false, readiness: { score: 0 }, nextActions: [] },
    isLoading: false,
  }),
  getGetMatchingStateQueryKey: () => ["matching-state"],
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, isLoading: false, user: null }),
}));

import Insights from "@/pages/Insights";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  mockRollup = null;
  mockIsAuthenticated = false;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
});

function Wrap() {
  return (
    <QueryClientProvider client={qc}>
      <Insights />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MULTI_SOURCE_ROLLUP: NonNullable<RollupData> = {
  totalAnalyzed: 2,
  sources: [
    {
      sourceApp: "Hinge",
      count: 1,
      attachmentStyle: "Secure — you communicate directly",
      traits: { warmth: 80, curiosity: 60, verbosity: 40, humor: 20 },
      signaturePattern: "Humor as a connector",
      summary: "One import from Hinge. Strong warmth and curiosity.",
    },
    {
      sourceApp: "iMessage",
      count: 1,
      attachmentStyle: "Secure — relaxed and direct",
      traits: { warmth: 20, curiosity: 40, verbosity: 50, humor: 90 },
      signaturePattern: "Playful deflection",
      summary: "One import from iMessage. High humor, low warmth.",
    },
  ],
  comparisons: [
    {
      trait: "warmth",
      leader: "Hinge",
      laggard: "iMessage",
      delta: 60,
      sentence: "You're warmer on Hinge than on iMessage (+60 pts).",
    },
    {
      trait: "humor",
      leader: "iMessage",
      laggard: "Hinge",
      delta: 70,
      sentence: "You're more playful on iMessage than on Hinge (+70 pts).",
    },
  ],
};

const SINGLE_SOURCE_ROLLUP: NonNullable<RollupData> = {
  totalAnalyzed: 1,
  sources: [
    {
      sourceApp: "Bumble",
      count: 1,
      attachmentStyle: "Secure",
      traits: { warmth: 50, curiosity: 50, verbosity: 50, humor: 50 },
      signaturePattern: "Question-heavy style",
      summary: "One import from Bumble.",
    },
  ],
  comparisons: [],
};

// ---------------------------------------------------------------------------
// Cross-import trends card — multi-source state
// ---------------------------------------------------------------------------

describe("cross-import trends card — multi-source (2+ sources)", () => {
  it("renders the rollup card when totalAnalyzed >= 2 and sources.length >= 2", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    expect(screen.getByTestId("card-insights-rollup")).toBeTruthy();
  });

  it("shows a per-source tile for each source", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    expect(screen.getByTestId("rollup-source-hinge")).toBeTruthy();
    expect(screen.getByTestId("rollup-source-imessage")).toBeTruthy();
  });

  it("renders at least one comparison row", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    const warmthRow = screen.getByTestId("rollup-comparison-warmth");
    expect(warmthRow).toBeTruthy();
    expect(warmthRow.textContent).toMatch(/warmer on Hinge than on iMessage/i);
  });

  it("renders all provided comparison rows", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    expect(screen.getByTestId("rollup-comparison-warmth")).toBeTruthy();
    expect(screen.getByTestId("rollup-comparison-humor")).toBeTruthy();
  });

  it("does not render the single-source nudge card alongside the full rollup card", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    expect(screen.queryByTestId("card-insights-rollup-single")).toBeNull();
  });

  it("displays the count summary in the card header", () => {
    mockRollup = MULTI_SOURCE_ROLLUP;
    render(<Wrap />);
    const card = screen.getByTestId("card-insights-rollup");
    expect(card.textContent).toMatch(/2 analyzed imports/i);
    expect(card.textContent).toMatch(/2 sources/i);
  });
});

// ---------------------------------------------------------------------------
// Cross-import trends card — single-source state
// ---------------------------------------------------------------------------

describe("cross-import trends card — single-source nudge", () => {
  it("renders the single-source card when authenticated with 1 analyzed insight from 1 source", () => {
    mockRollup = SINGLE_SOURCE_ROLLUP;
    mockIsAuthenticated = true;
    render(<Wrap />);
    expect(screen.getByTestId("card-insights-rollup-single")).toBeTruthy();
  });

  it("does not render the full rollup card in single-source state", () => {
    mockRollup = SINGLE_SOURCE_ROLLUP;
    mockIsAuthenticated = true;
    render(<Wrap />);
    expect(screen.queryByTestId("card-insights-rollup")).toBeNull();
  });

  it("does not show the single-source nudge for unauthenticated users", () => {
    mockRollup = SINGLE_SOURCE_ROLLUP;
    mockIsAuthenticated = false;
    render(<Wrap />);
    expect(screen.queryByTestId("card-insights-rollup-single")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No rollup data
// ---------------------------------------------------------------------------

describe("cross-import trends card — no data", () => {
  it("does not render the rollup card when rollup is null", () => {
    mockRollup = null;
    render(<Wrap />);
    expect(screen.queryByTestId("card-insights-rollup")).toBeNull();
    expect(screen.queryByTestId("card-insights-rollup-single")).toBeNull();
  });

  it("does not render the rollup card when totalAnalyzed is 0", () => {
    mockRollup = { totalAnalyzed: 0, sources: [], comparisons: [] };
    render(<Wrap />);
    expect(screen.queryByTestId("card-insights-rollup")).toBeNull();
  });
});
