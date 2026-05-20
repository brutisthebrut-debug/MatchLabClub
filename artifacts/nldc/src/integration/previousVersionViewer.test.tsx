import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
  within,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Shared mutable state that the per-test setup can override.
// Using plain mutable objects lets vi.mock factories close over them and
// return updated values on every re-render without replacing the whole mock.
// ---------------------------------------------------------------------------

const auditDataRef: {
  current: Record<string, unknown> | null;
  isLoading: boolean;
} = { current: null, isLoading: false };

const generateReportMock = {
  mutateAsync: vi.fn(async () => NEW_CURRENT_REPORT),
  isPending: false,
};

// ---------------------------------------------------------------------------
// Module-level mocks — must be registered before the page is imported.
// ---------------------------------------------------------------------------

vi.mock("wouter", () => ({
  useParams: () => ({ id: "42" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetAudit: () => ({ data: auditDataRef.current, isLoading: auditDataRef.isLoading }),
  useGenerateAuditReport: () => generateReportMock,
  useGetEngineMeta: () => ({ data: { engineVersion: "v1" } }),
  useListAuditReportVersions: () => ({
    data: { versions: [{ id: 1, readinessScore: 72, generatedAt: new Date().toISOString(), report: NEW_CURRENT_REPORT }] },
  }),
  useCorrectAuditSourceApp: () => ({ mutate: vi.fn(), isPending: false }),
  getGetAuditQueryKey: (id: number) => ["audit", id],
  getListAuditReportVersionsQueryKey: (id: number) => ["audit-versions", id],
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useMeta", () => ({
  useMeta: () => {},
}));

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }),
}));

// framer-motion: disable animations so waitFor doesn't race with CSS transitions
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          React.createElement(tag, rest, children),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Import the page AFTER mocks are registered.
import Report from "@/pages/Report";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const PREVIOUS_REPORT = {
  auditId: 42,
  readinessScore: 55,
  overallGrade: "C",
  strengths: ["Previous strength A", "Previous strength B"],
  risks: ["Previous risk A"],
  bioAudit: "Previous bio audit text here.",
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
  strengths: ["Current strength A", "Current strength B"],
  risks: ["Current risk A"],
  bioAudit: "Current bio audit text.",
  rewrittenBio: "CURRENT_REWRITTEN_BIO: the latest bio.",
  rewrittenPrompts: [],
  photoGuidance: [],
  actionPlan: [],
  messagingStyle: "Current messaging style.",
  coachingCta: "Current CTA.",
  engineVersion: "v1",
};

const RICH_CURRENT_REPORT = {
  ...NEW_CURRENT_REPORT,
  rewrittenPrompts: [
    {
      original: "The way to win me over is...",
      rewritten: "CURRENT_PROMPT_REWRITE_0: latest prompt rewrite.",
      tip: "A current tip.",
    },
  ],
  actionPlan: [
    {
      priority: 1,
      title: "CURRENT_ACTION_TITLE_0",
      description: "Current action description.",
      timeframe: "This week",
    },
  ],
};

