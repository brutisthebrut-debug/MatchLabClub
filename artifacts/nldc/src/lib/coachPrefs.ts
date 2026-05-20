import { useEffect, useState } from "react";

export const DEFAULT_COACH_TONIGHT_HOUR = 20;
export const DEFAULT_COACH_TOMORROW_MORNING_HOUR = 9;

export const COACH_TONIGHT_HOUR_MIN = 17;
export const COACH_TONIGHT_HOUR_MAX = 23;
export const COACH_TOMORROW_MORNING_HOUR_MIN = 5;
export const COACH_TOMORROW_MORNING_HOUR_MAX = 11;

const PREFS_KEY = "nldc.coach.nudgePrefs";
const PREFS_CHANGED_EVENT = "nldc:coachNudgePrefsChanged";

export interface CoachNudgePrefs {
  tonightHour: number;
  tomorrowMorningHour: number;
}

export const DEFAULT_COACH_NUDGE_PREFS: CoachNudgePrefs = {
  tonightHour: DEFAULT_COACH_TONIGHT_HOUR,
  tomorrowMorningHour: DEFAULT_COACH_TOMORROW_MORNING_HOUR,
};

export function formatHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

function clampHour(raw: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.round(raw)
      : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function loadCoachNudgePrefs(): CoachNudgePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_COACH_NUDGE_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_COACH_NUDGE_PREFS };
    const parsed = JSON.parse(raw) as Partial<CoachNudgePrefs>;
    return {
      tonightHour: clampHour(
        parsed.tonightHour,
        DEFAULT_COACH_TONIGHT_HOUR,
        COACH_TONIGHT_HOUR_MIN,
        COACH_TONIGHT_HOUR_MAX,
      ),
      tomorrowMorningHour: clampHour(
        parsed.tomorrowMorningHour,
        DEFAULT_COACH_TOMORROW_MORNING_HOUR,
        COACH_TOMORROW_MORNING_HOUR_MIN,
        COACH_TOMORROW_MORNING_HOUR_MAX,
      ),
    };
  } catch {
    return { ...DEFAULT_COACH_NUDGE_PREFS };
  }
}

export function saveCoachNudgePrefs(prefs: CoachNudgePrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore — preference is a nice-to-have
  }
  try {
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function useCoachNudgePrefs(): [
  CoachNudgePrefs,
  (next: CoachNudgePrefs) => void,
] {
  const [prefs, setPrefs] = useState<CoachNudgePrefs>(() =>
    loadCoachNudgePrefs(),
  );

  useEffect(() => {
    const sync = () => setPrefs(loadCoachNudgePrefs());
    window.addEventListener(PREFS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (next: CoachNudgePrefs) => {
    saveCoachNudgePrefs(next);
    setPrefs(next);
  };

  return [prefs, update];
}

export interface WebSnoozeChip {
  label: string;
  sublabel?: string;
  kind: "duration" | "tonight" | "tomorrowMorning";
  seconds?: number;
}

export function buildWebSnoozeChips(prefs: CoachNudgePrefs): WebSnoozeChip[] {
  return [
    { kind: "duration", label: "30 min", seconds: 30 * 60 },
    { kind: "duration", label: "1 hr", seconds: 60 * 60 },
    { kind: "duration", label: "2 hr", seconds: 2 * 60 * 60 },
    {
      kind: "tonight",
      label: "Tonight",
      sublabel: formatHourLabel(prefs.tonightHour),
    },
    { kind: "duration", label: "3 hr", seconds: 3 * 60 * 60 },
    { kind: "duration", label: "6 hr", seconds: 6 * 60 * 60 },
    {
      kind: "tomorrowMorning",
      label: "Tomorrow morning",
      sublabel: formatHourLabel(prefs.tomorrowMorningHour),
    },
  ];
}

export function buildTonightHourOptions(): Array<{
  value: number;
  label: string;
}> {
  const opts = [];
  for (let h = COACH_TONIGHT_HOUR_MIN; h <= COACH_TONIGHT_HOUR_MAX; h++) {
    opts.push({ value: h, label: formatHourLabel(h) });
  }
  return opts;
}

export function buildTomorrowMorningHourOptions(): Array<{
  value: number;
  label: string;
}> {
  const opts = [];
  for (
    let h = COACH_TOMORROW_MORNING_HOUR_MIN;
    h <= COACH_TOMORROW_MORNING_HOUR_MAX;
    h++
  ) {
    opts.push({ value: h, label: formatHourLabel(h) });
  }
  return opts;
}
