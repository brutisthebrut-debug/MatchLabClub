export type CommunicationLens = "connection_style" | "personal_blueprint";

export interface CommunicationRecord<TInput = Record<string, unknown>, TResult = Record<string, unknown>> {
  lens: CommunicationLens;
  input: TInput;
  result: TResult;
  generatedBy: "ai" | "deterministic" | "legacy_local";
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && body.error
      ? body.error : "Your Communication record could not be updated.");
  }
  return body as T;
}

export function listCommunicationRecords(): Promise<{ records: CommunicationRecord[] }> {
  return json("/me/communication");
}

export function saveCommunicationRecord<TInput, TResult>(
  lens: CommunicationLens,
  value: { input: TInput; result: TResult; generatedBy: CommunicationRecord["generatedBy"]; confidence: number },
): Promise<CommunicationRecord<TInput, TResult>> {
  return json(`/me/communication/${lens}`, { method: "PUT", body: JSON.stringify(value) });
}

export function deleteCommunicationRecord(lens: CommunicationLens): Promise<{ deleted: boolean }> {
  return json(`/me/communication/${lens}`, { method: "DELETE" });
}
