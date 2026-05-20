import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Shared mutable state for per-test control.
// ---------------------------------------------------------------------------

const auditDataRef: {
  current: Record<string, unknown> | null;
  isLoading: boolean;
} = { current: null, isLoading: false };

const generateMutateAsync = vi.fn(async (_args: { id: number }) => NEW_CURRENT_REPORT);

// ---------------------------------------------------------------------------
// React Native mocks — must be registered before the screen is imported.
// jsdom has no native bridge, so we replace every RN primitive with a
// lightweight DOM element that preserves testID / children / onPress.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// expo-clipboard mock — factory must not reference hoisted variables.
// We access the spy via the mocked module import below.
// ---------------------------------------------------------------------------

vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(async (_text: string) => {}),
}));

vi.mock("react-native", () => {
  const rn = {
    View: ({
      children,
      testID,
      style: _style,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
      testID?: string;
    }) => (
      <div data-testid={testID} {...rest}>
        {children}
      </div>
    ),
    Text: ({
      children,
      testID,
      style: _style,
      ...rest
    }: React.HTMLAttributes<HTMLSpanElement> & {
      children?: React.ReactNode;
      testID?: string;
    }) => (
      <span data-testid={testID} {...rest}>
        {children}
      </span>
    ),
    ScrollView: ({
      children,
      testID,
      contentContainerStyle: _ccs,
      style: _style,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
      testID?: string;
      contentContainerStyle?: unknown;
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
      hitSlop: _hs,
      style,
      accessibilityLabel,
      accessibilityState: _as,
      ...rest
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      testID?: string;
      onPress?: () => void;
      disabled?: boolean;
      hitSlop?: unknown;
      style?: unknown | ((state: { pressed: boolean }) => unknown);
      accessibilityLabel?: string;
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
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
      animationType?: string;
      presentationStyle?: string;
      onRequestClose?: () => void;
      transparent?: boolean;
    }) => (visible ? <div data-testid="__modal">{children}</div> : null),
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    Platform: { OS: "web" },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(s: T): T => s,
    },
  };
  return rn;
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({ name, size: _s, color: _c, style: _st }: { name: string; size?: number; color?: string; style?: unknown }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

vi.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ id: "42" }),
  useRouter: () => ({
    back: vi.fn(),
    replace: vi.fn(),
    canGoBack: () => false,
  }),
}));

vi.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#000",
    card: "#111",
    cardBorder: "#222",
    foreground: "#fff",
    mutedForeground: "#999",
    primary: "#8b5cf6",
    destructive: "#ef4444",
    success: "#22c55e",
    gold: "#f59e0b",
    violet: "#8b5cf6",
    rose: "#f43f5e",
    teal: "#14b8a6",
  }),
}));

vi.mock("@/components/ScoreRing", () => ({
  ScoreRing: ({ score }: { score: number }) => (
    <span data-testid="score-ring">{score}</span>
  ),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetAudit: () => ({
    data: auditDataRef.current,
    isLoading: auditDataRef.isLoading,
    error: null,
  }),
  useGenerateAuditReport: (opts?: {
    mutation?: { onSuccess?: () => void };
  }) => ({
    mutateAsync: vi.fn(async (args: { id: number }) => {
      const result = await generateMutateAsync(args);
      opts?.mutation?.onSuccess?.();
      return result;
    }),
    isPending: false,
  }),
  useGetEngineMeta: () => ({ data: { engineVersion: "v1" } }),
  useListAuditReportVersions: () => ({
    data: {
      versions: [
        {
          id: 1,
          readinessScore: 72,
          generatedAt: new Date().toISOString(),
          report: NEW_CURRENT_REPORT,
        },
      ],
    },
  }),
  useDeleteAudit: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  getGetAuditQueryKey: (id: number) => ["audit", id],
  getListAuditReportVersionsQueryKey: (id: number) => ["audit-versions", id],
  getListAuditsQueryKey: () => ["audits"],
}));

