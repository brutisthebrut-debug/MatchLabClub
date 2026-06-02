import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface ThresholdConfig {
  windowSize: number;
  minSample: number;
  firstTrySuccessRate: number;
}
interface PerToolThreshold extends ThresholdConfig {
  toolName: string;
}
interface ThresholdChange {
  id: number;
  toolName: string;
  action: string;
  oldWindowSize: number | null;
  oldMinSample: number | null;
  oldFirstTrySuccessRate: number | null;
  newWindowSize: number | null;
  newMinSample: number | null;
  newFirstTrySuccessRate: number | null;
  createdAt: string;
}

const DEFAULTS: ThresholdConfig = {
  windowSize: 50,
  minSample: 10,
  firstTrySuccessRate: 0.7,
};

const server: {
  global: ThresholdConfig;
  perTool: PerToolThreshold[];
  changes: ThresholdChange[];
  nextId: number;
} = {
  global: { ...DEFAULTS },
  perTool: [],
  changes: [],
  nextId: 1,
};

function eq(a: ThresholdConfig, b: ThresholdConfig) {
  return (
    a.windowSize === b.windowSize &&
    a.minSample === b.minSample &&
    a.firstTrySuccessRate === b.firstTrySuccessRate
  );
}

function logChange(c: Omit<ThresholdChange, "id" | "createdAt">) {
  server.changes.unshift({
    ...c,
    id: server.nextId++,
    createdAt: new Date().toISOString(),
  });
}

