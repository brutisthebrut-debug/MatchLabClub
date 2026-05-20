import { useEffect, useState } from "react";

const STORAGE_KEY = "nldc.autoRefreshStaleReports";

export function loadAutoRefreshPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAutoRefreshPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — preference is a nice-to-have
  }
  try {
    window.dispatchEvent(new CustomEvent("nldc:autoRefreshPrefChanged"));
  } catch {
    // ignore
  }
}

export function useAutoRefreshPref(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => loadAutoRefreshPref());
  useEffect(() => {
    const onChange = () => setEnabled(loadAutoRefreshPref());
    window.addEventListener("nldc:autoRefreshPrefChanged", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nldc:autoRefreshPrefChanged", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (next: boolean) => {
    saveAutoRefreshPref(next);
    setEnabled(next);
  };
  return [enabled, update];
}

// Per-tab guard so we only sweep stale audits once per session.
let sweptThisSession = false;
export function markSwept(): void {
  sweptThisSession = true;
}
export function hasSwept(): boolean {
  return sweptThisSession;
}

export const AUTO_REFRESH_BATCH_SIZE = 3;
