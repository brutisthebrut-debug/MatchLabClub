import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Queue of responses the next mutateAsync() calls will resolve with.
// Each test sets this up before driving the page.
const responseQueue: Array<{
  mode: "live" | "fallback";
  isFallback: boolean;
  output: string;
  validated?: boolean;
  durationMs?: number;
}> = [];

const mutateAsync = vi.fn(async () => {
  if (responseQueue.length === 0) {
    throw new Error("aiFallback test: response queue is empty");
  }
  const next = responseQueue.shift()!;
  return {
    mode: next.mode,
    isFallback: next.isFallback,
    output: next.output,
    durationMs: next.durationMs ?? 1,
    validated: next.validated,
  };
});

vi.mock("@workspace/api-client-react", () => ({
  useEnhanceAi: () => ({
    mutateAsync,
    isPending: false,
  }),
  useGetAiFallbackRate: () => ({ data: null, isLoading: false }),
  getGetAiFallbackRateQueryKey: () => ["ai-fallback-rate"],
  useListAudits: () => ({ data: [], isLoading: false }),
  useListMessageCoachingSessions: () => ({ data: [], isLoading: false }),
  getListAuditsQueryKey: () => ["list-audits"],
  getListMessageCoachingSessionsQueryKey: () => ["list-coaching-sessions"],
  useSaveCompassRead: () => ({
    mutateAsync: vi.fn(async () => ({ id: 1 })),
    isPending: false,
  }),
  useListCompassReads: () => ({ data: { reads: [] }, isLoading: false }),
  getListCompassReadsQueryKey: () => ["list-compass-reads"],
  useGetAiContentConsent: () => ({ data: { consent: false }, isLoading: false }),
  getGetAiContentConsentQueryKey: () => ["ai-content-consent"],
}));

// AppLayout pulls in Navbar/Footer which depend on auth + routing — pass through
// the children so the page renders standalone.
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// useMeta touches document.title; no behavior to test here.
vi.mock("@/hooks/useMeta", () => ({
  useMeta: () => {},
}));

// Auth hook is referenced through other deep imports in some pages.
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }),
}));

// Import pages AFTER mocks are registered.
import Blueprint from "@/pages/Blueprint";
import NextMessage from "@/pages/NextMessage";
import StyleMap from "@/pages/StyleMap";
import Reflection from "@/pages/Reflection";
import MirrorProfile from "@/pages/MirrorProfile";
import GlowUp from "@/pages/GlowUp";
import CompatibilityCompass from "@/pages/CompatibilityCompass";
import ConnectionStyle from "@/pages/ConnectionStyle";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  responseQueue.length = 0;
  mutateAsync.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const FALLBACK_RESPONSE = {
  mode: "fallback" as const,
  isFallback: true,
  output: "",
  validated: false,
};

// ---------------------------------------------------------------------------
// Per-tool drivers — each knows how to fill the page's required inputs,
// where to click submit, and which valid JSON satisfies the page's parser.
// ---------------------------------------------------------------------------

const longSentence = (n: number): string =>
  Array.from({ length: n }, () => "this is a coach-written sentence").join(". ") + ".";

interface ToolDriver {
  name: string;
  Page: React.ComponentType;
  retryTestId: string;
  // Fills inputs needed to enable submit, then returns the submit button.
  drive: () => HTMLElement;
  // Valid JSON string the page's parser will accept (clears the fallback notice).
  validSuccessOutput: string;
}

function clickChipByText(text: string): void {
  const chip = screen.getByRole("button", { name: text });
  fireEvent.click(chip);
}

