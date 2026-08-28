export type JourneyRecordKind = "reflection" | "date" | "win" | "experiment" | "follow-up" | "play" | "insight" | "compatibility" | "introduction";

export type JourneySourceType = "journal_entry" | "post_date_note" | "dating_win" | "journey_experiment";

export interface JourneyRecordItem {
  id: string;
  kind: JourneyRecordKind;
  source: { type: JourneySourceType | "journey_follow_up" | "play_record" | "insight_record" | "compatibility_read" | "match_connection"; id: number | string; label: string };
  title: string;
  body: string;
  details: Record<string, unknown>;
  occurredAt: string;
  updatedAt: string;
  href: string;
}

export interface JourneyRecordResponse {
  summary: { total: number; reflections: number; dates: number; wins: number; experiments: number; followUps: number; play: number; insights: number; compatibility: number; introductions: number; headline: string };
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

export type WinCategory = "sent-it" | "great-convo" | "got-a-date" | "noticed-something" | "personal-win";

export interface WinInput {
  category: WinCategory;
  body: string;
}

export type ExperimentStatus = "planned" | "tried" | "helped" | "did-not-help";

export interface ExperimentInput {
  title: string;
  description: string;
  status: ExperimentStatus;
  result: string;
}

export type FollowUpStatus = "pending" | "answered" | "skipped";

export interface FollowUpInput {
  sourceType: JourneySourceType;
  sourceId: number;
  sourceLabel: string;
  question: string;
  status: FollowUpStatus;
  answer: string;
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

export async function saveWin(input: WinInput, id?: number): Promise<{ id: number }> {
  return request<{ id: number }>(id ? `/api/me/dating-wins/${id}` : "/api/me/dating-wins", id ? "PATCH" : "POST", input);
}

export async function saveExperiment(input: ExperimentInput, id?: number): Promise<{ id: number }> {
  return request<{ id: number }>(id ? `/api/me/journey/experiments/${id}` : "/api/me/journey/experiments", id ? "PATCH" : "POST", input);
}

export async function saveFollowUp(input: FollowUpInput, id?: number): Promise<{ id: number }> {
  return request<{ id: number }>(id ? `/api/me/journey/follow-ups/${id}` : "/api/me/journey/follow-ups", id ? "PATCH" : "POST", input);
}

function sourcePath(item: JourneyRecordItem): string {
  if (item.source.type === "play_record" || item.source.type === "insight_record" || item.source.type === "compatibility_read" || item.source.type === "match_connection") {
    throw new Error("This history is read-only in Journey.");
  }
  if (item.source.type === "journal_entry") return `/api/journal/${item.source.id}`;
  if (item.source.type === "post_date_note") return `/api/post-date-notes/${item.source.id}`;
  if (item.source.type === "dating_win") return `/api/me/dating-wins/${item.source.id}`;
  if (item.source.type === "journey_experiment") return `/api/me/journey/experiments/${item.source.id}`;
  return `/api/me/journey/follow-ups/${item.source.id}`;
}

export async function removeJourneyItem(item: JourneyRecordItem): Promise<unknown> {
  return request(sourcePath(item), "DELETE");
}

export async function restoreJourneyItem(item: JourneyRecordItem): Promise<unknown> {
  return request(`${sourcePath(item)}/restore`, "POST");
}
