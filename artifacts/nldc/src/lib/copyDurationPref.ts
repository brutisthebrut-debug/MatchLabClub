import { useEffect, useState } from "react";

export type CopyDuration = "short" | "default" | "long";

const STORAGE_KEY = "nldc.copyFeedbackDuration";
const DEFAULT_DURATION: CopyDuration = "default";

export const COPY_DURATION_MS: Record<CopyDuration, number> = {
  short: 1500,
  default: 3000,
  long: 6000,
};

export const COPY_DURATION_LABELS: Record<CopyDuration, string> = {
  short: "Short (1.5 s)",
  default: "Default (3 s)",
  long: "Long (6 s)",
};

export function loadCopyDurationPref(): CopyDuration {
  if (typeof window === "undefined") return DEFAULT_DURATION;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "short" || v === "default" || v === "long") return v;
    return DEFAULT_DURATION;
  } catch {
    return DEFAULT_DURATION;
  }
}

export function saveCopyDurationPref(value: CopyDuration): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore, preference is a nice-to-have
  }
  try {
    window.dispatchEvent(new CustomEvent("nldc:copyDurationPrefChanged"));
  } catch {
    // ignore
  }
}

export function useCopyDurationPref(): [CopyDuration, (next: CopyDuration) => void] {
  const [value, setValue] = useState<CopyDuration>(() => loadCopyDurationPref());
  useEffect(() => {
    const onChange = () => setValue(loadCopyDurationPref());
    window.addEventListener("nldc:copyDurationPrefChanged", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nldc:copyDurationPrefChanged", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (next: CopyDuration) => {
    saveCopyDurationPref(next);
    setValue(next);
  };
  return [value, update];
}
