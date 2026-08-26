import { describe, expect, it } from "vitest";
import {
  embeddedPlayGame,
  PLAY_DAILY_SPARK_HREF,
  PLAY_QUIZ_CATALOG_HREF,
  PLAY_SCENARIOS_HREF,
  PLAY_THIS_OR_THAT_HREF,
  PLAY_WOULD_YOU_RATHER_HREF,
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
    expect(shouldFocusQuizCatalog(PLAY_THIS_OR_THAT_HREF)).toBe(false);
  });

  it("reopens the canonical embedded Would You Rather history and capture", () => {
    expect(PLAY_WOULD_YOU_RATHER_HREF).toBe("/play?game=would-you-rather");
    expect(embeddedPlayGame(PLAY_WOULD_YOU_RATHER_HREF)).toBe("would-you-rather");
    expect(shouldFocusQuizCatalog(PLAY_WOULD_YOU_RATHER_HREF)).toBe(false);
  });

  it("reopens the canonical embedded Daily Spark history and capture", () => {
    expect(PLAY_DAILY_SPARK_HREF).toBe("/play?game=daily-spark");
    expect(embeddedPlayGame(PLAY_DAILY_SPARK_HREF)).toBe("daily-spark");
    expect(shouldFocusQuizCatalog(PLAY_DAILY_SPARK_HREF)).toBe(false);
  });

  it("reopens the canonical embedded Scenarios history and capture", () => {
    expect(PLAY_SCENARIOS_HREF).toBe("/play?game=scenarios");
    expect(embeddedPlayGame(PLAY_SCENARIOS_HREF)).toBe("scenarios");
    expect(shouldFocusQuizCatalog(PLAY_SCENARIOS_HREF)).toBe(false);
  });
});
