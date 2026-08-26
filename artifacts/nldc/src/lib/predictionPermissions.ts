export interface PredictionPermissions {
  echoUse?: boolean;
  learningConfirmed?: boolean;
  matchingUse?: boolean;
}

export async function updatePredictionPermissions(itemId: string, permissions: PredictionPermissions): Promise<void> {
  const response = await fetch(`/api/me/predictions/${encodeURIComponent(itemId)}/permissions`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(permissions),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Permission update failed.");
}
