import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MySession } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSessions: MySession[] = [];

vi.mock("@workspace/api-client-react", () => ({
  useListMySessions: () => ({
    data: { sessions: mockSessions },
    isLoading: false,
    isError: false,
  }),
  getListMySessionsQueryKey: () => ["list-my-sessions"],
  useRevokeOneSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeOtherSessions: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: "u1", email: null } }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Import page AFTER mocks are registered.
import Sessions from "@/pages/Sessions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<MySession> = {}): MySession {
  return {
    sid: "sess-" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    current: true,
    channel: "web",
    deviceLabel: "Chrome on macOS",
    ip: "203.0.113.42",
    ipLocation: null,
    ...overrides,
  };
}

function Wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSessions = [];
});

afterEach(() => {
  cleanup();
});

describe("Sessions page — city/country location display", () => {
  it("shows a resolved location string when ipLocation is present", async () => {
    const session = makeSession({ ipLocation: "Berlin, DE" });
    mockSessions = [session];

    render(
      <Wrap>
        <Sessions />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sessions-list")).toBeTruthy();
    });

    const locationEl = screen.getByTestId(`session-location-${session.sid}`);
    expect(locationEl).toBeTruthy();
    expect(locationEl.textContent?.trim()).toBe("Berlin, DE");
  });

  it("shows a non-empty location for any session row that has ipLocation", async () => {
    const s1 = makeSession({ sid: "sess-a", ipLocation: "Brooklyn, NY, US", current: true });
    const s2 = makeSession({ sid: "sess-b", ipLocation: "Tokyo, JP", current: false });
    mockSessions = [s1, s2];

    render(
      <Wrap>
        <Sessions />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sessions-list")).toBeTruthy();
    });

    const locationEls = document.querySelectorAll("[data-testid^='session-location-']");
    expect(locationEls.length).toBeGreaterThanOrEqual(1);
    locationEls.forEach((el) => {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it("falls back to the raw IP when ipLocation is null", async () => {
    const session = makeSession({ ipLocation: null, ip: "198.51.100.7" });
    mockSessions = [session];

    render(
      <Wrap>
        <Sessions />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sessions-list")).toBeTruthy();
    });

    const ipEl = screen.getByTestId(`session-ip-${session.sid}`);
    expect(ipEl).toBeTruthy();
    expect(ipEl.textContent?.trim()).toBe("198.51.100.7");

    // No location element should be present for this session.
    expect(
      document.querySelector(`[data-testid="session-location-${session.sid}"]`),
    ).toBeNull();
  });

  it("shows neither location nor IP when both are absent", async () => {
    const session = makeSession({ ipLocation: null, ip: null });
    mockSessions = [session];

    render(
      <Wrap>
        <Sessions />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sessions-list")).toBeTruthy();
    });

    expect(
      document.querySelector(`[data-testid="session-location-${session.sid}"]`),
    ).toBeNull();
    expect(
      document.querySelector(`[data-testid="session-ip-${session.sid}"]`),
    ).toBeNull();
  });

  it("correctly separates location vs IP rows in a mixed session list", async () => {
    const withLocation = makeSession({ sid: "sess-loc", ipLocation: "Paris, FR", current: true });
    const withIpOnly = makeSession({ sid: "sess-ip", ipLocation: null, ip: "10.0.0.1", current: false });
    mockSessions = [withLocation, withIpOnly];

    render(
      <Wrap>
        <Sessions />
      </Wrap>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("sessions-list")).toBeTruthy();
    });

    // Session with resolved location uses the location element.
    expect(screen.getByTestId("session-location-sess-loc").textContent?.trim()).toBe("Paris, FR");
    expect(document.querySelector("[data-testid='session-ip-sess-loc']")).toBeNull();

    // Session with raw IP only uses the IP element.
    expect(screen.getByTestId("session-ip-sess-ip").textContent?.trim()).toBe("10.0.0.1");
    expect(document.querySelector("[data-testid='session-location-sess-ip']")).toBeNull();
  });
});
