import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordCoachFollowUp as apiRecordCoachFollowUp } from "@workspace/api-client-react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PERMISSION_ASKED_KEY = "nldc.coach.notifPermissionAsked";
const SCHEDULED_ID_KEY = "nldc.coach.scheduledReminderId";
const DRAFT_KEY = "nldc.coach.savedDraft";
const SEND_STATS_KEY = "nldc.coach.sendThroughStats";
const PENDING_PROMPT_KEY = "nldc.coach.pendingFollowUpPrompt";
const PREFS_KEY = "nldc.coach.reminderPrefs";

export const COACH_REMINDER_DELAY_SECONDS = 2 * 60 * 60;
export const COACH_NOTIFICATION_TYPE = "coach-unsent-reply";
export const COACH_NOTIFICATION_CATEGORY = "coach-unsent-reply-followup";
export const COACH_ACTION_SENT = "coach-followup-sent";
export const COACH_ACTION_NOT_SENT = "coach-followup-not-sent";
export const COACH_ACTION_SNOOZE_1H = "coach-followup-snooze-1h";
export const COACH_ACTION_SNOOZE_3H = "coach-followup-snooze-3h";
export const COACH_ACTION_DISMISS = "coach-followup-dismiss";

export const COACH_SNOOZE_1H_SECONDS = 60 * 60;
export const COACH_SNOOZE_3H_SECONDS = 3 * 60 * 60;

export const COACH_REMINDER_DELAY_OPTIONS: Array<{
  label: string;
  seconds: number;
}> = [
  { label: "30 min", seconds: 30 * 60 },
  { label: "2 hr", seconds: 2 * 60 * 60 },
  { label: "6 hr", seconds: 6 * 60 * 60 },
];

export type SnoozeTimeOfDayKind = "tonight" | "tomorrowMorning";

export type SnoozeMode =
  | { kind: "duration"; seconds: number }
  | { kind: SnoozeTimeOfDayKind };

export const DEFAULT_COACH_TONIGHT_HOUR = 20;
export const DEFAULT_COACH_TOMORROW_MORNING_HOUR = 9;

export const COACH_TONIGHT_HOUR_MIN = 17;
export const COACH_TONIGHT_HOUR_MAX = 23;
export const COACH_TOMORROW_MORNING_HOUR_MIN = 5;
export const COACH_TOMORROW_MORNING_HOUR_MAX = 11;

export function formatHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

function clampHour(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export type SnoozeOption =
  | { kind: "duration"; label: string; seconds: number }
  | { kind: SnoozeTimeOfDayKind; label: string };

export function buildCoachSnoozeShortOptions(tonightHour: number): SnoozeOption[] {
  return [
    { kind: "duration", label: "30 min", seconds: 30 * 60 },
    { kind: "duration", label: "1 hr", seconds: 60 * 60 },
    { kind: "duration", label: "2 hr", seconds: 2 * 60 * 60 },
    { kind: "tonight", label: `Tonight (${formatHourLabel(tonightHour)})` },
  ];
}

export function buildCoachSnoozeLongOptions(
  tomorrowMorningHour: number,
): SnoozeOption[] {
  return [
    { kind: "duration", label: "3 hr", seconds: 3 * 60 * 60 },
    { kind: "duration", label: "6 hr", seconds: 6 * 60 * 60 },
    { kind: "duration", label: "12 hr", seconds: 12 * 60 * 60 },
    {
      kind: "tomorrowMorning",
      label: `Tomorrow morning (${formatHourLabel(tomorrowMorningHour)})`,
    },
  ];
}

export const COACH_SNOOZE_CUSTOM_MIN_SECONDS = 5 * 60;
export const COACH_SNOOZE_CUSTOM_MAX_SECONDS = 24 * 60 * 60;

export interface CoachReminderPrefs {
  enabled: boolean;
  delaySeconds: number;
  snoozeShort: SnoozeMode;
  snoozeLong: SnoozeMode;
  tonightHour: number;
  tomorrowMorningHour: number;
}

export const DEFAULT_COACH_REMINDER_PREFS: CoachReminderPrefs = {
  enabled: true,
  delaySeconds: COACH_REMINDER_DELAY_SECONDS,
  snoozeShort: { kind: "duration", seconds: COACH_SNOOZE_1H_SECONDS },
  snoozeLong: { kind: "duration", seconds: COACH_SNOOZE_3H_SECONDS },
  tonightHour: DEFAULT_COACH_TONIGHT_HOUR,
  tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR,
};

function clampSnoozeSeconds(seconds: number, fallback: number): number {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return fallback;
  }
  const rounded = Math.round(seconds);
  if (rounded < COACH_SNOOZE_CUSTOM_MIN_SECONDS)
    return COACH_SNOOZE_CUSTOM_MIN_SECONDS;
  if (rounded > COACH_SNOOZE_CUSTOM_MAX_SECONDS)
    return COACH_SNOOZE_CUSTOM_MAX_SECONDS;
  return rounded;
}

