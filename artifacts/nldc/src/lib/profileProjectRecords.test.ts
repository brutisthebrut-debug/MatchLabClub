import { describe, expect, it } from "vitest";
import type {
  Audit,
  AuditReport,
  AuditReportVersion,
} from "@workspace/api-client-react";
import {
  auditProvenance,
  currentAuditRecord,
  reportSections,
  versionedAuditRecord,
} from "./profileProjectRecords";

const audit = {
  id: 42,
  firstName: "Daniel",
  age: 41,
  gender: "man",
  datingGoal: "relationship",
  currentApps: ["Hinge"],
  bio: "A real profile",
  status: "complete",
  source: "screenshot",
  sourceApp: "Hinge",
  readinessScore: 88,
  createdAt: "2026-08-24T12:00:00.000Z",
  reportGeneratedAt: "2026-08-24T12:05:00.000Z",
} as Audit;

const report = {
  auditId: 42,
  readinessScore: 88,
  overallGrade: "A",
  strengths: ["Specific and warm"],
  risks: ["One prompt is generic"],
  bioAudit: "The bio feels human.",
  rewrittenBio: "A clearer bio.",
  rewrittenPrompts: [],
  photoGuidance: [],
  actionPlan: [
    {
      priority: 1,
      title: "Tighten the opener",
      description: "Lead with the specific story.",
      timeframe: "today",
    },
  ],
  messagingStyle: "direct",
  coachingCta: "Keep going",
} as AuditReport;

describe("Profile Project records", () => {
  it("keeps source provenance visible", () => {
    expect(auditProvenance(audit)).toBe("Profile screenshot · Hinge");
    expect(currentAuditRecord({ ...audit, report }).provenance).toBe(
      "Profile screenshot · Hinge",
    );
  });

  it("reopens an exact historical report version", () => {
    const version = {
      id: 7,
      auditId: 42,
      readinessScore: 77,
      report: { ...report, readinessScore: 77 },
      generatedAt: "2026-08-20T10:00:00.000Z",
    } as AuditReportVersion;

    const record = versionedAuditRecord(audit, version);

    expect(record.versionId).toBe(7);
    expect(record.generatedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(record.report?.readinessScore).toBe(77);
  });

  it("builds a non-grading member view while preserving the report", () => {
    const sections = reportSections(report);

    expect(sections).toEqual({
      strengths: ["Specific and warm"],
      cautions: ["One prompt is generic"],
      bioRead: "The bio feels human.",
      suggestedBio: "A clearer bio.",
      actions: ["Tighten the opener: Lead with the specific story."],
    });
    expect(sections).not.toHaveProperty("readinessScore");
    expect(sections).not.toHaveProperty("overallGrade");
  });
});
