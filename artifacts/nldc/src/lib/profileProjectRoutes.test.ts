import { describe, expect, it } from "vitest";
import {
  PROFILE_PROJECT_AUDIT_CAPTURE_HREF,
  profileProjectAuditHistoryHref,
} from "./profileProjectRoutes";

describe("legacy audit route handoff", () => {
  it("preserves a durable report id in the canonical history URL", () => {
    expect(profileProjectAuditHistoryHref(47)).toBe(
      "/my-matchlab/profile?audit=47#audit-history",
    );
  });

  it("fails closed to history for a malformed id", () => {
    expect(profileProjectAuditHistoryHref("../other")).toBe(
      "/my-matchlab/profile#audit-history",
    );
  });

  it("keeps capture deep links anchored to the canonical workflow", () => {
    expect(PROFILE_PROJECT_AUDIT_CAPTURE_HREF).toBe(
      "/my-matchlab/profile#audit-capture",
    );
  });
});
