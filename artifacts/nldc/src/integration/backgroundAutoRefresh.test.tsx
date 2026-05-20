import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Audit } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Hoisted mock state — must be declared before vi.mock factory calls.
// ---------------------------------------------------------------------------

const {
  mockLoadAutoRefreshPref,
  mockHasSwept,
  mockMarkSwept,
} = vi.hoisted(() => ({
  mockLoadAutoRefreshPref: vi.fn<() => boolean>(() => false),
  mockHasSwept: vi.fn<() => boolean>(() => false),
  mockMarkSwept: vi.fn<() => void>(),
}));

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
    user: { id: "test-user", email: null },
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

// jsdom stubs for observers Dashboard uses
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STALE_DATE = new Date(
  Date.now() - 35 * 24 * 60 * 60 * 1000,
).toISOString(); // 35 days ago — well past the 30-day threshold

const FRESH_DATE = new Date(
  Date.now() - 1 * 24 * 60 * 60 * 1000,
).toISOString(); // 1 day ago — definitely fresh

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
// Fetch mock factory
// ---------------------------------------------------------------------------

interface FetchState {
  audits: Audit[];
  generateCallIds: number[];
  generateResolve: () => Response;
}

const fetchState: FetchState = {
  audits: [],
  generateCallIds: [],
  generateResolve: () => new Response(JSON.stringify({ readinessScore: 75 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }),
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
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      // POST /api/audits/:id/generate — background auto-refresh call
      const generateMatch =
        method === "POST" && url.match(/\/api\/audits\/(\d+)\/generate$/);
      if (generateMatch) {
        const id = Number(generateMatch[1]);
        fetchState.generateCallIds.push(id);
        return fetchState.generateResolve();
      }

      // GET /api/audits — list (handles infinite query with optional query params)
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
    }),
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
  fetchState.generateResolve = () =>
    new Response(JSON.stringify({ readinessScore: 75 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Background auto-refresh sweep", () => {
  it("makes no generateAuditReport call when the pref is off", async () => {
    mockLoadAutoRefreshPref.mockReturnValue(false);
    fetchState.audits = [
      buildAudit({ id: 1, reportGeneratedAt: STALE_DATE }),
      buildAudit({ id: 2, reportGeneratedAt: STALE_DATE }),
    ];

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    // Wait for the audits list to load so the sweep effect has had a chance
    // to run (it waits on auditsLoading becoming false).
    await waitFor(() => {
      expect(screen.getByTestId("row-audit-1")).toBeTruthy();
    });

    // Give any async work triggered by the effect time to settle.
    await new Promise<void>((r) => setTimeout(r, 50));

    expect(fetchState.generateCallIds).toHaveLength(0);
    expect(mockMarkSwept).not.toHaveBeenCalled();
  });

  it("regenerates up to AUTO_REFRESH_BATCH_SIZE stale audits and invalidates the list", async () => {
    mockLoadAutoRefreshPref.mockReturnValue(true);

    // 5 stale audits — more than the batch cap of 3.
    fetchState.audits = [1, 2, 3, 4, 5].map((id) =>
      buildAudit({ id, reportGeneratedAt: STALE_DATE }),
    );

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-1")).toBeTruthy();
    });

    // Wait for all background generate calls to fire.
    await waitFor(() => {
      expect(fetchState.generateCallIds).toHaveLength(3);
    });

    // Only the first 3 audits (in list order) should have been refreshed.
    expect(fetchState.generateCallIds).toEqual([1, 2, 3]);

    // markSwept must have been called exactly once.
    expect(mockMarkSwept).toHaveBeenCalledTimes(1);

    // After the sweep, the list query is re-fetched (invalidateQueries fires
    // another GET /api/audits). We just need at least 2 list fetches total:
    // the initial one and the post-sweep invalidation.
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    const listCalls = fetchMock.mock.calls.filter(([input]) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      return /\/api\/audits(\?.*)?$/.test(url);
    });
    expect(listCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not sweep when there are no stale audits even with pref on", async () => {
    mockLoadAutoRefreshPref.mockReturnValue(true);
    // Fresh audit — should not trigger a sweep
    fetchState.audits = [buildAudit({ id: 10, reportGeneratedAt: FRESH_DATE })];

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-10")).toBeTruthy();
    });

    await new Promise<void>((r) => setTimeout(r, 50));

    expect(fetchState.generateCallIds).toHaveLength(0);
    expect(mockMarkSwept).not.toHaveBeenCalled();
  });

  it("does not sweep on re-mount when hasSwept returns true", async () => {
    mockLoadAutoRefreshPref.mockReturnValue(true);
    // First mount: sweep allowed.
    mockHasSwept.mockReturnValue(false);
    fetchState.audits = [buildAudit({ id: 20, reportGeneratedAt: STALE_DATE })];

    const { unmount } = render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(fetchState.generateCallIds).toHaveLength(1);
    });
    expect(mockMarkSwept).toHaveBeenCalledTimes(1);

    // Simulate session guard: subsequent hasSwept() calls return true.
    mockHasSwept.mockReturnValue(true);
    const firstCallCount = fetchState.generateCallIds.length;

    // Unmount and remount — should NOT trigger a second sweep.
    unmount();
    cleanup();

    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-20")).toBeTruthy();
    });

    await new Promise<void>((r) => setTimeout(r, 50));

    // No additional generate calls after the re-mount.
    expect(fetchState.generateCallIds).toHaveLength(firstCallCount);
    // markSwept was only called once (during the first mount).
    expect(mockMarkSwept).toHaveBeenCalledTimes(1);
  });
});
