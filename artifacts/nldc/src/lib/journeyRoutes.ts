export const GUIDED_DEBRIEF_HREF = "/journey?capture=guided-date";

export function shouldOpenGuidedDebrief(location: string, browserSearch = ""): boolean {
  return `${location}${browserSearch}`.includes("capture=guided-date");
}
