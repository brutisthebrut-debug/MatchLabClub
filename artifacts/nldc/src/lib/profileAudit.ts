import {
  ApiError,
  customFetch,
  type Audit,
  type AuditInput,
  type AuditReport,
} from "@workspace/api-client-react";

export interface InsufficientAuditEvidence {
  error: "insufficient_evidence";
  message: string;
  fields: string[];
  reasons: string[];
}

export interface ProfileProjectAuditResult {
  audit: Audit;
  report: AuditReport;
}

export async function createProfileProjectAudit(
  input: AuditInput,
): Promise<ProfileProjectAuditResult> {
  return customFetch<ProfileProjectAuditResult>(
    "/api/me/profile-project/audits",
    {
      method: "POST",
      body: JSON.stringify(input),
      responseType: "json",
    },
  );
}

export function auditFailureDetails(error: unknown): {
  title: string;
  reasons: string[];
} {
  if (error instanceof ApiError && error.status === 422) {
    const data = error.data as Partial<InsufficientAuditEvidence> | null;
    return {
      title: data?.message ?? "There is not enough evidence for a reliable read yet.",
      reasons:
        Array.isArray(data?.reasons) && data.reasons.length > 0
          ? data.reasons.filter(
              (reason): reason is string => typeof reason === "string",
            )
          : ["Add more specific profile text, then try again."],
    };
  }
  return {
    title: "The read could not be generated.",
    reasons: [
      "Nothing was presented as a result. Your earlier saved records are unchanged.",
    ],
  };
}
