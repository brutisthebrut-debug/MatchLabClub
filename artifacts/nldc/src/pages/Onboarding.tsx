import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Compass,
  Heart,
  Plug,
  ImageUp,
  Download,
  MessageCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateWellnessAnswer,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  getListWellnessAnswersQueryKey,
  getGetAccountSummaryQueryKey,
} from "@workspace/api-client-react";
import { STARTER_MODULE } from "@/lib/wellnessQuestionBank";
import { markOnboardingComplete, rememberOnboardingGoal } from "@/lib/onboardingState";
import { trackEvent } from "@/lib/analytics";

const GOALS = [
  { value: "find a relationship", label: "Find a relationship", desc: "Something real and lasting" },
  { value: "casual dating", label: "Casual dating", desc: "Open to connections without pressure" },
  { value: "heal from a breakup", label: "Heal and rediscover myself", desc: "Moving forward and ready to grow" },
  { value: "just curious", label: "Just curious", desc: "Exploring what's out there" },
];

const SOURCES = [
  {
    icon: ImageUp,
    title: "Scan a profile screenshot",
    desc: "Upload a photo or screenshot and we read the signal.",
    href: "/scan",
    cta: "Open Photo Scan",
  },
  {
    icon: Download,
    title: "Import your Hinge export",
    desc: "Bring your match and message history in one file.",
    href: "/imports",
    cta: "Open Imports",
  },
  {
    icon: MessageCircle,
    title: "Coach a real conversation",
    desc: "Paste a chat and get reply options that sound like you.",
    href: "/coach",
    cta: "Open Message Coach",
  },
  {
    icon: Plug,
    title: "See every data source",
    desc: "The Connection Center shows what each source adds and never touches.",
    href: "/connections",
    cta: "Open Connection Center",
  },
];

