import type { Audit, AuditReport, AuditReportVersion } from "@workspace/api-client-react";

export interface ProfileAuditRecord {
  audit: Audit;
  report: AuditReport | null;
  generatedAt: string | null;
  versionId: number | null;
  provenance: string;
}

export function auditProvenance(audit: Audit): string {
  const origin =
    audit.source === "screenshot"
      ? "Profile screenshot"
      : "Member-entered profile";
  const app = audit.sourceApp?.trim();
  return app ? `${origin} · ${app}` : origin;
}

export function currentAuditRecord(audit: Audit): ProfileAuditRecord {
  return {
    audit,
    report: audit.report ?? null,
    generatedAt: audit.reportGeneratedAt ?? null,
    versionId: null,
    provenance: auditProvenance(audit),
  };
}

export function versionedAuditRecord(
  audit: Audit,
  version: AuditReportVersion,
): ProfileAuditRecord {
  return {
    audit,
    report: version.report,
    generatedAt: version.generatedAt,
    versionId: version.id,
    provenance: auditProvenance(audit),
  };
}

export function reportSections(report: AuditReport | null) {
  if (!report) {
    return {
      strengths: [] as string[],
      cautions: [] as string[],
      bioRead: null as string | null,
      suggestedBio: null as string | null,
      prompts: [] as AuditReport["rewrittenPrompts"],
      actions: [] as string[],
    };
  }

  return {
    strengths: report.strengths,
    cautions: report.risks,
    bioRead: report.bioAudit,
    suggestedBio: report.rewrittenBio,
    prompts: report.rewrittenPrompts,
    actions: report.actionPlan.map(
      (item) => item.title + ": " + item.description,
    ),
  };
}
