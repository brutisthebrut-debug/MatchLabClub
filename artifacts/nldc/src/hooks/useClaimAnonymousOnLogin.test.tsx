import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ----------------------------------------------------------------

// Mock the auth hook so we can flip authentication state at will.
const mockUseAuth = vi.fn();
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the API client. `useClaimAnonymousData` returns a mutation-like object;
// we record the body it was called with and resolve with a canned response.
const claimMutateImpl = vi.fn();
const redeemMutateImpl = vi.fn();

vi.mock("@workspace/api-client-react", () => {
  const claimAnonymousData = vi.fn();
  return {
    useClaimAnonymousData: () => ({
      mutate: (vars: { data: unknown }, opts?: { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }) => {
        claimMutateImpl(vars, opts);
      },
    }),
    useRedeemAnonymousClaimHandoff: () => ({
      mutate: (vars: { data: unknown }, opts?: { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }) => {
        redeemMutateImpl(vars, opts);
      },
    }),
    claimAnonymousData,
    getListAuditsQueryKey: () => ["audits"],
    getGetAuditSummaryQueryKey: () => ["audit-summary"],
    getListProfilesQueryKey: () => ["profiles"],
    getListMessageCoachingSessionsQueryKey: () => ["message-sessions"],
    getListInsightsQueryKey: () => ["insights"],
  };
});

// Capture toast calls so we can assert the UI surface.
const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (args: unknown) => toastSpy(args),
}));

// Track location changes triggered by toast actions.
const setLocationSpy = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocationSpy] as const,
}));

// Import AFTER mocks are registered.
import { useClaimAnonymousOnLogin, classifyRedeemError } from "./useClaimAnonymousOnLogin";
import {
  rememberAnonymousId,
  hasAnyAnonymousIds,
  readAnonymousIds,
} from "@/lib/anonymousIds";

