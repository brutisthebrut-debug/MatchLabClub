export const PLAY_QUIZ_CATALOG_HREF = "/play?section=quizzes";
export const PLAY_THIS_OR_THAT_HREF = "/play?game=this-or-that";
export const PLAY_WOULD_YOU_RATHER_HREF = "/play?game=would-you-rather";
export const PLAY_DAILY_SPARK_HREF = "/play?game=daily-spark";
export const PLAY_SCENARIOS_HREF = "/play?game=scenarios";
export const PLAY_PREDICT_HREF = "/play?game=predict";

export type EmbeddedPlayGame = "this-or-that" | "would-you-rather" | "daily-spark" | "scenarios" | "predict";

function queryFor(location: string, browserSearch = ""): URLSearchParams {
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : browserSearch;
  return new URLSearchParams(query);
}

export function shouldFocusQuizCatalog(location: string, browserSearch = ""): boolean {
  return queryFor(location, browserSearch).get("section") === "quizzes";
}

export function embeddedPlayGame(location: string, browserSearch = ""): EmbeddedPlayGame | null {
  const game = queryFor(location, browserSearch).get("game");
  return game === "this-or-that" || game === "would-you-rather" || game === "daily-spark" || game === "scenarios" || game === "predict" ? game : null;
}
