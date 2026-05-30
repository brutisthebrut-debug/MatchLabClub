import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ----------------------------------------------------------------

// In-memory AsyncStorage stand-in. The real module is backed by native code
// that does not exist under Vitest's jsdom environment.
const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => (storage.has(k) ? storage.get(k)! : null)),
    setItem: vi.fn(async (k: string, v: string) => {
      storage.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      storage.delete(k);
    }),
  },
}));

// Mock the mobile auth hook so we can flip authentication state at will.
const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock the generated API client. `useClaimAnonymousData` returns a
// mutation-like object whose `mutate` we record so we can drive onSuccess /
// onError manually.
const claimMutateImpl = vi.fn();
vi.mock("@workspace/api-client-react", () => ({
  useClaimAnonymousData: () => ({
    mutate: (
      vars: { data: unknown },
      opts?: {
        onSuccess?: (r: unknown) => void;
        onError?: (e: unknown) => void;
      },
    ) => {
      claimMutateImpl(vars, opts);
    },
  }),
  getListAuditsQueryKey: () => ["audits"],
  getGetAuditSummaryQueryKey: () => ["audit-summary"],
  getListProfilesQueryKey: () => ["profiles"],
  getListMessageCoachingSessionsQueryKey: () => ["message-sessions"],
  getListInsightsQueryKey: () => ["insights"],
  getListJournalEntriesQueryKey: () => ["journal-entries"],
  getListPostDateNotesQueryKey: () => ["post-date-notes"],
}));

// Import AFTER mocks are registered.
import { useClaimAnonymousOnLogin } from "./useClaimAnonymousOnLogin";
import {
  rememberAnonymousId,
  hasAnyAnonymousIds,
  readAnonymousIds,
} from "./anonymousIds";

// --- Helpers --------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  storage.clear();
  mockUseAuth.mockReset();
  claimMutateImpl.mockReset();
});

describe("useClaimAnonymousOnLogin (mobile) — anon → login → claim", () => {
  it("does nothing while auth is loading", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });
    await rememberAnonymousId("audits", 7);

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    // Give the async effect a chance to run; it must not call mutate.
    await new Promise((r) => setTimeout(r, 10));
    expect(claimMutateImpl).not.toHaveBeenCalled();
  });

  it("does nothing for an anonymous visitor even when IDs are stored", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });
    await rememberAnonymousId("audits", 7);

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await new Promise((r) => setTimeout(r, 10));
    expect(claimMutateImpl).not.toHaveBeenCalled();
    expect(await hasAnyAnonymousIds()).toBe(true);
  });

  it("does not call claim when authenticated with no anon IDs", async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-xyz", email: null },
    });

    renderHook(() => useClaimAnonymousOnLogin(), { wrapper });

    await new Promise((r) => setTimeout(r, 10));
    expect(claimMutateImpl).not.toHaveBeenCalled();
  });

  it("on login, claims the IDs stored anonymously and refetches dashboard data", async () => {
    // 1) Anonymous user created an audit (42) and a profile (99).
    await rememberAnonymousId("audits", 42);
    await rememberAnonymousId("profiles", 99);

    // 2) User signs in.
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

    // 3) The claim mutation fires with the exact IDs from AsyncStorage.
    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [vars, opts] = claimMutateImpl.mock.calls[0];
    expect(vars).toEqual({
      data: {
        auditIds: [42],
        profileIds: [99],
        messageSessionIds: [],
        insightIds: [],
        journalEntryIds: [],
        postDateNoteIds: [],
      },
    });

    // 4) On success, anon IDs are cleared and user-scoped queries refetched.
    act(() => {
      opts.onSuccess({
        claimed: { audits: 1, profiles: 1, messages: 0, insights: 0 },
      });
    });

    await waitFor(async () => {
      expect(await readAnonymousIds()).toEqual({
        auditIds: [],
        profileIds: [],
        messageSessionIds: [],
        insightIds: [],
        journalEntryIds: [],
        postDateNoteIds: [],
      });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey?: unknown[] } | undefined)?.queryKey?.[0],
    );
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

  it("allows retry on the next render if the claim errors out", async () => {
    await rememberAnonymousId("audits", 5);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "user-1", email: null },
    });

    const { rerender } = renderHook(() => useClaimAnonymousOnLogin(), {
      wrapper,
    });

    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(1));
    const [, opts] = claimMutateImpl.mock.calls[0];
    act(() => {
      opts.onError(new Error("network down"));
    });

    // IDs are preserved (clear was not triggered).
    expect(await hasAnyAnonymousIds()).toBe(true);

    // Next render with same user retries.
    rerender();
    await waitFor(() => expect(claimMutateImpl).toHaveBeenCalledTimes(2));
  });
});
