export const PLAY_QUIZ_CATALOG_HREF = "/play?section=quizzes";

export function shouldFocusQuizCatalog(location: string, browserSearch = ""): boolean {
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : browserSearch;
  return new URLSearchParams(query).get("section") === "quizzes";
}
