import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  compatibilityReadsTable,
  journalEntriesTable,
  wellnessAnswersTable,
  importedSourcesTable,
  postDateNotesTable,
  datingWinsTable,
  auditsTable,
  messageCoachingSessionsTable,
  lifePulsesTable,
} from "@workspace/db";

/**
 * Development-only test-user seeding.
 *
 * The founder cannot easily walk the real, populated product: the only options
 * are demo-fallback data or a fresh personal login with zero signals. This
 * module provisions two stable test accounts so the founder can preview both
 * ends of the spectrum with real, account-backed data (not demo fallback):
 *
 *   - "new"   , a brand-new account with no signals at all (readiness near 0)
 *   - "power" , an account with realistic signal across every registry lane
 *               (readiness near the top)
 *
 * Seeding is idempotent: every call wipes the account's signal rows first, then
 * re-inserts the target state, so a login always lands the founder on a clean,
 * known state.
 *
 * SECURITY: this file holds no auth bypass on its own , it only writes rows.
 * The test-login that establishes a session from it is hard-gated to
 * development by `isDevEnvironment()` and the conditional route mount. Nothing
 * here ever runs in production.
 */

export type TestUserState = "new" | "power";

export interface TestUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export const DEV_TEST_USERS: Record<TestUserState, TestUserProfile> = {
  new: {
    id: "dev-test-new",
    email: "dev-new@matchlab.test",
    firstName: "Avery",
    lastName: "Newcomer",
  },
  power: {
    id: "dev-test-power",
    email: "dev-power@matchlab.test",
    firstName: "Jordan",
    lastName: "Powers",
  },
};

/**
 * True when the server is running anywhere other than production. The api-server
 * production build sets NODE_ENV=production explicitly (see artifact.toml), so
 * an unset or non-production value always means a development/test context.
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Remove every signal row owned by a seeded test user so re-seeding is clean. */
async function clearTestUserSignals(userId: string): Promise<void> {
  await Promise.all([
    db
      .delete(compatibilityReadsTable)
      .where(eq(compatibilityReadsTable.userId, userId)),
    db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)),
    db.delete(wellnessAnswersTable).where(eq(wellnessAnswersTable.userId, userId)),
    db.delete(importedSourcesTable).where(eq(importedSourcesTable.userId, userId)),
    db.delete(postDateNotesTable).where(eq(postDateNotesTable.userId, userId)),
    db.delete(datingWinsTable).where(eq(datingWinsTable.userId, userId)),
    db.delete(auditsTable).where(eq(auditsTable.userId, userId)),
    db
      .delete(messageCoachingSessionsTable)
      .where(eq(messageCoachingSessionsTable.userId, userId)),
    db.delete(lifePulsesTable).where(eq(lifePulsesTable.userId, userId)),
  ]);
}

async function upsertTestUser(profile: TestUserProfile): Promise<void> {
  await db
    .insert(usersTable)
    .values({
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      // Power user opts into the deep AI lane so the founder can preview the
      // full hybrid experience; the new user stays on the deterministic default.
      aiContentConsentGranted: false,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        updatedAt: new Date(),
      },
    });
}

/** The 18 wellness dimensions, per the wellness_answers schema. */
const WELLNESS_DIMENSIONS = [
  "emotional",
  "physical",
  "social",
  "intellectual",
  "spiritual",
  "occupational",
  "financial",
  "environmental",
  "communication",
  "conflict",
  "boundaries",
  "affection",
  "intimacy",
  "lifestyle",
  "future_vision",
  "values",
] as const;

