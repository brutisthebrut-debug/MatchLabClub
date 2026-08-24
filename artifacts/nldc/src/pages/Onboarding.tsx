import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Compass,
  Eye,
  Plug,
  ImageUp,
  Download,
  MessageCircle,
  Sparkles,
  Loader2,
  TrendingUp,
  Award,
  Zap,
  Icon,
  Target,
} from "lucide-react";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateWellnessAnswer,
  useGetMatchingState,
  useGetMirrorPortrait,
  getGetMatchingStateQueryKey,
  getGetMirrorPortraitQueryKey,
  getListWellnessAnswersQueryKey,
  getGetAccountSummaryQueryKey,
} from "@workspace/api-client-react";
import { STARTER_MODULE } from "@/lib/wellnessQuestionBank";
import {
  markOnboardingComplete,
  rememberOnboardingGoal,
  readOnboardingGoal,
  rememberOnboardingOrientation,
  readOnboardingOrientation,
  rememberOnboardingSeeking,
  readOnboardingSeeking,
} from "@/lib/onboardingState";
import { trackEvent } from "@/lib/analytics";

const GOALS = [
  { value: "find a relationship", label: "Find a relationship", desc: "Something real and lasting" },
  { value: "casual dating", label: "Casual dating", desc: "Open to connections without pressure" },
  { value: "heal from a breakup", label: "Heal and rediscover myself", desc: "Moving forward and ready to grow" },
  { value: "just curious", label: "Just curious", desc: "Exploring what's out there" },
];

const ORIENTATIONS = ["Straight", "Gay", "Lesbian", "Bisexual", "Queer", "Other"];
const SEEKING = ["Women", "Men", "Non-binary people", "Everyone", "Other / it's complicated"];

function goalIntro(goal: string): string {
  switch (goal) {
    case "heal from a breakup":
      return "No pressure, and nothing here is about your ex. These few questions are how Echo starts to really understand you. Answer in a sentence or skip any.";
    case "casual dating":
      return "These are how Echo gets a feel for who actually fits your vibe. A sentence each is plenty, or skip any and come back later.";
    case "just curious":
      return "Just a taste of how this works. These three answers are how Echo starts getting to know you. Say as little or as much as you like.";
    default:
      return "These are how Echo starts getting to know you, the foundation for everything ahead. Answer in a sentence or two, or skip any and come back later. Used to coach you, never sold or shared.";
  }
}

const SOURCES = [
  {
    icon: ImageUp,
    title: "Scan a profile screenshot",
    desc: "Upload a photo or screenshot and we read the signal.",
    href: "/scan",
    cta: "Open Photo Scan",
    points: 15,
  },
  {
    icon: Download,
    title: "Import your Hinge export",
    desc: "Bring your match and message history in one file.",
    href: "/imports",
    cta: "Open Imports",
    points: 30,
  },
  {
    icon: MessageCircle,
    title: "Coach a real conversation",
    desc: "Paste a chat and get reply options that sound like you.",
    href: "/coach",
    cta: "Open Message Coach",
    points: 10,
  },
  {
    icon: Plug,
    title: "See every data source",
    desc: "The Connection Center shows what each source adds and never touches.",
    href: "/connections",
    cta: "Open Connection Center",
    points: 0,
  },
];

const fadeStep = {
  initial: { opacity: 0, x: 20, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -20, filter: "blur(4px)" },
  transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] },
};

function AnimatedMeter({ score, label, previousScore }: { score: number, label: string, previousScore?: number | null }) {
  const [displayScore, setDisplayScore] = useState(previousScore ?? 0);
  
  useEffect(() => {
    let startTime: number;
    const duration = 1500;
    const startValue = previousScore ?? 0;
    
    function update(time: number) {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayScore(startValue + (score - startValue) * easeOutQuart);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }, [score, previousScore]);

  const percentage = Math.max(0, Math.min(100, displayScore));
  
  return (
    <div className="bg-background/80 border border-border/50 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(248_62%_52%/0.03)] to-[hsl(326_100%_59%/0.03)] pointer-events-none" />
      <div className="flex items-end justify-between mb-4 relative z-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {label}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-bold font-serif tabular-nums text-foreground tracking-tight">
              {Math.round(displayScore)}
            </span>
            <span className="text-muted-foreground font-semibold">/ 100</span>
          </div>
        </div>
        {previousScore !== null && previousScore !== undefined && score > previousScore && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="bg-[hsl(142_55%_60%/0.15)] text-[hsl(142_55%_45%)] dark:text-[hsl(142_55%_60%)] px-3 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1"
          >
            <TrendingUp className="w-4 h-4" />
            +{Math.round(score - previousScore)} pts
          </motion.div>
        )}
      </div>
      
      <div className="h-4 w-full bg-secondary/80 rounded-full overflow-hidden relative z-10 p-0.5">
        <motion.div
          className="h-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] rounded-full relative"
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] translate-x-[-100%] animate-[shimmer_2s_infinite]" />
        </motion.div>
      </div>
      <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest relative z-10">
        <span>Cold Start</span>
        <span>Match Ready</span>
      </div>
    </div>
  );
}


