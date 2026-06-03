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
import type { Audit } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Mocks (must be registered BEFORE page components are imported)
// ---------------------------------------------------------------------------

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: "user-trash-flow", email: null },
  }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

// wouter mock — Link renders a plain <a>, useLocation returns "/"
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/", vi.fn()],
  useSearch: () => "",
}));

// IntersectionObserver / ResizeObserver stubs for jsdom
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
// Import page components AFTER mocks.
// ---------------------------------------------------------------------------
import Dashboard from "@/pages/Dashboard";
import Trash from "@/pages/Trash";
import { Toaster } from "@/components/ui/toaster";

// ---------------------------------------------------------------------------
// Shared in-memory server state
// ---------------------------------------------------------------------------

interface ServerState {
  activeAudits: Audit[];
  trashedAudits: Audit[];
}

const server: ServerState = { activeAudits: [], trashedAudits: [] };

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

        // GET /api/audits — active list (infinite, paginated)
        if (method === "GET" && /\/api\/audits(\?.*)?$/.test(url)) {
          return jsonResponse(200, server.activeAudits);
        }

        // GET /api/audits/summary
        if (method === "GET" && url.endsWith("/api/audits/summary")) {
          return jsonResponse(200, {
            totalAudits: server.activeAudits.length,
            averageScore: 70,
            latestScore: server.activeAudits[0]?.readinessScore ?? 0,
            scoreHistory: [],
            topStrengths: [],
            topRisks: [],
          });
        }

        // GET /api/audits/trash
        if (method === "GET" && url.endsWith("/api/audits/trash")) {
          return jsonResponse(200, server.trashedAudits);
        }

        // DELETE /api/audits/:id (soft-delete — moves to trash)
        const softDeleteMatch =
          method === "DELETE" && url.match(/\/api\/audits\/(\d+)$/);
        if (softDeleteMatch) {
          const id = Number(softDeleteMatch[1]);
          const idx = server.activeAudits.findIndex((a) => a.id === id);
          if (idx !== -1) {
            const [audit] = server.activeAudits.splice(idx, 1);
            const trashed = {
              ...audit,
              deletedAt: new Date().toISOString(),
            };
            server.trashedAudits.push(trashed);
          }
          return new Response(null, { status: 204 });
        }

        // POST /api/audits/:id/restore
        const restoreMatch =
          method === "POST" && url.match(/\/api\/audits\/(\d+)\/restore$/);
        if (restoreMatch) {
          const id = Number(restoreMatch[1]);
          const idx = server.trashedAudits.findIndex((a) => a.id === id);
          if (idx !== -1) {
            const [audit] = server.trashedAudits.splice(idx, 1);
            const restored = { ...audit, deletedAt: null };
            server.activeAudits.unshift(restored);
            return jsonResponse(200, restored);
          }
          return jsonResponse(404, { error: "not found" });
        }

        // DELETE /api/audits/:id/purge
        const purgeMatch =
          method === "DELETE" && url.match(/\/api\/audits\/(\d+)\/purge$/);
        if (purgeMatch) {
          const id = Number(purgeMatch[1]);
          const idx = server.trashedAudits.findIndex((a) => a.id === id);
          if (idx !== -1) {
            server.trashedAudits.splice(idx, 1);
          }
          return jsonResponse(200, { id });
        }

        // Other endpoints Dashboard touches — return empty
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
    gender: "Man",
    datingGoal: "find a relationship",
    currentApps: ["Hinge"],
    bio: "",
    prompts: null,
    source: null,
    status: "complete",
    readinessScore: 72,
    createdAt: new Date().toISOString(),
    deletedAt: null,
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
  server.activeAudits = [buildAudit({ id: 201, firstName: "Casey" })];
  server.trashedAudits = [];
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

