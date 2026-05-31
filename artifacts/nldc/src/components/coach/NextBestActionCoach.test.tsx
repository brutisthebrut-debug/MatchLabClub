import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The container half of this module imports these workspace packages at module
// scope. We only exercise the pure View, so stub them to keep the transform off
// the prebuilt lib sources.
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, login: () => {}, user: null }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetMatchingState: () => ({ data: undefined, isLoading: false }),
  getGetMatchingStateQueryKey: () => ["matching-state"],
}));

import { NextBestActionCoachView } from "./NextBestActionCoach";

const ACTION = {
  key: "wellness",
  label: "Run a wellness pass",
  detail: "Answer a few prompts so the machine can read where your head is at.",
  points: 12,
  href: "/wellness",
};

afterEach(() => cleanup());

describe("NextBestActionCoachView", () => {
  it("shows the single action with its reason, expected gain, and a CTA", () => {
    render(<NextBestActionCoachView action={ACTION} eligible={false} />);

    expect(screen.getByText(ACTION.label)).toBeTruthy();
    expect(screen.getByText(ACTION.detail)).toBeTruthy();
    expect(screen.getByTestId("next-best-action-gain").textContent).toContain(
      "+12 readiness",
    );
    const cta = screen.getByTestId("next-best-action-cta") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/wellness");
  });

  it("hides the gain badge when the action is worth no points", () => {
    render(
      <NextBestActionCoachView action={{ ...ACTION, points: 0 }} eligible={false} />,
    );
    expect(screen.queryByTestId("next-best-action-gain")).toBeNull();
  });

  it("shows a match-ready state pointing at matching when eligible with no action", () => {
    render(<NextBestActionCoachView action={null} eligible={true} />);

    expect(screen.getByText("You are match ready")).toBeTruthy();
    const cta = screen.getByTestId("next-best-action-cta") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/matching");
  });

  it("renders nothing when there is no action and the user is not eligible", () => {
    const { container } = render(
      <NextBestActionCoachView action={null} eligible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("respects a custom testId", () => {
    render(
      <NextBestActionCoachView
        action={ACTION}
        eligible={false}
        testId="tool-handoff-coach"
      />,
    );
    expect(screen.getByTestId("tool-handoff-coach")).toBeTruthy();
    expect(screen.getByTestId("tool-handoff-coach-cta")).toBeTruthy();
  });
});
