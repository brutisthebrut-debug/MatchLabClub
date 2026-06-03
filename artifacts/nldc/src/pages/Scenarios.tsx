import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Clapperboard, Flame, Shield, Check } from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetScenarioResponses,
  useCreateScenarioResponse,
  getGetScenarioResponsesQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SCENARIO_DECK,
  SCENARIO_DIMENSION_LABEL,
  nextScenario,
  computeDayStreak,
  type Scenario,
} from "@/lib/scenarios";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A few pre-filled picks so a signed-out visitor sees a real, played board
// instead of an empty one. The demo never writes to the server.
const DEMO_ANSWERED: Record<string, string> = {
  "left-on-read-two-days": "name-it",
  "they-vent-no-fix": "ask-what-need",
  "crossed-a-line": "own-it-now",
};

export default function Scenarios() {
  useMeta(
    "Scenario reels",
    "Real relationship moments, one at a time. How you respond reveals your communication and conflict style, and every response feeds your matching readiness.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: responsesData } = useGetScenarioResponses({
    query: {
      queryKey: getGetScenarioResponsesQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const createResponse = useCreateScenarioResponse();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  // Local picks for the signed-out demo, so the reels are playable before sign-in.
  const [demoPicks, setDemoPicks] =
    useState<Record<string, string>>(DEMO_ANSWERED);

  const isDemo = !isAuthenticated;

  const answeredMap = useMemo(() => {
    const m = new Map<string, string>();
    if (isDemo) {
      for (const [id, c] of Object.entries(demoPicks)) m.set(id, c);
    } else {
      for (const r of responsesData ?? []) m.set(r.scenarioId, r.optionId);
    }
    return m;
  }, [isDemo, demoPicks, responsesData]);

  const answeredIds = useMemo(() => new Set(answeredMap.keys()), [answeredMap]);

  const current: Scenario | null = useMemo(
    () => nextScenario(answeredIds),
    [answeredIds],
  );

  const streak = useMemo(() => {
    if (isDemo) return 3;
    return computeDayStreak((responsesData ?? []).map((r) => r.createdAt));
  }, [isDemo, responsesData]);

  const answeredCount = answeredMap.size;
  const total = SCENARIO_DECK.length;
  const isBrandNewUser = isAuthenticated && answeredCount === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetScenarioResponsesQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const pick = (scenario: Scenario, optionId: string) => {
    if (isDemo) {
      setDemoPicks((prev) => ({ ...prev, [scenario.id]: optionId }));
      return;
    }
    if (createResponse.isPending) return;
    // Snapshot readiness first so the page can animate the real climb this
    // response produced.
    climb.snapshot();
    createResponse.mutate(
      { data: { scenarioId: scenario.id, optionId } },
      { onSuccess: invalidate },
    );
  };

  // Recently answered scenarios, newest first, to show what they have revealed.
  const recent = useMemo(() => {
    const orderedIds = isDemo
      ? Object.keys(demoPicks).reverse()
      : (responsesData ?? []).map((r) => r.scenarioId);
    const seen = new Set<string>();
    const out: { scenario: Scenario; option: { id: string; label: string } }[] =
      [];
    for (const id of orderedIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const scenario = SCENARIO_DECK.find((s) => s.id === id);
      const optionId = answeredMap.get(id);
      const option = scenario?.options.find((o) => o.id === optionId);
      if (scenario && option) out.push({ scenario, option });
    }
    return out.slice(0, 8);
  }, [isDemo, demoPicks, responsesData, answeredMap]);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Clapperboard className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Daily play
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Scenario reels
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              A real relationship moment, one at a time. How you respond when
              things get tense reveals your communication and conflict style, and
              every answer is a real signal toward who the machine pairs you with.
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
                <Clapperboard className="w-5 h-5 text-[hsl(245_70%_72%)]" />
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
                  scenarios played
                </p>
              </div>
            </div>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Clapperboard className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to scenario reels"
              title="Play your first scenario"
              description="There are no wrong answers. Each moment you work through sharpens what the machine understands about how you communicate and handle friction, and nudges your matching readiness up."
              testId="scenarios-empty-state"
            />
          )}

          {/* Today's scenario */}
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.id}
                {...fadeUp(0.06)}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className="glass border border-white/10 rounded-2xl p-6 mb-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">
                  {SCENARIO_DIMENSION_LABEL[current.dimension]}
                </p>
                <p className="text-base font-semibold text-foreground mb-5 leading-snug">
                  {current.prompt}
                </p>
                <div className="space-y-2.5">
                  {current.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => pick(current, option.id)}
                      disabled={!isDemo && createResponse.isPending}
                      className="group w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-[hsl(245_58%_62%/0.5)] hover:bg-[hsl(245_58%_62%/0.07)] disabled:opacity-60"
                      data-testid={`scenario-option-${option.id}`}
                    >
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {option.label}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground/50 mt-4">
                  {isDemo
                    ? "Sign in to save your responses and count them toward matching."
                    : "Pick what you would actually reach for, even if it is not the polished answer."}
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
                  You have played every scenario
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Come back as the deck grows. New scenarios keep sharpening what
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
                  Sample responses, your board starts the moment you sign in
                </p>
              )}
              <div className="space-y-2.5">
                <AnimatePresence>
                  {recent.map(({ scenario, option }, i) => (
                    <motion.div
                      key={scenario.id}
                      {...fadeUp(0.08 + i * 0.03)}
                      layout
                      className="glass border border-white/8 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(245_70%_72%)]">
                          {SCENARIO_DIMENSION_LABEL[scenario.dimension]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 leading-relaxed mb-1.5">
                        {scenario.prompt}
                      </p>
                      <p className="text-sm text-foreground font-medium leading-relaxed">
                        {option.label}
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
                Only your response is stored.
              </strong>{" "}
              We keep which option you chose and how many scenarios you have
              played, never any free text. Your responses count toward matching
              readiness and you can wipe everything from your account at any time.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
