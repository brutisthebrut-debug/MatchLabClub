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

// ---------------------------------------------------------------------------
// React Native and environment mocks.
// ---------------------------------------------------------------------------

vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(async (_text: string) => {}),
}));

// CopyButton imports expo-haptics, which loads expo-modules-core and trips
// over jsdom-incompatible internals (TurboModuleRegistry / EventEmitter).
// Stub expo-haptics; the CopyButton itself still renders for real so the
// copy-to-clipboard behavior under test is exercised.
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => {}),
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
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
  Feather: ({
    name,
    size: _s,
    color: _c,
    style: _st,
  }: {
    name: string;
    size?: number;
    color?: string;
    style?: unknown;
  }) => <span data-testid={`icon-${name}`} />,
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
      opts?.mutation?.onSuccess?.();
      return CURRENT_REPORT;
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
          report: CURRENT_REPORT,
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

import * as Clipboard from "expo-clipboard";
import AuditDetailScreen from "@/app/audit/[id]";

// ---------------------------------------------------------------------------
// Fixture data — current report with all sections populated.
// ---------------------------------------------------------------------------

const CURRENT_REPORT = {
  auditId: 42,
  readinessScore: 72,
  overallGrade: "B",
  strengths: ["Current strength A"],
  risks: ["Current risk A"],
  bioAudit: "Current bio audit text.",
  rewrittenBio: "CURRENT_REWRITTEN_BIO: the latest and greatest bio.",
  rewrittenPrompts: [
    {
      original: "The way to win me over is...",
      rewritten: "CURRENT_PROMPT_REWRITE_0: remembering the weird specific thing.",
      tip: "Specificity beats sincerity.",
    },
  ],
  photoGuidance: [],
  actionPlan: [
    {
      priority: 1,
      title: "CURRENT_ACTION_TITLE_0",
      description: "CURRENT_ACTION_DESC_0: rewrite your opening line today.",
      timeframe: "Today",
    },
  ],
  messagingStyle: "Current messaging style.",
  coachingCta: "Current CTA.",
  engineVersion: "v1",
};

function makeAudit() {
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
    report: CURRENT_REPORT,
    reportGeneratedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    previousReport: null,
    previousReportGeneratedAt: null,
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
  vi.mocked(Clipboard.setStringAsync).mockClear();
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
// Tests — current report copy buttons (bio, prompt rewrite, action plan)
// ---------------------------------------------------------------------------

describe("Current report — copy buttons (mobile)", () => {
  it("renders the rewritten bio on the main screen", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const bioText = await screen.findByTestId("text-rewritten-bio");
    expect(bioText.textContent).toContain("CURRENT_REWRITTEN_BIO");
  });

  it("pressing the rewritten bio copy button calls Clipboard.setStringAsync with the bio text", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    // Wait for the report to render.
    await screen.findByTestId("text-rewritten-bio");

    // The bio copy button is a Pressable with accessibilityLabel "Copy to clipboard"
    // rendered in the Section headerRight — no modal open, so the first such
    // button on the main screen is the bio copy button.
    const copyBtns = screen.getAllByRole("button", { name: "Copy to clipboard" });
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });

    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      CURRENT_REPORT.rewrittenBio,
    );
  });

  it("pressing the rewritten bio copy button shows 'Copied' feedback", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    await screen.findByTestId("text-rewritten-bio");

    const copyBtns = screen.getAllByRole("button", { name: "Copy to clipboard" });

    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Copied").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("pressing a prompt rewrite copy button calls Clipboard.setStringAsync with the rewritten text", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const promptCard = await screen.findByTestId("card-prompt-rewrite-0");
    const copyBtn = within(promptCard).getByRole("button", {
      name: "Copy to clipboard",
    });

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      CURRENT_REPORT.rewrittenPrompts[0].rewritten,
    );
  });

  it("pressing a prompt rewrite copy button shows 'Copied' feedback", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const promptCard = await screen.findByTestId("card-prompt-rewrite-0");
    const copyBtn = within(promptCard).getByRole("button", {
      name: "Copy to clipboard",
    });

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await waitFor(() => {
      expect(within(promptCard).getAllByText("Copied").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("pressing an action plan copy button calls Clipboard.setStringAsync with title + description", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const actionCard = await screen.findByTestId("card-action-item-0");
    const copyBtn = within(actionCard).getByRole("button", {
      name: "Copy to clipboard",
    });

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    const item = CURRENT_REPORT.actionPlan[0];
    expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
      `${item.title}: ${item.description}`,
    );
  });

  it("pressing an action plan copy button shows 'Copied' feedback", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    const actionCard = await screen.findByTestId("card-action-item-0");
    const copyBtn = within(actionCard).getByRole("button", {
      name: "Copy to clipboard",
    });

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await waitFor(() => {
      expect(within(actionCard).getAllByText("Copied").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("all three current-report copy buttons are present (bio, prompt, action plan)", async () => {
    auditDataRef.current = makeAudit();

    render(
      <Wrap>
        <AuditDetailScreen />
      </Wrap>,
    );

    await screen.findByTestId("text-rewritten-bio");

    // No modal is open — all Copy buttons belong to the current report view.
    const copyBtns = screen.getAllByRole("button", { name: "Copy to clipboard" });
    // 1 bio + 1 prompt + 1 action plan = 3 minimum
    expect(copyBtns.length).toBeGreaterThanOrEqual(3);
  });
});
