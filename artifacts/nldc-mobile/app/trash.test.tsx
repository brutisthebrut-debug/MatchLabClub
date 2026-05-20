import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Shared mutable refs so individual tests can control data.
// ---------------------------------------------------------------------------

const trashedAuditsRef: { data: unknown[] } = { data: [] };
const purgeMutateRef = { fn: vi.fn() };

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
  ScrollView: ({
    children,
    testID,
    contentContainerStyle: _ccs,
    style: _s,
    refreshControl: _rc,
    ...rest
  }: {
    children?: React.ReactNode;
    testID?: string;
    contentContainerStyle?: unknown;
    style?: unknown;
    refreshControl?: React.ReactNode;
  }) => (
    <div data-testid={testID} {...rest}>
      {children}
    </div>
  ),
  Pressable: ({
    children,
    testID,
    onPress,
    disabled,
    style,
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
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  RefreshControl: () => null,
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
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

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    card: "#111",
    border: "#333",
    foreground: "#fff",
    mutedForeground: "#999",
    primary: "#8b5cf6",
    primaryForeground: "#fff",
    destructive: "#ef4444",
    input: "#222",
  }),
}));

vi.mock("@/lib/auditTrashNotifications", () => ({
  maybeScheduleTrashReminder: vi.fn(async () => {}),
  resetTrashReminderSignature: vi.fn(async () => {}),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListTrashedAudits: () => ({
    data: trashedAuditsRef.data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isRefetching: false,
  }),
  useListExpiringTrashedAudits: () => ({
    data: { audits: [], retentionDays: 30 },
  }),
  useRestoreAudit: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  usePurgeAudit: () => ({
    mutate: purgeMutateRef.fn,
    isPending: false,
    variables: undefined,
  }),
  useEmptyTrash: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreAllTrash: () => ({ mutate: vi.fn(), isPending: false }),
  getListTrashedAuditsQueryKey: () => ["trash"],
  getListExpiringTrashedAuditsQueryKey: () => ["trash-expiring"],
  getListAuditsQueryKey: () => ["audits"],
}));

// Import component AFTER all vi.mock() calls.
import TrashScreen from "@/app/trash";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const FAKE_AUDIT = {
  id: 7,
  firstName: "Alex",
  deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
};

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  trashedAuditsRef.data = [FAKE_AUDIT];
  purgeMutateRef.fn = vi.fn();
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
// Tests: type-delete guard on the trash purge confirm dialog
// ---------------------------------------------------------------------------

describe("Trash purge confirm dialog — type-delete guard", () => {
  it("'Delete forever' button is disabled when the confirm input is empty", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    // Open the purge dialog for the first audit.
    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);

    // Dialog should be visible.
    await screen.findByTestId("dialog-confirm-purge-audit");

    const confirmBtn = screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("'Delete forever' button stays disabled when the wrong text is typed", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    const input = screen.getByTestId("input-trash-purge-confirm");
    fireEvent.change(input, { target: { value: "delet" } });

    const confirmBtn = screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("'Delete forever' button becomes enabled when 'delete' is typed (exact match)", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    const input = screen.getByTestId("input-trash-purge-confirm");
    fireEvent.change(input, { target: { value: "delete" } });

    await waitFor(() => {
      expect((screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("'Delete forever' button becomes enabled when 'DELETE' is typed (case-insensitive)", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    const input = screen.getByTestId("input-trash-purge-confirm");
    fireEvent.change(input, { target: { value: "DELETE" } });

    await waitFor(() => {
      expect((screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("'Delete forever' button becomes enabled when '  Delete  ' is typed (trimmed)", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    const input = screen.getByTestId("input-trash-purge-confirm");
    fireEvent.change(input, { target: { value: "  Delete  " } });

    await waitFor(() => {
      expect((screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("Cancel closes the dialog", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    const cancelBtn = screen.getByTestId("button-trash-purge-cancel");
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("dialog-confirm-purge-audit")).toBeNull();
    });
  });

  it("Cancel resets the typed text so re-opening the dialog starts fresh", async () => {
    render(
      <Wrap>
        <TrashScreen />
      </Wrap>,
    );

    // Open → type → cancel → reopen.
    const purgeBtn = await screen.findByTestId(`button-trash-purge-${FAKE_AUDIT.id}`);
    fireEvent.click(purgeBtn);
    await screen.findByTestId("dialog-confirm-purge-audit");

    fireEvent.change(screen.getByTestId("input-trash-purge-confirm"), {
      target: { value: "delete" },
    });

    // Confirm button should now be enabled.
    await waitFor(() => {
      expect((screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId("button-trash-purge-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("dialog-confirm-purge-audit")).toBeNull();
    });

    // Reopen the dialog — confirm button should be disabled again.
    fireEvent.click(screen.getByTestId(`button-trash-purge-${FAKE_AUDIT.id}`));
    await screen.findByTestId("dialog-confirm-purge-audit");

    expect((screen.getByTestId("button-trash-purge-confirm") as HTMLButtonElement).disabled).toBe(true);
  });
});
