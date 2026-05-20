import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const enhanceMutateAsync = vi.fn(async () => ({
  mode: "fallback" as const,
  isFallback: true,
  output: "",
  durationMs: 1,
  validated: false,
}));

const createAuditMutateAsync = vi.fn(async () => ({ id: 1 }));
const generateReportMutateAsync = vi.fn(async () => ({
  readinessScore: 70,
  risks: ["A test risk to surface."],
  rewrittenBio: "A rewritten test bio. With two sentences.",
}));

vi.mock("@workspace/api-client-react", () => ({
  useEnhanceAi: () => ({ mutateAsync: enhanceMutateAsync, isPending: false }),
  useCreateAudit: () => ({ mutateAsync: createAuditMutateAsync, isPending: false }),
  useGenerateAuditReport: () => ({ mutateAsync: generateReportMutateAsync, isPending: false }),
  getListAuditsQueryKey: () => ["list-audits"],
  useGetAiFallbackRate: () => ({ data: null, isLoading: false }),
  getGetAiFallbackRateQueryKey: () => ["ai-fallback-rate"],
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Stub AnimatePresence so that mode="wait" doesn't block children from
// mounting while exit animations are pending (those never complete in jsdom).
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/lib/anonymousIds", () => ({
  rememberAnonymousId: () => {},
}));

vi.mock("@/lib/apiClient", () => ({
  captureLead: vi.fn(async () => ({})),
}));

// Auth mock is mutated per test to switch between anonymous / authenticated.
const authState: { isAuthenticated: boolean } = { isAuthenticated: false };
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isLoading: false,
    user: authState.isAuthenticated ? { id: "u1" } : null,
  }),
}));

// Import pages AFTER mocks are registered.
import ProfileReader from "@/pages/ProfileReader";
import NextMessage from "@/pages/NextMessage";
import PatternBreaker from "@/pages/PatternBreaker";
import SignalCheck from "@/pages/SignalCheck";
import Blueprint from "@/pages/Blueprint";
import DatingWinsLog from "@/pages/DatingWinsLog";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  authState.isAuthenticated = false;
  enhanceMutateAsync.mockClear();
  createAuditMutateAsync.mockClear();
  generateReportMutateAsync.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Per-tool drivers — describe how to detect anonymous demo content, and
// how to "run" the tool so the empty state should disappear.
// ---------------------------------------------------------------------------

interface Driver {
  name: string;
  Page: React.ComponentType;
  emptyStateTestId: string;
  // Text that is visible to anonymous users via demo content.
  anonymousDemoMatcher: RegExp;
  // Drive the tool to clear the empty state for an authenticated user.
  runTool: () => Promise<void> | void;
}

