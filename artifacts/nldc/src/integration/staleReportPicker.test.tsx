import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Audit } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Hoisted mocks — must live before vi.mock factory calls
// ---------------------------------------------------------------------------

const { mockLoadAutoRefreshPref, mockHasSwept, mockMarkSwept } = vi.hoisted(
  () => ({
    mockLoadAutoRefreshPref: vi.fn<[], boolean>(() => false),
    mockHasSwept: vi.fn<[], boolean>(() => false),
    mockMarkSwept: vi.fn<[], void>(),
  }),
);

// ---------------------------------------------------------------------------
// Mocks (registered before any page import)
// ---------------------------------------------------------------------------

vi.mock("@/lib/autoRefreshPref", () => ({
  loadAutoRefreshPref: mockLoadAutoRefreshPref,
  hasSwept: mockHasSwept,
  markSwept: mockMarkSwept,
  AUTO_REFRESH_BATCH_SIZE: 3,
  useAutoRefreshPref: () => [false, vi.fn()],
  saveAutoRefreshPref: vi.fn(),
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: "test-picker-user", email: null },
  }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/lib/anonymousIds", () => ({
  hasAnyAnonymousIds: () => false,
}));

// jsdom does not implement these — stub them so observer-based effects are
// no-ops rather than throwing.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ---------------------------------------------------------------------------
// Import Dashboard AFTER mocks are registered.
// ---------------------------------------------------------------------------
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/toaster";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A date 35 days in the past — well past the 30-day staleness threshold. */
const STALE_DATE = new Date(
  Date.now() - 35 * 24 * 60 * 60 * 1000,
).toISOString();

function buildAudit(overrides: Partial<Audit> & { id: number }): Audit {
  return {
    firstName: "Jordan",
    age: 30,
    gender: "x",
    datingGoal: "find a relationship",
    currentApps: ["Hinge"],
    bio: "",
    prompts: null,
    source: null,
    status: "complete",
    readinessScore: 72,
    createdAt: new Date().toISOString(),
    reportGeneratedAt: STALE_DATE,
    ...overrides,
  } as Audit;
}

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

interface FetchState {
  audits: Audit[];
  generateCallIds: number[];
}

