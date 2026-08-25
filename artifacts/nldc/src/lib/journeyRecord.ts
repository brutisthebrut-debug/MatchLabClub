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

export interface ReflectionInput {
  prompt: string | null;
  body: string;
  tags: string[];
  mood: number | null;
}

export type DateOutcome = "another_date" | "no_more" | "unsure" | "ghosted";

export interface DateDebriefInput {
  dateAt: string | null;
  personLabel: string | null;
  platform: string | null;
  summary: string;
  whatWentWell: string;
  whatDidnt: string;
  followUpPlanned: boolean;
  outcome: DateOutcome | null;
}

async function request<T>(url: string, method: "POST" | "PATCH" | "DELETE", payload?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    ...(payload === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && typeof body === "object" && "error" in body && body.error
      ? body.error
      : "That moment could not be saved.");
  }
  return body as T;
}

export async function getJourneyRecord(view: "active" | "trash" = "active"): Promise<JourneyRecordResponse> {
  const url = view === "trash" ? "/api/me/journey/record?view=trash" : "/api/me/journey/record";
  const response = await fetch(url, { credentials: "include" });
  const body = (await response.json().catch(() => null)) as JourneyRecordResponse | { error?: string } | null;
  if (!response.ok) {
    throw new Error(body && "error" in body && body.error ? body.error : "Your Journey could not load.");
  }
  return body as JourneyRecordResponse;
}

export async function saveReflection(input: ReflectionInput, id?: number): Promise<{ id: number }> {
  return request<{ id: number }>(id ? `/api/journal/${id}` : "/api/journal", id ? "PATCH" : "POST", input);
}

export async function saveDateDebrief(input: DateDebriefInput, id?: number): Promise<{ id: number }> {
  return request<{ id: number }>(id ? `/api/post-date-notes/${id}` : "/api/post-date-notes", id ? "PATCH" : "POST", input);
}

function sourcePath(item: JourneyRecordItem): string {
  return item.source.type === "journal_entry" ? `/api/journal/${item.source.id}` : `/api/post-date-notes/${item.source.id}`;
}

export async function removeJourneyItem(item: JourneyRecordItem): Promise<unknown> {
  return request(sourcePath(item), "DELETE");
}

export async function restoreJourneyItem(item: JourneyRecordItem): Promise<unknown> {
  return request(`${sourcePath(item)}/restore`, "POST");
}
