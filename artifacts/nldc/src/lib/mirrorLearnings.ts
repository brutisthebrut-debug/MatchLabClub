export type MirrorLearningStatus = "proposed" | "confirmed" | "dismissed";

export interface MirrorLearning {
  id: number;
  source: { type: string; ref: string; label: string };
  observation: string;
  proposedLearning: string;
  memberLearning: string | null;
  status: MirrorLearningStatus;
  confidence: number;
  matchingUseApproved: boolean;
  confirmedAt: string | null;
  dismissedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type LearningEnvelope = { learnings: MirrorLearning[] };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "error" in body && body.error
        ? body.error
        : "Your Mirror learning could not be updated.",
    );
  }
  return body as T;
}

export function listMirrorLearnings(): Promise<LearningEnvelope> {
  return json("/me/mirror-learnings");
}

export function syncMirrorLearnings(): Promise<LearningEnvelope> {
  return json("/me/mirror-learnings/sync", { method: "POST" });
}

export function proposeCommunicationLearning(
  source: "care_dialect" | "standards" | "connection_style" | "personal_blueprint",
): Promise<MirrorLearning> {
  return json("/me/mirror-learnings/communication", {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

export type MirrorLearningDecision =
  | { action: "confirm" }
  | { action: "revise"; learning: string }
  | { action: "dismiss" }
  | { action: "unconfirm" }
  | { action: "set_matching"; approved: boolean };

export function decideMirrorLearning(
  id: number,
  decision: MirrorLearningDecision,
): Promise<MirrorLearning> {
  return json(`/me/mirror-learnings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(decision),
  });
}
