import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// End-to-end coverage for the OCR mismatch trend Day/Week grouping toggle.
// We mount the real Founder page, navigate to the OCR Mismatches tab, and
// exercise the groupby toggle. All network calls are mocked.
// ---------------------------------------------------------------------------

const trendPayload = {
  days: 30,
  since: "2026-04-20T00:00:00.000Z",
  series: [
    { period: "2026-05-19", firstName: 2, age: 0, sourceApp: 1, bio: 0, prompts: 0, total: 3 },
    { period: "2026-05-20", firstName: 1, age: 0, sourceApp: 0, bio: 1, prompts: 0, total: 2 },
  ],
};

const ocrPayload = {
  summary: {
    totalScreenshotAudits: 2,
    auditsWithRawOcr: 2,
    auditsWithCorrections: 2,
    sampleSize: 2,
    windowDays: 30,
    since: null,
    sort: "total" as const,
  },
  perField: [],
  recent: [],
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useGetCurrentAuthUser: () => ({
    data: { user: { id: "founder-test", role: "founder" } },
    isLoading: false,
  }),
  useListAudits: () => ({ data: [] }),
  useAskFounderCopilot: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({ answer: "", citations: [] })),
    isPending: false,
    isError: false,
    data: null,
    reset: vi.fn(),
  }),
  useGetWaitlistStats: () => ({ data: { totalCount: 0, spotsRemaining: 0, nextMilestone: 0 } }),
  useGetCoachFollowUpTimeline: () => ({ data: { buckets: [] }, isLoading: false, isError: false }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/lib/apiClient", () => {
  const stub = async () => { throw new Error("not used in this test"); };
  return {
    getFounderStats: stub,
    getLeads: async () => [],
    getPurchaseInterestList: async () => [],
    getJourneyEvents: async () => ({
      counts: [],
      totals: { today: 0, last7d: 0, last30d: 0 },
      recent: [],
    }),
    getAiMetrics: stub,
    getAiThresholds: stub,
    updateAiThresholds: stub,
    getAiMetricsTrends: stub,
    getAiThresholdChanges: stub,
    getRollupHeartbeat: stub,
    getOcrMismatches: async () => ({
      summary: {
        totalScreenshotAudits: 2,
        auditsWithRawOcr: 2,
        auditsWithCorrections: 2,
        sampleSize: 2,
        windowDays: 30,
        since: null,
        sort: "total" as const,
      },
      perField: [],
      recent: [],
    }),
    getOcrMismatchesTrends: async () => ({
      days: 30,
      since: "2026-04-20T00:00:00.000Z",
      series: [
        { day: "2026-05-19", firstName: 2, age: 0, sourceApp: 1, bio: 0, prompts: 0, total: 3 },
        { day: "2026-05-20", firstName: 1, age: 0, sourceApp: 0, bio: 1, prompts: 0, total: 2 },
      ],
    }),
    getBackgroundJobs: async () => ({ jobs: [] }),
    getOcrLearnedRules: async () => ({ rules: [] }),
    getOcrPendingRules: async () => ({ rules: [] }),
    getOcrRuleReviewLog: async () => ({ log: [] }),
    runOcrLearn: async () => ({ scannedAudits: 0, candidates: 0, persisted: 0 }),
    clearOcrLearnedRules: async () => {},
    getAlertSettings: async () => ({ rebreachCooldownMinutes: 15 }),
    updateAlertSettings: async (_key: string, minutes: number) => ({ rebreachCooldownMinutes: minutes }),
    approveOcrRule: async () => {},
    rejectOcrRule: async () => {},
    getReferralAttribution: async () => ({
      summary: { totalReferrals: 0, totalInviters: 0, totalConverted: 0, overallConversionRate: 0 },
      topInviters: [],
      surfaces: [],
    }),
    getEchoUserSignals: async () => ({ signals: null }),
    getFounderFunnel: async () => ({
      stages: [],
      readinessThreshold: 50,
      paidViaPurchaseInterest: 0,
      overallConversionRate: 0,
    }),
  };
});

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as typeof fetch;
  window.history.replaceState({}, "", "/founder");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

import Founder from "@/pages/Founder";

function renderFounder() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Founder />
    </QueryClientProvider>,
  );
}

async function openOcrTab() {
  const tab = await screen.findByRole("button", { name: /OCR Mismatches/i });
  fireEvent.click(tab);
  await screen.findByTestId("ocr-mismatches-panel");
}

describe("OCR mismatch trend groupby toggle", () => {
  it("renders the toggle and defaults to 'day' grouping", async () => {
    renderFounder();
    await openOcrTab();

    const toggle = screen.getByTestId("ocr-trend-groupby-toggle");
    expect(toggle).toBeTruthy();

    const chart = screen.getByTestId("ocr-trend-chart");
    expect(chart.textContent).toMatch(/per day/i);
    expect(chart.textContent).not.toMatch(/per week/i);
  });

  it("switches to 'week' grouping when Week is clicked, then reverts on Day click", async () => {
    renderFounder();
    await openOcrTab();

    const weekBtn = screen.getByTestId("ocr-trend-groupby-week");
    fireEvent.click(weekBtn);

    await waitFor(() => {
      const chart = screen.getByTestId("ocr-trend-chart");
      expect(chart.textContent).toMatch(/per week/i);
      expect(chart.textContent).not.toMatch(/per day/i);
    });

    const dayBtn = screen.getByTestId("ocr-trend-groupby-day");
    fireEvent.click(dayBtn);

    await waitFor(() => {
      const chart = screen.getByTestId("ocr-trend-chart");
      expect(chart.textContent).toMatch(/per day/i);
      expect(chart.textContent).not.toMatch(/per week/i);
    });
  });
});
