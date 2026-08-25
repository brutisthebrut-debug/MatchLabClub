export const GUIDED_DEBRIEF_HREF = "/journey?capture=guided-date";

export interface JourneyRouteState {
  view: "active" | "trash";
  kind: "all" | "reflection" | "date";
  query: string;
  source: { type: "journal_entry" | "post_date_note"; id: number } | null;
}

function routeParams(location: string, browserSearch = ""): URLSearchParams {
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : browserSearch;
  return new URLSearchParams(query);
}

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function shouldOpenGuidedDebrief(location: string, browserSearch = ""): boolean {
  return routeParams(location, browserSearch).get("capture") === "guided-date";
}

export function readJourneyRouteState(location: string, browserSearch = ""): JourneyRouteState {
  const params = routeParams(location, browserSearch);
  const reflectionId = positiveId(params.get("reflection"));
  const dateId = positiveId(params.get("date"));
  const requestedKind = params.get("kind");
  return {
    view: params.get("view") === "trash" ? "trash" : "active",
    kind: requestedKind === "reflection" || requestedKind === "date" ? requestedKind : "all",
    query: params.get("q")?.trim() ?? "",
    source: reflectionId
      ? { type: "journal_entry", id: reflectionId }
      : dateId ? { type: "post_date_note", id: dateId } : null,
  };
}

function compatibilityHref(kind: "reflection" | "date", idKey: "entry" | "note", location: string, browserSearch = ""): string {
  const from = routeParams(location, browserSearch);
  const to = new URLSearchParams();
  to.set("kind", kind);
  if (from.get("view") === "trash") to.set("view", "trash");
  const q = from.get("q")?.trim();
  if (q) to.set("q", q);
  const id = positiveId(from.get(idKey));
  if (id) to.set(kind, String(id));
  return `/journey?${to.toString()}`;
}

export function journalCompatibilityHref(location: string, browserSearch = ""): string {
  return compatibilityHref("reflection", "entry", location, browserSearch);
}

export function datesCompatibilityHref(location: string, browserSearch = ""): string {
  return compatibilityHref("date", "note", location, browserSearch);
}
