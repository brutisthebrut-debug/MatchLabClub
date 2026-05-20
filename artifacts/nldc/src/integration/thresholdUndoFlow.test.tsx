import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// In-memory server state
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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiClient", () => ({
  getFounderStats: vi.fn(async () => ({ leads: 0, purchaseInterest: 0, audits: 0, waitlist: 0, messages: 0 })),
  getLeads: vi.fn(async () => []),
  getPurchaseInterestList: vi.fn(async () => []),
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
  undoAiThresholdChange: vi.fn(async (_key: string, id: number) => {
    const change = server.changes.find((c) => c.id === id);
    if (!change) throw new Error("Threshold change not found.");

    const { toolName } = change;
    const isGlobal = toolName === "__global__";
    const hasOld =
      change.oldWindowSize !== null &&
      change.oldMinSample !== null &&
      change.oldFirstTrySuccessRate !== null;

    if (hasOld) {
      const oldCfg: ThresholdConfig = {
        windowSize: change.oldWindowSize as number,
        minSample: change.oldMinSample as number,
        firstTrySuccessRate: change.oldFirstTrySuccessRate as number,
      };

      if (isGlobal) {
        const prev = { ...server.global };
        logChange({
          toolName,
          action: "update",
          oldWindowSize: prev.windowSize,
          oldMinSample: prev.minSample,
          oldFirstTrySuccessRate: prev.firstTrySuccessRate,
          newWindowSize: oldCfg.windowSize,
          newMinSample: oldCfg.minSample,
          newFirstTrySuccessRate: oldCfg.firstTrySuccessRate,
        });
        server.global = { ...oldCfg };
      } else {
        const existing = server.perTool.find((p) => p.toolName === toolName);
        const undoAction = existing ? "update" : "create";
        logChange({
          toolName,
          action: undoAction,
          oldWindowSize: existing?.windowSize ?? null,
          oldMinSample: existing?.minSample ?? null,
          oldFirstTrySuccessRate: existing?.firstTrySuccessRate ?? null,
          newWindowSize: oldCfg.windowSize,
          newMinSample: oldCfg.minSample,
          newFirstTrySuccessRate: oldCfg.firstTrySuccessRate,
        });
        server.perTool = [
          ...server.perTool.filter((p) => p.toolName !== toolName),
          { toolName, ...oldCfg },
        ];
      }
    } else {
      // Original action was a "create" with no prior values — undo removes the row.
      if (isGlobal) {
        const prev = { ...server.global };
        logChange({
          toolName,
          action: "reset",
          oldWindowSize: prev.windowSize,
          oldMinSample: prev.minSample,
          oldFirstTrySuccessRate: prev.firstTrySuccessRate,
          newWindowSize: null,
          newMinSample: null,
          newFirstTrySuccessRate: null,
        });
        server.global = { ...DEFAULTS };
      } else {
        const existing = server.perTool.find((p) => p.toolName === toolName);
        logChange({
          toolName,
          action: "remove",
          oldWindowSize: existing?.windowSize ?? null,
          oldMinSample: existing?.minSample ?? null,
          oldFirstTrySuccessRate: existing?.firstTrySuccessRate ?? null,
          newWindowSize: null,
          newMinSample: null,
          newFirstTrySuccessRate: null,
        });
        server.perTool = server.perTool.filter((p) => p.toolName !== toolName);
      }
    }

    return {
      undoneId: id,
      global: { ...server.global },
      perTool: server.perTool.map((p) => ({ ...p })),
    };
  }),
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
  getOcrPendingRules: vi.fn(async () => ({ rules: [] })),
  approveOcrRule: vi.fn(async () => {}),
  rejectOcrRule: vi.fn(async () => {}),
  getOcrRuleReviewLog: vi.fn(async () => ({ log: [] })),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListAudits: () => ({ data: [] as unknown[] }),
  useGetWaitlistStats: () => ({ data: { totalCount: 0 } }),
  useGetCoachFollowUpTimeline: () => ({ data: { buckets: [] }, isLoading: false, isError: false }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

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

  server.global = { ...DEFAULTS };
  server.perTool = [];
  server.changes = [];
  server.nextId = 1;

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
  await screen.findByText("Global defaults", {}, { timeout: 5000 });
}

