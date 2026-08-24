import { describe, expect, it } from "vitest";
import { STARTER_MODULE } from "./wellnessQuestionBank";
import { buildOnboardingStarterAnswers } from "./onboardingCapture";

describe("buildOnboardingStarterAnswers", () => {
  it("makes every saved starter answer explicitly coaching-only", () => {
    const question = STARTER_MODULE[0];
    const result = buildOnboardingStarterAnswers({
      [question.id]: "  Something true about me.  ",
    });

    expect(result).toEqual([
      {
        questionId: question.id,
        dimension: question.dimension,
        category: question.category ?? null,
        questionText: question.text,
        answer: "Something true about me.",
        consentLevel: "coaching",
      },
    ]);
  });

  it("does not create records for blank or unknown answers", () => {
    expect(
      buildOnboardingStarterAnswers({
        [STARTER_MODULE[0].id]: "   ",
        not_a_starter_question: "Do not save me",
      }),
    ).toEqual([]);
  });

  it("never infers matching, research, or all-use consent", () => {
    const answers = Object.fromEntries(
      STARTER_MODULE.map((question) => [question.id, "Shared for Echo"]),
    );

    expect(
      buildOnboardingStarterAnswers(answers).every(
        (answer) => answer.consentLevel === "coaching",
      ),
    ).toBe(true);
  });
});
