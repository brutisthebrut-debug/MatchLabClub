export interface ScenarioPermissions {
  echoUse?: boolean;
  learningConfirmed?: boolean;
  matchingUse?: boolean;
}

export async function updateScenarioPermissions(scenarioId: string, permissions: ScenarioPermissions): Promise<void> {
  const response = await fetch(`/api/me/scenarios/${encodeURIComponent(scenarioId)}/permissions`, {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(permissions),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Permission update failed.");
}
