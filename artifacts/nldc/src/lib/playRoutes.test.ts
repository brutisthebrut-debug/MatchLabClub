import { describe, expect, it } from "vitest";
import {
  embeddedPlayGame,
  PLAY_QUIZ_CATALOG_HREF,
  PLAY_THIS_OR_THAT_HREF,
  shouldFocusQuizCatalog,
} from "./playRoutes";

describe("Play compatibility routing", () => {
  it("keeps the retired Quiz Lab catalog focused on Play's quiz section", () => {
    expect(PLAY_QUIZ_CATALOG_HREF).toBe("/play?section=quizzes");
    expect(shouldFocusQuizCatalog(PLAY_QUIZ_CATALOG_HREF)).toBe(true);
    expect(shouldFocusQuizCatalog("/play", "?section=quizzes")).toBe(true);
    expect(shouldFocusQuizCatalog("/play")).toBe(false);
  });

  it("reopens the canonical embedded This or That experience", () => {
    expect(PLAY_THIS_OR_THAT_HREF).toBe("/play?game=this-or-that");
    expect(embeddedPlayGame(PLAY_THIS_OR_THAT_HREF)).toBe("this-or-that");
    expect(embeddedPlayGame("/play", "?game=this-or-that")).toBe("this-or-that");
    expect(embeddedPlayGame("/play?game=unknown")).toBeNull();
  });
});