function parseSnoozeMode(raw: unknown, fallback: SnoozeMode): SnoozeMode {
  if (raw && typeof raw === "object") {
    const kind = (raw as { kind?: unknown }).kind;
    if (kind === "tonight" || kind === "tomorrowMorning") {
      return { kind };
    }
    if (kind === "duration") {
      const seconds = (raw as { seconds?: unknown }).seconds;
      const fb =
        fallback.kind === "duration"
          ? fallback.seconds
          : COACH_SNOOZE_1H_SECONDS;
      return {
        kind: "duration",
        seconds: clampSnoozeSeconds(seconds as number, fb),
      };
    }
  }
  return fallback;
}

export function formatSnoozeDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  if (Number.isInteger(hours)) return `${hours} hr`;
  return `${hours.toFixed(1)} hr`;
}

export function computeSnoozeDelaySeconds(
  mode: SnoozeMode,
  hours: { tonightHour: number; tomorrowMorningHour: number } = {
    tonightHour: DEFAULT_COACH_TONIGHT_HOUR,
    tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR,
  },
  now: Date = new Date(),
): number {
  if (mode.kind === "duration") return mode.seconds;
  const target = new Date(now);
  if (mode.kind === "tonight") {
    target.setHours(hours.tonightHour, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
  } else {
    target.setDate(target.getDate() + 1);
    target.setHours(hours.tomorrowMorningHour, 0, 0, 0);
  }
  return Math.max(60, Math.round((target.getTime() - now.getTime()) / 1000));
}

export function snoozeModeActionLabel(
  mode: SnoozeMode,
  hours: { tonightHour: number; tomorrowMorningHour: number } = {
    tonightHour: DEFAULT_COACH_TONIGHT_HOUR,
    tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR,
  },
): string {
  if (mode.kind === "duration")
    return `Remind me in ${formatSnoozeDuration(mode.seconds)}`;
  if (mode.kind === "tonight")
    return `Remind me tonight (${formatHourLabel(hours.tonightHour)})`;
  return `Remind me tomorrow morning (${formatHourLabel(hours.tomorrowMorningHour)})`;
}

export function snoozeModesEqual(a: SnoozeMode, b: SnoozeOption): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "duration" && b.kind === "duration") {
    return a.seconds === b.seconds;
  }
  return true;
}

export function snoozeOptionToMode(opt: SnoozeOption): SnoozeMode {
  if (opt.kind === "duration") {
    return { kind: "duration", seconds: opt.seconds };
  }
  return { kind: opt.kind };
}

export async function loadCoachReminderPrefs(): Promise<CoachReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_COACH_REMINDER_PREFS };
    const parsed = JSON.parse(raw) as Partial<CoachReminderPrefs>;
    const delaySeconds =
      typeof parsed.delaySeconds === "number" && parsed.delaySeconds > 0
        ? parsed.delaySeconds
        : DEFAULT_COACH_REMINDER_PREFS.delaySeconds;
    const enabled =
      typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : DEFAULT_COACH_REMINDER_PREFS.enabled;
    const legacyShort = (parsed as { snoozeShortSeconds?: unknown })
      .snoozeShortSeconds;
    const legacyLong = (parsed as { snoozeLongSeconds?: unknown })
      .snoozeLongSeconds;
    const snoozeShort: SnoozeMode = parsed.snoozeShort
      ? parseSnoozeMode(parsed.snoozeShort, DEFAULT_COACH_REMINDER_PREFS.snoozeShort)
      : typeof legacyShort === "number"
        ? {
            kind: "duration",
            seconds: clampSnoozeSeconds(
              legacyShort,
              COACH_SNOOZE_1H_SECONDS,
            ),
          }
        : DEFAULT_COACH_REMINDER_PREFS.snoozeShort;
    const snoozeLong: SnoozeMode = parsed.snoozeLong
      ? parseSnoozeMode(parsed.snoozeLong, DEFAULT_COACH_REMINDER_PREFS.snoozeLong)
      : typeof legacyLong === "number"
        ? {
            kind: "duration",
            seconds: clampSnoozeSeconds(
              legacyLong,
              COACH_SNOOZE_3H_SECONDS,
            ),
          }
        : DEFAULT_COACH_REMINDER_PREFS.snoozeLong;
    const tonightHour = clampHour(
      parsed.tonightHour,
      DEFAULT_COACH_TONIGHT_HOUR,
      COACH_TONIGHT_HOUR_MIN,
      COACH_TONIGHT_HOUR_MAX,
    );
    const tomorrowMorningHour = clampHour(
      parsed.tomorrowMorningHour,
      DEFAULT_COACH_TOMORROW_MORNING_HOUR,
      COACH_TOMORROW_MORNING_HOUR_MIN,
      COACH_TOMORROW_MORNING_HOUR_MAX,
    );
    return {
      enabled,
      delaySeconds,
      snoozeShort,
      snoozeLong,
      tonightHour,
      tomorrowMorningHour,
    };
  } catch {
    return { ...DEFAULT_COACH_REMINDER_PREFS };
  }
}

