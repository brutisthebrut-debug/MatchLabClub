export const PROFILE_PROJECT_AUDIT_CAPTURE_HREF =
  "/my-matchlab/profile#audit-capture";

export function profileProjectAuditHistoryHref(
  auditId: string | number | null | undefined,
): string {
  const normalized = String(auditId ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    return "/my-matchlab/profile#audit-history";
  }
  return `/my-matchlab/profile?audit=${normalized}#audit-history`;
}
