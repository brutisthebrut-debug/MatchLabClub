import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { computeClimb } from "@/lib/climb";

interface Reward {
  id: number;
  delta: number;
  levelUp?: string;
}

// Watches the readiness score and turns every gain into a felt moment. It rides
// on the matching-state query, which every tool invalidates after feeding a
// signal, so a single watcher catches gains from anywhere in the app. The first
// observed value only sets the baseline, so loading the app never celebrates.
// This reads the score, it never changes how the score is computed.
export function ReadinessRewardWatcher() {
  const { isAuthenticated } = useAuth();
  const { data } = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const { toast } = useToast();
  const prevScore = useRef<number | null>(null);
  const prevThreshold = useRef<number>(50);
  const [reward, setReward] = useState<Reward | null>(null);

  const score = data?.readiness?.score;
  const threshold = data?.readinessThreshold ?? 50;

  useEffect(() => {
    if (typeof score !== "number") return;

    if (prevScore.current === null) {
      prevScore.current = score;
      prevThreshold.current = threshold;
      return;
    }

    const before = prevScore.current;
    if (score > before) {
      const delta = score - before;
      const beforeClimb = computeClimb(before, prevThreshold.current);
      const afterClimb = computeClimb(score, threshold);
      const newlyCleared = afterClimb.unlocks.find(
        (u) =>
          u.unlocked &&
          !beforeClimb.unlocks.some(
            (b) => b.threshold === u.threshold && b.unlocked,
          ),
      );

      setReward({ id: Date.now(), delta, levelUp: newlyCleared?.title });
      toast({
        title: newlyCleared
          ? `${newlyCleared.title} unlocked`
          : `Readiness up ${delta}`,
        description: newlyCleared
          ? newlyCleared.unlocks
          : "Your second brain just learned something new about you.",
      });
    }

    prevScore.current = score;
    prevThreshold.current = threshold;
  }, [score, threshold, toast]);

  useEffect(() => {
    if (!reward) return;
    const timer = setTimeout(() => setReward(null), 2800);
    return () => clearTimeout(timer);
  }, [reward]);

  return (
    <AnimatePresence>
      {reward ? (
        <motion.div
          key={reward.id}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4"
          data-testid="readiness-reward"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 rounded-full px-5 py-3 text-white shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(248 62% 52%), hsl(326 100% 56%))",
            }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
              {reward.levelUp ? (
                <Trophy className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="leading-tight">
              {reward.levelUp ? (
                <>
                  <p className="text-sm font-bold">{reward.levelUp} unlocked</p>
                  <p className="text-xs text-white/80">
                    Readiness up {reward.delta}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold">
                    Readiness up {reward.delta}
                  </p>
                  <p className="text-xs text-white/80">
                    The machine knows you a little better.
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
