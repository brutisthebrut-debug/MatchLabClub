import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateSourcePaste,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMeta } from "@/hooks/useMeta";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";

const ACCENT = "hsl(326 70% 58%)";

// Each pair is a quick either-or. The label we record is the chosen side phrased
// as a plain preference, so the stored count is meaningful but never tied to any
// sensitive attribute. Raw choices are never sent to any AI prompt; only the
// count fills the rapid-fire preferences lane of Match Readiness.
type Pair = {
  prompt: string;
  left: { label: string; pick: string };
  right: { label: string; pick: string };
};

const PAIRS: Pair[] = [
  {
    prompt: "Your ideal escape",
    left: { label: "Mountains", pick: "Prefers mountains over beach" },
    right: { label: "Beach", pick: "Prefers beach over mountains" },
  },
  {
    prompt: "Your natural clock",
    left: { label: "Night owl", pick: "Night owl" },
    right: { label: "Early bird", pick: "Early bird" },
  },
  {
    prompt: "A good Friday night",
    left: { label: "Big party", pick: "Prefers a big party" },
    right: { label: "Small gathering", pick: "Prefers a small gathering" },
  },
  {
    prompt: "How you'd rather connect",
    left: { label: "Texting", pick: "Prefers texting" },
    right: { label: "Calling", pick: "Prefers calling" },
  },
  {
    prompt: "Your approach to plans",
    left: { label: "Planner", pick: "Likes to plan ahead" },
    right: { label: "Spontaneous", pick: "Likes to be spontaneous" },
  },
  {
    prompt: "Your morning cup",
    left: { label: "Coffee", pick: "Coffee person" },
    right: { label: "Tea", pick: "Tea person" },
  },
  {
    prompt: "A date you'd pick",
    left: { label: "Cook at home", pick: "Prefers cooking at home" },
    right: { label: "Eat out", pick: "Prefers eating out" },
  },
  {
    prompt: "Your kind of company",
    left: { label: "Dogs", pick: "Dog person" },
    right: { label: "Cats", pick: "Cat person" },
  },
  {
    prompt: "Your ideal weekend",
    left: { label: "Quiet reset", pick: "Prefers a quiet weekend" },
    right: { label: "Big adventure", pick: "Prefers a big adventure" },
  },
  {
    prompt: "Your go-to flavour",
    left: { label: "Sweet", pick: "Sweet tooth" },
    right: { label: "Savoury", pick: "Prefers savoury" },
  },
  {
    prompt: "A night in, your pick",
    left: { label: "Books", pick: "Prefers books" },
    right: { label: "Films", pick: "Prefers films" },
  },
  {
    prompt: "Your money instinct",
    left: { label: "Save it", pick: "Saver by instinct" },
    right: { label: "Treat yourself", pick: "Treats yourself" },
  },
  {
    prompt: "Where you feel at home",
    left: { label: "City", pick: "City person" },
    right: { label: "Countryside", pick: "Countryside person" },
  },
  {
    prompt: "When you move your body",
    left: { label: "Morning workout", pick: "Morning workout" },
    right: { label: "Evening workout", pick: "Evening workout" },
  },
];

export default function ThisOrThat() {
  useMeta(
    "This or That | MatchLab Club",
    "Tap through quick either-or choices. Each round reads the small instinctive preferences that quietly shape day-to-day fit.",
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const paste = useCreateSourcePaste();
  const climb = useReadinessClimb();

  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const total = PAIRS.length;
  const current = PAIRS[index];
  const answered = picks.length;
  const progress = useMemo(
    () => Math.round((answered / total) * 100),
    [answered, total],
  );

  const submit = (finalPicks: string[]) => {
    if (finalPicks.length === 0) return;
    climb.snapshot();
    paste.mutate(
      {
        data: {
          source: "preferences-paste",
          items: finalPicks.map((p) => p.slice(0, 280)),
        },
      },
      {
        onSuccess: (result) => {
          setDone(result.itemCount);
          queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
          toast({
            title: "Your picks are saved",
            description: `${result.itemCount} ${
              result.itemCount === 1 ? "round" : "rounds"
            } added to your readiness. Fills the rapid-fire preferences lane.`,
          });
        },
        onError: () => {
          toast({
            title: "Could not save your picks",
            description: "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const choose = (pick: string) => {
    const next = [...picks, pick];
    setPicks(next);
    if (index + 1 >= total) {
      submit(next);
    } else {
      setIndex(index + 1);
    }
  };

  const restart = () => {
    setIndex(0);
    setPicks([]);
    setDone(null);
    climb.reset();
  };

  return (
    <AppLayout>
      <HubTabs hub="games" />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/connections"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Connection Center
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              className="w-11 h-11 rounded-xl grid place-items-center"
              style={{ background: `${ACCENT} / 0.15`, color: ACCENT }}
            >
              <Shuffle className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-semibold">This or That</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Tap the one that feels more like you. There are no wrong answers, just
            a quick read on the instincts that shape day-to-day fit.
          </p>
        </motion.div>

        {done !== null ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CheckCircle2
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: "hsl(142 55% 60%)" }}
              />
              <h2 className="text-xl font-semibold mb-2">
                {done} {done === 1 ? "round" : "rounds"} added
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Fills the rapid-fire preferences lane of your Match Readiness.
                Each round adds a read on what a good day-to-day fit feels like.
              </p>
              {climb.before !== null && (
                <ReadinessClimbReveal
                  from={climb.before}
                  to={climb.current}
                  className="max-w-sm mx-auto mb-6 rounded-2xl border border-foreground/10 p-6 text-left"
                />
              )}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={restart} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Play again
                </Button>
                <Button asChild>
                  <Link href="/connections">Back to Connection Center</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>
                  Round {Math.min(index + 1, total)} of {total}
                </span>
                <span>{answered} answered</span>
              </div>
              <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ACCENT }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-center">
                  {current.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {[current.left, current.right].map((side) => (
                      <button
                        key={side.label}
                        type="button"
                        disabled={paste.isPending}
                        onClick={() => choose(side.pick)}
                        className="group rounded-2xl border border-foreground/10 px-4 py-10 text-center font-semibold text-lg transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[hsl(326_70%_58%/0.5)] disabled:opacity-60"
                      >
                        {side.label}
                      </button>
                    ))}
                  </motion.div>
                </AnimatePresence>
                {paste.isPending && (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving your picks
                  </p>
                )}
                {answered > 0 && !paste.isPending && (
                  <div className="text-center mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => submit(picks)}
                    >
                      Save my {answered}{" "}
                      {answered === 1 ? "pick" : "picks"} now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: ACCENT }} />
                  What we read
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  We record which side you picked and a simple count of how many
                  rounds you played, used to fill the lane.
                </p>
                <p>
                  Your choices are never tied back to any sensitive attribute or
                  sold, and your raw picks are never sent to any AI prompt. Only
                  the count moves your readiness.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
