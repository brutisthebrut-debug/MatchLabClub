import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const STORAGE_KEY = "nldc.autoRefreshStaleReports";

export async function loadAutoRefreshPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function saveAutoRefreshPref(enabled: boolean): Promise<void> {
  try {
    if (enabled) await AsyncStorage.setItem(STORAGE_KEY, "1");
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore, preference is a nice-to-have
  }
}

export function useAutoRefreshPref(): {
  enabled: boolean;
  loaded: boolean;
  setEnabled: (next: boolean) => Promise<void>;
} {
  const [enabled, setEnabledState] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadAutoRefreshPref().then((v) => {
      if (!cancelled) {
        setEnabledState(v);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setEnabled = async (next: boolean) => {
    setEnabledState(next);
    await saveAutoRefreshPref(next);
  };
  return { enabled, loaded, setEnabled };
}

let sweptThisSession = false;
export function markSwept(): void {
  sweptThisSession = true;
}
export function hasSwept(): boolean {
  return sweptThisSession;
}

export const AUTO_REFRESH_BATCH_SIZE = 3;
