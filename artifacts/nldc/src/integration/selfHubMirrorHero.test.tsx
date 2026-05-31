import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MirrorPortrait } from "@workspace/api-client-react";
import { DEMO_PORTRAIT } from "@/lib/mirrorDemo";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// The Mirror portrait hook is the one under test: each test swaps its return
// value to model "portrait loaded" vs "portrait failed/loading".
const mirrorPortraitState: { data: MirrorPortrait | undefined; isLoading: boolean; isError: boolean } = {
  data: undefined,
  isLoading: false,
  isError: false,
};

// A real, signed-in user's portrait — distinct from DEMO_PORTRAIT so the test
// can prove the live data is what renders (and the sample is NOT shown).
const REAL_PORTRAIT: MirrorPortrait = {
  readinessScore: 71,
  stage: "sharp",
  stageLabel: "Warming",
  stageBlurb: "Real signals are stacking up and the picture is sharpening.",
  coveragePercent: 67,
  headline:
    "I can see your steady weekly rhythm and how directly you write. Your real date outcomes are starting to come through too.",
  known: [
    {
      key: "wellness",
      label: "Emotional readiness",
      coverage: 88,
      confidence: 80,
      insight: "Your check-ins read grounded and specific.",
      dimensions: ["self-awareness"],
    },
  ],
  blindSpots: [
    {
      key: "spending",
      label: "Spending rhythm",
      why: "No financial signal is connected yet.",
      actionLabel: "Connect spending",
      href: "/connections",
    },
  ],
  nextSignal: {
    key: "compass",
    label: "Run a Compatibility Compass read",
    detail: "One compass read sharpens how I see your values.",
    href: "/compatibility-compass",
    points: 10,
  },
  outcomeHeadline: "Two real date outcomes logged.",
  totalDates: 2,
  eligible: false,
  threshold: 60,
  engineVersion: "v1",
};

vi.mock("@workspace/api-client-react", () => ({
  useGetAccountSummary: () => ({ data: undefined, isLoading: false }),
  getGetAccountSummaryQueryKey: () => ["account-summary"],
  useListWellnessAnswers: () => ({ data: { answers: [] }, isLoading: false }),
  getListWellnessAnswersQueryKey: () => ["wellness-answers"],
  useListJournalEntries: () => ({ data: { entries: [] }, isLoading: false }),
  getListJournalEntriesQueryKey: () => ["journal-entries"],
  useListPostDateNotes: () => ({ data: { notes: [] }, isLoading: false }),
  getListPostDateNotesQueryKey: () => ["post-date-notes"],
  useGetAiContentConsent: () => ({ data: { granted: false }, isLoading: false }),
  getGetAiContentConsentQueryKey: () => ["ai-content-consent"],
  useSetAiContentConsent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useCreateInstagramPaste: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useGetMatchingState: () => ({
    data: { eligible: false, readiness: { score: 0 }, nextActions: [] },
    isLoading: false,
  }),
  getGetMatchingStateQueryKey: () => ["matching-state"],
  useListInsights: () => ({ data: [], isLoading: false }),
  getListInsightsQueryKey: () => ["list-insights"],
  useListCompassReads: () => ({ data: { reads: [] }, isLoading: false }),
  getListCompassReadsQueryKey: () => ["list-compass-reads"],
  useListImports: () => ({ data: { imports: [] }, isLoading: false }),
  getListImportsQueryKey: () => ["list-imports"],
  useGetDatingWins: () => ({ data: [], isLoading: false }),
  getGetDatingWinsQueryKey: () => ["dating-wins"],
  useGetMirrorPortrait: () => mirrorPortraitState,
  getGetMirrorPortraitQueryKey: () => ["mirror-portrait"],
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useMeta", () => ({ useMeta: () => {} }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn(() => ({ dismiss: vi.fn() })) }),
}));

vi.mock("@/components/echo/ShareButton", () => ({
  ShareButton: () => <div data-testid="share-button-stub" />,
}));

// Signed-in user. SelfHub renders its full dashboard only when authenticated.
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    login: () => {},
    user: { id: "u1", firstName: "Sam" },
  }),
}));

// Import the page AFTER mocks are registered.
import SelfHub from "@/pages/SelfHub";

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  mirrorPortraitState.data = undefined;
  mirrorPortraitState.isLoading = false;
  mirrorPortraitState.isError = false;
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
});

function renderHub() {
  render(
    <QueryClientProvider client={qc}>
      <SelfHub />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SelfHub Mirror hero (/me lead card)", () => {
  it("shows the real portrait for a signed-in user when it loads", () => {
    mirrorPortraitState.data = REAL_PORTRAIT;
    renderHub();

    const hero = screen.getByTestId("card-mirror-hero");

    // Headline is the user's real portrait, not the sample.
    const headline = within(hero).getByTestId("mirror-hero-headline");
    expect(headline.textContent).toBe(REAL_PORTRAIT.headline);
    expect(headline.textContent).not.toBe(DEMO_PORTRAIT.headline);

    // Coverage line reflects the real stage + coverage percent.
    expect(hero.textContent).toContain(REAL_PORTRAIT.stageLabel);
    expect(hero.textContent).toContain(`${REAL_PORTRAIT.coveragePercent}% of you mapped`);

    // The next-signal CTA and the "Open Your Mirror" link both render.
    const nextSignal = within(hero).getByTestId("mirror-hero-next-signal");
    expect(nextSignal.getAttribute("href")).toBe(REAL_PORTRAIT.nextSignal!.href);

    const open = within(hero).getByTestId("mirror-hero-open");
    expect(open.getAttribute("href")).toBe("/your-mirror");
    expect(open.textContent).toMatch(/Open Your Mirror/i);
  });

  it("falls back to the sample portrait when the load fails, without claiming it is the user's real data", () => {
    // Model a failed/empty portrait fetch: no data returned.
    mirrorPortraitState.data = undefined;
    mirrorPortraitState.isError = true;
    renderHub();

    const hero = screen.getByTestId("card-mirror-hero");

    // The sample (DEMO_PORTRAIT) stands in so the lead card is never empty.
    const headline = within(hero).getByTestId("mirror-hero-headline");
    expect(headline.textContent).toBe(DEMO_PORTRAIT.headline);

    // Coverage line still renders, sourced from the sample.
    expect(hero.textContent).toContain(DEMO_PORTRAIT.stageLabel);
    expect(hero.textContent).toContain(`${DEMO_PORTRAIT.coveragePercent}% of you mapped`);

    // The "Open Your Mirror" link is still present so the user can reach the
    // real surface even while the sample stands in.
    const open = within(hero).getByTestId("mirror-hero-open");
    expect(open.getAttribute("href")).toBe("/your-mirror");
    expect(open.textContent).toMatch(/Open Your Mirror/i);
  });
});
