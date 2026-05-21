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
// Navigation test: Account tab → Devices & sign-ins → sessions screen
//
// Renders the Account tab with an authenticated user and verifies that
// tapping the "Devices & sign-ins" card calls router.push("/sessions").
// ---------------------------------------------------------------------------

const routerPushSpy = vi.fn();

// ---------------------------------------------------------------------------
// React Native mocks
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
    style?: unknown;
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

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: routerPushSpy, replace: vi.fn() }),
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

vi.mock("@/lib/auditTrashNotifications", () => ({
  DEFAULT_TRASH_REMINDER_PREFS: { enabled: true },
  loadTrashReminderPrefs: vi.fn(async () => ({ enabled: true })),
  saveTrashReminderPrefs: vi.fn(async () => {}),
}));

// account.tsx imports HandoffQrCard, which pulls in expo-media-library +
// expo-file-system + react-native-view-shot. Those expo modules load
// expo-modules-core which can't initialize under jsdom (TurboModuleRegistry
// is undefined on the mocked react-native). This test only verifies the
// "Devices & sign-ins" navigation path; the QR card is irrelevant here, so
// replace it with an inert stub.
vi.mock("@/components/HandoffQrCard", () => ({
  HandoffQrCard: () => null,
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

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { firstName: "Taylor", lastName: "Smith", email: "taylor@example.com" },
    isAuthenticated: true,
    isLoading: false,
    isSigningIn: false,
    error: null,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
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
  deleteMyAccount: vi.fn(async () => {}),
  exportMyData: vi.fn(async () => ({})),
  getExportMyDataQueryKey: () => ["export-my-data"],
}));

// Import AFTER all vi.mock() calls.
import AccountScreen from "@/app/(tabs)/account";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  routerPushSpy.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests: Account tab → sessions navigation
// ---------------------------------------------------------------------------

describe("Account tab — Devices & sign-ins card navigation", () => {
  it("shows the Devices & sign-ins card when the user is signed in", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    await screen.findByTestId("button-account-sessions");
  });

  it("navigates to /sessions when the Devices & sign-ins card is tapped", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const card = await screen.findByTestId("button-account-sessions");
    fireEvent.click(card);

    await waitFor(() => {
      expect(routerPushSpy).toHaveBeenCalledWith("/sessions");
    });
  });
});
