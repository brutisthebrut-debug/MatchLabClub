import { describe, expect, it } from "vitest";
import { PLAY_QUIZ_CATALOG_HREF, shouldFocusQuizCatalog } from "./playRoutes";

describe("Play compatibility routing", () => {
  it("keeps the retired Quiz Lab catalog focused on Play's quiz section", () => {
    expect(PLAY_QUIZ_CATALOG_HREF).toBe("/play?section=quizzes");
    expect(shouldFocusQuizCatalog(PLAY_QUIZ_CATALOG_HREF)).toBe(true);
    expect(shouldFocusQuizCatalog("/play", "?section=quizzes")).toBe(true);
    expect(shouldFocusQuizCatalog("/play")).toBe(false);
  });
});
