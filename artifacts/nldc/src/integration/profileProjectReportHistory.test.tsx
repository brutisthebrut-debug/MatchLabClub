import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { AuditReport } from "@workspace/api-client-react";
import { ProfileAuditReportView } from "@/pages/ProfileProject";
import { reportSections } from "@/lib/profileProjectRecords";

function report(label: "CURRENT" | "PREVIOUS"): AuditReport {
  return {
    auditId: 42,
    readinessScore: label === "CURRENT" ? 72 : 55,
    overallGrade: label === "CURRENT" ? "B" : "C",
    strengths: [`${label} strength`],
    risks: [`${label} caution`],
    bioAudit: `${label} bio read`,
    rewrittenBio: `${label}_REWRITTEN_BIO`,
    rewrittenPrompts: [
      {
        original: "The way to win me over is...",
        rewritten: `${label}_PROMPT_REWRITE`,
        tip: `${label} prompt tip`,
      },
    ],
    photoGuidance: [],
    actionPlan: [
      {
        priority: 1,
        title: `${label}_ACTION_TITLE`,
        description: `${label} action description`,
        timeframe: "This week",
      },
    ],
    messagingStyle: `${label} messaging style`,
    coachingCta: `${label} coaching CTA`,
  };
}

let clipboardWrite: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: clipboardWrite },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Profile Project audit report history", () => {
  it("presents the complete non-grading current report", () => {
    render(<ProfileAuditReportView sections={reportSections(report("CURRENT"))} />);

    expect(screen.getByText("CURRENT bio read")).toBeTruthy();
    expect(screen.getByText("CURRENT strength")).toBeTruthy();
    expect(screen.getByText("CURRENT caution")).toBeTruthy();
    expect(screen.getByText("CURRENT_REWRITTEN_BIO")).toBeTruthy();
    expect(screen.getByText("CURRENT_PROMPT_REWRITE")).toBeTruthy();
    expect(
      screen.getByText("CURRENT_ACTION_TITLE: CURRENT action description"),
    ).toBeTruthy();
    expect(screen.queryByText("72")).toBeNull();
    expect(screen.queryByText("B")).toBeNull();
  });

  it("copies the current bio, prompt, and action with visible feedback", async () => {
    render(<ProfileAuditReportView sections={reportSections(report("CURRENT"))} />);

    const bio = screen.getByTestId("profile-audit-suggested-bio");
    const prompt = screen.getByTestId("profile-audit-prompt-0");
    const action = screen.getByTestId("profile-audit-action-0");

    for (const region of [bio, prompt, action]) {
      const button = within(region).getByRole("button", { name: "Copy" });
      fireEvent.click(button);
      await waitFor(() => expect(button.textContent).toMatch(/copied/i));
    }

    expect(clipboardWrite).toHaveBeenNthCalledWith(1, "CURRENT_REWRITTEN_BIO");
    expect(clipboardWrite).toHaveBeenNthCalledWith(2, "CURRENT_PROMPT_REWRITE");
    expect(clipboardWrite).toHaveBeenNthCalledWith(
      3,
      "CURRENT_ACTION_TITLE: CURRENT action description",
    );
  });

  it("reopens and copies the exact saved report version", async () => {
    const { rerender } = render(
      <ProfileAuditReportView sections={reportSections(report("CURRENT"))} />,
    );

    rerender(
      <ProfileAuditReportView sections={reportSections(report("PREVIOUS"))} />,
    );

    expect(screen.queryByText("CURRENT_REWRITTEN_BIO")).toBeNull();
    expect(screen.getByText("PREVIOUS_REWRITTEN_BIO")).toBeTruthy();
    expect(screen.getByText("PREVIOUS_PROMPT_REWRITE")).toBeTruthy();
    expect(
      screen.getByText("PREVIOUS_ACTION_TITLE: PREVIOUS action description"),
    ).toBeTruthy();

    const prompt = screen.getByTestId("profile-audit-prompt-0");
    fireEvent.click(within(prompt).getByRole("button", { name: "Copy" }));

    await waitFor(() =>
      expect(clipboardWrite).toHaveBeenCalledWith("PREVIOUS_PROMPT_REWRITE"),
    );
  });
});
