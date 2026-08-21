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
  detail: "Answer a few prompts so Echo can understand where your head is at.",
  points: 12,
  href: "/wellness",
};

afterEach(() => cleanup());

describe("NextBestActionCoachView", () => {
  it("shows one Echo suggestion without a score reward", () => {
    render(<NextBestActionCoachView action={ACTION} eligible={false} />);

    expect(screen.getByText(ACTION.label)).toBeTruthy();
    expect(screen.getByText(ACTION.detail)).toBeTruthy();
    expect(screen.getByText("Echo's suggestion")).toBeTruthy();
    expect(screen.queryByTestId("next-best-action-gain")).toBeNull();
    const cta = screen.getByTestId("next-best-action-cta") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/wellness");
  });

  it("does not restore a gain badge when the legacy action carries zero points", () => {
    render(
      <NextBestActionCoachView action={{ ...ACTION, points: 0 }} eligible={false} />,
    );
    expect(screen.queryByTestId("next-best-action-gain")).toBeNull();
  });

  it("separates a broad profile read from matching access", () => {
    render(<NextBestActionCoachView action={null} eligible={true} />);

    expect(
      screen.getByText("Echo has enough for a real profile read"),
    ).toBeTruthy();
    expect(screen.getByText(/does not promise a match/i)).toBeTruthy();
    const cta = screen.getByTestId("next-best-action-cta") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/echo");
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