export async function saveCoachReminderPrefs(prefs: CoachReminderPrefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
  await applyCoachNotificationCategory(prefs).catch(() => {});
}

export interface SavedCoachDraft {
  matchName: string;
  context: string;
  lastMessage: string;
  replies: Array<{ style: string; text: string; rationale: string }>;
  savedAt: number;
}

export type CoachFollowUpAnswer = "sent" | "not_sent";

export interface CoachSendStats {
  totalPrompts: number;
  sentCount: number;
  notSentCount: number;
  snoozeCount: number;
  dismissCount: number;
  lastAnsweredAt: number | null;
  lastAnswer: CoachFollowUpAnswer | null;
}

const EMPTY_STATS: CoachSendStats = {
  totalPrompts: 0,
  sentCount: 0,
  notSentCount: 0,
  snoozeCount: 0,
  dismissCount: 0,
  lastAnsweredAt: null,
  lastAnswer: null,
};

let handlerConfigured = false;

export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  void applyCoachNotificationCategory();
}

export async function applyCoachNotificationCategory(
  prefs?: CoachReminderPrefs,
) {
  if (Platform.OS === "web") return;
  const current = prefs ?? (await loadCoachReminderPrefs());
  const hours = {
    tonightHour: current.tonightHour,
    tomorrowMorningHour: current.tomorrowMorningHour,
  };
  try {
    await Notifications.setNotificationCategoryAsync(
      COACH_NOTIFICATION_CATEGORY,
      [
        {
          identifier: COACH_ACTION_SENT,
          buttonTitle: "Sent it ✅",
          options: { opensAppToForeground: false },
        },
        {
          identifier: COACH_ACTION_NOT_SENT,
          buttonTitle: "Still thinking 💭",
          options: { opensAppToForeground: false },
        },
        {
          identifier: COACH_ACTION_SNOOZE_1H,
          buttonTitle: snoozeModeActionLabel(current.snoozeShort, hours),
          options: { opensAppToForeground: false },
        },
        {
          identifier: COACH_ACTION_SNOOZE_3H,
          buttonTitle: snoozeModeActionLabel(current.snoozeLong, hours),
          options: { opensAppToForeground: false },
        },
        {
          identifier: COACH_ACTION_DISMISS,
          buttonTitle: "Dismiss",
          options: { opensAppToForeground: false, isDestructive: true },
        },
      ],
    );
  } catch {
    // ignore — categories aren't supported everywhere
  }
}

export async function ensureCoachNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const already = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    if (already) return false;
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "1");
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch {
    return false;
  }
}

export async function cancelCoachReminder() {
  try {
    const id = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
    }
  } catch {
    // ignore
  }
}

