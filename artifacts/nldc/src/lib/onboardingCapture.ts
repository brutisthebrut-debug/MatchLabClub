import { STARTER_MODULE } from "@/lib/wellnessQuestionBank";

export type OnboardingStarterAnswer = {
  questionId: string;
  dimension: string;
  category: string | null;
  questionText: string;
  answer: string;
  consentLevel: "coaching";
};

export function buildOnboardingStarterAnswers(
  answers: Record<string, string>,
): OnboardingStarterAnswer[] {
  return Object.entries(answers).flatMap(([questionId, rawAnswer]) => {
    const answer = rawAnswer.trim();
    if (!answer) return [];

    const question = STARTER_MODULE.find((item) => item.id === questionId);
    if (!question) return [];

    return [
      {
        questionId,
        dimension: question.dimension,
        category: question.category ?? null,
        questionText: question.text,
        answer,
        consentLevel: "coaching" as const,
      },
    ];
  });
}