const drivers: Driver[] = [
  {
    name: "Profile Reader",
    Page: ProfileReader,
    emptyStateTestId: "profile-reader-empty-state",
    anonymousDemoMatcher: /Example output — paste a profile above/i,
    runTool: async () => {
      const textarea = screen.getByPlaceholderText(/Paste their bio/i);
      fireEvent.change(textarea, {
        target: { value: "I'm curious, kind, and write more than I should." },
      });
      const button = screen.getByRole("button", { name: /Read the Profile/i });
      fireEvent.click(button);
      // ProfileReader uses setTimeout(1000) before populating results.
      await vi.advanceTimersByTimeAsync(1100);
    },
  },
  {
    name: "Next Message",
    Page: NextMessage,
    emptyStateTestId: "next-message-empty-state",
    anonymousDemoMatcher: /Example options — fill in context above/i,
    runTool: async () => {
      const conv = screen.getByPlaceholderText(/Paste the conversation/i);
      fireEvent.change(conv, {
        target: { value: "Alex: hey how was your week?\nMe: pretty good, hiked twice" },
      });
      const button = screen.getByRole("button", { name: /Get My 7 Options/i });
      fireEvent.click(button);
      // The mocked enhance returns a fallback, which sets result to the
      // deterministic local engine output.
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Pattern Breaker",
    Page: PatternBreaker,
    emptyStateTestId: "pattern-breaker-empty-state",
    // Anonymous users still see the action list — assert one of the
    // category labels rendered for the week's actions.
    anonymousDemoMatcher: /Why this works/i,
    runTool: async () => {
      // Find all unchecked Circle buttons (action toggles) and click the
      // first one to register a "done" action.
      const buttons = screen.getAllByRole("button");
      // The first toggle button sits at the top of the list; we just need
      // any toggle. They are rendered with the lucide Circle icon and no
      // accessible name. Filter by lack of name and by being a sibling of
      // a "Why this works" disclosure.
      const togglers = buttons.filter(
        (b) => b.textContent === "" || b.textContent === null,
      );
      expect(togglers.length).toBeGreaterThan(0);
      fireEvent.click(togglers[0]!);
    },
  },
  {
    name: "Signal Check",
    Page: SignalCheck,
    emptyStateTestId: "signal-check-empty-state",
    // SignalCheck doesn't display demo result content to anonymous users —
    // it shows the input form. Use the form's hero text as the visible
    // "anonymous" content marker.
    anonymousDemoMatcher: /Your 3-Minute Signal Check/i,
    runTool: async () => {
      const bio = screen.getByTestId("textarea-signal-bio");
      fireEvent.change(bio, {
        target: { value: "I'm a curious, slightly bookish writer who loves long walks." },
      });
      const button = screen.getByTestId("button-run-signal-check");
      fireEvent.click(button);
      await waitFor(() => {
        expect(createAuditMutateAsync).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(generateReportMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    // Gating variant: !result — panel shows for authenticated users who
    // haven't yet run the tool (result is null).
    name: "Blueprint",
    Page: Blueprint,
    emptyStateTestId: "blueprint-empty-state",
    // Anonymous users see the demo blueprint (isDemo = !result = true when
    // result is null). The watermark text below the results is the marker.
    anonymousDemoMatcher: /Example blueprint — fill in the form above to get yours/i,
    runTool: async () => {
      const textarea = screen.getByPlaceholderText(/Be as honest or vague as you like/i);
      fireEvent.change(textarea, {
        target: { value: "I'm curious, empathetic, and tend to think before I speak." },
      });
      const button = screen.getByRole("button", { name: /Build My Blueprint/i });
      fireEvent.click(button);
      // The mocked enhance returns isFallback:true, which falls back to the
      // deterministic local output and sets result — clearing the panel.
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    // Gating variant: isDemo (localStorage-backed) — panel shows for
    // authenticated users whose localStorage has no stored wins.
    name: "Dating Wins Log",
    Page: DatingWinsLog,
    emptyStateTestId: "wins-empty-state",
    // Anonymous users also have isDemo=true (no wins in localStorage) but
    // isBrandNewUser is false because they're not authenticated. They see
    // the demo wins list with its "sample wins" label.
    anonymousDemoMatcher: /Sample wins — your log starts the moment you add one/i,
    runTool: async () => {
      const logBtn = screen.getByRole("button", { name: /Log a win/i });
      fireEvent.click(logBtn);
      // AnimatePresence is mocked to render children synchronously, so the
      // form is immediately in the DOM after the click triggers setShowForm(true).
      const textarea = await screen.findByPlaceholderText(/You hit send/i);
      fireEvent.change(textarea, {
        target: { value: "Sent the message I'd been overthinking for two days." },
      });
      const saveBtn = screen.getByRole("button", { name: /Save win/i });
      fireEvent.click(saveBtn);
    },
  },
];

// ---------------------------------------------------------------------------
// Parameterized tests
// ---------------------------------------------------------------------------

describe("AI tool welcome panels", () => {
  for (const driver of drivers) {
    describe(driver.name, () => {
      it("shows the demo content for anonymous visitors (no welcome panel)", () => {
        authState.isAuthenticated = false;

        render(
          <Wrap>
            <driver.Page />
          </Wrap>,
        );

        expect(screen.queryByTestId(driver.emptyStateTestId)).toBeNull();
        expect(screen.getAllByText(driver.anonymousDemoMatcher).length).toBeGreaterThan(0);
      });

      it("shows the welcome empty-state panel for a brand-new authenticated user", () => {
        authState.isAuthenticated = true;

        render(
          <Wrap>
            <driver.Page />
          </Wrap>,
        );

        expect(screen.getByTestId(driver.emptyStateTestId)).toBeTruthy();
      });

      it("hides the welcome empty-state after the user runs the tool", async () => {
        authState.isAuthenticated = true;

        render(
          <Wrap>
            <driver.Page />
          </Wrap>,
        );

        expect(screen.getByTestId(driver.emptyStateTestId)).toBeTruthy();

        await driver.runTool();

        await waitFor(() => {
          expect(screen.queryByTestId(driver.emptyStateTestId)).toBeNull();
        });
      });
    });
  }
});
