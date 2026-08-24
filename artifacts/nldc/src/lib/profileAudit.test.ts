import { describe, expect, it } from "vitest";
import { ApiError } from "@workspace/api-client-react";
import { auditFailureDetails } from "./profileAudit";

describe("Profile Project audit failure presentation", () => {
  it("presents every server evidence reason without substituting a result", () => {
    const response = new Response(null, {
      status: 422,
      statusText: "Unprocessable Content",
    });
    const error = new ApiError(
      response,
      {
        error: "insufficient_evidence",
        message: "This source does not contain enough reliable profile evidence.",
        fields: ["bio"],
        reasons: ["Add two specific sentences.", "Remove placeholder text."],
      },
      { method: "POST", url: "/api/me/profile-project/audits" },
    );

    expect(auditFailureDetails(error)).toEqual({
      title: "This source does not contain enough reliable profile evidence.",
      reasons: ["Add two specific sentences.", "Remove placeholder text."],
    });
  });

  it("uses an honest failure state for non-evidence errors", () => {
    const result = auditFailureDetails(new Error("offline"));
    expect(result.title).toBe("The read could not be generated.");
    expect(result.reasons.join(" ")).toContain("No");
    expect(JSON.stringify(result)).not.toContain("score");
  });
});