function getThresholdLogList() {
  const heading = screen.getByText(/Recent threshold changes/i);
  return heading.closest("div")!.parentElement! as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Threshold change undo flow", () => {
  it("undoes a per-tool threshold update: logs a new audit row and disables the undo button", async () => {
    render(
      <Wrap>
        <Founder />
      </Wrap>,
    );

    await openThresholdEditor();

    // Add a ProfileReader override.
    const select = screen
      .getAllByRole("combobox")
      .find((el) => /Add override for/i.test(el.textContent ?? "")) as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: "ProfileReader" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    await waitFor(() => {
      // Editor override row uses "text-xs text-foreground/85 truncate" class.
      const editorSpan = document.querySelector<HTMLElement>(
        "span.truncate[title='ProfileReader']",
      );
      expect(editorSpan).toBeTruthy();
    });

    // Change its threshold to 80%.
    const overrideRow = document
      .querySelector<HTMLElement>("span.truncate[title='ProfileReader']")!
      .closest("div")!;
    const overrideInputs = overrideRow.querySelectorAll("input");
    expect(overrideInputs.length).toBe(3);
    fireEvent.change(overrideInputs[2]!, { target: { value: "80" } });

    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    // Wait for "create" audit row for ProfileReader at 80%.
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items[0]!.textContent).toMatch(/create/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      expect(items[0]!.textContent).toMatch(/80%/);
    });

    // Now update that override from 80% to 65%.
    // The editor override row span has a distinct class from the audit log span.
    // Scope the input lookup to the override row span's closest container div.
    const overrideRowUpdated = document
      .querySelector<HTMLElement>("span.truncate[title='ProfileReader']")!
      .closest("div")!;
    const overrideInputsUpdated = overrideRowUpdated.querySelectorAll("input");
    fireEvent.change(overrideInputsUpdated[2]!, { target: { value: "65" } });

    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    // Wait for "update" audit row at 65%.
    let updateChangeId: number;
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items[0]!.textContent).toMatch(/update/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      expect(items[0]!.textContent).toMatch(/65%/);
      updateChangeId = server.changes[0]!.id;
    });

    // Verify server state after save: override is at 65%.
    expect(server.perTool.find((p) => p.toolName === "ProfileReader")?.firstTrySuccessRate).toBeCloseTo(0.65);

    // Click the Undo button on the latest row (the 80→65 update).
    const undoBtn = await screen.findByTestId(`undo-threshold-change-${updateChangeId!}`);
    fireEvent.click(undoBtn);

    // Assert: the audit log gains a new entry at the top reflecting the undo (restores 80%).
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      // Three rows: undo (update back to 80%), the 65% update, and the original create.
      expect(items.length).toBeGreaterThanOrEqual(3);
      // The newest row reflects the undo — shows ProfileReader and 80%.
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      expect(items[0]!.textContent).toMatch(/80%/);
    });

    // Assert: server state has reverted the override back to 80%.
    expect(server.perTool.find((p) => p.toolName === "ProfileReader")?.firstTrySuccessRate).toBeCloseTo(0.8);

    // Assert: the undo button for the 65% update row is now disabled (marked "Undone").
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);

    // Assert: the editor override row for ProfileReader now shows 80% (reverted from 65%).
    await waitFor(() => {
      const overrideRowReverted = document.querySelector<HTMLElement>(
        "span.truncate[title='ProfileReader']",
      )!.closest("div")!;
      const inputs = overrideRowReverted.querySelectorAll("input");
      expect(inputs[2]!.value).toBe("80");
    });
  });

  it("undoes a per-tool 'create' (no prior values): logs a remove entry and reverts server state", async () => {
    render(
      <Wrap>
        <Founder />
      </Wrap>,
    );

    await openThresholdEditor();

    // Add a ProfileReader override at default values and save.
    const select = screen
      .getAllByRole("combobox")
      .find((el) => /Add override for/i.test(el.textContent ?? "")) as HTMLSelectElement;
    expect(select).toBeTruthy();
    fireEvent.change(select, { target: { value: "ProfileReader" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));

    await waitFor(() => {
      expect(document.querySelector("span.truncate[title='ProfileReader']")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    // Wait for "create" audit row.
    let createChangeId: number;
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items[0]!.textContent).toMatch(/create/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
      createChangeId = server.changes[0]!.id;
    });

    // Verify server has the override.
    expect(server.perTool.find((p) => p.toolName === "ProfileReader")).toBeTruthy();

    // Click Undo on the "create" row — should remove the override entirely.
    const undoBtn = await screen.findByTestId(`undo-threshold-change-${createChangeId!}`);
    fireEvent.click(undoBtn);

    // Assert: a "remove" entry appears at the top of the audit log.
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0]!.textContent).toMatch(/remove/i);
      expect(items[0]!.textContent).toMatch(/ProfileReader/);
    });

    // Assert: server state now has no ProfileReader override.
    expect(server.perTool.find((p) => p.toolName === "ProfileReader")).toBeUndefined();

    // Assert: the undo button for the original create row is now disabled.
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);

    // Assert: the editor no longer shows a ProfileReader override row.
    // The audit log still has a span[title='ProfileReader'] with class "font-mono",
    // so we specifically exclude that and look for the editor-only span (no font-mono).
    await waitFor(() => {
      const editorOverrideSpan = document.querySelector<HTMLElement>(
        "span.truncate[title='ProfileReader']:not(.font-mono)",
      );
      expect(editorOverrideSpan).toBeNull();
    });
  });

  it("undoes a global threshold update: reverts server.global and logs the undo entry", async () => {
    render(
      <Wrap>
        <Founder />
      </Wrap>,
    );

    await openThresholdEditor();

    // Locate the global Threshold % input via its label.
    const thresholdLabel = screen.getByText("Threshold %");
    const input = thresholdLabel.parentElement!.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("70");

    // Change the global threshold from 70% to 85%.
    fireEvent.change(input, { target: { value: "85" } });
    fireEvent.click(screen.getByRole("button", { name: /Save thresholds/i }));

    // Wait for an "update" audit row for "(global)" showing the new 85% value.
    let updateChangeId: number;
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      expect(items[0]!.textContent).toMatch(/update/i);
      expect(items[0]!.textContent).toMatch(/\(global\)/);
      expect(items[0]!.textContent).toMatch(/85%/);
      updateChangeId = server.changes[0]!.id;
    });

    // Verify server state after save: global threshold is now 85%.
    expect(server.global.firstTrySuccessRate).toBeCloseTo(0.85);

    // Click the Undo button on the global update row.
    const undoBtn = await screen.findByTestId(`undo-threshold-change-${updateChangeId!}`);
    fireEvent.click(undoBtn);

    // Assert: a new audit row appears at the top reflecting the undo (restores 70%).
    await waitFor(() => {
      const log = getThresholdLogList();
      const items = within(log).getAllByRole("listitem");
      // At least two rows: the undo entry and the original update.
      expect(items.length).toBeGreaterThanOrEqual(2);
      // The newest row is the undo — shows "(global)" and the restored 70%.
      expect(items[0]!.textContent).toMatch(/\(global\)/);
      expect(items[0]!.textContent).toMatch(/70%/);
    });

    // Assert: server.global has been reverted to the original 70%.
    expect(server.global.firstTrySuccessRate).toBeCloseTo(0.7);

    // Assert: the undo button for the original update row is now disabled.
    expect((undoBtn as HTMLButtonElement).disabled).toBe(true);

    // Assert: the global Threshold % input in the editor now reflects the reverted 70%.
    await waitFor(() => {
      const labelEl = screen.getByText("Threshold %");
      const inp = labelEl.parentElement!.querySelector("input") as HTMLInputElement;
      expect(inp.value).toBe("70");
    });
  });
});
