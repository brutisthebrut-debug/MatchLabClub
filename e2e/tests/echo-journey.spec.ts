import { expect, test, type Page, type Route } from "@playwright/test";

const MEMBER = {
  id: "e2e-echo-journey",
  email: "echo-journey@example.com",
  firstName: "Daniel",
  lastName: "Journey",
  profileImageUrl: null,
  role: "member",
};

const NOW = new Date().toISOString();

const MATCHING_STATE = {
  preferences: null,
  poolStatus: "building",
  tier: null,
  readiness: { score: 68, breakdown: {} },
  eligible: true,
  readinessThreshold: 50,
  cityDensity: 12,
  totalPoolCount: 30,
  nextActions: [],
  history: [],
  outcomeInsight: {
    totalDates: 0,
    anotherDate: 0,
    noMore: 0,
    ghosted: 0,
    unsure: 0,
    headline: "No dates logged yet.",
  },
  activityStreak: { current: 1, longest: 1 },
  readinessLearning: null,
};

const CONNECTION = {
  id: "connection-1",
  counterpartUserId: "member-2",
  status: "active",
  closedReason: null,
  closedByYou: false,
  unreadCount: 0,
  createdAt: NOW,
  lastMessageAt: null,
  lastMessagePreview: null,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockJourneyApi(page: Page) {
  let mutualIntroduction = false;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === "/api/auth/user") {
      return json(route, { user: MEMBER });
    }
    if (path === "/api/me/matching/state") {
      return json(route, MATCHING_STATE);
    }
    if (path === "/api/me/matching/proposals") {
      return json(
        route,
        mutualIntroduction
          ? [
              {
                id: "proposal-1",
                userId: MEMBER.id,
                proposedToUserId: "member-2",
                source: "internal",
                status: "mutual_yes",
                compatibilityScore: 86,
                cosmicResonance: null,
                cosmicResonanceNote: null,
                summary: "A considered introduction.",
                createdAt: NOW,
                updatedAt: NOW,
              },
            ]
          : [],
      );
    }
    if (path === "/api/me/companion") {
      return json(route, {
        personaLabel: "Your witty sibling",
        greeting: "Morning.",
        read: "You are clearer than you were yesterday.",
        challenge: "Specific beats impressive.",
        nextMove: null,
        readinessScore: 68,
        threshold: 50,
        eligible: true,
        observations: [],
        commitments: [],
        unreadCount: 0,
        settings: {
          persona: "witty_sibling",
          candor: 2,
          inApp: true,
          email: false,
          sms: false,
        },
      });
    }
    if (path === "/api/me/signal-map") {
      return json(route, {
        densityPercent: 42,
        lanesActive: 6,
        totalLanes: 15,
        lanes: [],
        topBlindSpot: null,
      });
    }
    if (path === "/api/me/journey/summary") {
      return json(route, {
        signalsFed: 2,
        readinessGained: 8,
        toolsCompleted: 1,
      });
    }
    if (path === "/api/me/connections") {
      return json(route, [CONNECTION]);
    }
    if (path === `/api/me/connections/${CONNECTION.id}`) {
      return json(route, CONNECTION);
    }
    if (path === `/api/me/connections/${CONNECTION.id}/messages`) {
      return json(route, []);
    }
    if (path === `/api/me/connections/${CONNECTION.id}/starters`) {
      return json(route, { starters: [] });
    }
    if (
      path === "/api/wellness/answers" &&
      method === "POST"
    ) {
      return json(route, { id: 42 }, 201);
    }
    if (
      path === "/api/wellness/answers/42/permissions" &&
      method === "PATCH"
    ) {
      return json(route, { id: 42 });
    }
    if (path === "/api/mirror/trends") {
      return json(route, {
        hasEnoughData: false,
        totalAudits: 0,
        spanDays: 0,
        repeatedStrengths: [],
        recurringRisks: [],
        scoreDelta: {
          first: null,
          latest: null,
          previous: null,
          delta: 0,
          currentVsPrevious: 0,
          rolling30Delta: 0,
          direction: "flat",
        },
        themeShifts: [],
        engagementWindow: {
          firstAuditAt: null,
          latestAuditAt: null,
          avgGapDays: null,
          mostActiveDay: null,
          daysSinceLatest: null,
          auditsPerMonth: 0,
          dormancyGapCount: 0,
        },
        readinessSignals: [],
        readinessScore: 50,
        scoreHistory: [],
        headlineInsight: "Run your first audit to start seeing patterns.",
        outcomeStreak: {
          positiveStreak: 0,
          latestOutcome: null,
          totalWithOutcome: 0,
        },
        journalingStreak: {
          currentStreakDays: 0,
          daysInLast14: 0,
          totalEntries: 0,
        },
        moodTrend: {
          recentCount: 0,
          averageMood: null,
          direction: "unknown",
        },
        engineVersion: "e2e-fixture",
      });
    }
    if (path.startsWith("/api/mirror/journal")) {
      return json(route, { entries: [] });
    }
    if (path.startsWith("/api/mirror/dates")) {
      return json(route, { notes: [] });
    }

    // The journey cards are deliberately resilient to supporting-data failures.
    // Returning an honest error for unneeded surfaces keeps this acceptance test
    // focused on the chapter contract instead of reproducing every API fixture.
    return json(route, { error: "Not needed in Echo Journey replay" }, 503);
  });

  return {
    makeIntroductionMutual() {
      mutualIntroduction = true;
    },
  };
}

