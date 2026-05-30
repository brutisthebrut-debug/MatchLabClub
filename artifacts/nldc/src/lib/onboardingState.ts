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