const drivers: ToolDriver[] = [
  {
    name: "Blueprint",
    Page: Blueprint,
    retryTestId: "button-retry-blueprint",
    drive: () => {
      const textareas = screen.getAllByRole("textbox");
      fireEvent.change(textareas[0]!, {
        target: { value: "I'm a steady, curious person who values depth over speed in connection." },
      });
      return screen.getByRole("button", { name: /Build My Blueprint/i });
    },
    validSuccessOutput: JSON.stringify({
      firstImpression: longSentence(2),
      repeatingPattern: longSentence(2),
      communicationStyle: longSentence(2),
      attractionPattern: longSentence(2),
      comfortNeeds: longSentence(2),
      riskLoop: longSentence(2),
      growthEdge: longSentence(2),
    }),
  },
  {
    name: "NextMessage",
    Page: NextMessage,
    retryTestId: "button-retry-next-message",
    drive: () => {
      const textareas = screen.getAllByRole("textbox");
      // First textarea is "their name" input, but it's an <input> so role=textbox
      // matches both. The conversation context is the <Textarea>; find it by placeholder.
      const conv = screen.getByPlaceholderText(/Paste the conversation/i);
      fireEvent.change(conv, {
        target: { value: "Alex: hey how was your week?\nMe: pretty good, hiked twice" },
      });
      // Avoid unused var warning
      void textareas;
      return screen.getByRole("button", { name: /Get My 7 Options/i });
    },
    validSuccessOutput: JSON.stringify({
      options: [
        { style: "Safe", text: "Sounds great — when works for you?", when: "default" },
        { style: "Warm", text: "Loved that. Coffee this weekend?", when: "default" },
        { style: "Playful", text: "I'm in if you bring the wit.", when: "default" },
      ],
      coachNote: "Pick the one that feels like you.",
    }),
  },
  {
    name: "StyleMap",
    Page: StyleMap,
    retryTestId: "button-retry-stylemap",
    drive: () => {
      const textarea = screen.getByPlaceholderText(/Paste the conversation thread/i);
      fireEvent.change(textarea, {
        target: { value: "Me: hey!\nThem: hi, how's your week?\nMe: pretty solid, you?" },
      });
      return screen.getByRole("button", { name: /Map My Style/i });
    },
    validSuccessOutput: JSON.stringify({
      readout: longSentence(2),
      topStrength: "Your warmth — it lands clearly.",
      growthEdge: "Be more direct about what you want.",
    }),
  },
  {
    name: "Reflection",
    Page: Reflection,
    retryTestId: "button-retry-reflection",
    drive: () => {
      clickChipByText("Excited / hopeful");
      clickChipByText("Like myself — relaxed and real");
      clickChipByText("Yes — effort and interest felt balanced");
      clickChipByText("They reached out");
      return screen.getByRole("button", { name: /Get My Reflection/i });
    },
    validSuccessOutput: JSON.stringify({
      positiveSigns: [
        "They followed up the next day with a specific reference back to the conversation.",
        "Their energy stayed consistent across the whole interaction with no awkward dips.",
      ],
      cautionSigns: [],
      patternShowing: longSentence(3),
      recommendedNextStep: longSentence(3),
      suggestedNote: longSentence(1),
      recommendationNote: longSentence(2),
    }),
  },
  {
    name: "MirrorProfile",
    Page: MirrorProfile,
    retryTestId: "button-retry-mirror",
    drive: () => {
      const bio = screen.getAllByRole("textbox")[0]!;
      fireEvent.change(bio, {
        target: {
          value: "Climber, writer, recovering perfectionist. Looking for someone steady and curious.",
        },
      });
      return screen.getByRole("button", { name: /Show Me My Mirror/i });
    },
    validSuccessOutput: JSON.stringify({
      values: longSentence(2),
      protectiveHabits: longSentence(2),
      signalsShown: longSentence(2),
      understatedQualities: longSentence(2),
      overcompensation: longSentence(2),
      likelyAudienceResponse: longSentence(2),
      missingInformation: longSentence(2),
      emotionalImpression: longSentence(2),
      nextExperiment: longSentence(2),
    }),
  },
  {
    name: "GlowUp",
    Page: GlowUp,
    retryTestId: "button-retry-glowup",
    drive: () => {
      const bio = screen.getByPlaceholderText(/Paste your current dating profile bio here/i);
      fireEvent.change(bio, {
        target: { value: "Writer, climber, big fan of unplanned weekends and small espresso cups." },
      });
      return screen.getByRole("button", { name: /Glow Up My Profile/i });
    },
    validSuccessOutput: JSON.stringify(
      ["serious", "playful", "direct", "queer", "lessgeneric"].map((style) => ({
        style,
        bio: longSentence(2),
        tip: "This version reads as specific.",
      })),
    ),
  },
  {
    name: "CompatibilityCompass",
    Page: CompatibilityCompass,
    retryTestId: "button-retry-compass",
    drive: () => {
      clickChipByText("Slow Burn — I open gradually, invest deeply");
      return screen.getByRole("button", { name: /Find My Compass/i });
    },
    validSuccessOutput: JSON.stringify({
      supportiveTraits: ["Patience with pacing here", "Curiosity over urgency right now"],
      cautionDynamics: ["Partners who escalate too fast and demand immediate clarity."],
      nonNegotiables: ["Honest communication always", "Consistent showing up week to week"],
      commonPull: longSentence(2),
      bestDynamic: longSentence(2),
      falseSpark: longSentence(2),
    }),
  },
  {
    name: "ConnectionStyle",
    Page: ConnectionStyle,
    retryTestId: "button-retry-connection-style",
    drive: () => {
      // Click the first option of each of the 6 quiz questions.
      const firstOptionPerQuestion = [
        "Feel anxious and wonder what you did wrong",
        "Go all-in fast — you feel it and you act on it",
        "Bring it up — you'd rather address it than let it sit",
        "Something I want and move toward",
        "Feel fully present and excited — you're in",
        "It's exhausting — I want to know quickly whether this is real",
      ];
      for (const label of firstOptionPerQuestion) {
        clickChipByText(label);
      }
      return screen.getByRole("button", { name: /See My Style/i });
    },
    validSuccessOutput: JSON.stringify({
      tagline: longSentence(2),
      strengths: ["Steady presence", "Patient warmth", "Clear communication"],
      activationPattern: longSentence(2),
      whatHelps: longSentence(2),
      nextExperiment: longSentence(2),
    }),
  },
];

