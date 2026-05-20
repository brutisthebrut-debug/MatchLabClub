import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Hoisted mutable mock refs — must be declared before vi.mock() calls so
// the factories can close over them.
// ---------------------------------------------------------------------------
const extractRef = vi.hoisted(() => ({
  current: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
}));

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
    multiline,
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
    multiline?: boolean;
  }) =>
    multiline ? (
      <textarea
        data-testid={testID}
        value={value ?? ""}
        disabled={editable === false}
        onChange={(e) => onChangeText?.(e.target.value)}
        {...rest}
      />
    ) : (
      <input
        data-testid={testID}
        value={value ?? ""}
        disabled={editable === false}
        onChange={(e) => onChangeText?.(e.target.value)}
        {...rest}
      />
    ),
  Image: ({
    testID,
    source: _src,
    style: _s,
  }: {
    testID?: string;
    source?: unknown;
    style?: unknown;
  }) => <img data-testid={testID} alt="screenshot" />,
  Switch: () => null,
  ActivityIndicator: () => null,
  Alert: { alert: vi.fn() },
  Platform: { OS: "web" },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(s: T): T => s,
  },
}));

vi.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: ({
    children,
    contentContainerStyle: _ccs,
    ...rest
  }: {
    children?: React.ReactNode;
    contentContainerStyle?: unknown;
    bottomOffset?: number;
    keyboardShouldPersistTaps?: string;
  }) => <div {...rest}>{children}</div>,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  requestCameraPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useFocusEffect: vi.fn((cb: () => (() => void) | void) => {
    cb();
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useExtractMessageScreenshot: () => extractRef.current,
  useCoachMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateMessageCoachingSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetCoachFollowUpStats: () => ({ data: null }),
  useGetCoachFollowUpTimeline: () => ({ data: null }),
  getGetCoachFollowUpStatsQueryKey: () => ["coach-follow-up-stats"],
  getGetCoachFollowUpTimelineQueryKey: () => ["coach-follow-up-timeline"],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isSigningIn: false,
    error: null,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  }),
}));

vi.mock("@/lib/anonymousIds", () => ({
  rememberAnonymousId: vi.fn(async () => {}),
}));

vi.mock("@/lib/coachNotifications", () => ({
  buildCoachSnoozeShortOptions: vi.fn(() => []),
  buildCoachSnoozeLongOptions: vi.fn(() => []),
  cancelCoachReminder: vi.fn(async () => {}),
  clearCoachDraft: vi.fn(async () => {}),
  COACH_REMINDER_DELAY_OPTIONS: [],
  COACH_SNOOZE_CUSTOM_MAX_SECONDS: 86400,
  COACH_SNOOZE_CUSTOM_MIN_SECONDS: 300,
  COACH_TOMORROW_MORNING_HOUR_MAX: 11,
  COACH_TOMORROW_MORNING_HOUR_MIN: 5,
  COACH_TONIGHT_HOUR_MAX: 23,
  COACH_TONIGHT_HOUR_MIN: 18,
  consumePendingCoachFollowUpPrompt: vi.fn(async () => false),
  DEFAULT_COACH_REMINDER_PREFS: {
    enabled: false,
    delaySeconds: 3600,
    snoozeShort: { kind: "duration", seconds: 1800 },
    snoozeLong: { kind: "duration", seconds: 28800 },
    tonightHour: 20,
    tomorrowMorningHour: 8,
  },
  ensureCoachNotificationPermission: vi.fn(async () => {}),
  formatHourLabel: (h: number) => `${h}:00`,
  loadCoachDraft: vi.fn(async () => null),
  loadCoachReminderPrefs: vi.fn(async () => ({
    enabled: false,
    delaySeconds: 3600,
    snoozeShort: { kind: "duration", seconds: 1800 },
    snoozeLong: { kind: "duration", seconds: 28800 },
    tonightHour: 20,
    tomorrowMorningHour: 8,
  })),
  recordCoachFollowUp: vi.fn(async () => {}),
  saveCoachDraft: vi.fn(async () => {}),
  saveCoachReminderPrefs: vi.fn(async () => {}),
  scheduleCoachReminder: vi.fn(async () => {}),
  snoozeModesEqual: vi.fn(() => false),
  snoozeOptionToMode: vi.fn((o: unknown) => o),
}));

