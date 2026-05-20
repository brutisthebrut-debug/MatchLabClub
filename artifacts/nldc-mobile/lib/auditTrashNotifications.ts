import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PREFS_KEY = "nldc.trash.reminderPrefs";
const SCHEDULED_ID_KEY = "nldc.trash.scheduledReminderId";
const LAST_NOTIFIED_KEY = "nldc.trash.lastNotifiedSignature";

export const TRASH_NOTIFICATION_TYPE = "trash-purge-warning";
export const TRASH_NOTIFICATION_CATEGORY = "trash-purge-warning";

export interface TrashReminderPrefs {
  enabled: boolean;
}

export const DEFAULT_TRASH_REMINDER_PREFS: TrashReminderPrefs = {
  enabled: true,
};

export async function loadTrashReminderPrefs(): Promise<TrashReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_TRASH_REMINDER_PREFS };
    const parsed = JSON.parse(raw) as Partial<TrashReminderPrefs>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_TRASH_REMINDER_PREFS.enabled,
    };
  } catch {
    return { ...DEFAULT_TRASH_REMINDER_PREFS };
  }
}

export async function saveTrashReminderPrefs(prefs: TrashReminderPrefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
  if (!prefs.enabled) {
    await cancelTrashReminder();
  }
}

export async function cancelTrashReminder() {
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

/**
 * Builds a stable signature from the set of expiring audit ids and their
 * soonest purge timestamp so we only fire one local notification per
 * distinct warning state (avoids re-notifying on every screen focus).
 */
export function expiringSignature(opts: {
  ids: number[];
  soonestDeletedAt: string | null;
}): string {
  const idsPart = [...opts.ids].sort((a, b) => a - b).join(",");
  return `${idsPart}|${opts.soonestDeletedAt ?? ""}`;
}

export function describeExpiringMessage(opts: {
  count: number;
  earliestDaysLeft: number;
}): { title: string; body: string } {
  const { count, earliestDaysLeft } = opts;
  const noun = count === 1 ? "audit" : "audits";
  const when =
    earliestDaysLeft <= 0
      ? "today"
      : earliestDaysLeft === 1
        ? "tomorrow"
        : `in ${earliestDaysLeft} days`;
  return {
    title:
      count === 1
        ? "An audit is about to be deleted"
        : `${count} audits are about to be deleted`,
    body: `${count === 1 ? "It" : "The earliest"} purges ${when}. Tap to restore from Recently deleted.`,
  };
}

export interface MaybeScheduleOpts {
  ids: number[];
  soonestDeletedAt: string | null;
  earliestDaysLeft: number;
}

/**
 * If the user has trash reminders enabled, has granted notification
 * permission, and we haven't already notified for this exact set of
 * expiring audits, schedule a local notification. Returns the scheduled
 * notification id, or null if nothing was scheduled.
 */
export async function maybeScheduleTrashReminder(
  opts: MaybeScheduleOpts,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (opts.ids.length === 0) {
    await cancelTrashReminder();
    return null;
  }
  const prefs = await loadTrashReminderPrefs();
  if (!prefs.enabled) {
    await cancelTrashReminder();
    return null;
  }
  let permission;
  try {
    permission = await Notifications.getPermissionsAsync();
  } catch {
    return null;
  }
  if (!permission.granted) return null;

  const signature = expiringSignature({
    ids: opts.ids,
    soonestDeletedAt: opts.soonestDeletedAt,
  });
  try {
    const lastSig = await AsyncStorage.getItem(LAST_NOTIFIED_KEY);
    if (lastSig === signature) return null;
  } catch {
    // continue — if storage is broken, falling through to schedule is safer
    // than going silent.
  }

  const { title, body } = describeExpiringMessage({
    count: opts.ids.length,
    earliestDaysLeft: opts.earliestDaysLeft,
  });

  await cancelTrashReminder();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: TRASH_NOTIFICATION_TYPE },
        categoryIdentifier: TRASH_NOTIFICATION_CATEGORY,
      },
      // Fire immediately. We rely on the server-side check to decide
      // *when* the user should be warned (i.e. within ~3 days of purge);
      // the app surfaces it the next time it's foregrounded.
      trigger: null,
    });
    await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);
    try {
      await AsyncStorage.setItem(LAST_NOTIFIED_KEY, signature);
    } catch {
      // ignore — duplicate-fire is the worst case
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Clear the "last notified" signature so the next foreground will fire a
 * fresh notification (e.g. after the user views the trash screen and we
 * want them to be warned again if more audits enter the warning window).
 */
export async function resetTrashReminderSignature() {
  try {
    await AsyncStorage.removeItem(LAST_NOTIFIED_KEY);
  } catch {
    // ignore
  }
}
