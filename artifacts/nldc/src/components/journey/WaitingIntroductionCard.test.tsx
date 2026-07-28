import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { MatchProposal } from "@workspace/api-client-react";
import {
  hasPendingIntroduction,
  markWaitingPending,
} from "@/lib/onboardingState";
import { WaitingIntroductionCard } from "./WaitingIntroductionCard";

function proposal(status: MatchProposal["status"]): MatchProposal {
  return {
    id: "proposal-7",
    userId: "member-1",
    source: "internal",
    status,
    compatibilityScore: 86,
    cosmicResonance: null,
    cosmicResonanceNote: null,
    summary: "A considered introduction.",
    proposedToUserId: "member-2",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("WaitingIntroductionCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    markWaitingPending();
  });

  it("tells the truth while an eligible member waits in the pool", () => {
    render(
      <WaitingIntroductionCard
        eligible
        poolStatus="building"
        proposals={[]}
      />,
    );

    expect(screen.getByText("Chapter 5 of 8 · Waiting")).toBeTruthy();
    expect(
      screen.getByText("You are in. Waiting is part of considered matching."),
    ).toBeTruthy();
  });

  it("explains mutual consent before opening a proposed introduction", () => {
    render(
      <WaitingIntroductionCard
        eligible
        poolStatus="building"
        proposals={[proposal("proposed")]}
      />,
    );

    expect(screen.getByTestId("journey-waiting-review")).toBeTruthy();
    expect(
      screen.getByText(/both people must choose yes/i),
    ).toBeTruthy();
  });

  it("advances to Introduction only after a mutual yes", async () => {
    render(
      <WaitingIntroductionCard
        eligible
        poolStatus="building"
        proposals={[proposal("mutual_yes")]}
      />,
    );

    expect(screen.getByText("Chapter 6 of 8 · Introduction")).toBeTruthy();
    expect(screen.getByTestId("journey-introduction-open")).toBeTruthy();
    await waitFor(() => expect(hasPendingIntroduction()).toBe(true));
  });
});
