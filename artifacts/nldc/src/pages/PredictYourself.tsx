import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Flame, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WelcomePanel } from "@/components/WelcomePanel";
import {
  useGetPredictionResponses,
  useCreatePredictionResponse,
  getGetPredictionResponsesQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PREDICT_DECK,
  nextItem,
  computeDayStreak,
  averageCalibrationGap,
  type PredictItem,
} from "@/lib/predictYourself";
import { updatePredictionPermissions, type PredictionPermissions } from "@/lib/predictionPermissions";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A couple of pre-filled rounds so a signed-out visitor sees a real, played
// board instead of an empty one. The demo never writes to the server.
const DEMO_ROUNDS: Record<string, { predicted: number; actual: number }> = {
  "how-you-text": { predicted: 3, actual: 4 },
  "first-dates": { predicted: 2, actual: 2 },
};

type Phase = "predict" | "answer" | "reveal";

function calibrationLine(gap: number, total: number): string {
  const pct = total > 0 ? gap / total : 0;
  if (pct === 0) return "You read yourself exactly. That is rare.";
  if (pct <= 0.2) return "Close. Your self-image tracks how you actually answer.";
  if (pct <= 0.4)
    return "A small gap between how you see yourself and how you answered.";
  return "A real gap here. Worth noticing where your self-image and answers part ways.";
}

interface SavedRound {
  itemId: string;
  predicted: number;
  actual: number;
  createdAt: string;
  echoUseAllowed: boolean;
  learningConfirmed: boolean;
  matchingUseAllowed: boolean;
}