// Import mocked modules AFTER all vi.mock() calls are registered.
import * as Clipboard from "expo-clipboard";
import AuditDetailScreen from "@/app/audit/[id]";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const PREVIOUS_REPORT = {
  auditId: 42,
  readinessScore: 55,
  overallGrade: "C",
  strengths: ["Previous strength A"],
  risks: ["Previous risk A"],
  bioAudit: "Previous bio audit text.",
  rewrittenBio: "PREVIOUS_REWRITTEN_BIO: earlier version of the bio.",
  rewrittenPrompts: [
    {
      original: "The way to win me over is...",
      rewritten: "PREVIOUS_PROMPT_REWRITE_0: earlier prompt rewrite.",
      tip: "A tip from before.",
    },
  ],
  photoGuidance: [],
  actionPlan: [
    {
      priority: 1,
      title: "PREVIOUS_ACTION_TITLE_0",
      description: "Previous action description.",
      timeframe: "This week",
    },
  ],
  messagingStyle: "Previous messaging style.",
  coachingCta: "Previous CTA.",
  engineVersion: "v0",
};

const NEW_CURRENT_REPORT = {
  auditId: 42,
  readinessScore: 72,
  overallGrade: "B",
  strengths: ["Current strength A"],
  risks: ["Current risk A"],
  bioAudit: "Current bio audit text.",
  rewrittenBio: "CURRENT_REWRITTEN_BIO: latest bio.",
  rewrittenPrompts: [],
  photoGuidance: [],
  actionPlan: [],
  messagingStyle: "Current messaging style.",
  coachingCta: "Current CTA.",
  engineVersion: "v1",
};

const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

