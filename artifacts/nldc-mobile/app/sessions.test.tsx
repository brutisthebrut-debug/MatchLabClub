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

// ---------------------------------------------------------------------------
// Mutable refs so individual tests can control session data and mutation behaviour.
// ---------------------------------------------------------------------------

type FakeSession = {
  sid: string;
  deviceLabel: string;
  lastSeenAt: string;
  createdAt: string;
  channel: "mobile" | "web";
  current: boolean;
  ip: string | null;
};

const sessionsRef: { data: FakeSession[] } = { data: [] };
const revokeOneMutateRef = { fn: vi.fn(async (_args: { sid: string }) => {}) };
const revokeOthersMutateRef = { fn: vi.fn(async () => ({ revoked: 0 })) };

// ---------------------------------------------------------------------------
// React Native mocks — registered before the screen is imported.
// ---------------------------------------------------------------------------

vi.mock("react-native", () => ({
  View: ({
    children,
    testID,
    style: _s,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
  Text: ({
    children,
    testID,
    style: _s,
    numberOfLines: _nl,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    style?: unknown;
    numberOfLines?: number;
  }) => (
    <span data-testid={testID} {...rest}>
      {children}
    </span>
  ),
  ScrollView: ({
    children,
    contentContainerStyle: _ccs,
    style: _s,
    ...rest
  }: {
    children?: React.ReactNode;
    contentContainerStyle?: unknown;
    style?: unknown;
  }) => <div {...rest}>{children}</div>,
  Pressable: ({
    children,
    testID,
    onPress,
    disabled,
    style: _s,
    ...rest
  }: {
    children?: React.ReactNode | ((s: { pressed: boolean }) => React.ReactNode);
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    style?: unknown;
  }) => (
    <button
      data-testid={testID}
      onClick={() => !disabled && onPress?.()}
      disabled={disabled}
      {...rest}
    >
      {typeof children === "function" ? children({ pressed: false }) : children}
    </button>
  ),
  ActivityIndicator: () => null,
  Platform: { OS: "web" },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({
    name: _n,
    size: _s,
    color: _c,
  }: {
    name: string;
    size?: number;
    color?: string;
  }) => null,
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    card: "#111",
    cardBorder: "#222",
    border: "#333",
    foreground: "#fff",
    mutedForeground: "#999",
    destructive: "#ef4444",
    success: "#22c55e",
    violet: "#8b5cf6",
    input: "#222",
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    logout: vi.fn(async () => {}),
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListMySessions: () => ({
    data: { sessions: sessionsRef.data },
    isLoading: false,
    isError: false,
  }),
  useRevokeOneSession: () => ({ mutateAsync: revokeOneMutateRef.fn }),
  useRevokeOtherSessions: () => ({ mutateAsync: revokeOthersMutateRef.fn }),
  getListMySessionsQueryKey: () => ["my-sessions"],
}));

// Import AFTER all vi.mock() calls.
import SessionsScreen from "@/app/sessions";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENT_SESSION: FakeSession = {
  sid: "sess-current",
  deviceLabel: "iPhone 15",
  lastSeenAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  channel: "mobile",
  current: true,
  ip: "1.2.3.4",
};

const OTHER_SESSION: FakeSession = {
  sid: "sess-other",
  deviceLabel: "Chrome on Mac",
  lastSeenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hr ago
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  channel: "web",
  current: false,
  ip: "5.6.7.8",
};

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  sessionsRef.data = [CURRENT_SESSION, OTHER_SESSION];
  revokeOneMutateRef.fn = vi.fn(async (_args: { sid: string }) => {});
  revokeOthersMutateRef.fn = vi.fn(async () => ({ revoked: 0 }));
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests: session row rendering
// ---------------------------------------------------------------------------

describe("Sessions screen — session rows", () => {
  it("renders the sessions list when authenticated", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    await screen.findByTestId("sessions-list");
  });

  it("renders a row for each session", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    await screen.findByTestId(`session-row-${CURRENT_SESSION.sid}`);
    await screen.findByTestId(`session-row-${OTHER_SESSION.sid}`);
  });

  it("displays the device label for each session row", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const currentLabel = await screen.findByTestId(
      `session-device-${CURRENT_SESSION.sid}`,
    );
    expect(currentLabel.textContent).toBe("iPhone 15");

    const otherLabel = screen.getByTestId(
      `session-device-${OTHER_SESSION.sid}`,
    );
    expect(otherLabel.textContent).toBe("Chrome on Mac");
  });

  it("displays a last-seen time for each session row", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const currentLastSeen = await screen.findByTestId(
      `session-last-seen-${CURRENT_SESSION.sid}`,
    );
    expect(currentLastSeen.textContent).toContain("Last active");
    // 5 minutes ago → "5 mins ago"
    expect(currentLastSeen.textContent).toMatch(/\d+ min/);

    const otherLastSeen = screen.getByTestId(
      `session-last-seen-${OTHER_SESSION.sid}`,
    );
    expect(otherLastSeen.textContent).toContain("Last active");
    // 1 hour ago → "1 hour ago"
    expect(otherLastSeen.textContent).toMatch(/\d+ hour/);
  });

  it("marks the current session with a 'This device' badge", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const badge = await screen.findByTestId(
      `session-current-badge-${CURRENT_SESSION.sid}`,
    );
    expect(badge.textContent).toBe("This device");

    // The other session should NOT have a current badge.
    expect(
      screen.queryByTestId(`session-current-badge-${OTHER_SESSION.sid}`),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: revoke one session
// ---------------------------------------------------------------------------

describe("Sessions screen — revoke one session", () => {
  it("calls revokeOne.mutateAsync with the correct sid when Revoke is pressed", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const revokeBtn = await screen.findByTestId(
      `button-revoke-session-${OTHER_SESSION.sid}`,
    );
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(revokeOneMutateRef.fn).toHaveBeenCalledWith({
        sid: OTHER_SESSION.sid,
      });
    });
  });

  it("shows a success banner after revoking a non-current session", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const revokeBtn = await screen.findByTestId(
      `button-revoke-session-${OTHER_SESSION.sid}`,
    );
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      const banner = screen.getByTestId("sessions-banner");
      expect(banner.textContent).toContain("That device has been signed out.");
    });
  });

  it("row disappears from the list after the Revoke button is pressed", async () => {
    // Wire the mutation to remove the other session from the mock data.
    revokeOneMutateRef.fn = vi.fn(async (_args: { sid: string }) => {
      sessionsRef.data = [CURRENT_SESSION];
    });

    const { rerender } = render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    // Both rows present before revoke.
    await screen.findByTestId(`session-row-${OTHER_SESSION.sid}`);

    fireEvent.click(
      screen.getByTestId(`button-revoke-session-${OTHER_SESSION.sid}`),
    );

    // After the mutation resolves, force a re-render so the component picks
    // up the updated sessionsRef.data, then assert the row is gone.
    await waitFor(() => {
      rerender(
        <Wrap>
          <SessionsScreen />
        </Wrap>,
      );
      expect(
        screen.queryByTestId(`session-row-${OTHER_SESSION.sid}`),
      ).toBeNull();
    });

    // The current session row should still be present.
    expect(screen.getByTestId(`session-row-${CURRENT_SESSION.sid}`)).toBeTruthy();
  });

  it("each session row has a Revoke button", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    await screen.findByTestId(`button-revoke-session-${CURRENT_SESSION.sid}`);
    await screen.findByTestId(`button-revoke-session-${OTHER_SESSION.sid}`);
  });
});

// ---------------------------------------------------------------------------
// Tests: sign out everywhere else
// ---------------------------------------------------------------------------

describe("Sessions screen — sign out everywhere else", () => {
  it("is disabled when there are no other sessions (only the current one)", async () => {
    sessionsRef.data = [CURRENT_SESSION];

    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const btn = (await screen.findByTestId(
      "button-revoke-others",
    )) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("is enabled when at least one other session exists", async () => {
    // Default sessionsRef.data has CURRENT_SESSION + OTHER_SESSION.
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const btn = (await screen.findByTestId(
      "button-revoke-others",
    )) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls revokeOthers.mutateAsync when pressed", async () => {
    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-revoke-others");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(revokeOthersMutateRef.fn).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a success banner after signing out other devices", async () => {
    revokeOthersMutateRef.fn = vi.fn(async () => ({ revoked: 1 }));

    render(
      <Wrap>
        <SessionsScreen />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-revoke-others");
    fireEvent.click(btn);

    await waitFor(() => {
      const banner = screen.getByTestId("sessions-banner");
      expect(banner.textContent).toContain("Signed out 1 other device.");
    });
  });
});
