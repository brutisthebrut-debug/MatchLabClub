import {
  customFetch,
  type PhotoLabRankInput,
  type PhotoLabRankResult,
} from "@workspace/api-client-react";

export interface ProfilePhotoLabInputSnapshot {
  photos: Array<{
    id: string;
    shotType:
      | "solo_face"
      | "full_body"
      | "activity"
      | "group"
      | "candid"
      | "other";
    wellLit: boolean | null;
    genuineExpression: boolean | null;
  }>;
  datingGoal: string | null;
  sourceApp: string | null;
}

export interface ProfilePhotoLabRun {
  id: number;
  sourcePhotoIds: number[];
  inputSnapshot: ProfilePhotoLabInputSnapshot;
  result: PhotoLabRankResult;
  createdAt: string;
}

export async function listProfilePhotoLabRuns(): Promise<ProfilePhotoLabRun[]> {
  const response = await customFetch<{ runs: ProfilePhotoLabRun[] }>(
    "/api/me/photo-lab-runs",
    { responseType: "json" },
  );
  return response.runs;
}

export async function createProfilePhotoLabRun(
  input: PhotoLabRankInput,
): Promise<ProfilePhotoLabRun> {
  return customFetch<ProfilePhotoLabRun>("/api/me/photo-lab-runs", {
    method: "POST",
    body: JSON.stringify(input),
    responseType: "json",
  });
}

export async function deleteProfilePhotoLabRun(
  id: number,
): Promise<{ deleted: true; id: number }> {
  return customFetch<{ deleted: true; id: number }>(
    `/api/me/photo-lab-runs/${id}`,
    { method: "DELETE", responseType: "json" },
  );
}

/**
 * Canonical Profile Project presentation intentionally omits the engine's
 * numeric score. Members see ordered roles, rationale, notes, and provenance,
 * not a grade of their appearance or worth.
 */
export function presentPhotoLabRun(run: ProfilePhotoLabRun) {
  return {
    id: run.id,
    createdAt: run.createdAt,
    sourcePhotoIds: run.sourcePhotoIds,
    leadShotId: run.result.leadShotId,
    leadShotRationale: run.result.leadShotRationale,
    summary: run.result.summary,
    ranked: run.result.ranked.map(({ id, rank, role, isLead, notes }) => ({
      id,
      rank,
      role,
      isLead,
      notes,
    })),
    checklist: run.result.checklist,
    visionMode: run.result.visionMode,
    visionFallbackReason: run.result.visionFallbackReason,
    visionAnalysis: run.result.visionAnalysis,
  };
}