// ---------------------------------------------------------------------------
// Parameterized contract test
// ---------------------------------------------------------------------------

describe("AI tools render the fallback notice and retry clears it", () => {
  for (const driver of drivers) {
    describe(driver.name, () => {
      it("shows the fallback notice when the server returns a fallback response", async () => {
        responseQueue.push({ ...FALLBACK_RESPONSE });

        render(
          <Wrap>
            <driver.Page />
          </Wrap>,
        );

        const submit = driver.drive();
        expect((submit as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(submit);

        const retry = await screen.findByTestId(driver.retryTestId);
        expect(retry).toBeTruthy();
        expect(retry.textContent).toMatch(/Try again/i);
        expect(mutateAsync).toHaveBeenCalledTimes(1);
      });

      it("clicking Try again fires another request and clears the notice on success", async () => {
        responseQueue.push({ ...FALLBACK_RESPONSE });
        responseQueue.push({
          mode: "live",
          isFallback: false,
          output: driver.validSuccessOutput,
          validated: true,
        });

        render(
          <Wrap>
            <driver.Page />
          </Wrap>,
        );

        const submit = driver.drive();
        fireEvent.click(submit);

        const retry = await screen.findByTestId(driver.retryTestId);
        expect(mutateAsync).toHaveBeenCalledTimes(1);

        fireEvent.click(retry);

        await waitFor(() => {
          expect(mutateAsync).toHaveBeenCalledTimes(2);
        });

        // After a successful, parser-accepted response the notice disappears.
        await waitFor(() => {
          expect(screen.queryByTestId(driver.retryTestId)).toBeNull();
        });
      });
    });
  }
});
