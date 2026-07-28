import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingPlayRead,
  clearPendingWaiting,
  hasCompletedOnboarding,
  hasPendingFirstRead,
  hasPendingArrival,
  hasPendingWaiting,
  markArrivalSeen,
  markFirstReadSeen,
  markOnboardingComplete,
  markWaitingPending,
  readPendingPlayRead,
  rememberPendingPlayRead,
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

  it("carries only the derived Play read into member confirmation", () => {
    rememberPendingPlayRead({
      archetypeKey: "connector",
      archetypeName: "The Connector",
      summary: "You create warmth quickly and need that care returned.",
    });

    expect(readPendingPlayRead()).toEqual({
      archetypeKey: "connector",
      archetypeName: "The Connector",
      summary: "You create warmth quickly and need that care returned.",
    });

    clearPendingPlayRead();
    expect(readPendingPlayRead()).toBeNull();
  });

  it("opens the Waiting chapter after a Play read is confirmed", () => {
    expect(hasPendingWaiting()).toBe(false);
    markWaitingPending();
    expect(hasPendingWaiting()).toBe(true);
    clearPendingWaiting();
    expect(hasPendingWaiting()).toBe(false);
  });
});