describe("Web Trash / Recently-deleted flow", () => {
  it("Trash page shows deleted-at copy and remaining-days hint for a trashed audit", async () => {
    // Simulate an audit already in the trash (deleted just now)
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 301, firstName: "Alex", deletedAt: now }),
    ];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    // The trash list should appear
    await waitFor(() => {
      expect(screen.getByTestId("trash-list")).toBeTruthy();
    });

    // The row for audit 301 should be visible
    const row = screen.getByTestId("row-trashed-301");
    expect(row).toBeTruthy();

    // Deleted-at label: freshly deleted → "Deleted today"
    expect(within(row).getByText(/deleted today/i)).toBeTruthy();

    // Remaining-days hint: 30 days left (just deleted)
    expect(within(row).getByText(/30 days left/i)).toBeTruthy();
  });

  it("Trash page shows correct remaining days for older deletions", async () => {
    // Simulate an audit deleted 5 days ago
    const fiveDaysAgo = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 302, firstName: "Morgan", deletedAt: fiveDaysAgo }),
    ];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("trash-list")).toBeTruthy();
    });

    const row = screen.getByTestId("row-trashed-302");
    // Deleted 5 days ago
    expect(within(row).getByText(/deleted 5 days ago/i)).toBeTruthy();
    // 25 days left
    expect(within(row).getByText(/25 days left/i)).toBeTruthy();
  });

  it("Restoring an audit removes it from the trash list and shows a toast", async () => {
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 303, firstName: "Riley", deletedAt: now }),
    ];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    // Wait for the row to appear
    await waitFor(() => {
      expect(screen.getByTestId("row-trashed-303")).toBeTruthy();
    });

    // Click the Restore button
    fireEvent.click(screen.getByTestId("button-restore-303"));

    // The audit should move back to active server-side
    await waitFor(() => {
      expect(server.trashedAudits).toHaveLength(0);
      expect(server.activeAudits).toHaveLength(1);
      expect(server.activeAudits[0].id).toBe(303);
    });

    // The row should disappear from the trash list
    await waitFor(() => {
      expect(screen.queryByTestId("row-trashed-303")).toBeNull();
    });

    // The empty state should appear (no more trashed audits)
    await waitFor(() => {
      expect(screen.getByTestId("trash-empty")).toBeTruthy();
    });

    // A success toast should appear
    await waitFor(() => {
      expect(screen.getAllByText(/restored/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Purging an audit permanently removes it via confirmation dialog and shows a toast", async () => {
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 304, firstName: "Drew", deletedAt: now }),
    ];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-trashed-304")).toBeTruthy();
    });

    // Click the Delete-forever icon (opens the confirmation dialog)
    fireEvent.click(screen.getByTestId("button-purge-304"));

    // The confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId("dialog-confirm-purge")).toBeTruthy();
    });

    // The dialog mentions the match name and "permanently"
    const dialog = screen.getByTestId("dialog-confirm-purge");
    expect(within(dialog).getByText(/Drew/i)).toBeTruthy();
    expect(within(dialog).getByText(/permanently/i)).toBeTruthy();

    // Confirm the purge
    fireEvent.click(screen.getByTestId("button-confirm-purge"));

    // Server should have purged the audit
    await waitFor(() => {
      expect(server.trashedAudits).toHaveLength(0);
    });

    // Row should be gone from the UI
    await waitFor(() => {
      expect(screen.queryByTestId("row-trashed-304")).toBeNull();
    });

    // The empty state should appear
    await waitFor(() => {
      expect(screen.getByTestId("trash-empty")).toBeTruthy();
    });

    // A "Deleted forever" toast should appear
    await waitFor(() => {
      expect(screen.getByText(/deleted forever/i)).toBeTruthy();
    });
  });

  it("Cancelling the purge dialog leaves the audit in the trash", async () => {
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 305, firstName: "Blake", deletedAt: now }),
    ];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-trashed-305")).toBeTruthy();
    });

    // Open the confirmation dialog
    fireEvent.click(screen.getByTestId("button-purge-305"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-confirm-purge")).toBeTruthy();
    });

    // Cancel
    fireEvent.click(screen.getByTestId("button-cancel-purge"));

    // Audit should still be in the trash list (dialog dismissed)
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-confirm-purge")).toBeNull();
    });
    expect(screen.getByTestId("row-trashed-305")).toBeTruthy();
    expect(server.trashedAudits).toHaveLength(1);
  });

  it("Dashboard delete moves an audit to the trash (server-side), which then appears in the Trash page", async () => {
    // Dashboard is mounted and the audit is visible
    const { unmount } = render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-201")).toBeTruthy();
    });

    // Delete from Dashboard — optimistic removal
    fireEvent.click(screen.getByTestId("button-delete-audit-201"));

    await waitFor(() => {
      expect(screen.queryByTestId("row-audit-201")).toBeNull();
    });

    // Unmount to flush the pending delete (unmount cleanup fires the DELETE API)
    unmount();

    await waitFor(() => {
      expect(server.activeAudits).toHaveLength(0);
      expect(server.trashedAudits).toHaveLength(1);
      expect(server.trashedAudits[0].id).toBe(201);
      expect(server.trashedAudits[0].deletedAt).not.toBeNull();
    });

    // Remount the Trash page and confirm the audit appears there
    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("trash-list")).toBeTruthy();
      expect(screen.getByTestId("row-trashed-201")).toBeTruthy();
    });

    // Verify the deleted-at label appears
    const row = screen.getByTestId("row-trashed-201");
    expect(within(row).getByText(/deleted today/i)).toBeTruthy();
    expect(within(row).getByText(/30 days left/i)).toBeTruthy();
  });

  it("Restore from Trash → Dashboard shows the audit in the active list again", async () => {
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 401, firstName: "Sam", deletedAt: now }),
    ];

    // Mount Trash first, restore the audit
    const { unmount: unmountTrash } = render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-trashed-401")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("button-restore-401"));

    await waitFor(() => {
      expect(server.trashedAudits).toHaveLength(0);
      expect(server.activeAudits).toHaveLength(1);
    });

    unmountTrash();
    cleanup();

    // Now mount Dashboard and verify the audit is in the list
    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-audit-401")).toBeTruthy();
    });
  });

  it("Purge from Trash → Dashboard no longer shows the audit", async () => {
    const now = new Date().toISOString();
    server.activeAudits = [];
    server.trashedAudits = [
      buildAudit({ id: 501, firstName: "Quinn", deletedAt: now }),
    ];

    // Mount Trash and purge
    const { unmount: unmountTrash } = render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-trashed-501")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("button-purge-501"));
    await waitFor(() => {
      expect(screen.getByTestId("dialog-confirm-purge")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("button-confirm-purge"));

    await waitFor(() => {
      expect(server.trashedAudits).toHaveLength(0);
      expect(server.activeAudits).toHaveLength(0);
    });

    unmountTrash();
    cleanup();

    // Mount Dashboard — the audit must not appear (purged, not just soft-deleted)
    render(
      <Wrap>
        <Dashboard />
      </Wrap>,
    );

    await waitFor(() => {
      // Dashboard query settles
      expect(screen.queryByTestId("audits-load-more-sentinel")).not.toBeTruthy();
    });

    // Purged audit should not be in the active list
    expect(screen.queryByTestId("row-audit-501")).toBeNull();
  });

  it("Trash page shows the empty state when there are no trashed audits", async () => {
    server.activeAudits = [];
    server.trashedAudits = [];

    render(
      <Wrap>
        <Trash />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("trash-empty")).toBeTruthy();
    });

    expect(screen.queryByTestId("trash-list")).toBeNull();
  });
});
