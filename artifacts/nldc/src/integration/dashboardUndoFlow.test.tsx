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
// Mocks (must be registered BEFORE Dashboard is imported)
// ---------------------------------------------------------------------------

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: "user-undo-flow", email: null },
  }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

// IntersectionObserver doesn't exist in jsdom; stub it so the load-more
// sentinel effect is a no-op.
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
// Import AFTER mocks are registered.
// ---------------------------------------------------------------------------
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/toaster";

// ---------------------------------------------------------------------------
// Fetch mock: a tiny in-memory model of the audit endpoints Dashboard hits.
// ---------------------------------------------------------------------------

interface ServerState {
  audits: Audit[];
  deletedIds: number[];
}

const server: ServerState = { audits: [], deletedIds: [] };

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
              : input.url;
        const method = (
          init?.method ?? (input instanceof Request ? input.method : "GET")
        ).toUpperCase();

        // GET /api/audits — list
        if (method === "GET" && /\/api\/audits(\?.*)?$/.test(url)) {
          return jsonResponse(200, server.audits);
        }

        // DELETE /api/audits/:id — single delete
        const deleteMatch =
          method === "DELETE" && url.match(/\/api\/audits\/(\d+)$/);
        if (deleteMatch) {
          const id = Number(deleteMatch[1]);
          server.audits = server.audits.filter((a) => a.id !== id);
          server.deletedIds.push(id);
          return new Response(null, { status: 204 });
        }

        // GET /api/audits/summary
        if (method === "GET" && url.endsWith("/api/audits/summary")) {
          return jsonResponse(200, {
            totalAudits: server.audits.length,
            averageScore: 70,
            latestScore: server.audits[0]?.readinessScore ?? 0,
            scoreHistory: [],
            topStrengths: [],
            topRisks: [],
          });
        }

        // Other endpoints Dashboard touches — return empty.
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
    ...overrides,
  } as Audit;
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  server.audits = [buildAudit({ id: 101, firstName: "Jordan" })];
  server.deletedIds = [];
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

describe("Dashboard delete + Undo flow", () => {
  it("refreshing mid-undo-window keeps the audit deleted (and removes it server-side)", async () => {
    const view = render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    // Audit row appears once the list query resolves.
    await waitFor(() => {
      expect(screen.getByTestId("row-audit-101")).toBeTruthy();
    });

    // Click the trash button. Don't click Undo — we want to simulate the
    // user navigating away (refresh) while the undo toast is still up.
    fireEvent.click(screen.getByTestId("button-delete-audit-101"));

    // Row removed optimistically.
    await waitFor(() => {
      expect(screen.queryByTestId("row-audit-101")).toBeNull();
    });

    // Pending entry persisted to localStorage so a refresh survives it.
    expect(localStorage.getItem("nldc:pending-audit-deletes")).not.toBeNull();

    // Simulate a page refresh: unmount Dashboard before the 5s undo window
    // expires, then remount it. The unmount cleanup + on-mount drain effect
    // must finalize the delete server-side.
    view.unmount();

    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    // Wait for the server to record the delete (either the unmount-cleanup
    // mutate or the on-mount drain path is allowed to be the one that lands).
    await waitFor(() => {
      expect(server.deletedIds).toContain(101);
    });

    // Server now reports the audit gone.
    expect(server.audits.find((a) => a.id === 101)).toBeUndefined();

    // The fresh Dashboard never re-renders the deleted audit, and the
    // pending-deletes localStorage entry is drained.
    await waitFor(() => {
      expect(localStorage.getItem("nldc:pending-audit-deletes")).toBeNull();
    });
    expect(screen.queryByTestId("row-audit-101")).toBeNull();
  });

  it("clicking Undo within the window restores the audit and skips the server delete", async () => {
    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-101")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("button-delete-audit-101"));

    // Optimistic removal.
    await waitFor(() => {
      expect(screen.queryByTestId("row-audit-101")).toBeNull();
    });

    // The Undo toast button is rendered.
    const undoBtn = await screen.findByTestId("button-undo-delete-101");
    fireEvent.click(undoBtn);

    // Audit comes back in the rendered list.
    await waitFor(() => {
      expect(screen.getByTestId("row-audit-101")).toBeTruthy();
    });

    // Pending entry is cleared from localStorage and no DELETE was ever sent.
    expect(localStorage.getItem("nldc:pending-audit-deletes")).toBeNull();
    expect(server.deletedIds).not.toContain(101);
    expect(server.audits.find((a) => a.id === 101)).toBeDefined();
  });
});
