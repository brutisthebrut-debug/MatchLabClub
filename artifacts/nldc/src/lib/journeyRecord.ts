export type JourneyRecordKind = "reflection" | "date";

export interface JourneyRecordItem {
  id: string;
  kind: JourneyRecordKind;
  source: { type: "journal_entry" | "post_date_note"; id: number; label: string };
  title: string;
  body: string;
  details: Record<string, unknown>;
  occurredAt: string;
  updatedAt: string;
  href: string;
}

export interface JourneyRecordResponse {
  summary: { total: number; reflections: number; dates: number; headline: string };
  records: JourneyRecordItem[];
}

export async function getJourneyRecord(): Promise<JourneyRecordResponse> {
  const response = await fetch("/api/me/journey/record", { credentials: "include" });
  const body = (await response.json().catch(() => null)) as JourneyRecordResponse | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && "error" in body && body.error ? body.error : "Your Journey could not load.");
  }
  return body as JourneyRecordResponse;
}