// --- Helpers --------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockUseAuth.mockReset();
  claimMutateImpl.mockReset();
  redeemMutateImpl.mockReset();
  toastSpy.mockReset();
  setLocationSpy.mockReset();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("useClaimAnonymousOnLogin — full anon→login→claim flow", () => {
  it("does nothing while auth is loading", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });
    rememberAnonymousId("audits", 7);

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    expect(claimMutateImpl).not.toHaveBeenCalled();
  });

  it("does nothing for an anonymous visitor with audits in localStorage", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    rememberAnonymousId("audits", 7);

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    expect(claimMutateImpl).not.toHaveBeenCalled();
    expect(hasAnyAnonymousIds()).toBe(true);
  });

  it("on login, claims the IDs stored anonymously and refetches dashboard data", async () => {
    // Simulate the full path:
    //   1) anon visitor created an audit (id 42) and a profile (id 99)
    rememberAnonymousId("audits", 42);
    rememberAnonymousId("profiles", 99);

    //   2) user logs in
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-abc", email: null },
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    function localWrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    }

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper: localWrapper });

    //   3) the claim mutation was fired with the exact IDs from localStorage
    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [vars, opts] = claimMutateImpl.mock.calls[0];
    expect(vars).toEqual({
      data: {
        auditIds: [42],
        profileIds: [99],
        messageSessionIds: [],
        insightIds: [],
        followUpIds: [],
      },
    });

    //   4) on success, anon IDs are cleared and dashboard queries are invalidated
    act(() => {
      opts.onSuccess({ claimed: { audits: 1, profiles: 1, messages: 0, insights: 0, followUps: 0 } });
    });

    expect(readAnonymousIds()).toEqual({
      auditIds: [],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
      followUpIds: [],
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "audits",
        "audit-summary",
        "profiles",
        "message-sessions",
        "insights",
      ]),
    );
  });

  it("shows a 'Welcome back' toast mentioning email insights when the cookie-scoped claim returns claimed.insights > 0", async () => {
    rememberAnonymousId("insights", 11);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-insights-cookie", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = claimMutateImpl.mock.calls[0];

    act(() => {
      opts.onSuccess({
        claimed: { audits: 0, profiles: 0, messages: 0, insights: 1, followUps: 0 },
      });
    });

    expect(toastSpy).toHaveBeenCalledTimes(1);
    const arg = toastSpy.mock.calls[0][0] as { title: string; description: string };
    expect(arg.title).toBe("Welcome back");
    expect(arg.description).toMatch(/1 email insight\b/);
    expect(arg.description).not.toMatch(/email insights\b/);
  });

  it("pluralizes 'email insights' in the toast when the cookie-scoped claim returns multiple", async () => {
    rememberAnonymousId("insights", 11);
    rememberAnonymousId("insights", 12);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-insights-cookie-many", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = claimMutateImpl.mock.calls[0];

    act(() => {
      opts.onSuccess({
        claimed: { audits: 0, profiles: 0, messages: 0, insights: 3, followUps: 0 },
      });
    });

    const arg = toastSpy.mock.calls[0][0] as { description: string };
    expect(arg.description).toMatch(/3 email insights\b/);
  });

  it("shows a 'Welcome back' toast mentioning email insights when the handoff redeem returns claimed.insights > 0", async () => {
    const handoffPayload = {
      handoff: "insights-handoff-token",
      auditIds: [],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [55],
      followUpIds: [],
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoffPayload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/?nldc_handoff=${b64}`);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-insights-handoff", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(redeemMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = redeemMutateImpl.mock.calls[0];

    act(() => {
      opts.onSuccess({
        claimed: { audits: 0, profiles: 0, messages: 0, insights: 1, followUps: 0 },
      });
    });

    expect(toastSpy).toHaveBeenCalledTimes(1);
    const arg = toastSpy.mock.calls[0][0] as { title: string; description: string };
    expect(arg.title).toBe("Welcome back");
    expect(arg.description).toMatch(/1 email insight\b/);
  });

  it("does not call claim when the user is authenticated but has no anon IDs", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-xyz", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    expect(claimMutateImpl).not.toHaveBeenCalled();
  });

  it("redeems a pending handoff token captured from the URL on login", async () => {
    // Build a handoff payload exactly like the originating browser would, then
    // navigate the (receiving) browser to a URL carrying it.
    const handoffPayload = {
      handoff: "test-handoff-token",
      auditIds: [13],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
      followUpIds: [21],
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoffPayload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/?nldc_handoff=${b64}`);

    // Authenticated user lands on the page from another device.
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-handoff", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    // Param is stripped from the URL.
    expect(window.location.search).toBe("");

    // Redeem mutation is fired with the IDs encoded in the handoff URL.
    await waitFor(() => expect(redeemMutateImpl).toHaveBeenCalledTimes(1));
    const [vars, opts] = redeemMutateImpl.mock.calls[0];
    expect(vars).toEqual({
      data: {
        handoff: "test-handoff-token",
        auditIds: [13],
        profileIds: [],
        messageSessionIds: [],
        insightIds: [],
        followUpIds: [21],
      },
    });

    // On success the pending handoff is cleared so it isn't retried.
    act(() => {
      opts.onSuccess({ claimed: { audits: 1, profiles: 0, messages: 0, insights: 0, followUps: 1 } });
    });
    expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull();
  });

  it("shows an 'already used' toast with a dashboard action when redeem returns the replay error", async () => {
    const handoffPayload = {
      handoff: "replayed-token",
      auditIds: [42],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoffPayload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/?nldc_handoff=${b64}`);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-replay", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(redeemMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = redeemMutateImpl.mock.calls[0];

    act(() => {
      opts.onError({
        status: 400,
        data: { error: "This handoff link has already been used" },
      });
    });

    expect(toastSpy).toHaveBeenCalledTimes(1);
    const arg = toastSpy.mock.calls[0][0] as {
      title: string;
      description: string;
      action: React.ReactElement<{ onClick: () => void }>;
    };
    expect(arg.title).toMatch(/already used/i);
    expect(arg.description).toMatch(/fresh link|start a new audit/i);

    // Clicking the action navigates to /start.
    act(() => {
      arg.action.props.onClick();
    });
    expect(setLocationSpy).toHaveBeenCalledWith("/start");

    // The pending handoff is cleared so we don't retry it.
    expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull();
  });

  it("shows an 'expired link' toast with a start-audit action when redeem returns invalid/expired", async () => {
    const handoffPayload = {
      handoff: "expired-token",
      auditIds: [1],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoffPayload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/?nldc_handoff=${b64}`);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-expired", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(redeemMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = redeemMutateImpl.mock.calls[0];

    act(() => {
      opts.onError({
        status: 400,
        data: { error: "Invalid or expired handoff token" },
      });
    });

    expect(toastSpy).toHaveBeenCalledTimes(1);
    const arg = toastSpy.mock.calls[0][0] as {
      title: string;
      action: React.ReactElement<{ onClick: () => void }>;
    };
    expect(arg.title).toMatch(/expired/i);

    act(() => {
      arg.action.props.onClick();
    });
    expect(setLocationSpy).toHaveBeenCalledWith("/start");
  });

  it("shows a generic failure toast when the redeem error doesn't match a known reason", async () => {
    const handoffPayload = {
      handoff: "x",
      auditIds: [],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(handoffPayload))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/?nldc_handoff=${b64}`);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-other", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(redeemMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = redeemMutateImpl.mock.calls[0];

    act(() => {
      opts.onError(new Error("network down"));
    });

    expect(toastSpy).toHaveBeenCalledTimes(1);
    const arg = toastSpy.mock.calls[0][0] as { title: string; variant?: string };
    expect(arg.title).toMatch(/couldn.?t bring/i);
    expect(arg.variant).toBe("destructive");
  });

  it("ignores a missing handoff param without firing redeem", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-no-handoff", email: null },
    });
    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });
    expect(redeemMutateImpl).not.toHaveBeenCalled();
  });

  it("allows retry on the next render if the claim errors out", async () => {
    rememberAnonymousId("audits", 5);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-1", email: null },
    });

    const { rerender } = renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = claimMutateImpl.mock.calls[0];
    act(() => {
      opts.onError(new Error("network down"));
    });

    // IDs are preserved (no clear was triggered)
    expect(hasAnyAnonymousIds()).toBe(true);

    // Next render with same user retries
    rerender();
    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(2));
  });
});
