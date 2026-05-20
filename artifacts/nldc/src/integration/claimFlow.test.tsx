import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the auth hook so we can flip from anonymous -> authenticated mid-test.
let authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string | null } | null;
} = { isAuthenticated: false, isLoading: false, user: null };

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => authState,
}));

// IMPORTANT: import AFTER the mock is registered.
import {
  useCreateAudit,
  useListAudits,
  type Audit,
} from "@workspace/api-client-react";
import { useClaimAnonymousOnLogin } from "@/hooks/useClaimAnonymousOnLogin";
import {
  rememberAnonymousId,
  hasAnyAnonymousIds,
} from "@/lib/anonymousIds";

// ---------------------------------------------------------------------------
// Fetch mock: simulates the server side of the claim flow.
// ---------------------------------------------------------------------------

interface StoredAudit {
  audit: Audit;
  userId: string | null;
}

interface ServerState {
  audits: StoredAudit[];
  nextId: number;
  claimCalls: number;
}

const server: ServerState = { audits: [], nextId: 1, claimCalls: 0 };

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
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      // GET /api/audits — list visible audits for the current "user".
      if (method === "GET" && url.endsWith("/api/audits")) {
        const currentUserId = authState.isAuthenticated ? authState.user!.id : null;
        const visible = server.audits
          .filter((row) => row.userId === currentUserId)
          .map((row) => row.audit);
        return jsonResponse(200, visible);
      }

      // POST /api/audits — create an audit. Authed -> owned, anon -> userId=null.
      if (method === "POST" && url.endsWith("/api/audits")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const audit: Audit = {
          id: server.nextId++,
          firstName: body.firstName ?? "Anon",
          age: body.age ?? 30,
          gender: body.gender ?? "x",
          datingGoal: body.datingGoal ?? "find a relationship",
          currentApps: body.currentApps ?? [],
          bio: body.bio ?? "",
          prompts: body.prompts ?? null,
          status: "pending",
          readinessScore: null,
          createdAt: new Date().toISOString(),
        };
        server.audits.push({
          audit,
          userId: authState.isAuthenticated ? authState.user!.id : null,
        });
        return jsonResponse(201, audit);
      }

      // POST /api/claim-anonymous — reassign anon rows to the current user.
      if (method === "POST" && url.endsWith("/api/claim-anonymous")) {
        server.claimCalls += 1;
        if (!authState.isAuthenticated) {
          return jsonResponse(401, { error: "Not authenticated" });
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const ids: number[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        let claimed = 0;
        for (const row of server.audits) {
          if (ids.includes(row.audit.id) && row.userId === null) {
            row.userId = authState.user!.id;
            claimed += 1;
          }
        }
        return jsonResponse(200, {
          claimed: { audits: claimed, profiles: 0, messages: 0, insights: 0 },
        });
      }

      return jsonResponse(404, { error: `unhandled ${method} ${url}` });
    }),
  );
}

// ---------------------------------------------------------------------------
// Tiny harness components that exercise the real generated hooks.
// ---------------------------------------------------------------------------

function AnonAuditCreator({ onCreated }: { onCreated: (id: number) => void }) {
  const create = useCreateAudit();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    create.mutate(
      {
        data: {
          firstName: "Riley",
          age: 29,
          gender: "x",
          orientation: "unspecified",
          datingGoal: "find a relationship",
          currentApps: [],
          bio: "writer + climber",
        },
      },
      {
        onSuccess: (audit) => {
          rememberAnonymousId("audits", audit.id);
          onCreated(audit.id);
        },
      },
    );
    // We deliberately omit `create` from deps — its identity changes per render
    // but firedRef prevents a re-fire loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function DashboardAuditList() {
  useClaimAnonymousOnLogin();
  const { data: audits } = useListAudits();
  return (
    <ul data-testid="audit-list">
      {(audits ?? []).map((a) => (
        <li key={a.id} data-testid={`audit-${a.id}`}>
          {a.firstName} (#{a.id})
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  localStorage.clear();
  server.audits = [];
  server.nextId = 1;
  server.claimCalls = 0;
  authState = { isAuthenticated: false, isLoading: false, user: null };
  installFetchMock();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// The e2e-shaped integration test the task calls for:
//   "create an anonymous audit -> log in -> confirm the audit appears in the
//    dashboard list".
// ---------------------------------------------------------------------------

describe("Anonymous audit follows the user into their account", () => {
  it("anon-created audit shows up in the dashboard after login + claim", async () => {
    let createdId: number | undefined;

    // 1) Anonymous visitor creates an audit via the real useCreateAudit hook.
    const created = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdId).toBeDefined());
    expect(hasAnyAnonymousIds()).toBe(true);
    expect(server.audits).toHaveLength(1);
    expect(server.audits[0]!.userId).toBeNull();

    // Tear down the anonymous tree before flipping auth so the dashboard
    // mounts cleanly under the new auth state (the way a fresh page load
    // would after redirecting back from the login provider).
    created.unmount();

    // 2) The user logs in — auth context flips to authenticated.
    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-xyz", email: null },
      };
    });

    // 3) Dashboard mounts. useClaimAnonymousOnLogin fires the claim mutation,
    //    which the mock server applies to the in-memory store, then
    //    useListAudits refetches.
    render(
      <Wrap>
        <DashboardAuditList />
      </Wrap>,
    );

    // 4) The previously-anonymous audit appears in the dashboard list.
    await waitFor(() => {
      expect(screen.getByTestId(`audit-${createdId}`)).toBeTruthy();
    });

    // Claim endpoint was hit exactly once, with the id we created anonymously.
    expect(server.claimCalls).toBe(1);

    // Ownership was transferred in the store.
    const stored = server.audits.find((row) => row.audit.id === createdId);
    expect(stored?.userId).toBe("user-xyz");

    // localStorage hand-off cleared after a successful claim.
    expect(hasAnyAnonymousIds()).toBe(false);
  });
});