vi.mock("@/lib/apiClient", () => ({
  getFounderStats: vi.fn(async () => ({ leads: 0, purchaseInterest: 0, audits: 0, waitlist: 0, messages: 0 })),
  getLeads: vi.fn(async () => []),
  getPurchaseInterestList: vi.fn(async () => []),
  getJourneyEvents: vi.fn(async () => ({
    counts: [],
    totals: { today: 0, last7d: 0, last30d: 0 },
    recent: [],
  })),
  getAiMetrics: vi.fn(async () => ({
    overall: {
      total: 0,
      firstTryOk: 0,
      retriedOk: 0,
      fallbacks: 0,
      firstTrySuccessRate: 0,
      overallSuccessRate: 0,
      avgAttempts: 0,
      avgDurationMs: 0,
    },
    perTool: [
      {
        toolName: "ProfileReader",
        total: 0,
        firstTryOk: 0,
        retriedOk: 0,
        fallbacks: 0,
        validationFailures: 0,
        firstTrySuccessRate: 0,
        overallSuccessRate: 0,
        avgAttempts: 0,
        avgDurationMs: 0,
        recent: { windowSize: 50, total: 0, firstTryOk: 0, fallbacks: 0, firstTrySuccessRate: 0 },
        last24h: { total: 0, fallbacks: 0, fallbackRate: 0 },
        last7d: { total: 0, fallbacks: 0, fallbackRate: 0 },
        effectiveThreshold: { ...DEFAULTS, isOverride: false },
        alert: false,
      },
    ],
    alertThreshold: { ...DEFAULTS },
    perToolOverrides: [],
    mailerHealth: [],
    alerts: [],
  })),
  getAiThresholds: vi.fn(async () => ({
    global: { ...server.global },
    perTool: server.perTool.map((p) => ({ ...p })),
    defaults: { ...DEFAULTS },
  })),
  updateAiThresholds: vi.fn(async (_key: string, body: any) => {
    // Simulate the server-side change logging.
    if (body.resetGlobal) {
      const prev = { ...server.global };
      const next = { ...DEFAULTS };
      if (!eq(prev, next)) {
        logChange({
          toolName: "__global__",
          action: "reset",
          oldWindowSize: prev.windowSize,
          oldMinSample: prev.minSample,
          oldFirstTrySuccessRate: prev.firstTrySuccessRate,
          newWindowSize: next.windowSize,
          newMinSample: next.minSample,
          newFirstTrySuccessRate: next.firstTrySuccessRate,
        });
        server.global = next;
      }
    } else if (body.global) {
      const prev = { ...server.global };
      const next: ThresholdConfig = {
        windowSize: body.global.windowSize,
        minSample: body.global.minSample,
        firstTrySuccessRate: body.global.firstTrySuccessRate,
      };
      if (!eq(prev, next)) {
        logChange({
          toolName: "__global__",
          action: "update",
          oldWindowSize: prev.windowSize,
          oldMinSample: prev.minSample,
          oldFirstTrySuccessRate: prev.firstTrySuccessRate,
          newWindowSize: next.windowSize,
          newMinSample: next.minSample,
          newFirstTrySuccessRate: next.firstTrySuccessRate,
        });
        server.global = next;
      }
    }

    for (const t of (body.perTool ?? []) as PerToolThreshold[]) {
      const prev = server.perTool.find((p) => p.toolName === t.toolName);
      const next: PerToolThreshold = {
        toolName: t.toolName,
        windowSize: t.windowSize,
        minSample: t.minSample,
        firstTrySuccessRate: t.firstTrySuccessRate,
      };
      if (prev && eq(prev, next)) continue;
      logChange({
        toolName: t.toolName,
        action: prev ? "update" : "create",
        oldWindowSize: prev?.windowSize ?? null,
        oldMinSample: prev?.minSample ?? null,
        oldFirstTrySuccessRate: prev?.firstTrySuccessRate ?? null,
        newWindowSize: next.windowSize,
        newMinSample: next.minSample,
        newFirstTrySuccessRate: next.firstTrySuccessRate,
      });
      server.perTool = [
        ...server.perTool.filter((p) => p.toolName !== t.toolName),
        next,
      ];
    }

    for (const name of (body.removeToolNames ?? []) as string[]) {
      const prev = server.perTool.find((p) => p.toolName === name);
      if (!prev) continue;
      logChange({
        toolName: name,
        action: "remove",
        oldWindowSize: prev.windowSize,
        oldMinSample: prev.minSample,
        oldFirstTrySuccessRate: prev.firstTrySuccessRate,
        newWindowSize: null,
        newMinSample: null,
        newFirstTrySuccessRate: null,
      });
      server.perTool = server.perTool.filter((p) => p.toolName !== name);
    }

    return { global: { ...server.global }, perTool: server.perTool.map((p) => ({ ...p })) };
  }),
  getAiMetricsTrends: vi.fn(async () => ({ days: 7, since: new Date().toISOString(), series: [] })),
  getAiThresholdChanges: vi.fn(async (_key: string, limit = 10) => ({
    changes: server.changes.slice(0, limit).map((c) => ({ ...c })),
  })),
  getRollupHeartbeat: vi.fn(async () => ({
    lastSuccessAt: new Date().toISOString(),
    ageMs: 0,
    staleThresholdMs: 60_000,
    stale: false,
  })),
  getOcrMismatches: vi.fn(async () => ({
    summary: {
      totalScreenshotAudits: 0,
      auditsWithRawOcr: 0,
      auditsWithCorrections: 0,
      sampleSize: 0,
      windowDays: null,
      since: null,
      sort: "frequency",
    },
    perField: [],
    recent: [],
  })),
  getBackgroundJobs: vi.fn(async () => ({ jobs: [] })),
  getOcrMismatchesTrends: vi.fn(async () => ({ days: 30, since: new Date().toISOString(), series: [] })),
  getOcrLearnedRules: vi.fn(async () => ({ rules: [] })),
  getOcrPendingRules: vi.fn(async () => ({ rules: [] })),
  getOcrRuleReviewLog: vi.fn(async () => ({ log: [] })),
  runOcrLearn: vi.fn(async () => ({ scannedAudits: 0, candidates: 0, persisted: 0 })),
  clearOcrLearnedRules: vi.fn(async () => {}),
  getAlertSettings: vi.fn(async () => ({ rebreachCooldownMinutes: 15 })),
  updateAlertSettings: vi.fn(async (_key: string, minutes: number) => ({ rebreachCooldownMinutes: minutes })),
  approveOcrRule: vi.fn(async () => {}),
  rejectOcrRule: vi.fn(async () => {}),
  getReferralAttribution: vi.fn(async () => ({
    summary: { totalReferrals: 0, totalInviters: 0, totalConverted: 0, overallConversionRate: 0 },
    topInviters: [],
    surfaces: [],
  })),
  getEchoUserSignals: vi.fn(async () => ({ signals: null })),
  getFounderFunnel: vi.fn(async () => ({
    stages: [],
    readinessThreshold: 50,
    paidViaPurchaseInterest: 0,
    overallConversionRate: 0,
  })),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListAudits: () => ({ data: [] as unknown[] }),
  useAskFounderCopilot: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => ({ answer: "", citations: [] })),
    isPending: false,
    isError: false,
    data: null,
    reset: vi.fn(),
  }),
  useGetWaitlistStats: () => ({ data: { totalCount: 0 } }),
  useGetCoachFollowUpTimeline: () => ({ data: { buckets: [] }, isLoading: false, isError: false }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

// Mock fetch for AiStatusPanel calls.
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        mode: "fallback",
        keyDetected: false,
        provider: null,
        source: "none",
        model: "unknown",
        message: "ok",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as any;

  // Reset server state.
  server.global = { ...DEFAULTS };
  server.perTool = [];
  server.changes = [];
  server.nextId = 1;

  // Enter authenticated founder view via ?key=... query param.
  window.history.replaceState({}, "", "/founder?key=nldc2024");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

// Imported after mocks are registered.
import Founder from "@/pages/Founder";

function Wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function openThresholdEditor() {
  const tuneBtn = await screen.findByRole(
    "button",
    { name: /Tune alert thresholds/i },
    { timeout: 5000 },
  );
  fireEvent.click(tuneBtn);
  // Wait until the editor's case-sensitive "Global defaults" heading appears.
  await screen.findByText("Global defaults", {}, { timeout: 5000 });
}

function getThresholdLogList() {
  const heading = screen.getByText(/Recent threshold changes/i);
  // The list is a sibling of the heading inside the same container.
  return heading.closest("div")!.parentElement! as HTMLElement;
}

describe("Founder threshold audit log", () => {
  it("records a global threshold edit and shows it under Recent threshold changes", async () => {
    render(
      <Wrap>
        <Founder />
      </Wrap>,
    );

    // Wait for AI Reliability panel + editor button to render.
    await openThresholdEditor();

    // The third input under "Global defaults" is the Threshold % input.
    const thresholdInputs = screen.getAllByTitle?.bind(screen) ?? null;
    void thresholdInputs;

    // Locate the global threshold % input by its label text "Threshold %".
    const thresholdLabel = screen.getByText("Threshold %");
    const input = thresholdLabel.parentElement!.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("70");
    fireEvent.change(input, { target: { value: "75" } });

    const saveBtn = screen.getByRole("button", { name: /Save thresholds/i });
    fireEvent.click(saveBtn);

    // Wait for the new entry to land in the audit log.
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items.length).toBe(1);
      // Action badge says "update", target reads "(global)".
      expect(items[0]!.textContent).toMatch(/update/i);
      expect(items[0]!.textContent).toMatch(/\(global\)/);
      // Old 70% → new 75% appears somewhere in the row.
      expect(items[0]!.textContent).toMatch(/70%/);
      expect(items[0]!.textContent).toMatch(/75%/);
    });
  });

  it("records a per-tool override add and subsequent remove as two log entries", async () => {
    render(
      <Wrap>
        <Founder />
      </Wrap>,
    );

    await openThresholdEditor();

    // Add an override for ProfileReader via the "Add override for…" select.
    // There are several selects on the page; pick the one whose first option
    // is the editor's "Add override for…" placeholder.
    const select = screen
      .getAllByRole("combobox")
      .find((el) => /Add override for/i.test(el.textContent ?? "")) as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: "ProfileReader" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    // The new override row should appear; tweak its threshold so the
    // recorded change has a distinct new value (80%).
    await waitFor(() => {
      expect(screen.getByText("ProfileReader")).toBeTruthy();
    });
    const overrideRow = screen.getByText("ProfileReader").closest("div")!;
    const overrideInputs = overrideRow.querySelectorAll("input");
    expect(overrideInputs.length).toBe(3);
    // Inputs are: window, minSample, threshold%. Change threshold% to 80.
    fireEvent.change(overrideInputs[2]!, { target: { value: "80" } });

    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    // After save, expect a single "create" entry for ProfileReader at 80%.
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items.length).toBe(1);
      expect(items[0]!.textContent).toMatch(/create/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      expect(items[0]!.textContent).toMatch(/80%/);
    });

    // Now remove the override and save again.
    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      // Newest first: remove, then create.
      expect(items.length).toBe(2);
      expect(items[0]!.textContent).toMatch(/remove/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      expect(items[0]!.textContent).toMatch(/80%/);
      expect(items[1]!.textContent).toMatch(/create/i);
      expect(items[1]!.textContent).toMatch(/ProfileReader/);
    });
  });
});
