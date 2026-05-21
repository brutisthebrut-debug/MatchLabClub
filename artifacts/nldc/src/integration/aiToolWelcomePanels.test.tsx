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

const createInsightMutateAsync = vi.fn(async () => ({ id: 1 }));
const analyzeInsightMutateAsync = vi.fn(async () => ({
  communicationPatterns: [],
  attachmentStyle: "Secure",
  strengths: ["Good listening"],
  growthAreas: ["Ask for dates sooner"],
  datingProfileTips: ["Be specific"],
  summary: "Overall strong communicator.",
}));

const createSessionMutateAsync = vi.fn(async () => ({ id: 1 }));
const coachMessageMutateAsync = vi.fn(async () => ({
  analysis: "Good conversation so far.",
  suggestedReplies: [
    { style: "Playful", text: "Test reply", rationale: "Test reason" },
    { style: "Direct", text: "Direct test", rationale: "Direct reason" },
    { style: "Warm", text: "Warm test", rationale: "Warm reason" },
  ],
  tone: "Warm",
  redFlags: [],
  coachTip: "You're doing great.",
}));

vi.mock("@workspace/api-client-react", () => ({
  useEnhanceAi: () => ({ mutateAsync: enhanceMutateAsync, isPending: false }),
  useCreateAudit: () => ({ mutateAsync: createAuditMutateAsync, isPending: false }),
  useGenerateAuditReport: () => ({ mutateAsync: generateReportMutateAsync, isPending: false }),
  useListAudits: () => ({ data: [], isLoading: false }),
  getListAuditsQueryKey: () => ["list-audits"],
  useGetAiFallbackRate: () => ({ data: null, isLoading: false }),
  getGetAiFallbackRateQueryKey: () => ["ai-fallback-rate"],
  // Insights
  useListInsights: () => ({ data: [], isLoading: false }),
  useCreateInsight: () => ({ mutateAsync: createInsightMutateAsync, isPending: false }),
  useAnalyzeInsight: () => ({ mutateAsync: analyzeInsightMutateAsync, isPending: false }),
  useGetInsightsRollup: () => ({ data: null }),
  useDeleteInsight: () => ({ mutate: vi.fn(), isPending: false }),
  getListInsightsQueryKey: () => ["list-insights"],
  getGetInsightsRollupQueryKey: () => ["insights-rollup"],
  // Coach / Lab sessions
  useListMessageCoachingSessions: () => ({ data: [], isLoading: false }),
  useCreateMessageCoachingSession: () => ({ mutateAsync: createSessionMutateAsync, isPending: false }),
  useCoachMessage: () => ({ mutateAsync: coachMessageMutateAsync, isPending: false }),
  getListMessageCoachingSessionsQueryKey: () => ["list-coaching-sessions"],
  useGetCoachFollowUpStats: () => ({ data: null }),
  getGetCoachFollowUpStatsQueryKey: () => ["coach-followup-stats"],
  useGetCoachFollowUpTimeline: () => ({ data: null }),
  getGetCoachFollowUpTimelineQueryKey: () => ["coach-followup-timeline"],
  useRecordCoachFollowUp: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExtractMessageScreenshot: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn(() => ({ dismiss: vi.fn() })) }),
}));

