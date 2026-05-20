import AsyncStorage from "@react-native-async-storage/async-storage";
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

export interface CoachReminderPrefs {
  enabled: boolean;
  delaySeconds: number;
}

export const DEFAULT_COACH_REMINDER_PREFS: CoachReminderPrefs = {
  enabled: true,
  delaySeconds: COACH_REMINDER_DELAY_SECONDS,
};

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
    return { enabled, delaySeconds };
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
  lastAnsweredAt: number | null;
  lastAnswer: CoachFollowUpAnswer | null;
}

const EMPTY_STATS: CoachSendStats = {
  totalPrompts: 0,
  sentCount: 0,
  notSentCount: 0,
  lastAnsweredAt: null,
  lastAnswer: null,
};

let handlerConfigured = false;
let categoryConfigured = false;

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
  void configureCoachNotificationCategory();
}

async function configureCoachNotificationCategory() {
  if (categoryConfigured) return;
  if (Platform.OS === "web") return;
  categoryConfigured = true;
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
          buttonTitle: "Remind me in 1 hr",
          options: { opensAppToForeground: false },
        },
        {
          identifier: COACH_ACTION_SNOOZE_3H,
          buttonTitle: "Remind me in 3 hr",
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
  delaySeconds: number;
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
  return scheduleCoachReminder({
    matchName,
    delaySeconds: opts.delaySeconds,
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

export async function recordCoachFollowUp(answer: CoachFollowUpAnswer) {
  try {
    const current = await loadCoachSendStats();
    const next: CoachSendStats = {
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
