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
const ARRIVAL_PENDING_KEY = "matchlab.arrival.pending";
const FIRST_READ_PENDING_KEY = "matchlab.first-read.pending";
const PLAY_READ_PENDING_KEY = "matchlab.play-read.pending";
const WAITING_PENDING_KEY = "matchlab.waiting.pending";
const INTRODUCTION_PENDING_KEY = "matchlab.introduction.pending";
const DATE_PENDING_KEY = "matchlab.date.pending";
const REFLECTION_PENDING_KEY = "matchlab.reflection.pending";
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

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A failed cleanup only means the member may see the confirmation again.
  }
}

export type PendingPlayRead = {
  archetypeKey: string;
  archetypeName: string;
  summary: string;
};

export function hasCompletedOnboarding(): boolean {
  return safeGet(DONE_KEY) === "1";
}

export function markOnboardingComplete(): void {
  safeSet(DONE_KEY, "1");
  safeSet(ARRIVAL_PENDING_KEY, "1");
}

export function hasPendingArrival(): boolean {
  return safeGet(ARRIVAL_PENDING_KEY) === "1";
}

export function markArrivalSeen(): void {
  safeSet(ARRIVAL_PENDING_KEY, "0");
  safeSet(FIRST_READ_PENDING_KEY, "1");
}

export function hasPendingFirstRead(): boolean {
  return safeGet(FIRST_READ_PENDING_KEY) === "1";
}

export function markFirstReadSeen(): void {
  safeSet(FIRST_READ_PENDING_KEY, "0");
}

export function rememberPendingPlayRead(read: PendingPlayRead): void {
  safeSet(PLAY_READ_PENDING_KEY, JSON.stringify(read));
}

export function readPendingPlayRead(): PendingPlayRead | null {
  const raw = safeGet(PLAY_READ_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPlayRead>;
    if (
      typeof parsed.archetypeKey !== "string" ||
      typeof parsed.archetypeName !== "string" ||
      typeof parsed.summary !== "string"
    ) {
      return null;
    }
    return {
      archetypeKey: parsed.archetypeKey,
      archetypeName: parsed.archetypeName,
      summary: parsed.summary,
    };
  } catch {
    return null;
  }
}

export function clearPendingPlayRead(): void {
  safeRemove(PLAY_READ_PENDING_KEY);
}

export function markWaitingPending(): void {
  safeSet(WAITING_PENDING_KEY, "1");
}

export function hasPendingWaiting(): boolean {
  return safeGet(WAITING_PENDING_KEY) === "1";
}

export function clearPendingWaiting(): void {
  safeRemove(WAITING_PENDING_KEY);
}

export function markIntroductionPending(): void {
  safeSet(INTRODUCTION_PENDING_KEY, "1");
}

export function hasPendingIntroduction(): boolean {
  return safeGet(INTRODUCTION_PENDING_KEY) === "1";
}

export function clearPendingIntroduction(): void {
  safeRemove(INTRODUCTION_PENDING_KEY);
}

export function markDatePending(): void {
  safeSet(DATE_PENDING_KEY, "1");
}

export function hasPendingDate(): boolean {
  return safeGet(DATE_PENDING_KEY) === "1";
}

export function clearPendingDate(): void {
  safeRemove(DATE_PENDING_KEY);
}

export function markReflectionPending(): void {
  clearPendingDate();
  safeSet(REFLECTION_PENDING_KEY, "1");
}

export function hasPendingReflection(): boolean {
  return safeGet(REFLECTION_PENDING_KEY) === "1";
}

export function clearPendingReflection(): void {
  safeRemove(REFLECTION_PENDING_KEY);
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
