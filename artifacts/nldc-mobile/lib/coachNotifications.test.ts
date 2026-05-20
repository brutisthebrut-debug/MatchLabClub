import { describe, it, expect, beforeEach, vi } from "vitest";

const asyncStore = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStore.delete(key);
    }),
  },
}));

vi.mock("expo-notifications", () => ({
  setNotificationCategoryAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("@workspace/api-client-react", () => ({
  recordCoachFollowUp: vi.fn(async () => {}),
}));

import {
  computeSnoozeDelaySeconds,
  snoozeModeActionLabel,
  loadCoachReminderPrefs,
  DEFAULT_COACH_TONIGHT_HOUR,
  DEFAULT_COACH_TOMORROW_MORNING_HOUR,
  COACH_TONIGHT_HOUR_MIN,
  COACH_TONIGHT_HOUR_MAX,
  COACH_TOMORROW_MORNING_HOUR_MIN,
  COACH_TOMORROW_MORNING_HOUR_MAX,
} from "./coachNotifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(hour: number, minute = 0, second = 0): Date {
  const d = new Date(2025, 4, 20, hour, minute, second, 0);
  return d;
}

// ---------------------------------------------------------------------------
// computeSnoozeDelaySeconds
// ---------------------------------------------------------------------------

describe("computeSnoozeDelaySeconds — duration mode", () => {
  it("returns the exact seconds for a duration mode snooze", () => {
    const delay = computeSnoozeDelaySeconds(
      { kind: "duration", seconds: 3600 },
      { tonightHour: 20, tomorrowMorningHour: 9 },
      makeDate(14, 0),
    );
    expect(delay).toBe(3600);
  });
});

describe("computeSnoozeDelaySeconds — tonight mode", () => {
  it("uses a custom tonightHour when now is before the target hour", () => {
    const tonightHour = 22;
    const now = makeDate(18, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tonight" },
      { tonightHour, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
      now,
    );
    const expectedSeconds = (22 - 18) * 3600;
    expect(delay).toBe(expectedSeconds);
  });

  it("uses the default tonightHour when no hours object is supplied", () => {
    const now = makeDate(DEFAULT_COACH_TONIGHT_HOUR - 2, 0, 0);
    const delay = computeSnoozeDelaySeconds({ kind: "tonight" }, undefined, now);
    expect(delay).toBe(2 * 3600);
  });

  it("wraps to the next day when now is at or after tonightHour", () => {
    const tonightHour = 20;
    const now = makeDate(20, 30, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tonight" },
      { tonightHour, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
      now,
    );
    const expectedSeconds = (24 * 3600) - (30 * 60);
    expect(delay).toBe(expectedSeconds);
  });

  it("wraps to next day even when now equals tonightHour exactly (on the minute)", () => {
    const tonightHour = 19;
    const now = makeDate(19, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tonight" },
      { tonightHour, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
      now,
    );
    expect(delay).toBe(24 * 3600);
  });

  it("respects a custom early tonightHour (17:00)", () => {
    const tonightHour = 17;
    const now = makeDate(15, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tonight" },
      { tonightHour, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
      now,
    );
    expect(delay).toBe(2 * 3600);
  });

  it("enforces the 60-second minimum even when target is within the past second", () => {
    const tonightHour = 20;
    const now = makeDate(20, 0, 1);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tonight" },
      { tonightHour, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
      now,
    );
    expect(delay).toBeGreaterThanOrEqual(60);
  });
});

describe("computeSnoozeDelaySeconds — tomorrowMorning mode", () => {
  it("schedules for tomorrow at the custom tomorrowMorningHour", () => {
    const tomorrowMorningHour = 7;
    const now = makeDate(21, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tomorrowMorning" },
      { tonightHour: DEFAULT_COACH_TONIGHT_HOUR, tomorrowMorningHour },
      now,
    );
    const expectedSeconds = (7 + 24 - 21) * 3600;
    expect(delay).toBe(expectedSeconds);
  });

  it("uses the default tomorrowMorningHour when no hours object is supplied", () => {
    const now = makeDate(21, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tomorrowMorning" },
      undefined,
      now,
    );
    const expectedSeconds = (DEFAULT_COACH_TOMORROW_MORNING_HOUR + 24 - 21) * 3600;
    expect(delay).toBe(expectedSeconds);
  });

  it("always fires tomorrow, even when tomorrowMorningHour is later today", () => {
    const tomorrowMorningHour = 11;
    const now = makeDate(8, 0, 0);
    const delay = computeSnoozeDelaySeconds(
      { kind: "tomorrowMorning" },
      { tonightHour: DEFAULT_COACH_TONIGHT_HOUR, tomorrowMorningHour },
      now,
    );
    const expectedSeconds = (11 + 24 - 8) * 3600;
    expect(delay).toBe(expectedSeconds);
  });
});

// ---------------------------------------------------------------------------
// snoozeModeActionLabel
// ---------------------------------------------------------------------------

describe("snoozeModeActionLabel", () => {
  it("formats the tonight label with a custom hour (8pm)", () => {
    const label = snoozeModeActionLabel(
      { kind: "tonight" },
      { tonightHour: 20, tomorrowMorningHour: 9 },
    );
    expect(label).toBe("Remind me tonight (8pm)");
  });

  it("formats the tonight label with a different custom hour (10pm)", () => {
    const label = snoozeModeActionLabel(
      { kind: "tonight" },
      { tonightHour: 22, tomorrowMorningHour: 9 },
    );
    expect(label).toBe("Remind me tonight (10pm)");
  });

  it("formats the tomorrowMorning label with a custom hour (7am)", () => {
    const label = snoozeModeActionLabel(
      { kind: "tomorrowMorning" },
      { tonightHour: 20, tomorrowMorningHour: 7 },
    );
    expect(label).toBe("Remind me tomorrow morning (7am)");
  });

  it("formats the tomorrowMorning label with the default hour (9am)", () => {
    const label = snoozeModeActionLabel(
      { kind: "tomorrowMorning" },
      { tonightHour: DEFAULT_COACH_TONIGHT_HOUR, tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR },
    );
    expect(label).toBe("Remind me tomorrow morning (9am)");
  });

  it("formats a duration label in minutes for short durations", () => {
    const label = snoozeModeActionLabel({ kind: "duration", seconds: 30 * 60 });
    expect(label).toBe("Remind me in 30 min");
  });

  it("formats a duration label in hours for whole-hour durations", () => {
    const label = snoozeModeActionLabel({ kind: "duration", seconds: 2 * 3600 });
    expect(label).toBe("Remind me in 2 hr");
  });

  it("uses defaults when no hours argument is passed", () => {
    const labelTonight = snoozeModeActionLabel({ kind: "tonight" });
    expect(labelTonight).toContain("Remind me tonight");

    const labelMorning = snoozeModeActionLabel({ kind: "tomorrowMorning" });
    expect(labelMorning).toContain("Remind me tomorrow morning");
  });
});

// ---------------------------------------------------------------------------
// loadCoachReminderPrefs — hour clamping
// ---------------------------------------------------------------------------

describe("loadCoachReminderPrefs — tonightHour clamping", () => {
  beforeEach(() => {
    asyncStore.clear();
  });

  it("returns the default when storage is empty", async () => {
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(DEFAULT_COACH_TONIGHT_HOUR);
    expect(prefs.tomorrowMorningHour).toBe(DEFAULT_COACH_TOMORROW_MORNING_HOUR);
  });

  it("accepts a valid tonightHour within range", async () => {
    asyncStore.set("nldc.coach.reminderPrefs", JSON.stringify({ tonightHour: 19 }));
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(19);
  });

  it("clamps tonightHour below COACH_TONIGHT_HOUR_MIN to min", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: COACH_TONIGHT_HOUR_MIN - 1 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(COACH_TONIGHT_HOUR_MIN);
  });

  it("clamps tonightHour above COACH_TONIGHT_HOUR_MAX to max", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: COACH_TONIGHT_HOUR_MAX + 1 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(COACH_TONIGHT_HOUR_MAX);
  });

  it("falls back to default when tonightHour is a string", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: "late" }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(DEFAULT_COACH_TONIGHT_HOUR);
  });

  it("falls back to default when tonightHour is null", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: null }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(DEFAULT_COACH_TONIGHT_HOUR);
  });

  it("falls back to default when tonightHour is stored as a boolean (non-number type)", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: true }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(DEFAULT_COACH_TONIGHT_HOUR);
  });

  it("rounds a fractional tonightHour to the nearest integer", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tonightHour: 20.7 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(21);
  });
});