function makeAudit(opts: { withPrevious: boolean }) {
  return {
    id: 42,
    firstName: "Alex",
    age: 28,
    gender: "m",
    orientation: "straight",
    datingGoal: "find a relationship",
    currentApps: ["Hinge"],
    bio: "Current bio",
    status: "complete",
    source: "manual",
    readinessScore: 72,
    report: NEW_CURRENT_REPORT,
    reportGeneratedAt: ONE_HOUR_AGO,
    previousReport: opts.withPrevious ? PREVIOUS_REPORT : null,
    previousReportGeneratedAt: opts.withPrevious ? TWO_DAYS_AGO : null,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    prompts: null,
  };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  auditDataRef.current = null;
  auditDataRef.isLoading = false;
  generateMutateAsync.mockReset();
  generateMutateAsync.mockResolvedValue(NEW_CURRENT_REPORT);
  vi.mocked(Clipboard.setStringAsync).mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Previous-version viewer — mobile audit detail screen", () => {
  it("shows the 'View previous version' button when audit has a previousReport", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-view-previous-version");
    expect(btn).toBeTruthy();
  });

  it("does NOT show the button when the audit has no previousReport", async () => {
    auditDataRef.current = makeAudit({ withPrevious: false });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    // Wait for the ring card to confirm the screen has fully rendered.
    await screen.findByTestId("score-ring");

    expect(screen.queryByTestId("button-view-previous-version")).toBeNull();
  });

  it("pressing the button opens the modal with previous-version-content", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-view-previous-version");
    fireEvent.click(btn);

    // The modal container becomes visible.
    const modal = await screen.findByTestId("__modal");
    expect(modal).toBeTruthy();

    // The previous-version content scroll view is inside the modal.
    const content = screen.getByTestId("previous-version-content");
    expect(content).toBeTruthy();
  });

  it("previous rewritten bio renders inside the modal", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));

    const prevBio = await screen.findByTestId("text-previous-rewritten-bio");
    expect(prevBio.textContent).toContain("PREVIOUS_REWRITTEN_BIO");
  });

  it("prompt rewrites and action plan from the previous report render in the modal", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));

    await screen.findByTestId("previous-version-content");

    const prompt0 = screen.getByTestId("prev-prompt-0");
    expect(prompt0.textContent).toContain("PREVIOUS_PROMPT_REWRITE_0");

    const action0 = screen.getByTestId("prev-action-0");
    expect(action0.textContent).toContain("PREVIOUS_ACTION_TITLE_0");
  });

  it("previous score is shown in the modal", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));

    await screen.findByTestId("previous-version-content");

    // ScoreRing inside PreviousReportContent shows the previous score.
    const rings = screen.getAllByTestId("score-ring");
    const scores = rings.map((el) => Number(el.textContent));
    expect(scores).toContain(PREVIOUS_REPORT.readinessScore);
  });

  it("pressing the close button dismisses the modal and returns to the current report", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));

    // Modal is open.
    await screen.findByTestId("previous-version-content");

    const closeBtn = screen.getByTestId("button-close-previous-version");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("previous-version-content")).toBeNull();
    });

    // The main audit ring (current report) should still be visible.
    expect(screen.getByTestId("score-ring")).toBeTruthy();
  });

  it("copy buttons are present in the previous-version modal for bio, prompt, and action plan", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));
    const container = await screen.findByTestId("previous-version-content");
    const scope = within(container);

    // There should be at least 3 copy buttons: bio rewrite, prompt rewrite, action plan.
    const copyBtns = scope.getAllByRole("button", { name: "Copy to clipboard" });
    expect(copyBtns.length).toBeGreaterThanOrEqual(3);
  });

  it("pressing the bio rewrite copy button calls Clipboard.setStringAsync with the bio text", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));
    const container = await screen.findByTestId("previous-version-content");
    await within(container).findByTestId("text-previous-rewritten-bio");

    // The first copy button inside the modal is the bio rewrite button.
    const copyBtns = within(container).getAllByRole("button", { name: "Copy to clipboard" });
    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });

    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      PREVIOUS_REPORT.rewrittenBio,
    );
  });

  it("pressing a prompt rewrite copy button calls Clipboard.setStringAsync with the rewritten text", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));
    const container = await screen.findByTestId("previous-version-content");
    await within(container).findByTestId("prev-prompt-0");

    const copyBtns = within(container).getAllByRole("button", { name: "Copy to clipboard" });
    // The prompt rewrite copy button is the second one inside the modal.
    await act(async () => {
      fireEvent.click(copyBtns[1]);
    });

    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      PREVIOUS_REPORT.rewrittenPrompts[0].rewritten,
    );
  });

  it("pressing an action plan copy button calls Clipboard.setStringAsync with title + description", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));
    const container = await screen.findByTestId("previous-version-content");
    await within(container).findByTestId("prev-action-0");

    const copyBtns = within(container).getAllByRole("button", { name: "Copy to clipboard" });
    // The action plan copy button is the third one inside the modal.
    await act(async () => {
      fireEvent.click(copyBtns[2]);
    });

    const expected = `${PREVIOUS_REPORT.actionPlan[0].title}: ${PREVIOUS_REPORT.actionPlan[0].description}`;
    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(expected);
  });

  it("copy button shows 'Copied' feedback after press", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    fireEvent.click(await screen.findByTestId("button-view-previous-version"));
    const container = await screen.findByTestId("previous-version-content");
    await within(container).findByTestId("text-previous-rewritten-bio");

    const copyBtns = within(container).getAllByRole("button", { name: "Copy to clipboard" });
    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });

    // After pressing, the button text switches to "Copied".
    await waitFor(() => {
      expect(within(container).getAllByText("Copied").length).toBeGreaterThanOrEqual(1);
    });

    // Clipboard was called with the bio text.
    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      PREVIOUS_REPORT.rewrittenBio,
    );
  });

  it("after regeneration the previous-version button becomes visible", async () => {
    // Start with no previous report.
    auditDataRef.current = makeAudit({ withPrevious: false });

    // When the mutation fires, update the shared ref so re-renders see the
    // new audit (with previousReport) — this mirrors how the server sets
    // previousReport on the stored Audit after regeneration.
    generateMutateAsync.mockImplementation(async () => {
      auditDataRef.current = makeAudit({ withPrevious: true });
      return NEW_CURRENT_REPORT;
    });

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    // Report renders but no previousReport yet → button absent.
    await screen.findByTestId("score-ring");
    expect(screen.queryByTestId("button-view-previous-version")).toBeNull();

    // The ring-card regenerate button has accessibilityLabel "Regenerate mini-report"
    // (isStaleEngine is false since engineVersion matches in our mock).
    // In our Pressable mock it becomes aria-label, so getByRole finds it.
    const regenBtn = await screen.findByRole("button", {
      name: "Regenerate mini-report",
    });
    await act(async () => {
      fireEvent.click(regenBtn);
    });

    // After state update + re-render with updated auditDataRef the button appears.
    await waitFor(() => {
      expect(screen.queryByTestId("button-view-previous-version")).toBeTruthy();
    });
  });
});
