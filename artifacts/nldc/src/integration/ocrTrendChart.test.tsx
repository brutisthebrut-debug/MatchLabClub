import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// End-to-end coverage for the OCR Mismatch trend chart on the Founder page.
// We mount the real Founder page, unlock the dashboard with the default key,
// switch to the OCR Mismatches tab, and assert the trend chart section renders
// in both the no-data empty state and the seeded-data (chart) state.
// All network calls are mocked so the test is hermetic.
// ---------------------------------------------------------------------------

const getOcrMismatchesMock = vi.fn();
const getOcrMismatchesTrendsMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useListAudits: () => ({ data: [] }),
  useGetWaitlistStats: () => ({
    data: { totalCount: 0, spotsRemaining: 0, nextMilestone: 0 },
  }),
  useGetCoachFollowUpTimeline: () => ({ data: { buckets: [] }, isLoading: false, isError: false }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/lib/apiClient", async () => {
  const stub = async () => {
    throw new Error("not used in this test");
  };
  return {
    getFounderStats: stub,
    getLeads: async () => [],
    getPurchaseInterestList: async () => [],
    getAiMetrics: stub,
    getAiThresholds: stub,
    updateAiThresholds: stub,
    getAiMetricsTrends: stub,
    getAiThresholdChanges: stub,
    undoAiThresholdChange: stub,
    getRollupHeartbeat: stub,
    getBackgroundJobs: stub,
    getOcrMismatches: () => getOcrMismatchesMock(),
    getOcrMismatchesTrends: () => getOcrMismatchesTrendsMock(),
    getOcrLearnedRules: async () => ({ rules: [] }),
    runOcrLearn: async () => ({
      scannedAudits: 0,
      candidates: 0,
      persisted: 0,
    }),
    clearOcrLearnedRules: async () => {},
  };
});

// Stub global fetch so the AI status panel (on Overview) doesn't throw.
// Recharts uses ResizeObserver internally; jsdom doesn't provide it.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const originalFetch = globalThis.fetch;

const ocrMismatchesPayload = {
  summary: {
    totalScreenshotAudits: 5,
    auditsWithRawOcr: 5,
    auditsWithCorrections: 3,
    sampleSize: 3,
    windowDays: 30,
    since: null,
    sort: "total" as const,
  },
  perField: [
    {
      field: "bio" as const,
      correctionsCount: 3,
      topDiffCount: 2,
      topDiffs: [{ example: "helo → hello", count: 2 }],
    },
  ],
  recent: [
    {
      auditId: 100,
      field: "bio" as const,
      raw: "helo",
      corrected: "hello",
      createdAt: "2026-05-20T10:00:00.000Z",
    },
  ],
};

// Trend payload where every day has total === 0 (empty-state path).
const emptyTrendPayload = {
  days: 30,
  since: "2026-04-20",
  series: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 3, 20) + i * 24 * 60 * 60 * 1000);
    return {
      day: d.toISOString().slice(0, 10),
      firstName: 0,
      age: 0,
      sourceApp: 0,
      bio: 0,
      prompts: 0,
      total: 0,
    };
  }),
};

// Trend payload with actual data (seeded: bio had corrections on day 1).
const seededTrendPayload = {
  days: 30,
  since: "2026-04-20",
  series: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 3, 20) + i * 24 * 60 * 60 * 1000);
    return {
      day: d.toISOString().slice(0, 10),
      firstName: 0,
      age: 0,
      sourceApp: 0,
      bio: i === 0 ? 3 : 0,
      prompts: 0,
      total: i === 0 ? 3 : 0,
    };
  }),
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  getOcrMismatchesMock.mockReset();
  getOcrMismatchesTrendsMock.mockReset();
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

import Founder from "@/pages/Founder";

function renderFounder() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Founder />
    </QueryClientProvider>,
  );
}

async function unlockAndOpenOcrTab() {
  const input = await screen.findByPlaceholderText(/Founder key/i);
  fireEvent.change(input, { target: { value: "nldc2024" } });
  fireEvent.click(screen.getByRole("button", { name: /Unlock Dashboard/i }));
  await screen.findByRole("button", { name: /OCR Mismatches/i });
  fireEvent.click(screen.getByRole("button", { name: /OCR Mismatches/i }));
  await screen.findByTestId("ocr-mismatches-panel");
}

describe("Founder dashboard → OCR trend chart (e2e)", () => {
  it("renders the ocr-trend-chart section after unlocking and switching to OCR tab", async () => {
    getOcrMismatchesTrendsMock.mockResolvedValue(seededTrendPayload);

    renderFounder();
    await unlockAndOpenOcrTab();

    await waitFor(() => {
      expect(screen.getByTestId("ocr-trend-chart")).toBeTruthy();
    });
  });

  it("shows the empty state when all trend series totals are zero", async () => {
    getOcrMismatchesTrendsMock.mockResolvedValue(emptyTrendPayload);

    renderFounder();
    await unlockAndOpenOcrTab();

    await waitFor(() => {
      expect(screen.getByTestId("ocr-trend-empty")).toBeTruthy();
    });

    expect(screen.getByTestId("ocr-trend-empty").textContent).toMatch(
      /No correction data in this window yet/i,
    );
  });

  it("does not show the empty state when the seeded trend has non-zero totals", async () => {
    getOcrMismatchesTrendsMock.mockResolvedValue(seededTrendPayload);

    renderFounder();
    await unlockAndOpenOcrTab();

    await waitFor(() => {
      expect(screen.getByTestId("ocr-trend-chart")).toBeTruthy();
    });

    // The chart path is taken; the empty-state placeholder must be absent.
    expect(screen.queryByTestId("ocr-trend-empty")).toBeNull();
  });
});