export async function scheduleCoachReminder(opts: {
  matchName: string;
  delaySeconds?: number;
}): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const prefs = await loadCoachReminderPrefs();
  if (!prefs.enabled) {
    await cancelCoachReminder();
    return null;
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;
  await cancelCoachReminder();
  const delay = opts.delaySeconds ?? prefs.delaySeconds;
  const who = opts.matchName.trim() || "your match";
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Did you send that reply?",
        body: `You drafted a reply to ${who} a couple of hours ago — tap to let us know.`,
        data: { type: COACH_NOTIFICATION_TYPE, matchName: who },
        categoryIdentifier: COACH_NOTIFICATION_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delay,
        repeats: false,
      },
    });
    await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export async function snoozeCoachReminder(opts: {
  matchName?: string;
  delaySeconds?: number;
  mode?: SnoozeMode;
}): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const prefs = await loadCoachReminderPrefs();
  if (!prefs.enabled) {
    await cancelCoachReminder();
    return null;
  }
  let matchName = opts.matchName?.trim();
  if (!matchName) {
    const draft = await loadCoachDraft();
    matchName = draft?.matchName?.trim() || "your match";
  }
  const delaySeconds =
    opts.mode !== undefined
      ? computeSnoozeDelaySeconds(opts.mode, {
          tonightHour: prefs.tonightHour,
          tomorrowMorningHour: prefs.tomorrowMorningHour,
        })
      : (opts.delaySeconds ?? COACH_SNOOZE_1H_SECONDS);
  return scheduleCoachReminder({
    matchName,
    delaySeconds,
  });
}

export async function saveCoachDraft(draft: SavedCoachDraft) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export async function loadCoachDraft(): Promise<SavedCoachDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCoachDraft;
  } catch {
    return null;
  }
}

export async function clearCoachDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export async function recordCoachFollowUp(
  answer: CoachFollowUpAnswer,
  opts?: { sessionId?: number | null },
) {
  try {
    const current = await loadCoachSendStats();
    const next: CoachSendStats = {
      ...current,
      totalPrompts: current.totalPrompts + 1,
      sentCount: current.sentCount + (answer === "sent" ? 1 : 0),
      notSentCount: current.notSentCount + (answer === "not_sent" ? 1 : 0),
      lastAnsweredAt: Date.now(),
      lastAnswer: answer,
    };
    await AsyncStorage.setItem(SEND_STATS_KEY, JSON.stringify(next));
    await clearCoachDraft();
    await cancelCoachReminder();
  } catch {
    // ignore
  }

  try {
    await apiRecordCoachFollowUp({
      answer,
      sessionId: opts?.sessionId ?? null,
    });
  } catch {
    // Offline / unauthenticated — local AsyncStorage copy is enough for now.
  }
}

export async function recordCoachSnoozed(opts?: {
  sessionId?: number | null;
}) {
  try {
    const current = await loadCoachSendStats();
    const next: CoachSendStats = {
      ...current,
      snoozeCount: current.snoozeCount + 1,
    };
    await AsyncStorage.setItem(SEND_STATS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  try {
    await apiRecordCoachFollowUp({
      answer: "snoozed",
      sessionId: opts?.sessionId ?? null,
    });
  } catch {
    // Offline / unauthenticated — local AsyncStorage copy is enough for now.
  }
}

export async function recordCoachDismissed(opts?: {
  sessionId?: number | null;
}) {
  try {
    const current = await loadCoachSendStats();
    const next: CoachSendStats = {
      ...current,
      dismissCount: current.dismissCount + 1,
    };
    await AsyncStorage.setItem(SEND_STATS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  try {
    await apiRecordCoachFollowUp({
      answer: "dismissed",
      sessionId: opts?.sessionId ?? null,
    });
  } catch {
    // Offline / unauthenticated — local AsyncStorage copy is enough for now.
  }
}

export async function loadCoachSendStats(): Promise<CoachSendStats> {
  try {
    const raw = await AsyncStorage.getItem(SEND_STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<CoachSendStats>;
    return {
      totalPrompts: parsed.totalPrompts ?? 0,
      sentCount: parsed.sentCount ?? 0,
      notSentCount: parsed.notSentCount ?? 0,
      snoozeCount: parsed.snoozeCount ?? 0,
      dismissCount: parsed.dismissCount ?? 0,
      lastAnsweredAt: parsed.lastAnsweredAt ?? null,
      lastAnswer: parsed.lastAnswer ?? null,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export async function setPendingCoachFollowUpPrompt() {
  try {
    await AsyncStorage.setItem(PENDING_PROMPT_KEY, "1");
  } catch {
    // ignore
  }
}

export async function consumePendingCoachFollowUpPrompt(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PENDING_PROMPT_KEY);
    if (!v) return false;
    await AsyncStorage.removeItem(PENDING_PROMPT_KEY);
    return true;
  } catch {
    return false;
  }
}