const TWO_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

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
  };
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;
let clipboardWriteSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auditDataRef.current = null;
  auditDataRef.isLoading = false;
  generateReportMock.mutateAsync.mockReset();
  generateReportMock.mutateAsync.mockResolvedValue(NEW_CURRENT_REPORT);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  // JSDOM doesn't implement navigator.clipboard — stub it out.
  clipboardWriteSpy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWriteSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Previous-version viewer — web Report page", () => {
  it("shows the 'View previous version' button once the audit has a previousReport", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-view-previous-version");
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/view previous version/i);
  });

  it("does NOT show the button when the audit has no previousReport", async () => {
    auditDataRef.current = makeAudit({ withPrevious: false });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    // Wait for the report content to be present first.
    await screen.findByTestId("card-report-header");

    expect(screen.queryByTestId("button-view-previous-version")).toBeNull();
  });

  it("opens the previous-version dialog with score, bio rewrite, prompts and action plan", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-view-previous-version");
    fireEvent.click(btn);

    // Dialog container should be present.
    const dialog = await screen.findByTestId("dialog-previous-version");
    expect(dialog).toBeTruthy();

    // Previous-version content section.
    const content = within(dialog).getByTestId("previous-version-content");
    expect(content).toBeTruthy();

    // Previous rewritten bio.
    const prevBio = within(dialog).getByTestId("text-previous-rewritten-bio");
    expect(prevBio.textContent).toContain("PREVIOUS_REWRITTEN_BIO");

    // Prompt rewrite (index 0).
    const prompt0 = within(dialog).getByTestId("prev-prompt-0");
    expect(prompt0.textContent).toContain("PREVIOUS_PROMPT_REWRITE_0");

    // Action plan item (index 0).
    const action0 = within(dialog).getByTestId("prev-action-0");
    expect(action0.textContent).toContain("PREVIOUS_ACTION_TITLE_0");

    // The generated-at description should mention the date of the previous report.
    const generatedAt = within(dialog).getByTestId("text-previous-version-generated-at");
    expect(generatedAt.textContent).toMatch(/generated/i);
  });

  it("previous score ring renders inside the dialog", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const btn = await screen.findByTestId("button-view-previous-version");
    fireEvent.click(btn);

    const dialog = await screen.findByTestId("dialog-previous-version");

    // The PreviousReportView renders a ScoreRing whose inner span shows the score.
    const scoreNumbers = within(dialog).getAllByTestId("report-score-number");
    const scores = scoreNumbers.map((el) => Number(el.textContent));
    expect(scores).toContain(PREVIOUS_REPORT.readinessScore);
  });

  it("dismissing the dialog (Close button) hides the previous-version content", async () => {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const openBtn = await screen.findByTestId("button-view-previous-version");
    fireEvent.click(openBtn);

    await screen.findByTestId("dialog-previous-version");

    // The built-in shadcn Close button has an sr-only "Close" label.
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("dialog-previous-version")).toBeNull();
    });
  });

  it("after regeneration the previous-version button becomes visible", async () => {
    // Start: audit has a report but NO previousReport (first-time user).
    auditDataRef.current = makeAudit({ withPrevious: false });

    // The regenerate mutation will update the shared ref so the next render
    // (triggered by setReport / setRegenerating state updates) returns an
    // audit with previousReport set.
    generateReportMock.mutateAsync.mockImplementation(async () => {
      auditDataRef.current = makeAudit({ withPrevious: true });
      return NEW_CURRENT_REPORT;
    });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    // Wait for the report header to appear (report state populated from storedReport).
    await screen.findByTestId("card-report-header");

    // Before regeneration: button must NOT be present.
    expect(screen.queryByTestId("button-view-previous-version")).toBeNull();

    // Click the regenerate button.
    const regenBtn = await screen.findByTestId("button-regenerate-report");
    await act(async () => {
      fireEvent.click(regenBtn);
    });

    // After regeneration and re-render with updated audit data the button appears.
    await waitFor(() => {
      expect(screen.queryByTestId("button-view-previous-version")).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Copy button tests
  // -------------------------------------------------------------------------

  async function openPreviousVersionDialog() {
    auditDataRef.current = makeAudit({ withPrevious: true });

    render(
      <Wrap>
        <Report />
      </Wrap>,
    );

    const openBtn = await screen.findByTestId("button-view-previous-version");
    fireEvent.click(openBtn);

    return screen.findByTestId("dialog-previous-version");
  }

  it("clicking the bio rewrite copy button shows 'Copied' feedback", async () => {
    const dialog = await openPreviousVersionDialog();

    // The bio copy button lives in the "previous rewritten bio" section,
    // which is the first copy button inside the dialog.
    const copyBtns = within(dialog).getAllByTestId("button-copy-text");
    const bioCopyBtn = copyBtns[0];

    expect(bioCopyBtn.textContent).toMatch(/copy/i);

    fireEvent.click(bioCopyBtn);

    // Feedback should switch to "Copied".
    await waitFor(() => {
      expect(bioCopyBtn.textContent).toMatch(/copied/i);
    });

    // Clipboard should have been called with the previous bio text.
    expect(clipboardWriteSpy).toHaveBeenCalledWith(PREVIOUS_REPORT.rewrittenBio);
  });

  it("clicking a prompt rewrite copy button shows 'Copied' feedback", async () => {
    const dialog = await openPreviousVersionDialog();

    // Scope to the first prompt card so we grab its copy button specifically.
    const promptCard = within(dialog).getByTestId("prev-prompt-0");
    const promptCopyBtn = within(promptCard).getByTestId("button-copy-text");

    expect(promptCopyBtn.textContent).toMatch(/copy/i);

    fireEvent.click(promptCopyBtn);

    await waitFor(() => {
      expect(promptCopyBtn.textContent).toMatch(/copied/i);
    });

    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      PREVIOUS_REPORT.rewrittenPrompts[0].rewritten,
    );
  });

  it("clicking an action-plan copy button shows 'Copied' feedback", async () => {
    const dialog = await openPreviousVersionDialog();

    // Scope to the first action-plan card.
    const actionCard = within(dialog).getByTestId("prev-action-0");
    const actionCopyBtn = within(actionCard).getByTestId("button-copy-text");

    expect(actionCopyBtn.textContent).toMatch(/copy/i);

    fireEvent.click(actionCopyBtn);

    await waitFor(() => {
      expect(actionCopyBtn.textContent).toMatch(/copied/i);
    });

    const item = PREVIOUS_REPORT.actionPlan[0];
    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      `${item.title}: ${item.description}`,
    );
  });

  it("all three previous-version copy buttons are present when the dialog opens", async () => {
    const dialog = await openPreviousVersionDialog();

    // 1 bio copy + 1 prompt copy + 1 action copy = 3 total.
    const copyBtns = within(dialog).getAllByTestId("button-copy-text");
    expect(copyBtns).toHaveLength(3);

    // All should start in the un-copied state.
    for (const btn of copyBtns) {
      expect(btn.textContent).toMatch(/^copy$/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Main report page copy buttons (outside the previous-version dialog)
// ---------------------------------------------------------------------------

describe("Main report page — copy buttons", () => {
  function makeRichAudit() {
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
      report: RICH_CURRENT_REPORT,
      reportGeneratedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      previousReport: null,
      previousReportGeneratedAt: null,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  beforeEach(() => {
    auditDataRef.current = makeRichAudit();
  });

  function renderReport() {
    render(
      <Wrap>
        <Report />
      </Wrap>,
    );
  }

  it("clicking the bio rewrite copy button on the main page shows 'Copied' feedback", async () => {
    renderReport();

    // Wait for the report to load (bio text is rendered).
    const bioText = await screen.findByTestId("text-rewritten-bio");
    expect(bioText.textContent).toContain("CURRENT_REWRITTEN_BIO");

    // The CopyButton for the bio sits in the same parent container as text-rewritten-bio.
    // Since no dialog is open, all button-copy-text elements are on the main page.
    const copyBtns = screen.getAllByTestId("button-copy-text");
    const bioCopyBtn = copyBtns[0];

    expect(bioCopyBtn.textContent).toMatch(/^copy$/i);

    fireEvent.click(bioCopyBtn);

    await waitFor(() => {
      expect(bioCopyBtn.textContent).toMatch(/copied/i);
    });

    expect(clipboardWriteSpy).toHaveBeenCalledWith(RICH_CURRENT_REPORT.rewrittenBio);
  });

  it("clicking a prompt rewrite copy button on the main page shows 'Copied' feedback", async () => {
    renderReport();

    // Wait for the prompt card to appear.
    const promptCard = await screen.findByTestId("card-prompt-rewrite-0");
    const promptCopyBtn = within(promptCard).getByTestId("button-copy-text");

    expect(promptCopyBtn.textContent).toMatch(/^copy$/i);

    fireEvent.click(promptCopyBtn);

    await waitFor(() => {
      expect(promptCopyBtn.textContent).toMatch(/copied/i);
    });

    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      RICH_CURRENT_REPORT.rewrittenPrompts[0].rewritten,
    );
  });

  it("clicking an action-plan copy button on the main page shows 'Copied' feedback", async () => {
    renderReport();

    // Wait for the action card to appear.
    const actionCard = await screen.findByTestId("card-action-item-0");
    const actionCopyBtn = within(actionCard).getByTestId("button-copy-text");

    expect(actionCopyBtn.textContent).toMatch(/^copy$/i);

    fireEvent.click(actionCopyBtn);

    await waitFor(() => {
      expect(actionCopyBtn.textContent).toMatch(/copied/i);
    });

    const item = RICH_CURRENT_REPORT.actionPlan[0];
    expect(clipboardWriteSpy).toHaveBeenCalledWith(
      `${item.title}: ${item.description}`,
    );
  });
});