const fadeStep = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function Onboarding() {
  useMeta(
    "Welcome to MatchLab",
    "A two-minute setup. Confirm your goal, share a few words about yourself, connect a source, and start your Match Readiness climb.",
  );
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const createAnswer = useCreateWellnessAnswer();
  const matchingState = useGetMatchingState();
  const readiness = matchingState.data?.readiness?.score ?? 0;

  const totalSteps = 4;
  const progress = Math.round(((step + 1) / totalSteps) * 100);
  const firstName = user?.firstName || "";

  function finish() {
    markOnboardingComplete();
    trackEvent("onboarding_complete", { goal });
    // Land a brand-new user straight on Your Mirror: the model of them is
    // already forming from what they just answered, with the readiness climb
    // and the single next signal to feed visible right away.
    setLocation("/your-mirror");
  }

  function skipAll() {
    markOnboardingComplete();
    trackEvent("onboarding_skip", { atStep: step });
    setLocation("/me");
  }

  function pickGoal(value: string) {
    setGoal(value);
    rememberOnboardingGoal(value);
  }

  async function saveBaseline() {
    const entries = Object.entries(answers).filter(([, v]) => v.trim().length > 0);
    if (entries.length === 0) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      for (const [questionId, answer] of entries) {
        const q = STARTER_MODULE.find((sq) => sq.id === questionId);
        if (!q) continue;
        await createAnswer.mutateAsync({
          data: {
            questionId,
            dimension: q.dimension,
            category: q.category,
            questionText: q.text,
            answer: answer.trim(),
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListWellnessAnswersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() }),
      ]);
      trackEvent("onboarding_baseline_saved", { count: entries.length });
      setStep(2);
    } catch {
      toast({
        title: "Could not save just yet",
        description: "Your answers did not save. You can try again or skip for now.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function connectSource(href: string) {
    markOnboardingComplete();
    trackEvent("onboarding_connect_source", { href });
    setLocation(href);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8 md:py-12">
        {/* Header: logo + progress */}
        <div className="mb-8">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/matchlab-logo.png"
                alt="MatchLab Club"
                className="h-8 w-auto"
                style={{ filter: "drop-shadow(0 2px 10px hsl(326 100% 60% / 0.4))" }}
              />
              <span className="font-serif text-base font-bold tracking-tight">
                MatchLab<span className="gradient-text">.</span>
              </span>
            </div>
            <button
              type="button"
              onClick={skipAll}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              data-testid="onboarding-skip"
            >
              Skip for now
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of {totalSteps}
          </p>
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" {...fadeStep}>
                <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">
                  {firstName ? `Welcome, ${firstName}.` : "Welcome to MatchLab."}
                </h1>
                <p className="mt-3 text-base text-muted-foreground">
                  This is your readiness lab. The more it knows you, the better it matches you with
                  people you would never find on your own, near you. Two minutes to begin.
                </p>
                <p className="mt-8 mb-3 text-sm font-semibold uppercase tracking-widest text-foreground/60">
                  What are you here for?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GOALS.map((g) => {
                    const active = goal === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => pickGoal(g.value)}
                        className={
                          "rounded-2xl border p-4 text-left transition-all " +
                          (active
                            ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)] ring-2 ring-[hsl(248_62%_52%/0.3)]"
                            : "border-foreground/10 hover:border-foreground/25 hover:bg-foreground/5")
                        }
                        data-testid={`onboarding-goal-${g.value.replace(/\s+/g, "-")}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="font-semibold">{g.label}</span>
                          {active && <Check className="h-4 w-4 text-[hsl(248_62%_52%)]" />}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex justify-end">
                  <Button
                    size="lg"
                    disabled={!goal}
                    onClick={() => setStep(1)}
                    className="gap-1.5"
                    data-testid="onboarding-next-0"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" {...fadeStep}>
                <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">
                  Three quick questions
                </h1>
                <p className="mt-3 text-base text-muted-foreground">
                  These start your wellness profile, the deepest signal for matching. Answer in a
                  sentence or two, or skip any and come back later. Used to coach you, never sold or
                  shared.
                </p>
                <div className="mt-8 space-y-6">
                  {STARTER_MODULE.map((q) => (
                    <div key={q.id}>
                      <label
                        htmlFor={`q-${q.id}`}
                        className="mb-2 block text-sm font-semibold text-foreground"
                      >
                        {q.text}
                      </label>
                      <Textarea
                        id={`q-${q.id}`}
                        value={answers[q.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Type your answer..."
                        rows={2}
                        data-testid={`onboarding-answer-${q.id}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(0)}
                    className="gap-1.5"
                    data-testid="onboarding-back-1"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    size="lg"
                    onClick={saveBaseline}
                    disabled={saving}
                    className="gap-1.5"
                    data-testid="onboarding-next-1"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" {...fadeStep}>
                <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">
                  Connect one source
                </h1>
                <p className="mt-3 text-base text-muted-foreground">
                  Every source you plug in sharpens your readiness and your matches. Pick one to try
                  now, or do it later from your Home. You control what is shared and can remove any
                  source anytime.
                </p>
                <div className="mt-8 grid gap-3">
                  {SOURCES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.href}
                        type="button"
                        onClick={() => connectSource(s.href)}
                        className="flex items-center gap-4 rounded-2xl border border-foreground/10 p-4 text-left transition-all hover:border-foreground/25 hover:bg-foreground/5"
                        data-testid={`onboarding-source-${s.href.replace(/\//g, "")}`}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(248_62%_52%/0.1)]">
                          <Icon className="h-5 w-5 text-[hsl(248_62%_52%)]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{s.title}</span>
                          <span className="block text-sm text-muted-foreground">{s.desc}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="gap-1.5"
                    data-testid="onboarding-back-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setStep(3)}
                    className="gap-1.5"
                    data-testid="onboarding-next-2"
                  >
                    I'll do this later <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" {...fadeStep} className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B]">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">
                  Your readiness is climbing
                </h1>
                <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
                  Match Readiness is the meter that gates matching. Every tool you use, source you
                  connect, and question you answer moves it up.
                </p>
                <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-foreground/10 p-6">
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      Match Readiness
                    </span>
                    <span className="font-serif text-3xl font-bold gradient-text">{readiness}%</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
                      initial={{ width: 0 }}
                      animate={{ width: `${readiness}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-3 text-left text-xs text-muted-foreground">
                    Keep going on your Home to unlock matching.
                  </p>
                </div>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button size="lg" onClick={finish} className="gap-1.5" data-testid="onboarding-finish">
                    Go to my Home <ArrowRight className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                    data-testid="onboarding-back-3"
                  >
                    <Compass className="h-4 w-4" /> Connect a source first
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
