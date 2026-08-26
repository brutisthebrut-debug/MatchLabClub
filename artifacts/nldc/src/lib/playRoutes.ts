export const PLAY_QUIZ_CATALOG_HREF = "/play?section=quizzes";
export const PLAY_THIS_OR_THAT_HREF = "/play?game=this-or-that";

export type EmbeddedPlayGame = "this-or-that";

function queryFor(location: string, browserSearch = ""): URLSearchParams {
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : browserSearch;
  return new URLSearchParams(query);
}

export function shouldFocusQuizCatalog(location: string, browserSearch = ""): boolean {
  return queryFor(location, browserSearch).get("section") === "quizzes";
}

export function embeddedPlayGame(location: string, browserSearch = ""): EmbeddedPlayGame | null {
  const game = queryFor(location, browserSearch).get("game");
  return game === "this-or-that" ? game : null;
}