describe("loadCoachReminderPrefs — tomorrowMorningHour clamping", () => {
  beforeEach(() => {
    asyncStore.clear();
  });

  it("accepts a valid tomorrowMorningHour within range", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tomorrowMorningHour: 8 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(8);
  });

  it("clamps tomorrowMorningHour below COACH_TOMORROW_MORNING_HOUR_MIN to min", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tomorrowMorningHour: COACH_TOMORROW_MORNING_HOUR_MIN - 1 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(COACH_TOMORROW_MORNING_HOUR_MIN);
  });

  it("clamps tomorrowMorningHour above COACH_TOMORROW_MORNING_HOUR_MAX to max", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tomorrowMorningHour: COACH_TOMORROW_MORNING_HOUR_MAX + 1 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(COACH_TOMORROW_MORNING_HOUR_MAX);
  });

  it("falls back to default when tomorrowMorningHour is a string", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tomorrowMorningHour: "early" }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(DEFAULT_COACH_TOMORROW_MORNING_HOUR);
  });

  it("falls back to default when tomorrowMorningHour is undefined", async () => {
    asyncStore.set("nldc.coach.reminderPrefs", JSON.stringify({}));
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(DEFAULT_COACH_TOMORROW_MORNING_HOUR);
  });

  it("rounds a fractional tomorrowMorningHour", async () => {
    asyncStore.set(
      "nldc.coach.reminderPrefs",
      JSON.stringify({ tomorrowMorningHour: 6.4 }),
    );
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tomorrowMorningHour).toBe(6);
  });
});

describe("loadCoachReminderPrefs — malformed JSON", () => {
  beforeEach(() => {
    asyncStore.clear();
  });

  it("returns defaults when stored JSON is invalid", async () => {
    asyncStore.set("nldc.coach.reminderPrefs", "not-json{{{");
    const prefs = await loadCoachReminderPrefs();
    expect(prefs.tonightHour).toBe(DEFAULT_COACH_TONIGHT_HOUR);
    expect(prefs.tomorrowMorningHour).toBe(DEFAULT_COACH_TOMORROW_MORNING_HOUR);
    expect(prefs.enabled).toBe(true);
  });
});
