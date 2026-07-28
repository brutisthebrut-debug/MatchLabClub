import { beforeEach, describe, expect, it } from "vitest";
import {
  hasCompletedOnboarding,
  hasPendingFirstRead,
  hasPendingArrival,
  markArrivalSeen,
  markFirstReadSeen,
  markOnboardingComplete,
} from "./onboardingState";

describe("onboarding arrival handoff", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks one pending arrival when onboarding completes", () => {
    markOnboardingComplete();

    expect(hasCompletedOnboarding()).toBe(true);
    expect(hasPendingArrival()).toBe(true);
  });

  it("keeps onboarding complete after the first read is opened", () => {
    markOnboardingComplete();
    markArrivalSeen();

    expect(hasCompletedOnboarding()).toBe(true);
    expect(hasPendingArrival()).toBe(false);
    expect(hasPendingFirstRead()).toBe(true);
  });

  it("closes the one-time handoff after the member continues to Play", () => {
    markOnboardingComplete();
    markArrivalSeen();
    markFirstReadSeen();

    expect(hasCompletedOnboarding()).toBe(true);
    expect(hasPendingArrival()).toBe(false);
    expect(hasPendingFirstRead()).toBe(false);
  });
});
