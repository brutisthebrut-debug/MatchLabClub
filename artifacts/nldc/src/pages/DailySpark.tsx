import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Flame, Shield, Check } from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetDailySparkAnswers,
  useCreateDailySparkAnswer,
  getGetDailySparkAnswersQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SPARK_DECK,
  SPARK_DIMENSION_LABEL,
  nextQuestion,
  computeDayStreak,
  optionLabel,
  type SparkQuestion,
} from "@/lib/dailySpark";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A handful of pre-filled picks so a signed-out visitor sees a real, played deck
// instead of an empty one. The demo never writes to the server.
const DEMO_ANSWERED: Record<string, string> = {
  "ideal-saturday-energy": "split-the-day",
  "first-move-style": "say-it-plain",
  "what-you-want-now": "open-to-real",
};

export default function DailySpark() {
  useMeta(
    "Daily Spark",
    "One small question a day. A single honest pick reveals how you actually move through dating, and every answer feeds your matching readiness.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: answersData } = useGetDailySparkAnswers({
    query: {
      queryKey: getGetDailySparkAnswersQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const createAnswer = useCreateDailySparkAnswer();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  // Local picks for the signed-out demo, so the game is playable before sign-in.
  const [demoPicks, setDemoPicks] =
    useState<Record<string, string>>(DEMO_ANSWERED);

  const isDemo = !isAuthenticated;

  const answeredMap = useMemo(() => {
    const m = new Map<string, string>();
    if (isDemo) {
      for (const [id, c] of Object.entries(demoPicks)) m.set(id, c);
    } else {
      for (const a of answersData ?? []) m.set(a.questionId, a.choice);
    }
    return m;
  }, [isDemo, demoPicks, answersData]);

  const answeredIds = useMemo(
    () => new Set(answeredMap.keys()),
    [answeredMap],
  );

  const current: SparkQuestion | null = useMemo(
    () => nextQuestion(answeredIds),
    [answeredIds],
  );

  const streak = useMemo(() => {
    if (isDemo) return 2;
    return computeDayStreak((answersData ?? []).map((a) => a.createdAt));
  }, [isDemo, answersData]);

  const answeredCount = answeredMap.size;
  const total = SPARK_DECK.length;
  const isBrandNewUser = isAuthenticated && answeredCount === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetDailySparkAnswersQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const pick = (question: SparkQuestion, optionId: string) => {
    if (isDemo) {
      setDemoPicks((prev) => ({ ...prev, [question.id]: optionId }));
      return;
    }
    if (createAnswer.isPending) return;
    // Snapshot readiness first so the page can animate the real climb this
    // answer produced.
    climb.snapshot();
    createAnswer.mutate(
      { data: { questionId: question.id, choice: optionId } },
      { onSuccess: invalidate },
    );
  };

  // Recently answered questions, newest first, to show what they have revealed.
  const recent = useMemo(() => {
    const orderedIds = isDemo
      ? Object.keys(demoPicks).reverse()
      : (answersData ?? []).map((a) => a.questionId);
    const seen = new Set<string>();
    const out: { question: SparkQuestion; choice: string }[] = [];
    for (const id of orderedIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const question = SPARK_DECK.find((q) => q.id === id);
      const choice = answeredMap.get(id);
      if (question && choice) out.push({ question, choice });
    }
    return out.slice(0, 8);
  }, [isDemo, demoPicks, answersData, answeredMap]);

  return (
    <AppLayout>
      <HubTabs hub="games" />
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Daily play
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Daily Spark
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              One small question a day. A single honest pick takes seconds and,
              answered across days, it reveals how you actually move through
              dating. Every answer is a real signal toward who the machine pairs
              you with.
            </p>
          </motion.div>

          {/* Streak + progress */}
          <motion.div
            {...fadeUp(0.04)}
            className="mb-6 grid grid-cols-2 gap-3"
          >
            <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(20_80%_55%/0.14)] flex items-center justify-center flex-shrink-0">
                <Flame className="w-5 h-5 text-[hsl(20_85%_62%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  {streak}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  day{streak === 1 ? "" : "s"} in a row
                </p>
              </div>
            </div>
            <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(245_58%_62%/0.14)] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-[hsl(245_70%_72%)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  {answeredCount}
                  <span className="text-sm text-muted-foreground font-medium">
                    {" "}
                    / {total}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  sparks answered
                </p>
              </div>
            </div>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Sparkles className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Daily Spark"
              title="Answer your first spark"
              description="There are no wrong answers. Each small pick sharpens what the machine understands about how you connect, and nudges your matching readiness up."
              testId="spark-empty-state"
            />
          )}

          {/* Today's spark */}
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id}
                {...fadeUp(0.06)}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className="glass border border-white/10 rounded-2xl p-6 mb-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">
                  {SPARK_DIMENSION_LABEL[current.dimension]}
                </p>
                <p className="text-lg font-semibold text-foreground mb-4 leading-snug">
                  {current.prompt}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {current.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => pick(current, option.id)}
                      disabled={!isDemo && createAnswer.isPending}
                      className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-[hsl(245_58%_62%/0.5)] hover:bg-[hsl(245_58%_62%/0.07)] disabled:opacity-60"
                      data-testid={`spark-choice-${option.id}`}
                    >
                      <p className="text-base font-medium text-foreground leading-snug">
                        {option.label}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground/50 mt-4">
                  {isDemo
                    ? "Sign in to save your picks and count them toward matching."
                    : "Pick the one that is more true for you, even if none is perfect."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="deck-complete"
                {...fadeUp(0.06)}
                className="glass border border-white/10 rounded-2xl p-8 mb-6 text-center"
              >
                <Check className="w-10 h-10 text-[hsl(245_70%_72%)] mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">
                  You have answered every spark
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Come back as the deck grows. New sparks keep sharpening what
                  the machine understands about you.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {isAuthenticated && climb.before !== null && (
            <motion.div {...fadeUp(0.07)} className="mb-6">
              <ReadinessClimbReveal
                from={climb.before}
                to={climb.current}
                className="glass border border-white/8 rounded-2xl p-5"
              />
            </motion.div>
          )}

          {/* What you have revealed */}
          {recent.length > 0 && (
            <div className="mb-6">
              {isDemo && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-3 px-0.5">
                  Sample picks, your deck starts the moment you sign in
                </p>
              )}
              <div className="space-y-2.5">
                <AnimatePresence>
                  {recent.map(({ question, choice }, i) => (
                    <motion.div
                      key={question.id}
                      {...fadeUp(0.08 + i * 0.03)}
                      layout
                      className="glass border border-white/8 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(245_70%_72%)]">
                          {SPARK_DIMENSION_LABEL[question.dimension]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/50 leading-relaxed">
                        {question.prompt}
                      </p>
                      <p className="text-sm text-foreground font-medium leading-relaxed mt-1">
                        {optionLabel(question, choice) ?? choice}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Trust note */}
          <motion.div
            {...fadeUp(0.45)}
            className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Only your pick is stored.
              </strong>{" "}
              We keep which option you chose and how many sparks you have
              answered, never any free text. Your answers count toward matching
              readiness and you can wipe everything from your account at any time.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
