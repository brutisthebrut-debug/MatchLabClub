import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// End-to-end coverage for the founder OCR Mismatches tab.
// We mount the real Founder page, unlock the dashboard with the default key,
// switch to the OCR Mismatches tab, and exercise the field filter chips.
// All network calls are mocked so the test is hermetic.
// ---------------------------------------------------------------------------

const ocrMismatchesPayload = {
  summary: {
    totalScreenshotAudits: 4,
    auditsWithRawOcr: 4,
    auditsWithCorrections: 3,
    sampleSize: 3,
    windowDays: 30,
    since: null,
    sort: "total" as const,
  },
  perField: [
    {
      field: "firstName" as const,
      correctionsCount: 3,
      topDiffCount: 2,
      topDiffs: [
        { example: "Rilye → Riley", count: 2 },
        { example: "Erma → Emma", count: 1 },
      ],
    },
    {
      field: "sourceApp" as const,
      correctionsCount: 1,
      topDiffCount: 1,
      topDiffs: [{ example: "Humble → Bumble", count: 1 }],
    },
    {
      field: "bio" as const,
      correctionsCount: 1,
      topDiffCount: 1,
      topDiffs: [{ example: "Sundayss. → Sundays.", count: 1 }],
    },
    { field: "age" as const, correctionsCount: 0, topDiffCount: 0, topDiffs: [] },
    { field: "prompts" as const, correctionsCount: 0, topDiffCount: 0, topDiffs: [] },
  ],
  recent: [
    {
      auditId: 581,
      field: "firstName" as const,
      raw: "Erma",
      corrected: "Emma",
      createdAt: "2026-05-20T12:00:00.000Z",
    },
    {
      auditId: 581,
      field: "sourceApp" as const,
      raw: "Humble",
      corrected: "Bumble",
      createdAt: "2026-05-20T12:00:00.000Z",
    },
    {
      auditId: 580,
      field: "firstName" as const,
      raw: "Rilye",
      corrected: "Riley",
      createdAt: "2026-05-20T11:59:00.000Z",
    },
    {
      auditId: 579,
      field: "firstName" as const,
      raw: "Rilye",
      corrected: "Riley",
      createdAt: "2026-05-20T11:58:00.000Z",
    },
    {
      auditId: 579,
      field: "bio" as const,
      raw: "Yoga teacher who loves long hikes and slow Sundayss.",
      corrected: "Yoga teacher who loves long hikes and slow Sundays.",
      createdAt: "2026-05-20T11:58:00.000Z",
    },
  ],
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
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

const getOcrMismatchesMock = vi.fn();

vi.mock("@/lib/apiClient", async () => {
  const stub = async () => {
    throw new Error("not used in this test");
  };
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
    getOcrMismatches: () => getOcrMismatchesMock(),
    getBackgroundJobs: async () => ({ jobs: [] }),
    getOcrMismatchesTrends: async () => ({ days: 30, since: new Date().toISOString(), series: [] }),
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

// Stub global fetch for any incidental calls (e.g. AI status panel on
// Overview tab). Each call returns an empty-but-OK response so nothing
// throws.
const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  getOcrMismatchesMock.mockReset();
  getOcrMismatchesMock.mockResolvedValue(ocrMismatchesPayload);
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

// Import the page AFTER mocks are registered.
import Founder from "@/pages/Founder";

function renderFounder() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Founder />
    </QueryClientProvider>,
  );
}

async function unlockDashboard() {
  const input = await screen.findByPlaceholderText(/Founder key/i);
  fireEvent.change(input, { target: { value: "nldc2024" } });
  const unlock = screen.getByRole("button", { name: /Open Dashboard/i });
  fireEvent.click(unlock);
  // Tab nav appears after unlock.
  await screen.findByRole("button", { name: /OCR Mismatches/i });
}

async function openOcrTab() {
  fireEvent.click(screen.getByRole("button", { name: /OCR Mismatches/i }));
  await screen.findByTestId("ocr-mismatches-panel");
}

describe("Founder dashboard → OCR Mismatches tab (e2e)", () => {
  it("unlocks the dashboard, opens the tab, and renders summary/per-field/recent sections", async () => {
    renderFounder();
    await unlockDashboard();
    await openOcrTab();

    // Summary cards.
    const summary = screen.getByTestId("ocr-summary-cards");
    expect(within(summary).getByText(/Screenshot audits/i)).toBeTruthy();
    expect(within(summary).getByText(/With raw OCR/i)).toBeTruthy();
    expect(within(summary).getByText(/With corrections/i)).toBeTruthy();
    expect(within(summary).getByText(/Sample size/i)).toBeTruthy();
    // Values come from the payload (4 / 4 / 3 / 3).
    expect(within(summary).getAllByText("4").length).toBeGreaterThanOrEqual(2);
    expect(within(summary).getAllByText("3").length).toBeGreaterThanOrEqual(2);

    // Per-field cards.
    expect(screen.getByTestId("ocr-field-card-firstName")).toBeTruthy();
    expect(screen.getByTestId("ocr-field-card-sourceApp")).toBeTruthy();
    expect(screen.getByTestId("ocr-field-card-bio")).toBeTruthy();
    expect(
      screen.getByTestId("ocr-field-count-firstName").textContent,
    ).toContain("3");
    expect(
      screen.getByTestId("ocr-field-count-sourceApp").textContent,
    ).toContain("1");

    // Recent diffs table starts with all 5 rows.
    const tbody = screen.getByTestId("ocr-recent-tbody");
    expect(within(tbody).getAllByTestId("ocr-recent-row")).toHaveLength(5);
    expect(screen.getByTestId("ocr-recent-row-count").textContent).toMatch(
      /Showing 5 of 5/,
    );
  });

  it("narrows the recent diffs table when field filter chips are clicked", async () => {
    renderFounder();
    await unlockDashboard();
    await openOcrTab();

    // Sanity: starting state is "All" with 5 rows.
    expect(
      within(screen.getByTestId("ocr-recent-tbody")).getAllByTestId(
        "ocr-recent-row",
      ),
    ).toHaveLength(5);

    // firstName chip → 3 rows, all data-field="firstName".
    fireEvent.click(screen.getByTestId("ocr-filter-chip-firstName"));
    await waitFor(() => {
      expect(screen.getByTestId("ocr-recent-row-count").textContent).toMatch(
        /Showing 3 of 5/,
      );
    });
    const firstNameRows = within(
      screen.getByTestId("ocr-recent-tbody"),
    ).getAllByTestId("ocr-recent-row");
    expect(firstNameRows).toHaveLength(3);
    for (const row of firstNameRows) {
      expect(row.getAttribute("data-field")).toBe("firstName");
    }

    // sourceApp chip → exactly 1 row, data-field="sourceApp".
    fireEvent.click(screen.getByTestId("ocr-filter-chip-sourceApp"));
    await waitFor(() => {
      expect(screen.getByTestId("ocr-recent-row-count").textContent).toMatch(
        /Showing 1 of 5/,
      );
    });
    const sourceAppRows = within(
      screen.getByTestId("ocr-recent-tbody"),
    ).getAllByTestId("ocr-recent-row");
    expect(sourceAppRows).toHaveLength(1);
    expect(sourceAppRows[0]!.getAttribute("data-field")).toBe("sourceApp");

    // age chip → 0 rows, empty state visible.
    fireEvent.click(screen.getByTestId("ocr-filter-chip-age"));
    await waitFor(() => {
      expect(screen.getByTestId("ocr-recent-row-count").textContent).toMatch(
        /Showing 0 of 5/,
      );
    });
    expect(
      within(screen.getByTestId("ocr-recent-tbody")).queryAllByTestId(
        "ocr-recent-row",
      ),
    ).toHaveLength(0);
    expect(screen.getByTestId("ocr-recent-empty").textContent).toMatch(
      /No diffs for this field/i,
    );

    // Back to All → 5 rows again.
    fireEvent.click(screen.getByTestId("ocr-filter-chip-all"));
    await waitFor(() => {
      expect(screen.getByTestId("ocr-recent-row-count").textContent).toMatch(
        /Showing 5 of 5/,
      );
    });
    expect(
      within(screen.getByTestId("ocr-recent-tbody")).getAllByTestId(
        "ocr-recent-row",
      ),
    ).toHaveLength(5);
  });
});
