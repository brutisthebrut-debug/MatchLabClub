import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { MobileBottomNav } from "./MobileBottomNav";

afterEach(cleanup);

function renderNavigation(path: string) {
  const { hook } = memoryLocation({ path, static: true });
  return render(
    <Router hook={hook}>
      <MobileBottomNav />
    </Router>,
  );
}

describe("MobileBottomNav", () => {
  it("renders the five approved member destinations in order", () => {
    renderNavigation("/today");

    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.textContent?.replace(/\s+/g, " ").trim()),
    ).toEqual(["Today", "Matches", "My MatchLab", "Journey", "Play"]);
  });

  it("marks the canonical owner active for a compatibility route", () => {
    renderNavigation("/matching");

    expect(
      screen.getByTestId("mobile-nav-matches").getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByTestId("mobile-nav-today").getAttribute("aria-current"),
    ).toBeNull();
  });

  it("provides an accessible navigation landmark", () => {
    renderNavigation("/journey");

    expect(
      screen.getByRole("navigation", {
        name: "Primary member destinations",
      }),
    ).toBeTruthy();
  });
});
