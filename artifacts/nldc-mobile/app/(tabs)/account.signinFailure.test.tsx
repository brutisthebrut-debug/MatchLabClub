/**
 * Integration (e2e-style) tests for sign-in failure paths.
 *
 * These tests mount the real AccountScreen together with the real AuthProvider
 * (no useAuth mock) so the full component tree is exercised end-to-end inside
 * the Vitest + jsdom renderer — the closest approximation to the Expo renderer
 * available in this project's test harness.
 *
 * Covered paths
 * ─────────────
 * 1. "Sign-in isn't ready yet" — tap the sign-in button before OIDC discovery
 *    has resolved (useAuthRequest returns null).
 * 2. Token-exchange 4xx — the OIDC redirect succeeds but the server-side
 *    token-exchange endpoint replies with a 4xx error code.
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Secure-store in-memory stub (mirrors auth.test.tsx)
// ---------------------------------------------------------------------------
const secureStore = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Controllable useAuthRequest mock (mirrors auth.test.tsx)
// ---------------------------------------------------------------------------
let mockAuthRequest: { codeVerifier: string } | null = { codeVerifier: "v" };
let mockAuthResponse: Record<string, unknown> | null = null;
let mockPromptAsync = vi.fn();

vi.mock("expo-auth-session", () => ({
  Prompt: { Login: "login" },
  useAutoDiscovery: () => ({ issuer: "https://example.com" }),
  makeRedirectUri: () => "https://example.com/redirect",
  useAuthRequest: () => [mockAuthRequest, mockAuthResponse, mockPromptAsync],
}));

// ---------------------------------------------------------------------------
// auditTrashNotifications — stubs for functions the AuthProvider also uses
// ---------------------------------------------------------------------------
vi.mock("@/lib/auditTrashNotifications", () => ({
  DEFAULT_TRASH_REMINDER_PREFS: { enabled: true },
  loadTrashReminderPrefs: vi.fn(async () => ({ enabled: true })),
  saveTrashReminderPrefs: vi.fn(async () => {}),
  registerPushTokenWithServer: vi.fn(async () => {}),
  deregisterPushTokenFromServer: vi.fn(async () => {}),
}));

vi.mock("@/lib/signInPushToken", () => ({
  getSigningInDevicePushToken: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// React Native primitives — minimal DOM equivalents
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
  Pressable: ({
    children,
    testID,
    onPress,
    disabled,
    style: _s,
    accessibilityLabel,
    accessibilityRole: _ar,
    accessibilityState: _as,
    ...rest
  }: {
    children?: React.ReactNode | ((s: { pressed: boolean }) => React.ReactNode);
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    style?: unknown | ((s: { pressed: boolean }) => unknown);
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: unknown;
  }) => (
    <button
      data-testid={testID}
      onClick={() => !disabled && onPress?.()}
      disabled={disabled}
      aria-label={accessibilityLabel}
      {...rest}
    >
      {typeof children === "function" ? children({ pressed: false }) : children}
    </button>
  ),
  TextInput: ({
    testID,
    value,
    onChangeText,
    editable,
    style: _s,
    placeholder: _ph,
    placeholderTextColor: _ptc,
    autoCapitalize: _ac,
    autoCorrect: _acr,
    autoComplete: _acp,
    spellCheck: _sc,
    ...rest
  }: {
    testID?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    editable?: boolean;
    style?: unknown;
    placeholder?: string;
    placeholderTextColor?: string;
    autoCapitalize?: string;
    autoCorrect?: boolean;
    autoComplete?: string;
    spellCheck?: boolean;
  }) => (
    <input
      data-testid={testID}
      value={value ?? ""}
      disabled={editable === false}
      onChange={(e) => onChangeText?.(e.target.value)}
      {...rest}
    />
  ),
  Modal: ({
    children,
    visible,
    onRequestClose: _orc,
    animationType: _at,
    transparent: _t,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
    onRequestClose?: () => void;
    animationType?: string;
    transparent?: boolean;
  }) => (visible ? <div data-testid="__modal">{children}</div> : null),
  Switch: ({
    testID,
    value: _v,
    onValueChange: _ovc,
    disabled: _d,
    trackColor: _tc,
    thumbColor: _thc,
    accessibilityLabel: _al,
  }: {
    testID?: string;
    value?: boolean;
    onValueChange?: (v: boolean) => void;
    disabled?: boolean;
    trackColor?: unknown;
    thumbColor?: unknown;
    accessibilityLabel?: string;
  }) => <input type="checkbox" data-testid={testID} />,
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  Platform: { OS: "web" },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
}));

vi.mock("react-native-gesture-handler", () => ({
  ScrollView: ({
    children,
    testID,
    contentContainerStyle: _ccs,
    style: _s,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    contentContainerStyle?: unknown;
    style?: unknown;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

vi.mock("expo-file-system", () => ({
  File: class FakeFile {
    exists = false;
    constructor(_base: unknown, _name: string) {}
    delete() {}
    create() {}
    write(_content: string) {}
    uri = "file://fake.json";
  },
  Paths: { cache: "/cache" },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(async () => {}),
}));

vi.mock("@/components/ScreenHeader", () => ({
  ScreenHeader: ({
    title,
  }: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
  }) => <h1>{title}</h1>,
}));

vi.mock("@/components/HandoffQrCard", () => ({
  HandoffQrCard: () => <div data-testid="handoff-qr-card" />,
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    card: "#111",
    cardBorder: "#222",
    border: "#333",
    foreground: "#fff",
    mutedForeground: "#999",
    primary: "#8b5cf6",
    destructive: "#ef4444",
    success: "#22c55e",
    gold: "#f59e0b",
    violet: "#8b5cf6",
    input: "#222",
  }),
}));

vi.mock("@/lib/autoRefreshPref", () => ({
  useAutoRefreshPref: () => ({
    enabled: true,
    loaded: true,
    setEnabled: vi.fn(async () => {}),
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  deleteMyAccountConfirmed: vi.fn(async () => {}),
  useDeleteMyAccountConfirmed: () => ({
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  }),
  exportMyData: vi.fn(async () => ({})),
  getExportMyDataQueryKey: () => ["export-my-data"],
  setAuthTokenGetter: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  customFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import AFTER all vi.mock() calls
// ---------------------------------------------------------------------------
import AccountScreen from "@/app/(tabs)/account";
import { AuthProvider } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Fetch handler infrastructure (mirrors auth.test.tsx)
// ---------------------------------------------------------------------------
type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Promise<Response> | Response;

let fetchHandler: FetchHandler = () => {
  throw new Error("fetch handler not configured");
};

function setFetchHandler(handler: FetchHandler) {
  fetchHandler = handler;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------
let qc: QueryClient;

beforeEach(() => {
  secureStore.clear();
  mockAuthRequest = { codeVerifier: "v" };
  mockAuthResponse = null;
  mockPromptAsync = vi.fn();
  process.env["EXPO_PUBLIC_DOMAIN"] = "test.example.com";

  globalThis.fetch = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : (input as Request).url ?? String(input);
      return await fetchHandler(url, init);
    },
  ) as typeof fetch;

  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete process.env["EXPO_PUBLIC_DOMAIN"];
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Path 1: tap sign-in before OIDC discovery resolves (request === null)
// ---------------------------------------------------------------------------

describe("AccountScreen — sign-in failure: not ready yet", () => {
  it("shows the auth-error banner when sign-in is tapped before discovery resolves", async () => {
    // Null request simulates useAuthRequest not yet initialised (discovery in flight).
    mockAuthRequest = null;

    // No stored token → fetchUser short-circuits without hitting the network.
    setFetchHandler(() => {
      throw new Error("unexpected fetch — no token, no call expected");
    });

    render(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    // Wait for the sign-in card to appear (auth is not loading, not authenticated).
    const signinBtn = await screen.findByTestId("button-account-signin");

    await act(async () => {
      fireEvent.click(signinBtn);
    });

    // The real AuthProvider's login() sets error = "Sign-in isn't ready yet..."
    // which the AccountScreen renders inside testID="account-auth-error".
    await waitFor(() => {
      const banner = screen.getByTestId("account-auth-error");
      expect(banner.textContent).toBe(
        "Sign-in isn't ready yet. Try again in a moment.",
      );
    });

    // The sign-in card must still be visible (user remains unauthenticated).
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Path 2: OIDC redirect succeeds but token-exchange returns a 4xx
// ---------------------------------------------------------------------------

describe("AccountScreen — sign-in failure: token-exchange 4xx", () => {
  it("shows the auth-error banner when the token-exchange endpoint returns 400", async () => {
    // promptAsync resolves with a successful OIDC redirect.
    mockPromptAsync = vi.fn().mockResolvedValue({
      type: "success",
      params: { code: "prompt-code", state: "prompt-state" },
    });

    // No stored token → fetchUser short-circuits; only token-exchange is called.
    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        return jsonResponse(400, { message: "Bad request" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    // Wait for the sign-in button to appear.
    const signinBtn = await screen.findByTestId("button-account-signin");

    // Click sign-in — this calls login() which calls promptAsync().
    await act(async () => {
      fireEvent.click(signinBtn);
    });

    // Inject the OIDC response and rerender to trigger the response effect
    // inside AuthProvider (mirrors the pattern from auth.test.tsx).
    mockAuthResponse = {
      type: "success",
      params: { code: "test-code", state: "test-state" },
    };
    rerender(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    // The exchange fails with 400; the real AuthProvider sets:
    //   error = "Couldn't complete sign-in (HTTP 400). Try again."
    // AccountScreen renders that string inside testID="account-auth-error".
    await waitFor(() => {
      const banner = screen.getByTestId("account-auth-error");
      expect(banner.textContent).toBe(
        "Couldn't complete sign-in (HTTP 400). Try again.",
      );
    });

    // The sign-in card must still be visible — the user is not authenticated.
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
  });

  it("shows the auth-error banner when the token-exchange endpoint returns 503", async () => {
    mockPromptAsync = vi.fn().mockResolvedValue({
      type: "success",
      params: { code: "prompt-code", state: "prompt-state" },
    });

    setFetchHandler((url) => {
      if (url.includes("/api/mobile-auth/token-exchange")) {
        return jsonResponse(503, { message: "Service unavailable" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    const signinBtn = await screen.findByTestId("button-account-signin");

    await act(async () => {
      fireEvent.click(signinBtn);
    });

    mockAuthResponse = {
      type: "success",
      params: { code: "test-code", state: "test-state" },
    };
    rerender(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    await waitFor(() => {
      const banner = screen.getByTestId("account-auth-error");
      expect(banner.textContent).toBe(
        "Couldn't complete sign-in (HTTP 503). Try again.",
      );
    });

    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Path 3: user cancels the OIDC browser flow
// ---------------------------------------------------------------------------

describe("AccountScreen — sign-in failure: user cancels", () => {
  it("does not show an error banner and re-enables the sign-in button when the user cancels", async () => {
    mockPromptAsync = vi.fn().mockResolvedValue({ type: "cancel" });

    setFetchHandler((url) => {
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { rerender } = render(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    const signinBtn = await screen.findByTestId("button-account-signin");

    await act(async () => {
      fireEvent.click(signinBtn);
    });

    // Inject the cancel response and rerender to trigger the response effect
    // inside AuthProvider (mirrors the pattern used by the success/error paths).
    mockAuthResponse = { type: "cancel" };
    rerender(
      <Wrap>
        <AuthProvider>
          <AccountScreen />
        </AuthProvider>
      </Wrap>,
    );

    // The cancel branch in AuthProvider resets isSigningIn to false without
    // setting any error — so the sign-in button must be re-enabled and no
    // account-auth-error banner should be visible.
    await waitFor(() => {
      const btn = screen.getByTestId(
        "button-account-signin",
      ) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    expect(screen.queryByTestId("account-auth-error")).toBeNull();
    expect(screen.getByTestId("account-signin-card")).toBeTruthy();
    expect(screen.queryByTestId("account-identity-card")).toBeNull();
  });
});
