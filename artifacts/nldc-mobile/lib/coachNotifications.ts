import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PERMISSION_ASKED_KEY = "nldc.coach.notifPermissionAsked";
const SCHEDULED_ID_KEY = "nldc.coach.scheduledReminderId";
const DRAFT_KEY = "nldc.coach.savedDraft";

export const COACH_REMINDER_DELAY_SECONDS = 2 * 60 * 60;
export const COACH_NOTIFICATION_TYPE = "coach-unsent-reply";

export interface SavedCoachDraft {
  matchName: string;
  context: string;
  lastMessage: string;
  replies: Array<{ style: string; text: string; rationale: string }>;
  savedAt: number;
}

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
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return null;
  await cancelCoachReminder();
  const delay = opts.delaySeconds ?? COACH_REMINDER_DELAY_SECONDS;
  const who = opts.matchName.trim() || "your match";
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Still feeling that reply?",
        body: `You drafted a reply to ${who} a couple of hours ago. Worth sending it?`,
        data: { type: COACH_NOTIFICATION_TYPE },
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