export default function Onboarding() {
  useMeta(
    "Meet Echo",
    "A two-minute hello. Tell Echo your goal, share a few words about yourself, connect a source, and start your Match Readiness climb.",
  );
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(() => readOnboardingGoal() ?? "");
  const [orientation, setOrientation] = useState(() => readOnboardingOrientation() ?? "");
  const [seeking, setSeeking] = useState<string[]>(() => readOnboardingSeeking());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [readinessBefore, setReadinessBefore] = useState<number | null>(null);

  const createAnswer = useCreateWellnessAnswer();
  const matchingState = useGetMatchingState();
  const readiness = matchingState.data?.readiness?.score ?? 0;

  const portraitQuery = useGetMirrorPortrait({
    query: {
      queryKey: getGetMirrorPortraitQueryKey(),
      enabled: step === 3,
      retry: false,
    },
  });
  const portrait = portraitQuery.data ?? null;

  const totalSteps = 4;
  const progress = Math.round(((step + 1) / totalSteps) * 100);
  const firstName = user?.firstName || "";

  function finish() {
    markOnboardingComplete();
    trackEvent("onboarding_complete", { goal });
    setLocation("/today");
  }

  function toggleSeeking(value: string) {
    setSeeking((prev) => {
      const next = prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value];
      rememberOnboardingSeeking(next);
      return next;
    });
  }

  function pickOrientation(value: string) {
    setOrientation((prev) => {
      const next = prev === value ? "" : value;
      rememberOnboardingOrientation(next);
      return next;
    });
  }

  function skipAll() {
    markOnboardingComplete();
    trackEvent("onboarding_skip", { atStep: step });
    setLocation("/today");
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
    setReadinessBefore(readiness);
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
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden">
      <div className="orb orb-violet fixed w-[800px] h-[800px] -top-[400px] -right-[200px] opacity-25 pointer-events-none" />
      <div className="orb orb-rose fixed w-[600px] h-[600px] -bottom-[300px] -left-[200px] opacity-15 pointer-events-none" />

      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-6 py-8 md:py-12 relative z-10">
        {/* Header: logo + progress */}
        <div className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] p-[1px] shadow-lg">
                <div className="w-full h-full bg-background rounded-[11px] flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(248_62%_52%/0.2)] to-[hsl(326_100%_59%/0.2)]" />
                  <Sparkles className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                </div>
              </div>
              <span className="font-serif text-xl font-bold tracking-tight">
                MatchLab<span className="text-[hsl(326_100%_59%)]">.</span>
              </span>
            </div>
            <button
              type="button"
              onClick={skipAll}
              className="text-sm font-bold text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary px-4 py-2 rounded-full"
              data-testid="onboarding-skip"
            >
              Skip for now
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 w-full overflow-hidden rounded-full bg-secondary/80 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              <span className="text-[hsl(248_62%_52%)]">{progress}%</span> Ready
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" {...fadeStep} className="max-w-2xl mx-auto w-full">
                <div className="text-center mb-10">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-16 h-16 rounded-2xl bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_52%)] flex items-center justify-center mx-auto mb-6 shadow-inner"
                  >
                    <Award className="w-8 h-8" />
                  </motion.div>
                  <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl tracking-tight mb-4">
                    {firstName ? `Hey ${firstName}, I'm Echo.` : "Hi, I'm Echo."}
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
                    I'm the friend who gets to know you, helps you get genuinely ready, and walks you toward the person you would never have found on your own. The more you share with me, the better I get at it.
                  </p>
                </div>

                <div className="glass-strong border border-border/50 rounded-[2rem] p-6 sm:p-10 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-[hsl(248_62%_52%/0.1)] to-transparent rounded-full blur-3xl" />
                  
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                    <Target className="w-4 h-4 text-[hsl(248_62%_52%)]" /> What are you here for?
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 mb-10">
                    {GOALS.map((g) => {
                      const active = goal === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => pickGoal(g.value)}
                          className={
                            "rounded-2xl border-2 p-5 text-left transition-all " +
                            (active
                              ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)] shadow-md"
                              : "border-border/60 hover:border-[hsl(248_62%_52%/0.3)] hover:bg-background/50 bg-background/30")
                          }
                          data-testid={`onboarding-goal-${g.value.replace(/\s+/g, "-")}`}
                        >
                          <span className="flex items-center justify-between mb-1.5">
                            <span className={`font-bold ${active ? "text-[hsl(248_62%_52%)]" : "text-foreground"}`}>{g.label}</span>
                            {active && <Check className="h-5 w-5 text-[hsl(248_62%_52%)]" />}
                          </span>
                          <span className="block text-sm text-muted-foreground leading-snug">{g.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/60 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[hsl(248_62%_52%)]" /> A little about you
                  </p>
                  <div className="space-y-6 bg-background/50 border border-border/50 rounded-2xl p-6">
                    <div>
                      <p className="mb-3 text-sm font-bold text-foreground">How you identify <span className="text-[10px] font-medium uppercase tracking-widest ml-2 bg-secondary px-2 py-1 rounded text-muted-foreground">Optional</span></p>
                      <div className="flex flex-wrap gap-2.5">
                        {ORIENTATIONS.map((o) => {
                          const active = orientation === o;
                          return (
                            <button
                              key={o}
                              type="button"
                              onClick={() => pickOrientation(o)}
                              className={
                                "rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition-all " +
                                (active
                                  ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%)] text-white shadow-md"
                                  : "border-border/60 hover:border-[hsl(248_62%_52%/0.4)] bg-background/40 hover:bg-background")
                              }
                              data-testid={`onboarding-orientation-${o.toLowerCase()}`}
                            >
                              {o}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-3 text-sm font-bold text-foreground">Who you want to meet <span className="text-[10px] font-medium uppercase tracking-widest ml-2 bg-secondary px-2 py-1 rounded text-muted-foreground">Multiple ok</span></p>
                      <div className="flex flex-wrap gap-2.5">
                        {SEEKING.map((s) => {
                          const active = seeking.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSeeking(s)}
                              className={
                                "rounded-xl border-2 px-5 py-2.5 text-sm font-bold transition-all " +
                                (active
                                  ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%)] text-white shadow-md"
                                  : "border-border/60 hover:border-[hsl(248_62%_52%/0.4)] bg-background/40 hover:bg-background")
                              }
                              data-testid={`onboarding-seeking-${s.toLowerCase().replace(/[ /']+/g, "-")}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex justify-end">
                  <Button
                    size="lg"
                    disabled={!goal}
                    onClick={() => setStep(1)}
                    className="h-14 px-8 rounded-full text-base font-bold bg-foreground text-background hover:bg-foreground/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    data-testid="onboarding-next-0"
                  >
                    Start the Climb <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" {...fadeStep} className="max-w-2xl mx-auto w-full">
                <div className="mb-8">
                  <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl tracking-tight mb-4">
                    Tell me about you
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {goalIntro(goal)}
                  </p>
                </div>
                
                <div className="mb-10">
                  <AnimatedMeter score={readiness} label="Where you are now" />
                </div>

                <div className="space-y-6 mb-10">
                  {STARTER_MODULE.map((q, i) => (
                    <div key={q.id} className="glass-strong border border-border/50 rounded-3xl p-6 shadow-sm group focus-within:border-[hsl(248_62%_52%/0.4)] focus-within:shadow-md transition-all">
                      <label
                        htmlFor={`q-${q.id}`}
                        className="mb-3 block text-base font-bold text-foreground flex gap-3"
                      >
                        <span className="text-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.1)] w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
                        {q.text}
                      </label>
                      <Textarea
                        id={`q-${q.id}`}
                        value={answers[q.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Type your answer... (a sentence or two is perfect)"
                        className="min-h-[100px] resize-none border-foreground/10 bg-background/50 rounded-xl text-base focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] p-4"
                        data-testid={`onboarding-answer-${q.id}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-8">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(0)}
                    className="h-14 px-6 rounded-full font-bold text-muted-foreground hover:text-foreground"
                    data-testid="onboarding-back-1"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" /> Back
                  </Button>
                  <Button
                    size="lg"
                    onClick={saveBaseline}
                    disabled={saving}
                    className="h-14 px-8 rounded-full text-base font-bold bg-[hsl(248_62%_52%)] hover:bg-[hsl(248_62%_52%/0.9)] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    data-testid="onboarding-next-1"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Taking it in...
                      </>
                    ) : (
                      <>
                        Share with Echo <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" {...fadeStep} className="max-w-2xl mx-auto w-full">
                <div className="mb-8">
                  <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl tracking-tight mb-4">
                    Momentum Unlocked
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Every source you connect helps Echo know you better and opens up new features. Pick one to try now, or do it later. You control your data.
                  </p>
                </div>
                
                <div className="mb-10">
                  <AnimatedMeter score={readiness} label="Readiness after your first answers" previousScore={readinessBefore} />
                </div>

                <div className="grid gap-4 mb-10">
                  {SOURCES.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.href}
                        type="button"
                        onClick={() => connectSource(s.href)}
                        className="group flex flex-col sm:flex-row sm:items-center gap-5 rounded-[2rem] border border-border/60 bg-background/50 p-5 text-left transition-all hover:border-[hsl(248_62%_52%/0.4)] hover:bg-[hsl(248_62%_52%/0.03)] hover:shadow-md"
                        data-testid={`onboarding-source-${s.href.replace(/\//g, "")}`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%/0.15)] to-[hsl(326_100%_59%/0.15)] border border-[hsl(248_62%_52%/0.2)] shadow-inner">
                            <Icon className="h-6 w-6 text-[hsl(248_62%_52%)]" />
                          </span>
                          <div>
                            <span className="block font-bold text-lg text-foreground mb-1 group-hover:text-[hsl(248_62%_52%)] transition-colors">{s.title}</span>
                            <span className="block text-sm text-muted-foreground leading-snug">{s.desc}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border/50">
                          {s.points > 0 && (
                            <div className="flex items-center gap-1.5 bg-[hsl(38_90%_50%/0.15)] text-[hsl(38_90%_40%)] dark:text-[hsl(38_90%_60%)] px-3 py-1.5 rounded-xl text-xs font-bold">
                              <Zap className="w-3.5 h-3.5" /> +{s.points} pts
                            </div>
                          )}
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-[hsl(248_62%_52%)] group-hover:text-white transition-colors">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex items-center justify-between border-t border-border/50 pt-8">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="h-14 px-6 rounded-full font-bold text-muted-foreground hover:text-foreground"
                    data-testid="onboarding-back-2"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" /> Back
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => setStep(3)}
                    className="h-14 px-8 rounded-full text-base font-bold bg-foreground text-background hover:bg-foreground/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    data-testid="onboarding-next-2"
                  >
                    Continue to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" {...fadeStep} className="max-w-2xl mx-auto w-full text-center">
                <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] shadow-[0_0_50px_hsl(248_62%_52%/0.3)]">
                  <Sparkles className="h-12 w-12 text-white animate-pulse" />
                </div>
                <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl tracking-tight mb-4">
                  Here's my first read on you
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground leading-relaxed">
                  This is what Echo can see so far, built entirely from what you just shared. It gets sharper with every move you make.
                </p>

                {portraitQuery.isLoading ? (
                  <div
                    className="mx-auto mt-12 flex max-w-md flex-col items-center justify-center gap-4 rounded-[2rem] border border-border/50 bg-background/50 p-10 shadow-inner"
                    data-testid="onboarding-portrait-loading"
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-[hsl(248_62%_52%)]" />
                    <p className="font-bold text-muted-foreground">Getting my first read...</p>
                  </div>
                ) : portrait ? (
                  <div
                    className="mx-auto mt-12 max-w-xl rounded-[2rem] border border-[hsl(248_62%_52%/0.3)] bg-gradient-to-b from-[hsl(248_62%_52%/0.08)] to-transparent p-8 text-left shadow-xl relative overflow-hidden"
                    data-testid="onboarding-portrait"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(248_62%_52%/0.2)] rounded-full blur-3xl" />
                    
                    <div className="flex flex-wrap items-center gap-3 relative z-10">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(248_62%_52%)] px-4 py-1.5 text-xs font-bold text-white shadow-sm">
                        <Eye className="h-3.5 w-3.5" /> {portrait.stageLabel}
                      </span>
                      <span className="rounded-full border-2 border-foreground/10 bg-background/80 px-4 py-1.5 text-xs font-bold text-muted-foreground">
                        {portrait.coveragePercent}% of you mapped
                      </span>
                    </div>
                    <p
                      className="mt-6 font-serif text-2xl md:text-3xl font-bold leading-snug text-foreground relative z-10"
                      data-testid="onboarding-portrait-headline"
                    >
                      {portrait.headline}
                    </p>
                    {portrait.nextSignal && (
                      <div className="mt-8 rounded-2xl border border-[hsl(326_100%_59%/0.2)] bg-background/80 p-5 relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-[hsl(326_100%_59%)] flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5" /> Your Best Next Move
                        </p>
                        <p className="mt-2 text-lg font-bold text-foreground">{portrait.nextSignal.label}</p>
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                          {portrait.nextSignal.detail}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="mt-12 flex justify-center">
                  <Button
                    size="lg"
                    onClick={finish}
                    className="h-16 px-10 rounded-full text-lg font-bold bg-foreground text-background hover:bg-foreground/90 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
                    data-testid="onboarding-finish"
                  >
                    Enter Your Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
