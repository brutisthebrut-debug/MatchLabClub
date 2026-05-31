/**
 * Lightweight client-side onboarding state.
 *
 * There is no `onboarded` column on the user yet, so first-run is decided by two
 * signals together: (1) this browser flag, set once the user finishes or skips
 * the guided flow, and (2) whether the account already has any real signal
 * (audits, profiles, wellness answers). The gate in App.tsx combines both so a
 * returning user with data is never sent back through onboarding.
 */

const DONE_KEY = "matchlab.onboarded";
const GOAL_KEY = "matchlab.goal";
const ORIENTATION_KEY = "matchlab.orientation";
const SEEKING_KEY = "matchlab.seeking";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures (private mode, quota); onboarding still works,
    // it just may re-prompt on a brand-new empty account.
  }
}

export function hasCompletedOnboarding(): boolean {
  return safeGet(DONE_KEY) === "1";
}

export function markOnboardingComplete(): void {
  safeSet(DONE_KEY, "1");
}

export function rememberOnboardingGoal(goal: string): void {
  safeSet(GOAL_KEY, goal);
}

export function readOnboardingGoal(): string | null {
  return safeGet(GOAL_KEY);
}

export function rememberOnboardingOrientation(orientation: string): void {
  safeSet(ORIENTATION_KEY, orientation);
}

export function readOnboardingOrientation(): string | null {
  return safeGet(ORIENTATION_KEY);
}

export function rememberOnboardingSeeking(seeking: string[]): void {
  safeSet(SEEKING_KEY, JSON.stringify(seeking));
}

export function readOnboardingSeeking(): string[] {
  const raw = safeGet(SEEKING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
