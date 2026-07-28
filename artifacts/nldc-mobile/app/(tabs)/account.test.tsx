import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// react-native-gesture-handler provides its own ScrollView used by the account screen.
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

vi.mock("@/lib/auditTrashNotifications", () => ({
  DEFAULT_TRASH_REMINDER_PREFS: { enabled: true },
  loadTrashReminderPrefs: vi.fn(async () => ({ enabled: true })),
  saveTrashReminderPrefs: vi.fn(async () => {}),
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
    user: {
      id: "account-test-user",
      email: "daniel@example.com",
      firstName: "Daniel",
      lastName: null,
      profileImageUrl: null,
    },
    isAuthenticated: true,
    isLoading: false,
    isSigningIn: false,
    error: null,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  }),
}));

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/HandoffQrCard", () => ({
  HandoffQrCard: () => null,
}));

vi.mock("@/lib/autoRefreshPref", () => ({
  useAutoRefreshPref: () => ({
    enabled: true,
    loaded: true,
    setEnabled: vi.fn(async () => {}),
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useDeleteMyAccountConfirmed: () => ({
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  }),
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests: type-email guard on the delete-account confirm dialog
// ---------------------------------------------------------------------------

describe("Delete-account confirm dialog — type-email guard", () => {
  it("confirm button is disabled when the confirm input is empty", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    // Open the delete-account dialog.
    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);

    // Dialog should be visible.
    await screen.findByTestId("dialog-confirm-delete-account");

    const confirmBtn = screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("confirm button stays disabled when the wrong text is typed", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    const input = screen.getByTestId("input-account-delete-confirm");
    fireEvent.change(input, { target: { value: "wrong@example.com" } });

    expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("confirm button becomes enabled when the account email is typed", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    const input = screen.getByTestId("input-account-delete-confirm");
    fireEvent.change(input, { target: { value: "daniel@example.com" } });

    await waitFor(() => {
      expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("accepts the account email case-insensitively", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    const input = screen.getByTestId("input-account-delete-confirm");
    fireEvent.change(input, { target: { value: "DANIEL@EXAMPLE.COM" } });

    await waitFor(() => {
      expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("accepts surrounding whitespace around the account email", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    const input = screen.getByTestId("input-account-delete-confirm");
    fireEvent.change(input, { target: { value: "  daniel@example.com  " } });

    await waitFor(() => {
      expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("Cancel closes the dialog", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    const cancelBtn = screen.getByTestId("button-account-delete-cancel");
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("dialog-confirm-delete-account")).toBeNull();
    });
  });

  it("Cancel resets the typed text so re-opening the dialog starts fresh", async () => {
    render(
      <Wrap>
        <AccountScreen />
      </Wrap>,
    );

    const deleteBtn = await screen.findByTestId("button-account-delete");
    fireEvent.click(deleteBtn);
    await screen.findByTestId("dialog-confirm-delete-account");

    // Type the account email to enable the confirm button.
    fireEvent.change(screen.getByTestId("input-account-delete-confirm"), {
      target: { value: "daniel@example.com" },
    });
    await waitFor(() => {
      expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(false);
    });

    // Cancel.
    fireEvent.click(screen.getByTestId("button-account-delete-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-confirm-delete-account")).toBeNull();
    });

    // Reopen — confirm button must be disabled again (text was reset).
    fireEvent.click(screen.getByTestId("button-account-delete"));
    await screen.findByTestId("dialog-confirm-delete-account");

    expect((screen.getByTestId("button-account-delete-confirm") as HTMLButtonElement).disabled).toBe(true);
  });
});
