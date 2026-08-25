export interface MirrorTrendSource {
  learningId: number;
  source: { type: string; ref: string; label: string };
  text: string;
  status: string;
  confidence: number;
  matchingUseApproved: boolean;
  updatedAt: string | null;
}

export interface MirrorTrendReport {
  summary: { confirmed: number; inReview: number; dismissed: number; headline: string };
  sources: MirrorTrendSource[];
  uncertainties: Array<{ learningId: number; sourceLabel: string; confidence: number; reason: string }>;
  contradictions: Array<{
    label: string;
    left: { learningId: number; sourceLabel: string; text: string };
    right: { learningId: number; sourceLabel: string; text: string };
  }>;
  changes: Array<{
    id: number;
    learningId: number | null;
    action: string;
    source: { type: string; ref: string; label: string };
    priorStatus: string | null;
    newStatus: string | null;
    priorText: string | null;
    newText: string | null;
    confidence: number;
    matchingUseApproved: boolean;
    createdAt: string | null;
  }>;
}

export async function getMirrorTrends(): Promise<MirrorTrendReport> {
  const response = await fetch("/api/me/mirror-trends", { credentials: "include" });
  const body = (await response.json().catch(() => null)) as MirrorTrendReport | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && "error" in body && body.error ? body.error : "Your Mirror changes could not load.");
  }
  return body as MirrorTrendReport;
}
