// Daily wellness question bank: a deterministic, DB-free pool of short questions
// per wellness dimension. The "Signal of the Day" drip serves one question a day
// from here. Picking is deterministic (least-covered dimension first, then the
// next unanswered question in that dimension) so the same question stays until it
// is answered, and coverage spreads across dimensions to lift distinct-dimension
// readiness fastest. Stable question ids (`daily:<dimension>:<n>`) mean an answer
// upserts one row per question and never clobbers hand-written wellness answers.

export interface BankQuestion {
  questionId: string;
  dimension: string;
  questionText: string;
}

// Dimensions in the same order as DIMENSION_LABELS in routes/wellness.ts. The
// order is the deterministic tie-break when two dimensions have equal coverage.
export const WELLNESS_DIMENSIONS = [
  "emotional",
  "physical",
  "social",
  "intellectual",
  "spiritual",
  "occupational",
  "financial",
  "environmental",
  "communication",
  "conflict",
  "boundaries",
  "affection",
  "intimacy",
  "lifestyle",
  "future_vision",
  "values",
  "family",
  "culture",
] as const;

const QUESTIONS_BY_DIMENSION: Record<string, string[]> = {
  emotional: [
    "When do you feel most like yourself?",
    "What helps you reset after a hard day?",
    "How do you usually know when something is bothering you?",
    "What does feeling emotionally safe with someone look like for you?",
  ],
  physical: [
    "What physical habits make you feel your best?",
    "How do you like to move your body in a normal week?",
    "What does rest look like when you actually let yourself have it?",
    "How does your energy tend to shift across a day?",
  ],
  social: [
    "What role does your social circle play in your dating life?",
    "Do you recharge more around people or on your own?",
    "How do you like to bring someone into your world of friends?",
    "What kind of plans with other people light you up?",
  ],
  intellectual: [
    "What topics make you lose track of time?",
    "What is something you have changed your mind about lately?",
    "How do you most enjoy learning something new?",
    "What is a question you keep coming back to?",
  ],
  spiritual: [
    "What principles guide your biggest decisions?",
    "Where do you find a sense of meaning?",
    "What grounds you when life feels uncertain?",
    "What does a life well lived look like to you?",
  ],
  occupational: [
    "What would you do with your time if money was not a factor?",
    "What part of your work feels most like you?",
    "How do you want work to fit around the rest of your life?",
    "What are you building toward right now?",
  ],
  financial: [
    "What does financial stability mean to you?",
    "How do you like to talk about money with a partner?",
    "What do you tend to spend on without thinking twice?",
    "How do you balance saving and enjoying the present?",
  ],
  environmental: [
    "What does your ideal living environment feel like?",
    "What makes a space feel like home to you?",
    "City, town, or somewhere quieter, and what draws you there?",
    "What is one thing in your space you would not give up?",
  ],
  communication: [
    "Are you someone who processes thoughts out loud or internally?",
    "What is your natural texting tempo?",
    "How do you like to be checked in on?",
    "What helps you feel actually heard?",
  ],
  conflict: [
    "How do you usually respond when you are upset?",
    "What helps you come back to someone after a disagreement?",
    "What does a good repair look like to you?",
    "How much time do you usually need before you can talk it through?",
  ],
  boundaries: [
    "What is something you have become stronger about as you have gotten older?",
    "How do you say no when you need to?",
    "What is a boundary you hold that matters to you?",
    "How do you like a partner to respond when you name a limit?",
  ],
  affection: [
    "What kinds of touch make you feel most cared for?",
    "What is your primary love language?",
    "How do you like to show someone you care?",
    "What small gesture means the most to you?",
  ],
  intimacy: [
    "What helps you feel emotionally and physically safe with someone?",
    "How quickly do you tend to develop feelings in early dating?",
    "What does closeness look like for you beyond the physical?",
    "What makes you feel truly known?",
  ],
  lifestyle: [
    "Are you an early riser or a night person?",
    "What does an ideal weekend look like for you?",
    "How much of your week do you like to leave unplanned?",
    "What is a daily ritual you protect?",
  ],
  future_vision: [
    "What kind of life are you trying to create?",
    "Where do you hope to be a few years from now?",
    "What does partnership add to the life you want?",
    "What is a dream you have not said out loud much?",
  ],
  values: [
    "What do you believe strongly even if others disagree?",
    "What is a value you will not compromise on in a relationship?",
    "Who has shaped what you stand for?",
    "What does integrity look like day to day for you?",
  ],
  family: [
    "What role does family play in your life today?",
    "What did you carry forward from how you grew up?",
    "How do you picture family in your own future?",
    "What does chosen family mean to you?",
  ],
  culture: [
    "What traditions matter to you?",
    "What part of your background are you proud of?",
    "How does culture show up in your daily life?",
    "What do you hope to share with a partner from where you come from?",
  ],
};

export const WELLNESS_QUESTION_BANK: readonly BankQuestion[] =
  WELLNESS_DIMENSIONS.flatMap((dimension) =>
    (QUESTIONS_BY_DIMENSION[dimension] ?? []).map((questionText, i) => ({
      questionId: `daily:${dimension}:${i + 1}`,
      dimension,
      questionText,
    })),
  );

export const WELLNESS_BANK_TOTAL = WELLNESS_QUESTION_BANK.length;

export interface DailyPickInput {
  /** Question ids the user has already answered (live, non-deleted). */
  answeredQuestionIds: ReadonlySet<string>;
  /** Live answer count per dimension, used to surface the least-covered first. */
  dimensionAnsweredCounts: ReadonlyMap<string, number>;
}

/**
 * Pick today's question deterministically: the least-covered dimension first
 * (ties broken by WELLNESS_DIMENSIONS order), then the first question in that
 * dimension the user has not answered yet. Returns null when every bank question
 * has already been answered.
 */
export function pickDailyQuestion(input: DailyPickInput): BankQuestion | null {
  const { answeredQuestionIds, dimensionAnsweredCounts } = input;

  const order = [...WELLNESS_DIMENSIONS].sort((a, b) => {
    const ca = dimensionAnsweredCounts.get(a) ?? 0;
    const cb = dimensionAnsweredCounts.get(b) ?? 0;
    if (ca !== cb) return ca - cb;
    return WELLNESS_DIMENSIONS.indexOf(a) - WELLNESS_DIMENSIONS.indexOf(b);
  });

  for (const dimension of order) {
    const next = WELLNESS_QUESTION_BANK.find(
      (q) => q.dimension === dimension && !answeredQuestionIds.has(q.questionId),
    );
    if (next) return next;
  }
  return null;
}
