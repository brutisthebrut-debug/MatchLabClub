import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Flame, Shield, Check } from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Button } from "@/components/ui/button";
import {
  useGetWouldYouRatherAnswers,
  useCreateWouldYouRatherAnswer,
  getGetWouldYouRatherAnswersQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  WYR_DECK,
  WYR_DIMENSION_LABEL,
  nextPrompt,
  computeDayStreak,
  type WyrPrompt,
} from "@/lib/wouldYouRather";
import { updateWouldYouRatherPermissions, type WouldYouRatherPermissions } from "@/lib/wouldYouRatherPermissions";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A handful of pre-filled picks so a signed-out visitor sees a real, played
// board instead of an empty one. The demo never writes to the server.
const DEMO_ANSWERED: Record<string, "a" | "b"> = {
  "reply-fast-surface-vs-slow-deep": "b",
  "driven-busy-vs-steady-present": "b",
  "hard-truth-kind-vs-gentle-spare": "a",
  "instant-spark-vs-slow-burn": "b",
};

interface SavedAnswer {
  promptId: string;
  choice: "a" | "b";
  createdAt: string;
  echoUseAllowed: boolean;
  learningConfirmed: boolean;
  matchingUseAllowed: boolean;
}

export function WouldYouRatherExperience({ embedded = false }: { embedded?: boolean }) {
  useMeta(
    "Would You Rather",
    "A daily forced tradeoff with private account history and member-controlled learning, Echo, and matching permissions.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: answersData, isLoading: answersLoading, isError: answersFailed } = useGetWouldYouRatherAnswers({
    query: {
      queryKey: getGetWouldYouRatherAnswersQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const createAnswer = useCreateWouldYouRatherAnswer();
  const [permissionBusy, setPermissionBusy] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const savedAnswers = (answersData ?? []) as SavedAnswer[];

  // Local picks for the signed-out demo, so the game is playable before sign-in.
  const [demoPicks, setDemoPicks] =
    useState<Record<string, "a" | "b">>(DEMO_ANSWERED);

  const isDemo = !isAuthenticated;

  const answeredMap = useMemo(() => {
    const m = new Map<string, "a" | "b">();
    if (isDemo) {
      for (const [id, c] of Object.entries(demoPicks)) m.set(id, c);
    } else {
      for (const a of savedAnswers) m.set(a.promptId, a.choice);
    }
    return m;
  }, [isDemo, demoPicks, savedAnswers]);

  const answeredIds = useMemo(
    () => new Set(answeredMap.keys()),
    [answeredMap],
  );

  const current: WyrPrompt | null = useMemo(
    () => nextPrompt(answeredIds),
    [answeredIds],
  );

  const streak = useMemo(() => {
    if (isDemo) return 3;
    return computeDayStreak(savedAnswers.map((a) => a.createdAt));
  }, [isDemo, savedAnswers]);

  const answeredCount = answeredMap.size;
  const total = WYR_DECK.length;
  const isBrandNewUser = isAuthenticated && answeredCount === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetWouldYouRatherAnswersQueryKey(),
    });
  };

  const pick = (prompt: WyrPrompt, choice: "a" | "b") => {
    if (isDemo) {
      setDemoPicks((prev) => ({ ...prev, [prompt.id]: choice }));
      return;
    }
    if (createAnswer.isPending) return;
    createAnswer.mutate(
      { data: { promptId: prompt.id, choice } },
      { onSuccess: invalidate },
    );
  };

  // Recently answered prompts, newest first, to show what they have revealed.
  const recent = useMemo(() => {
    const orderedIds = isDemo
      ? Object.keys(demoPicks).reverse()
      : savedAnswers.map((a) => a.promptId);
    const seen = new Set<string>();
    const out: { prompt: WyrPrompt; choice: "a" | "b"; saved?: SavedAnswer }[] = [];
    for (const id of orderedIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const prompt = WYR_DECK.find((p) => p.id === id);
      const choice = answeredMap.get(id);
      if (prompt && choice) out.push({ prompt, choice, saved: savedAnswers.find((answer) => answer.promptId === id) });
    }
    return out.slice(0, 8);
  }, [isDemo, demoPicks, savedAnswers, answeredMap]);

  async function changePermission(answer: SavedAnswer, patch: WouldYouRatherPermissions) {
    setPermissionBusy(answer.promptId);
    setPermissionError(null);
    try {
      await updateWouldYouRatherPermissions(answer.promptId, patch);
      await queryClient.invalidateQueries({ queryKey: getGetWouldYouRatherAnswersQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Permission update failed.");
    } finally {
      setPermissionBusy(null);
    }
  }

  const content = (
      <div id="play-would-you-rather" className={embedded ? "scroll-mt-24" : "min-h-screen mesh-bg py-10 px-4"}>
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Daily play
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Would You Rather
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              One forced tradeoff a day. What you actually pick reveals more than
              what you say you want. Your answer saves privately first; you decide
              what becomes confirmed learning or matching context.
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
                <Scale className="w-5 h-5 text-[hsl(245_70%_72%)]" />
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
                  tradeoffs answered
                </p>
              </div>
            </div>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Scale className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Would You Rather"
              title="Make your first pick"
              description="There are no wrong answers. Each tradeoff saves to your account, and you choose separately whether it becomes confirmed learning or matching context."
              testId="wyr-empty-state"
            />
          )}

          {/* Today's tradeoff */}
          <AnimatePresence mode="wait">
            {isAuthenticated && answersLoading ? (
              <motion.div key="answers-loading" {...fadeUp(0.06)} className="glass border border-white/10 rounded-2xl p-6 mb-6 text-sm text-muted-foreground">Loading your saved answers…</motion.div>
            ) : isAuthenticated && answersFailed ? (
              <motion.div key="answers-failed" {...fadeUp(0.06)} className="glass border border-destructive/30 rounded-2xl p-6 mb-6 text-sm text-destructive">Your saved answers could not load. No sample history has been substituted.</motion.div>
            ) : current ? (
              <motion.div
                key={current.id}
                {...fadeUp(0.06)}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className="glass border border-white/10 rounded-2xl p-6 mb-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-4">
                  {WYR_DIMENSION_LABEL[current.dimension]}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(["a", "b"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => pick(current, side)}
                      disabled={!isDemo && createAnswer.isPending}
                      className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-[hsl(245_58%_62%/0.5)] hover:bg-[hsl(245_58%_62%/0.07)] disabled:opacity-60"
                      data-testid={`wyr-choice-${side}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                        Would you rather
                      </span>
                      <p className="text-base font-semibold text-foreground mt-2 leading-snug">
                        {current[side]}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground/50 mt-4">
                  {isDemo
                    ? "Sign in to save your picks to your private account history."
                    : "Pick the one that is more true for you, even if neither is perfect."}
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
                  You have answered every tradeoff
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Come back as the deck grows. New tradeoffs keep sharpening what
                  I understand about you.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What you have revealed */}
          {recent.length > 0 && (
            <div className="mb-6">
              {isDemo && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 mb-3 px-0.5">
                  Sample picks, your board starts the moment you sign in
                </p>
              )}
              <div className="space-y-2.5">
                <AnimatePresence>
                  {recent.map(({ prompt, choice, saved }, i) => (
                    <motion.div
                      key={prompt.id}
                      {...fadeUp(0.08 + i * 0.03)}
                      layout
                      className="glass border border-white/8 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(245_70%_72%)]">
                          {WYR_DIMENSION_LABEL[prompt.dimension]}
                        </span>
                      </div>
                      <p className="text-sm text-foreground font-medium leading-relaxed">
                        {prompt[choice]}
                      </p>
                      <p className="text-xs text-muted-foreground/40 mt-1">
                        over: {prompt[choice === "a" ? "b" : "a"]}
                      </p>
                      {saved && !isDemo && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                          <Button size="sm" variant={saved.learningConfirmed ? "default" : "outline"} disabled={permissionBusy === saved.promptId} onClick={() => void changePermission(saved, { learningConfirmed: !saved.learningConfirmed })}>{saved.learningConfirmed ? "Learning confirmed" : "Confirm learning"}</Button>
                          <Button size="sm" variant={saved.echoUseAllowed ? "default" : "outline"} disabled={permissionBusy === saved.promptId} onClick={() => void changePermission(saved, { echoUse: !saved.echoUseAllowed })}>{saved.echoUseAllowed ? "Echo allowed" : "Allow Echo"}</Button>
                          <Button size="sm" variant={saved.matchingUseAllowed ? "default" : "outline"} disabled={permissionBusy === saved.promptId} onClick={() => void changePermission(saved, { matchingUse: !saved.matchingUseAllowed })}>{saved.matchingUseAllowed ? "Matching allowed" : "Allow matching"}</Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
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
                Only your pick is stored.
              </strong>{" "}
              We keep which side you chose and how many tradeoffs you have
              answered, never any free text. Saving alone does not authorize Echo,
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

export default function WouldYouRather() {
  return <WouldYouRatherExperience />;
}