async function seedPowerSignals(userId: string): Promise<void> {
  // Wellness: 16 of 18 dimensions answered, so coverage reads close to full.
  await db.insert(wellnessAnswersTable).values(
    WELLNESS_DIMENSIONS.map((dimension, i) => ({
      userId,
      questionId: `${dimension}.seed_${i}`,
      dimension,
      category: "seed",
      questionText: `How do you tend to show up around ${dimension.replace("_", " ")}?`,
      answer:
        "I have thought about this a fair amount and I know what I need here, and where I am still growing.",
      consentLevel: "all" as const,
    })),
  );

  // Compass: 5 reads, full coverage for that lane.
  await db.insert(compatibilityReadsTable).values(
    Array.from({ length: 5 }, (_, i) => ({
      userId,
      sourceKind: "paste" as const,
      rawText: `Sample candidate profile number ${i + 1} pasted for a compatibility read.`,
      parsedProfile: { firstName: `Candidate ${i + 1}`, age: 29 + i },
      resultJson: { headline: "Strong on shared values, lighter on pace." },
      overallAlignment: 68 + i * 4,
      mode: "fallback" as const,
    })),
  );

  // Hinge import (binary) and Instagram tone paste (binary) and a calendar
  // paste whose derived event count fills the calendar-rhythm lane.
  await db.insert(importedSourcesTable).values([
    {
      userId,
      source: "hinge",
      status: "ready",
      originalFilename: "hinge-export.zip",
      parsedSummary: {
        counts: { matches: 42, conversations: 18 },
        themes: ["thoughtful openers", "fades when busy"],
      },
      processedAt: new Date(),
    },
    {
      userId,
      source: "instagram-paste",
      status: "ready",
      parsedSummary: { tone: ["warm", "dry humor", "outdoorsy"] },
      processedAt: new Date(),
    },
    {
      userId,
      source: "calendar-ics",
      status: "ready",
      originalFilename: "calendar.ics",
      parsedSummary: { counts: { totalEvents: 12 } },
      processedAt: new Date(),
    },
  ]);

  // Post-date notes: 3 reflected notes with a spread of outcomes so the outcome
  // insight has something real to chew on.
  await db.insert(postDateNotesTable).values([
    {
      userId,
      personLabel: "Coffee on Tuesday",
      platform: "hinge",
      summary: "Easy two hours, lost track of time.",
      whatWentWell: "We both opened up faster than usual and the silences were comfortable.",
      whatDidnt: "I talked over them once when I got excited.",
      outcome: "another_date",
      followUpPlanned: true,
    },
    {
      userId,
      personLabel: "Dinner downtown",
      platform: "bumble",
      summary: "Nice enough, no real spark.",
      whatWentWell: "Good manners, easy logistics, decent conversation.",
      whatDidnt: "Values did not line up on the things that matter to me long term.",
      outcome: "no_more",
      followUpPlanned: false,
    },
    {
      userId,
      personLabel: "Walk in the park",
      platform: "hinge",
      summary: "Fun but they went quiet after.",
      whatWentWell: "Lots of laughing, shared a few real stories.",
      whatDidnt: "I waited too long to suggest a second date.",
      outcome: "ghosted",
      followUpPlanned: false,
    },
  ]);

  // Journal: 10 substantive entries (each well over the 120-char threshold).
  await db.insert(journalEntriesTable).values(
    Array.from({ length: 10 }, (_, i) => ({
      userId,
      prompt: i % 2 === 0 ? "What did I learn about myself this week?" : null,
      body:
        `Entry ${i + 1}: I noticed I get anxious right before sending the first message, ` +
        "and once I actually hit send the worry mostly evaporates. I want to keep practicing " +
        "that so the gap between wanting to reach out and actually doing it gets shorter over time.",
      tags: ["reflection"],
      mood: 3 + (i % 3),
    })),
  );

  // Dating wins: 5 logged wins across a spread of categories.
  const winCategories = [
    "sent-it",
    "great-convo",
    "got-a-date",
    "noticed-something",
    "personal-win",
  ] as const;
  await db.insert(datingWinsTable).values(
    winCategories.map((category, i) => ({
      userId,
      category,
      body: `Win ${i + 1}: a small moment of courage I want to remember and build on.`,
    })),
  );

  // Profile audits: 3 with a generated report, so the audits lane is full.
  await db.insert(auditsTable).values(
    Array.from({ length: 3 }, (_, i) => ({
      userId,
      firstName: "Jordan",
      age: 31,
      gender: "nonbinary",
      orientation: "queer",
      datingGoal: "long-term",
      currentApps: ["hinge", "bumble"],
      bio: `Audit ${i + 1}: trail coffee, weird museums, and a soft spot for terrible puns.`,
      prompts: "A life goal of mine: read in every national park.",
      status: "complete",
      source: "manual",
      readinessScore: 72 + i * 3,
      report: { summary: "Strong voice, photos could show more range." },
      reportGeneratedAt: new Date(),
    })),
  );

  // Message coaching: 5 worked sessions.
  await db.insert(messageCoachingSessionsTable).values(
    Array.from({ length: 5 }, (_, i) => ({
      userId,
      matchName: `Match ${i + 1}`,
      conversationContext: "We matched two days ago and have traded a few messages.",
      yourLastMessage: "That hike sounds great, what does your weekend look like?",
      goal: "Move from texting to a plan without being pushy.",
      sourceApp: "hinge",
      status: "complete",
    })),
  );

  // Life pulse: 7 check-ins.
  await db.insert(lifePulsesTable).values(
    Array.from({ length: 7 }, (_, i) => ({
      userId,
      sleep: 3 + (i % 3),
      energy: 3 + (i % 2),
      social: 2 + (i % 4),
      money: 3 + (i % 2),
      headspace: 3 + (i % 3),
      note: i === 0 ? "Felt steady this week." : null,
    })),
  );
}

/**
 * Provision a development test user in the requested state. Idempotent: the
 * account's signals are wiped and rebuilt on every call. Returns the profile so
 * the caller can mint a session for it.
 */
export async function seedTestUser(
  state: TestUserState,
): Promise<TestUserProfile> {
  if (!isDevEnvironment()) {
    throw new Error("seedTestUser is development-only and must never run in production.");
  }
  const profile = DEV_TEST_USERS[state];
  await upsertTestUser(profile);
  await clearTestUserSignals(profile.id);
  if (state === "power") {
    await seedPowerSignals(profile.id);
  }
  return profile;
}
