import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Shared mutable state — lets per-test setup override what the hooks return.
// ---------------------------------------------------------------------------

const auditDataRef: {
  current: Record<string, unknown> | null;
  isLoading: boolean;
} = { current: null, isLoading: false };

// ---------------------------------------------------------------------------
// Module-level mocks — registered before the page import.
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useParams: () => ({ id: "42" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetAudit: () => ({ data: auditDataRef.current, isLoading: auditDataRef.isLoading }),
  useGenerateAuditReport: () => ({
    mutateAsync: vi.fn(async () => CURRENT_REPORT),
    isPending: false,
  }),
  useGetEngineMeta: () => ({ data: { engineVersion: "v1" } }),
  useListAuditReportVersions: () => ({
    data: {
      versions: [
        {
          id: 1,
          readinessScore: 72,
          generatedAt: new Date().toISOString(),
          report: CURRENT_REPORT,
        },
      ],
    },
  }),
  useCorrectAuditSourceApp: () => ({ mutate: vi.fn(), isPending: false }),
  getGetAuditQueryKey: (id: number) => ["audit", id],
  getListAuditReportVersionsQueryKey: (id: number) => ["audit-versions", id],
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({
  useMeta: () => {},
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }),
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, rest, children),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Report from "@/pages/Report";

// ---------------------------------------------------------------------------
// Fixture data — current report with all sections populated.
// ---------------------------------------------------------------------------

const CURRENT_REPORT = {
  auditId: 42,
  readinessScore: 72,
  overallGrade: "B",
  strengths: ["Genuine warmth", "Clear intent"],
  risks: ["Generic opener"],
  bioAudit: "Current bio audit text.",
  rewrittenBio: "CURRENT_REWRITTEN_BIO: the best version of you.",
  rewrittenPrompts: [
    {
      original: "The way to win me over is...",
      rewritten: "CURRENT_PROMPT_REWRITE_0: remembering the weird specific thing.",
      tip: "Specificity beats sincerity.",
    },
  ],
  photoGuidance: [],
  actionPlan: [
    {
      priority: 1,
      title: "CURRENT_ACTION_TITLE_0",
      description: "CURRENT_ACTION_DESC_0: rewrite your opening line.",
      timeframe: "Today",
    },
    {
      priority: 2,
      title: "CURRENT_ACTION_TITLE_1",
      description: "CURRENT_ACTION_DESC_1: swap your lead photo.",
      timeframe: "This week",
    },
  ],
  messagingStyle: "Warm and curious.",
  coachingCta: "Ready for your full Dating Reset?",
  engineVersion: "v1",
};

function makeAudit() {
  return {
    id: 42,
    firstName: "Alex",
    age: 28,
    gender: "m",
    orientation: "straight",
    datingGoal: "find a relationship",
    currentApps: ["Hinge"],
    bio: "Current bio",
    status: "complete",
    source: "manual",
    readinessScore: 72,
    report: CURRENT_REPORT,
    reportGeneratedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    previousReport: null,
    previousReportGeneratedAt: null,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;
let clipboardWriteSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auditDataRef.current = null;
  auditDataRef.isLoading = false;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWriteSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests — current report action plan copy buttons
// ---------------------------------------------------------------------------

describe("Current report action plan — copy buttons", () => {
  it("action plan cards render with a copy button each", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const card0 = await screen.findByTestId("card-action-item-0");
    expect(within(card0).getByTestId("button-copy-text")).toBeTruthy();

    const card1 = screen.getByTestId("card-action-item-1");
    expect(within(card1).getByTestId("button-copy-text")).toBeTruthy();
  });

  it("clicking an action plan copy button calls clipboard.writeText with title + description", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const card0 = await screen.findByTestId("card-action-item-0");
    const copyBtn = within(card0).getByTestId("button-copy-text");

    fireEvent.click(copyBtn);

    const item = CURRENT_REPORT.actionPlan[0];
    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      `${item.title}: ${item.description}`,
    );
  });

  it("clicking the copy button shows 'Copied' feedback", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const card0 = await screen.findByTestId("card-action-item-0");
    const copyBtn = within(card0).getByTestId("button-copy-text");

    expect(copyBtn.textContent).toMatch(/^copy$/i);

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(copyBtn.textContent).toMatch(/copied/i);
    });
  });

  it("each action plan copy button copies its own item's text", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    await screen.findByTestId("card-action-item-0");

    const card1 = screen.getByTestId("card-action-item-1");
    const copyBtn1 = within(card1).getByTestId("button-copy-text");

    fireEvent.click(copyBtn1);

    const item1 = CURRENT_REPORT.actionPlan[1];
    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      `${item1.title}: ${item1.description}`,
    );
  });
});