vi.mock("@/components/PrimaryButton", () => ({
  PrimaryButton: ({
    label,
    onPress,
    loading,
  }: {
    label: string;
    onPress?: () => void;
    loading?: boolean;
    icon?: string;
  }) => (
    <button onClick={onPress} disabled={loading} data-testid="button-coach-submit">
      {label}
    </button>
  ),
}));

vi.mock("@/components/ReplyCard", () => ({
  ReplyCard: ({ style, text }: { style: string; text: string; rationale: string; accent?: string; onCopy?: () => void }) => (
    <div data-testid={`reply-card-${style.toLowerCase()}`}>{text}</div>
  ),
}));

vi.mock("@/components/ScreenHeader", () => ({
  ScreenHeader: ({ title }: { eyebrow?: string; title?: string; subtitle?: string }) => (
    <h1>{title}</h1>
  ),
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0B0F1D",
    card: "#111827",
    cardBorder: "#1F2937",
    border: "#374151",
    foreground: "#F9FAFB",
    mutedForeground: "#9CA3AF",
    primary: "#8B5CF6",
    destructive: "#EF4444",
    success: "#22C55E",
    gold: "#F59E0B",
    violet: "#8B5CF6",
    teal: "#14B8A6",
    rose: "#F43F5E",
    input: "#1F2937",
  }),
}));

// Import AFTER all vi.mock() calls.
import CoachScreen from "@/app/(tabs)/coach";
import * as ImagePicker from "expo-image-picker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let qc: QueryClient;

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function resetExtractMock() {
  extractRef.current.isPending = false;
  extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
    conversationText: "",
    sourceApp: null,
  });
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  resetExtractMock();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Screenshot flow — success path
// ---------------------------------------------------------------------------

