import { useEffect, useState } from "react";

const STORAGE_KEY = "nldc.trashedAuditReminders";
const DISMISS_KEY = "nldc.trashedAuditBannerDismissedAt";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 day

export function loadTrashReminderPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    // default ON, only off if explicitly set to "0"
    return v !== "0";
  } catch {
    return true;
  }
}

export function saveTrashReminderPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, "0");
  } catch {
    // ignore, preference is a nice-to-have
  }
  try {
    window.dispatchEvent(new CustomEvent("nldc:trashReminderPrefChanged"));
  } catch {
    // ignore
  }
}

export function useTrashReminderPref(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => loadTrashReminderPref());
  useEffect(() => {
    const onChange = () => setEnabled(loadTrashReminderPref());
    window.addEventListener("nldc:trashReminderPrefChanged", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nldc:trashReminderPrefChanged", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (next: boolean) => {
    saveTrashReminderPref(next);
    setEnabled(next);
  };
  return [enabled, update];
}

export function isDashboardBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function dismissDashboardBanner(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