test("seeded member can move through all eight Echo Journey chapters", async ({
  page,
}) => {
  const api = await mockJourneyApi(page);

  await page.addInitScript(() => {
    localStorage.setItem("matchlab.onboarded", "1");
    localStorage.setItem("matchlab.arrival.pending", "1");
  });
  await page.goto("/today");

  await expect(page.getByText("Chapter 1 of 8 · Arrive")).toBeVisible();
  await page.getByTestId("today-first-read").click();
  await expect(page.getByTestId("first-read-handoff")).toBeVisible();
  await expect(page.getByText("Chapter 2 of 8 · First read")).toBeVisible();

  await page
    .getByRole("link", { name: "Give me one quick instinct" })
    .click();
  await expect(page.getByTestId("journey-play")).toBeVisible();
  await expect(page.getByText("Chapter 3 of 8 · Play")).toBeVisible();
  await page.getByTestId("journey-play-start").click();

  for (let question = 0; question < 8; question += 1) {
    await page.getByTestId("journey-play-option-0").click();
    await page.getByTestId("journey-play-next").click();
  }

  await expect(page.getByTestId("journey-play-result")).toBeVisible();
  await page.getByTestId("journey-play-confirm").click();

  await expect(page.getByTestId("play-confirmation")).toBeVisible();
  await expect(page.getByText("Chapter 4 of 8 · Confirm")).toBeVisible();
  await page.getByTestId("play-confirmation-matching").check();
  await page.getByTestId("play-confirmation-keep").click();
  await expect(page.getByTestId("play-confirmation-next")).toBeVisible();
  await page.getByTestId("play-confirmation-next").click();

  await expect(page.getByTestId("journey-waiting")).toBeVisible();
  await expect(page.getByText("Chapter 5 of 8 · Waiting")).toBeVisible();

  api.makeIntroductionMutual();
  await page.reload();
  await expect(page.getByTestId("journey-introduction-ready")).toBeVisible();
  await expect(page.getByText("Chapter 6 of 8 · Introduction")).toBeVisible();
  await page.getByTestId("journey-introduction-open").click();

  await expect(page.getByTestId("matches-introduction-handoff")).toBeVisible();
  await page.getByTestId("matches-introduction-open").click();
  await expect(page.getByTestId("journey-date")).toBeVisible();
  await expect(page.getByText("Chapter 7 of 8 · Date")).toBeVisible();
  await page.getByTestId("journey-date-reflect").click();

  await expect(page.getByTestId("journey-reflect")).toBeVisible();
  await expect(page.getByText("Chapter 8 of 8 · Reflect")).toBeVisible();

  await page.getByRole("button", { name: "Excited / hopeful" }).click();
  await page
    .getByRole("button", { name: "Like myself, relaxed and real" })
    .click();
  await page
    .getByRole("button", {
      name: "Yes, effort and interest felt balanced",
    })
    .click();
  await page.getByRole("button", { name: "We both did" }).click();
  await page.getByRole("button", { name: "Get My Reflection" }).click();

  await expect(page.getByTestId("journey-reflect-complete")).toBeVisible();
  await page.getByTestId("journey-reflect-finish").click();
  await expect(page).toHaveURL(/\/progress\/timeline$/);
});