describe("Coach screenshot flow — success path", () => {
  it("populates the conversation field with the extracted text", async () => {
    const FAKE_CONVERSATION = "Her: Hey, you seem fun!\nMe: Thanks, you too!";
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: FAKE_CONVERSATION,
      sourceApp: "bumble",
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-screenshot.jpg", base64: "abc123" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    const libraryBtn = await screen.findByTestId("button-coach-screenshot-library");
    await act(async () => {
      fireEvent.click(libraryBtn);
    });

    await waitFor(() => {
      const contextInput = screen.getByTestId("input-coach-context") as HTMLInputElement;
      expect(contextInput.value).toBe(FAKE_CONVERSATION);
    });
  });

  it("pre-selects the detected source-app chip (Bumble)", async () => {
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "Hi there",
      sourceApp: "bumble",
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://ss.jpg", base64: "xyz" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      const bumbleChip = screen.getByTestId("button-coach-source-app-bumble") as HTMLButtonElement;
      expect(bumbleChip.getAttribute("aria-pressed")).toBe("true");
    });

    const hingeChip = screen.getByTestId("button-coach-source-app-hinge") as HTMLButtonElement;
    const tinderChip = screen.getByTestId("button-coach-source-app-tinder") as HTMLButtonElement;
    expect(hingeChip.getAttribute("aria-pressed")).not.toBe("true");
    expect(tinderChip.getAttribute("aria-pressed")).not.toBe("true");
  });

  it("pre-selects Hinge when the API returns 'hinge'", async () => {
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "Match: nice profile",
      sourceApp: "hinge",
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://ss.jpg", base64: "base64data" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      const hingeChip = screen.getByTestId("button-coach-source-app-hinge") as HTMLButtonElement;
      expect(hingeChip.getAttribute("aria-pressed")).toBe("true");
    });

    const bumbleChip = screen.getByTestId("button-coach-source-app-bumble") as HTMLButtonElement;
    const tinderChip = screen.getByTestId("button-coach-source-app-tinder") as HTMLButtonElement;
    expect(bumbleChip.getAttribute("aria-pressed")).not.toBe("true");
    expect(tinderChip.getAttribute("aria-pressed")).not.toBe("true");
  });

  it("shows the screenshot preview image after picking", async () => {
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "Hello",
      sourceApp: null,
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://shot.jpg", base64: "aaa" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    expect(screen.queryByTestId("img-coach-screenshot-preview")).toBeNull();

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("img-coach-screenshot-preview")).toBeTruthy();
    });
  });

  it("shows the 'Conversation auto-filled below' status after extraction completes", async () => {
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "Hey!",
      sourceApp: null,
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://s.jpg", base64: "b64" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-coach-screenshot-status").textContent).toBe(
        "Conversation auto-filled below",
      );
    });
  });

  it("clears the screenshot and hides the preview when Remove is pressed", async () => {
    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "Some text",
      sourceApp: null,
    });

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://img.jpg", base64: "data" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("img-coach-screenshot-preview")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("button-coach-screenshot-clear"));

    await waitFor(() => {
      expect(screen.queryByTestId("img-coach-screenshot-preview")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Screenshot flow — loading state
// ---------------------------------------------------------------------------

describe("Coach screenshot flow — loading state", () => {
  it("shows 'Reading screenshot…' status while the extraction is pending", async () => {
    let resolveMutation!: (val: { conversationText: string; sourceApp: string | null }) => void;
    extractRef.current.mutateAsync = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
          extractRef.current.isPending = true;
        }),
    );

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://pending.jpg", base64: "pending64" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    const { rerender } = render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));

    await waitFor(() => {
      expect(screen.getByTestId("img-coach-screenshot-preview")).toBeTruthy();
    });

    rerender(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await waitFor(() => {
      const statusEl = screen.queryByTestId("text-coach-screenshot-status");
      expect(statusEl?.textContent).toBe("Reading screenshot…");
    });

    resolveMutation({ conversationText: "", sourceApp: null });
  });
});

// ---------------------------------------------------------------------------
// Screenshot flow — error states
// ---------------------------------------------------------------------------

describe("Coach screenshot flow — error state", () => {
  it("shows the error banner when extraction fails", async () => {
    extractRef.current.mutateAsync = vi.fn().mockRejectedValue(new Error("API error"));

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://bad.jpg", base64: "badb64" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId("text-coach-screenshot-error");
      expect(errorBanner.textContent).toContain("Couldn't read that screenshot");
    });
  });

  it("shows a photo-access error when library permission is denied", async () => {
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
      expires: "never",
      canAskAgain: false,
      status: "denied",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId("text-coach-screenshot-error");
      expect(errorBanner.textContent).toContain("photo access");
    });
  });

  it("shows a camera-access error when camera permission is denied", async () => {
    vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
      expires: "never",
      canAskAgain: false,
      status: "denied",
    } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-camera"));
    });

    await waitFor(() => {
      const errorBanner = screen.getByTestId("text-coach-screenshot-error");
      expect(errorBanner.textContent).toContain("camera access");
    });
  });

  it("clears the error when a new screenshot is picked after a failure", async () => {
    extractRef.current.mutateAsync = vi.fn().mockRejectedValueOnce(new Error("first fail"));

    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      expires: "never",
      canAskAgain: true,
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>>);
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://retry.jpg", base64: "retry64" }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);

    render(
      <Wrap>
        <CoachScreen />
      </Wrap>,
    );

    await act(async () => {
      fireEvent.click(await screen.findByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("text-coach-screenshot-error")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("button-coach-screenshot-clear"));

    await waitFor(() => {
      expect(screen.getByTestId("button-coach-screenshot-library")).toBeTruthy();
    });

    extractRef.current.mutateAsync = vi.fn().mockResolvedValue({
      conversationText: "All good now",
      sourceApp: null,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-coach-screenshot-library"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("text-coach-screenshot-error")).toBeNull();
    });
  });
});
