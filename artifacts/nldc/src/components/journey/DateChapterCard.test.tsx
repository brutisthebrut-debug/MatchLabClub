import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  hasPendingDate,
  hasPendingReflection,
  markDatePending,
} from "@/lib/onboardingState";
import { DateChapterCard } from "./DateChapterCard";

describe("DateChapterCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stays quiet outside the seeded Date chapter", () => {
    render(<DateChapterCard />);
    expect(screen.queryByTestId("journey-date")).toBeNull();
  });

  it("moves the journey into Reflect when the member is ready", () => {
    markDatePending();
    render(<DateChapterCard />);

    expect(screen.getByText("Chapter 7 of 8 · Date")).toBeTruthy();
    fireEvent.click(screen.getByTestId("journey-date-reflect"));
    expect(hasPendingDate()).toBe(false);
    expect(hasPendingReflection()).toBe(true);
  });
});