vi.mock("@/lib/coachPrefs", () => ({
  useCoachNudgePrefs: () => [{}, vi.fn()],
  buildWebSnoozeChips: () => [],
  buildTonightHourOptions: () => [],
  buildTomorrowMorningHourOptions: () => [],
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
import CompatibilityCompass from "@/pages/CompatibilityCompass";
import Archetype from "@/pages/Archetype";
import Insights from "@/pages/Insights";
import Lab from "@/pages/Lab";
import Coach from "@/pages/Coach";
import Reflection from "@/pages/Reflection";
import StyleMap from "@/pages/StyleMap";
import MirrorProfile from "@/pages/MirrorProfile";
import GlowUp from "@/pages/GlowUp";

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
  createInsightMutateAsync.mockClear();
  analyzeInsightMutateAsync.mockClear();
  createSessionMutateAsync.mockClear();
  coachMessageMutateAsync.mockClear();
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
    // Second welcome panel on the same SignalCheck page — uses the WelcomePanel
    // component with testId="signalcheck-empty-state" (distinct from the
    // inline panel "signal-check-empty-state" covered above). Both are gated
    // by the same isBrandNewUser condition, so runTool is identical.
    name: "Signal Check (WelcomePanel variant)",
    Page: SignalCheck,
    emptyStateTestId: "signalcheck-empty-state",
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
  // -----------------------------------------------------------------------
  // Newly covered pages
  // -----------------------------------------------------------------------
  {
    name: "Compatibility Compass",
    Page: CompatibilityCompass,
    emptyStateTestId: "compass-empty-state",
    // Anonymous users see the demo compass result.
    anonymousDemoMatcher: /Example output — select your style above to get yours/i,
    runTool: async () => {
      // Select the first style pill ("Spark Chaser — …")
      const stylePills = screen.getAllByRole("button", { name: /Spark Chaser/i });
      fireEvent.click(stylePills[0]!);
      const button = screen.getByRole("button", { name: /Find My Compass/i });
      fireEvent.click(button);
      // The mocked enhance returns isFallback:true, which falls back to the
      // deterministic analyzeCompass output and sets result.
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Dating Archetype",
    Page: Archetype,
    emptyStateTestId: "archetype-empty-state",
    // Anonymous users see the quiz form. Use the submit button text which is
    // always rendered (disabled until all answers filled, but still present).
    anonymousDemoMatcher: /Reveal My Archetype/i,
    runTool: async () => {
      // Answer all 6 questions by clicking one option per question.
      // Q1: "When you first meet someone..."
      fireEvent.click(screen.getByRole("button", { name: /Feel excited and lean in quickly/i }));
      // Q2: "When someone you like pulls back..."
      fireEvent.click(screen.getByRole("button", { name: /Feel anxious and reach out to check in/i }));
      // Q3: "What you value most in early dating..."
      fireEvent.click(screen.getByRole("button", { name: /The electric spark — you'll know it when you feel it/i }));
      // Q4: "Your biggest challenge in dating..."
      fireEvent.click(screen.getByRole("button", { name: /You fall fast and it doesn't usually work out/i }));
      // Q5: "After a great first date..."
      fireEvent.click(screen.getByRole("button", { name: /Text them that night or early the next morning/i }));
      // Q6: "In a relationship that's going well..."
      fireEvent.click(screen.getByRole("button", { name: /Dive deep — you're all in once you decide/i }));

      const submitBtn = screen.getByRole("button", { name: /Reveal My Archetype/i });
      fireEvent.click(submitBtn);
      // computeArchetype runs synchronously — result is set immediately.
    },
  },
  {
    name: "Email Insights",
    Page: Insights,
    emptyStateTestId: "insights-empty-state",
    // Anonymous users see the demo analysis results with the "Example analysis
    // output" heading (shown when analysis === null and !isAuthenticated).
    anonymousDemoMatcher: /Example analysis output/i,
    runTool: async () => {
      const contentArea = screen.getByTestId("textarea-message-history");
      fireEvent.change(contentArea, {
        target: { value: "Me: Hey! Love that you mentioned the Japan trip.\nAlex: Oh amazing! I did Tokyo." },
      });
      // Tick the consent checkbox
      const consentLabel = screen.getByTestId("checkbox-consent");
      fireEvent.click(consentLabel);
      const analyzeBtn = screen.getByTestId("button-analyze-insights");
      fireEvent.click(analyzeBtn);
      await waitFor(() => {
        expect(createInsightMutateAsync).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(analyzeInsightMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Chemistry Lab",
    Page: Lab,
    emptyStateTestId: "lab-empty-state",
    // Anonymous users see the demo lab results.
    anonymousDemoMatcher: /Example output — paste your message above to get yours/i,
    runTool: async () => {
      const msgArea = screen.getByTestId("textarea-lab-message");
      fireEvent.change(msgArea, {
        target: { value: "Alex: I love that little ramen place on 5th\nMe: I've been meaning to try it" },
      });
      const runBtn = screen.getByTestId("button-run-lab");
      fireEvent.click(runBtn);
      await waitFor(() => {
        expect(createSessionMutateAsync).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(coachMessageMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Message Coach",
    Page: Coach,
    emptyStateTestId: "coach-empty-state",
    // Anonymous users see the demo coaching banner.
    anonymousDemoMatcher: /Example coaching output — fill in the form above to get yours/i,
    runTool: async () => {
      const lastMsgInput = screen.getByTestId("input-last-message");
      fireEvent.change(lastMsgInput, {
        target: { value: "Not yet but I've been meaning to" },
      });
      const coachBtn = screen.getByTestId("button-get-coaching");
      fireEvent.click(coachBtn);
      await waitFor(() => {
        expect(createSessionMutateAsync).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(coachMessageMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Post-Meeting Reflection",
    Page: Reflection,
    emptyStateTestId: "reflection-empty-state",
    // Anonymous users see the demo reflection results.
    anonymousDemoMatcher: /Example output — complete the form above to get yours/i,
    runTool: async () => {
      // Click one chip in each required group: before, during, mutual, afterward.
      // FELT_BEFORE[0] = "Excited / hopeful"
      fireEvent.click(screen.getByRole("button", { name: /Excited \/ hopeful/i }));
      // DURING_FEEL[0] = "Like myself — relaxed and real"
      fireEvent.click(screen.getByRole("button", { name: /Like myself — relaxed and real/i }));
      // MUTUAL_FEEL[0] = "Yes — effort and interest felt balanced"
      fireEvent.click(screen.getByRole("button", { name: /Yes — effort and interest felt balanced/i }));
      // AFTERWARD[0] = "They reached out"
      fireEvent.click(screen.getByRole("button", { name: /They reached out/i }));

      const submitBtn = screen.getByRole("button", { name: /Get My Reflection/i });
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Style Map",
    Page: StyleMap,
    emptyStateTestId: "stylemap-empty-state",
    // Anonymous users see the demo style map results.
    anonymousDemoMatcher: /Example output — paste your messages above to get yours/i,
    runTool: async () => {
      const conv = screen.getByPlaceholderText(/Paste the conversation thread here/i);
      fireEvent.change(conv, {
        target: { value: "Me: Hey! Love your profile.\nAlex: Thanks! I love hiking too.\nMe: Nice, me too! Where do you usually go?" },
      });
      const button = screen.getByRole("button", { name: /Map My Style/i });
      fireEvent.click(button);
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Mirror Profile",
    Page: MirrorProfile,
    emptyStateTestId: "mirror-empty-state",
    // Anonymous users see the demo mirror results.
    anonymousDemoMatcher: /Example output — paste your bio above to get yours/i,
    runTool: async () => {
      const bioArea = screen.getByPlaceholderText(/Paste your current dating profile bio/i);
      fireEvent.change(bioArea, {
        target: { value: "I'm someone who loves honest conversations and long walks. Looking for something real." },
      });
      const button = screen.getByRole("button", { name: /Show Me My Mirror/i });
      fireEvent.click(button);
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
    },
  },
  {
    name: "Glow Up",
    Page: GlowUp,
    emptyStateTestId: "glowup-empty-state",
    // Anonymous users see the demo glow-up rewrites.
    anonymousDemoMatcher: /Example rewrites — paste your bio above to get yours/i,
    runTool: async () => {
      const bioArea = screen.getByPlaceholderText(/Paste your current dating profile bio here/i);
      fireEvent.change(bioArea, {
        target: { value: "I like hiking, coffee, and honest conversations. Looking for someone real." },
      });
      const button = screen.getByRole("button", { name: /Glow Up My Profile/i });
      fireEvent.click(button);
      await waitFor(() => {
        expect(enhanceMutateAsync).toHaveBeenCalled();
      });
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