const fetchState: FetchState = {
  audits: [],
  generateCallIds: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetchMock(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        const method = (
          init?.method ?? (input instanceof Request ? input.method : "GET")
        ).toUpperCase();

        // POST /api/audits/:id/generate
        const generateMatch =
          method === "POST" && url.match(/\/api\/audits\/(\d+)\/generate$/);
        if (generateMatch) {
          const id = Number(generateMatch[1]);
          fetchState.generateCallIds.push(id);
          return jsonResponse(200, { readinessScore: 75 });
        }

        // GET /api/audits (handles infinite query with optional query params)
        if (method === "GET" && /\/api\/audits(\?.*)?$/.test(url)) {
          return jsonResponse(200, fetchState.audits);
        }

        // GET /api/audits/summary
        if (method === "GET" && url.endsWith("/api/audits/summary")) {
          return jsonResponse(200, {
            totalAudits: fetchState.audits.length,
            averageScore: 70,
            latestScore: fetchState.audits[0]?.readinessScore ?? 0,
            scoreHistory: [],
            topStrengths: [],
            topRisks: [],
          });
        }

        if (method === "GET" && url.endsWith("/api/profiles")) {
          return jsonResponse(200, []);
        }
        if (method === "GET" && url.endsWith("/api/messages")) {
          return jsonResponse(200, []);
        }
        if (method === "GET" && url.endsWith("/api/insights")) {
          return jsonResponse(200, []);
        }

        return jsonResponse(404, { error: `unhandled ${method} ${url}` });
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchState.audits = [];
  fetchState.generateCallIds = [];
  mockLoadAutoRefreshPref.mockReturnValue(false);
  mockHasSwept.mockReturnValue(false);
  mockMarkSwept.mockReset();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  installFetchMock();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Stale-report picker", () => {
  it("opens with all stale audits pre-selected and shows the correct count", async () => {
    fetchState.audits = [
      buildAudit({ id: 1, firstName: "Alice" }),
      buildAudit({ id: 2, firstName: "Bob" }),
      buildAudit({ id: 3, firstName: "Carol" }),
    ];

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    // Wait for audit rows to load.
    await waitFor(() => {
      expect(screen.getByTestId("row-audit-1")).toBeTruthy();
    });

    // The trigger button is present.
    const triggerBtn = screen.getByTestId("button-refresh-stale-reports");
    expect(triggerBtn).toBeTruthy();

    // Open the picker dialog.
    fireEvent.click(triggerBtn);

    // Dialog should appear.
    await waitFor(() => {
      expect(screen.getByTestId("dialog-refresh-stale-picker")).toBeTruthy();
    });

    // All 3 audits are pre-selected: count text shows "3 of 3 selected".
    const countEl = screen.getByTestId("text-refresh-picker-count");
    expect(countEl.textContent).toBe("3 of 3 selected");

    // All three checkboxes are present and checked.
    expect(screen.getByTestId("checkbox-refresh-picker-1")).toBeTruthy();
    expect(screen.getByTestId("checkbox-refresh-picker-2")).toBeTruthy();
    expect(screen.getByTestId("checkbox-refresh-picker-3")).toBeTruthy();
  });

  it("deselecting one audit updates the count label and confirm regenerates only the chosen subset", async () => {
    fetchState.audits = [
      buildAudit({ id: 10, firstName: "Dana" }),
      buildAudit({ id: 11, firstName: "Eve" }),
      buildAudit({ id: 12, firstName: "Frank" }),
    ];

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-10")).toBeTruthy();
    });

    // Open the picker.
    fireEvent.click(screen.getByTestId("button-refresh-stale-reports"));

    await waitFor(() => {
      expect(screen.getByTestId("dialog-refresh-stale-picker")).toBeTruthy();
    });

    // All 3 selected initially.
    expect(screen.getByTestId("text-refresh-picker-count").textContent).toBe(
      "3 of 3 selected",
    );

    // Deselect audit 11 (Eve).
    fireEvent.click(screen.getByTestId("checkbox-refresh-picker-11"));

    // Count label updates to reflect the deselection.
    await waitFor(() => {
      expect(screen.getByTestId("text-refresh-picker-count").textContent).toBe(
        "2 of 3 selected",
      );
    });

    // The confirm button label reflects the chosen subset.
    const confirmBtn = screen.getByTestId("button-refresh-picker-confirm");
    expect(confirmBtn.textContent?.trim()).toContain("2");

    // Confirm.
    fireEvent.click(confirmBtn);

    // Dialog closes.
    await waitFor(() => {
      expect(
        screen.queryByTestId("dialog-refresh-stale-picker"),
      ).toBeNull();
    });

    // Only audits 10 and 12 were regenerated — audit 11 (deselected) was not.
    await waitFor(() => {
      expect(fetchState.generateCallIds).toHaveLength(2);
    });
    expect(fetchState.generateCallIds).toContain(10);
    expect(fetchState.generateCallIds).toContain(12);
    expect(fetchState.generateCallIds).not.toContain(11);
  });

  it("progress label on the trigger button reflects the chosen subset during refresh", async () => {
    fetchState.audits = [
      buildAudit({ id: 20, firstName: "Grace" }),
      buildAudit({ id: 21, firstName: "Hank" }),
    ];

    // Make generate calls pause so we can observe the in-progress label.
    let resolveFirst: (r: Response) => void;
    const firstCallGate = new Promise<Response>((res) => {
      resolveFirst = res;
    });
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : (input as Request).url;
          const method = (
            init?.method ??
            (input instanceof Request ? input.method : "GET")
          ).toUpperCase();

          const generateMatch =
            method === "POST" && url.match(/\/api\/audits\/(\d+)\/generate$/);
          if (generateMatch) {
            fetchState.generateCallIds.push(Number(generateMatch[1]));
            callCount += 1;
            if (callCount === 1) {
              return firstCallGate;
            }
            return jsonResponse(200, { readinessScore: 75 });
          }

          if (method === "GET" && /\/api\/audits(\?.*)?$/.test(url)) {
            return jsonResponse(200, fetchState.audits);
          }
          if (method === "GET" && url.endsWith("/api/audits/summary")) {
            return jsonResponse(200, {
              totalAudits: fetchState.audits.length,
              averageScore: 70,
              latestScore: 72,
              scoreHistory: [],
              topStrengths: [],
              topRisks: [],
            });
          }
          if (method === "GET" && url.endsWith("/api/profiles")) {
            return jsonResponse(200, []);
          }
          if (method === "GET" && url.endsWith("/api/messages")) {
            return jsonResponse(200, []);
          }
          if (method === "GET" && url.endsWith("/api/insights")) {
            return jsonResponse(200, []);
          }
          return jsonResponse(404, { error: `unhandled ${method} ${url}` });
        },
      ),
    );

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-20")).toBeTruthy();
    });

    // Open picker (both audits pre-selected).
    fireEvent.click(screen.getByTestId("button-refresh-stale-reports"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-refresh-stale-picker")).toBeTruthy();
    });

    // Deselect audit 21 — only audit 20 is chosen.
    fireEvent.click(screen.getByTestId("checkbox-refresh-picker-21"));
    await waitFor(() => {
      expect(screen.getByTestId("text-refresh-picker-count").textContent).toBe(
        "1 of 2 selected",
      );
    });

    // Confirm with 1 selected.
    fireEvent.click(screen.getByTestId("button-refresh-picker-confirm"));

    // While the first (and only) generate call is in flight, the trigger
    // button shows "Refreshing 0/1…".
    await waitFor(() => {
      const triggerBtn = screen.getByTestId("button-refresh-stale-reports");
      expect(triggerBtn.textContent).toContain("Refreshing");
      expect(triggerBtn.textContent).toContain("0/1");
    });

    // Unblock the generate call — refresh completes.
    resolveFirst!(jsonResponse(200, { readinessScore: 75 }));

    // Only 1 generate call should have been fired (audit 20 only).
    await waitFor(() => {
      expect(fetchState.generateCallIds).toHaveLength(1);
    });
    expect(fetchState.generateCallIds).toContain(20);
    expect(fetchState.generateCallIds).not.toContain(21);
  });

  it("Cancel closes the dialog without firing any regenerate calls", async () => {
    fetchState.audits = [
      buildAudit({ id: 30, firstName: "Ivy" }),
      buildAudit({ id: 31, firstName: "Jack" }),
    ];

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-30")).toBeTruthy();
    });

    // Open the picker.
    fireEvent.click(screen.getByTestId("button-refresh-stale-reports"));

    await waitFor(() => {
      expect(screen.getByTestId("dialog-refresh-stale-picker")).toBeTruthy();
    });

    // Click Cancel.
    fireEvent.click(screen.getByTestId("button-refresh-picker-cancel"));

    // Dialog disappears.
    await waitFor(() => {
      expect(
        screen.queryByTestId("dialog-refresh-stale-picker"),
      ).toBeNull();
    });

    // No generate calls should have been made.
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(fetchState.generateCallIds).toHaveLength(0);
  });
});