export function PredictYourselfExperience({ embedded = false }: { embedded?: boolean }) {
  useMeta(
    "Predict yourself",
    "Guess how you will answer before you do, with private account history and member-controlled learning, Echo, and matching permissions.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: roundsData, isLoading: roundsLoading, isError: roundsFailed } = useGetPredictionResponses({
    query: {
      queryKey: getGetPredictionResponsesQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const createRound = useCreatePredictionResponse();
  const [permissionBusy, setPermissionBusy] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const savedRounds = (roundsData ?? []) as SavedRound[];

  const [demoRounds, setDemoRounds] =
    useState<Record<string, { predicted: number; actual: number }>>(DEMO_ROUNDS);

  const isDemo = !isAuthenticated;

  const roundsMap = useMemo(() => {
    const m = new Map<string, { predicted: number; actual: number }>();
    if (isDemo) {
      for (const [id, r] of Object.entries(demoRounds)) m.set(id, r);
    } else {
      for (const r of savedRounds)
        m.set(r.itemId, { predicted: r.predicted, actual: r.actual });
    }
    return m;
  }, [isDemo, demoRounds, savedRounds]);

  const answeredIds = useMemo(() => new Set(roundsMap.keys()), [roundsMap]);

  const current: PredictItem | null = useMemo(
    () => nextItem(answeredIds),
    [answeredIds],
  );

  // Local play state for the round in progress.
  const [phase, setPhase] = useState<Phase>("predict");
  const [predicted, setPredicted] = useState<number | null>(null);
  const [marks, setMarks] = useState<Record<number, boolean>>({});

  const streak = useMemo(() => {
    if (isDemo) return 2;
    return computeDayStreak(savedRounds.map((r) => r.createdAt));
  }, [isDemo, savedRounds]);

  const answeredCount = roundsMap.size;
  const total = PREDICT_DECK.length;
  const isBrandNewUser = isAuthenticated && answeredCount === 0;

  const avgGap = useMemo(() => {
    const rounds = isDemo
      ? Object.values(demoRounds)
      : savedRounds.map((r) => ({
          predicted: r.predicted,
          actual: r.actual,
        }));
    return averageCalibrationGap(rounds);
  }, [isDemo, demoRounds, savedRounds]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetPredictionResponsesQueryKey(),
    });
  };

  const resetRound = () => {
    setPhase("predict");
    setPredicted(null);
    setMarks({});
  };

  const markedCount = (item: PredictItem) =>
    item.statements.reduce((n, _s, i) => n + (marks[i] ? 1 : 0), 0);

  const allMarked = (item: PredictItem) =>
    item.statements.every((_s, i) => marks[i] !== undefined);

  const submit = (item: PredictItem) => {
    const actual = markedCount(item);
    if (isDemo) {
      setDemoRounds((prev) => ({
        ...prev,
        [item.id]: { predicted: predicted ?? 0, actual },
      }));
      setPhase("reveal");
      return;
    }
    if (createRound.isPending) return;
    createRound.mutate(
      { data: { itemId: item.id, predicted: predicted ?? 0, actual } },
      { onSuccess: () => { invalidate(); setPhase("reveal"); } },
    );
  };

  const recent = useMemo(() => savedRounds.map((round) => ({
    round,
    item: PREDICT_DECK.find((item) => item.id === round.itemId),
  })).filter((entry): entry is { round: SavedRound; item: PredictItem } => Boolean(entry.item)).slice(0, 8), [savedRounds]);

  async function changePermission(round: SavedRound, patch: PredictionPermissions) {
    setPermissionBusy(round.itemId);
    setPermissionError(null);
    try {
      await updatePredictionPermissions(round.itemId, patch);
      await queryClient.invalidateQueries({ queryKey: getGetPredictionResponsesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Permission update failed.");
    } finally {
      setPermissionBusy(null);
    }
  }

  const content = (
      <div id="play-predict" className={embedded ? "scroll-mt-24" : "min-h-screen mesh-bg py-10 px-4"}>
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Target className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Daily play
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Predict yourself
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              Guess how you will answer before you read the statements, then check
              yourself. The two counts save privately first; you decide separately
              what becomes confirmed learning, Echo context, or matching context.
            </p>
          </motion.div>

          {/* Streak + progress */}
          <motion.div {...fadeUp(0.04)} className="mb-6 grid grid-cols-2 gap-3">
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
                <Target className="w-5 h-5 text-[hsl(245_70%_72%)]" />
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
                  rounds played
                </p>
              </div>
            </div>
          </motion.div>

          {/* Honest calibration readout */}
          {avgGap !== null && answeredCount > 0 && (
            <motion.div
              {...fadeUp(0.05)}
              className="mb-6 glass border border-white/8 rounded-2xl p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">
                Your calibration
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                On average you are{" "}
                <span className="font-semibold text-[hsl(245_70%_78%)]">
                  {avgGap.toFixed(1)}
                </span>{" "}
                {avgGap === 1 ? "statement" : "statements"} off between what you
                predict and how you actually answer. Lower is sharper self-read,
                and we keep it honest either way.
              </p>
            </motion.div>
          )}

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Target className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to predict yourself"
              title="Play your first round"
              description="Predict how you will answer, then see how close you were. The private round saves to your account, and you choose its downstream permissions separately."
              testId="predict-empty-state"
            />
          )}

          {/* Current round */}
          <AnimatePresence mode="wait">
            {isAuthenticated && roundsLoading ? (
              <motion.div key="rounds-loading" {...fadeUp(0.06)} className="glass border border-white/10 rounded-2xl p-6 mb-6 text-sm text-muted-foreground">Loading your saved rounds…</motion.div>
            ) : isAuthenticated && roundsFailed ? (
              <motion.div key="rounds-failed" {...fadeUp(0.06)} className="glass border border-destructive/30 rounded-2xl p-6 mb-6 text-sm text-destructive">Your saved rounds could not load. No sample history has been substituted.</motion.div>
            ) : current ? (
              <motion.div
                key={current.id + phase}
                {...fadeUp(0.06)}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className="glass border border-white/10 rounded-2xl p-6 mb-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">
                  {current.theme}
                </p>

                {phase === "predict" && (
                  <>
                    <p className="text-base font-semibold text-foreground mb-5 leading-snug">
                      {current.predictPrompt}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {Array.from(
                        { length: current.statements.length + 1 },
                        (_v, n) => n,
                      ).map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setPredicted(n);
                            setPhase("answer");
                          }}
                          className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.03] text-base font-semibold text-foreground transition-all hover:border-[hsl(245_58%_62%/0.5)] hover:bg-[hsl(245_58%_62%/0.07)]"
                          data-testid={`predict-guess-${n}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground/50 mt-4">
                      {isDemo
                        ? "Sign in to save your rounds to your private account history."
                        : "Pick the number you honestly expect before you read on."}
                    </p>
                  </>
                )}

                {phase === "answer" && (
                  <>
                    <p className="text-sm text-muted-foreground mb-1">
                      You predicted{" "}
                      <span className="font-semibold text-foreground">
                        {predicted}
                      </span>
                      . Now mark each one true or false for you.
                    </p>
                    <div className="space-y-2.5 mt-4">
                      {current.statements.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 flex items-center justify-between gap-3"
                        >
                          <p className="text-sm text-foreground leading-snug flex-1">
                            {s}
                          </p>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() =>
                                setMarks((m) => ({ ...m, [i]: true }))
                              }
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                marks[i] === true
                                  ? "border-[hsl(150_50%_50%/0.6)] bg-[hsl(150_50%_45%/0.18)] text-[hsl(150_60%_70%)]"
                                  : "border-white/10 bg-white/[0.02] text-muted-foreground/50 hover:border-white/20"
                              }`}
                              aria-label="True for me"
                              data-testid={`predict-true-${i}`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setMarks((m) => ({ ...m, [i]: false }))
                              }
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                marks[i] === false
                                  ? "border-white/30 bg-white/[0.08] text-foreground"
                                  : "border-white/10 bg-white/[0.02] text-muted-foreground/50 hover:border-white/20"
                              }`}
                              aria-label="Not true for me"
                              data-testid={`predict-false-${i}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => submit(current)}
                      disabled={
                        !allMarked(current) ||
                        (!isDemo && createRound.isPending)
                      }
                      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                      data-testid="predict-reveal"
                    >
                      See how close you were
                    </button>
                  </>
                )}

                {phase === "reveal" &&
                  predicted !== null &&
                  (() => {
                    const actual = markedCount(current);
                    const gap = Math.abs(predicted - actual);
                    return (
                      <div className="text-center py-2">
                        <div className="flex items-center justify-center gap-6 mb-4">
                          <div>
                            <p className="text-3xl font-bold text-muted-foreground/60 leading-none">
                              {predicted}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              predicted
                            </p>
                          </div>
                          <div className="text-muted-foreground/30 text-lg">
                            vs
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-[hsl(245_70%_78%)] leading-none">
                              {actual}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              actually true
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-foreground max-w-sm mx-auto leading-relaxed mb-5">
                          {calibrationLine(gap, current.statements.length)}
                        </p>
                        <button
                          onClick={resetRound}
                          className="rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-white/30"
                          data-testid="predict-next"
                        >
                          Next round
                        </button>
                      </div>
                    );
                  })()}
              </motion.div>
            ) : (
              <motion.div
                key="deck-complete"
                {...fadeUp(0.06)}
                className="glass border border-white/10 rounded-2xl p-8 mb-6 text-center"
              >
                <Check className="w-10 h-10 text-[hsl(245_70%_72%)] mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">
                  You have played every round
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Come back as the deck grows. New rounds keep sharpening how well
                  you read yourself.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {createRound.isError && <p className="mb-4 text-sm text-destructive">This round could not be saved. Your account history was not changed.</p>}

          {recent.length > 0 && (
            <div className="mb-6 space-y-2.5" aria-label="Saved prediction rounds">
              {recent.map(({ round, item }, i) => (
                <motion.div key={round.itemId} {...fadeUp(0.08 + i * 0.03)} className="glass border border-white/8 rounded-2xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(245_70%_72%)]">{item.theme}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{round.predicted} predicted · {round.actual} actually true</p>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                    <Button size="sm" variant={round.learningConfirmed ? "default" : "outline"} disabled={permissionBusy === round.itemId} onClick={() => void changePermission(round, { learningConfirmed: !round.learningConfirmed })}>{round.learningConfirmed ? "Learning confirmed" : "Confirm learning"}</Button>
                    <Button size="sm" variant={round.echoUseAllowed ? "default" : "outline"} disabled={permissionBusy === round.itemId} onClick={() => void changePermission(round, { echoUse: !round.echoUseAllowed })}>{round.echoUseAllowed ? "Echo allowed" : "Allow Echo"}</Button>
                    <Button size="sm" variant={round.matchingUseAllowed ? "default" : "outline"} disabled={permissionBusy === round.itemId} onClick={() => void changePermission(round, { matchingUse: !round.matchingUseAllowed })}>{round.matchingUseAllowed ? "Matching allowed" : "Allow matching"}</Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {permissionError && <p className="mb-4 text-sm text-destructive">{permissionError}</p>}

          {/* Trust note */}
          <motion.div
            {...fadeUp(0.45)}
            className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3"
          >
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">
                Only your two numbers are stored.
              </strong>{" "}
              We keep what you predicted and how many you marked true, never which
              statements you picked. Saving alone does not authorize Echo,
              confirmed learning, or matching use, and you can remove the data from your account.
            </p>
          </motion.div>
        </div>
      </div>
  );

  return embedded ? content : (
    <AppLayout>
      <HubTabs hub="games" />
      {content}
    </AppLayout>
  );
}

export default function PredictYourself() {
  return <PredictYourselfExperience />;
}
