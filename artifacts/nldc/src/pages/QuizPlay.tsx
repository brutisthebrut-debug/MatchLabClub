import { useState, useMemo, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Sparkles, RefreshCw, Loader2, Award, Info, Activity } from "lucide-react";
import { ShareButton } from "@/components/echo/ShareButton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import { useEnhanceAi, useCreateWellnessAnswer } from "@workspace/api-client-react";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";
import { trackEvent } from "@/lib/analytics";
import {
  getQuizBySlug,
  scoreQuiz,
  saveQuizResult,
  extractWellnessAnswers,
  type QuizArchetype,
} from "@/lib/quizzes";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface ArchetypeOverride {
  tagline?: string;
  insight?: string;
  nextStep?: string;
}

function tryParseOverride(raw: string): ArchetypeOverride | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown, min: number) =>
      typeof v === "string" && v.trim().length >= min ? v.trim() : undefined;
    const out: ArchetypeOverride = {
      tagline: str(parsed.tagline, 20),
      insight: str(parsed.insight, 60),
      nextStep: str(parsed.nextStep, 20),
    };
    if (!out.tagline && !out.insight && !out.nextStep) return null;
    return out;
  } catch {
    return null;
  }
}

interface QuizPlayProps {
  slug: string;
}

export default function QuizPlay({ slug }: QuizPlayProps) {
  const quiz = getQuizBySlug(slug);
  useMeta(
    quiz ? `${quiz.title} · Quiz Lab` : "Quiz",
    quiz ? quiz.pitch : "MatchLab Quiz Lab",
  );

  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const enhance = useEnhanceAi();
  const createWellnessAnswer = useCreateWellnessAnswer();

  const [answers, setAnswers] = useState<number[]>(() =>
    quiz ? Array(quiz.questions.length).fill(-1) : [],
  );
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [override, setOverride] = useState<ArchetypeOverride>({});
  const [usedFallback, setUsedFallback] = useState(false);
  const [savedToWellness, setSavedToWellness] = useState(false);

  const progress = useMemo(() => {
    if (!quiz) return 0;
    const answered = answers.filter(a => a >= 0).length;
    return Math.round((answered / quiz.questions.length) * 100);
  }, [answers, quiz]);

  if (!quiz) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] flex items-center justify-center p-6 mesh-bg">
          <div className="text-center max-w-md glass-strong rounded-[2rem] p-10 border border-foreground/10">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-6 opacity-50" />
            <h1 className="text-3xl font-serif font-bold text-foreground mb-4">Quiz not found</h1>
            <p className="text-muted-foreground mb-8 text-base">That quiz doesn't exist, but the Quiz Lab is full of other reads.</p>
            <Button asChild size="lg" className="rounded-full w-full font-bold shadow-md">
              <Link href="/quizzes">Browse all quizzes <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const archetype: QuizArchetype | null = result ? quiz.archetypes[result] ?? null : null;
  const personalised: QuizArchetype | null = archetype
    ? {
        ...archetype,
        tagline: override.tagline ?? archetype.tagline,
        insight: override.insight ?? archetype.insight,
        nextStep: override.nextStep ?? archetype.nextStep,
      }
    : null;

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleAnswer(optIndex: number) {
    setAnswers(prev => {
      const next = [...prev];
      next[step] = optIndex;
      return next;
    });

    // Auto-advance after a short beat for visual feedback. Guard against
    // rapid taps stacking multiple timers (which could skip questions) by
    // cancelling any pending advance before scheduling a new one.
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const lastIndex = quiz!.questions.length - 1;
      setStep(s => (s < lastIndex ? s + 1 : s));
      advanceTimer.current = null;
    }, 400);
  }

  async function handleSubmit() {
    const archetypeKey = scoreQuiz(quiz!, answers);
    if (!archetypeKey) return;
    setResult(archetypeKey);
    setOverride({});
    setUsedFallback(false);

    const base = quiz!.archetypes[archetypeKey];
    if (!base) return;

    saveQuizResult({
      slug: quiz!.slug,
      archetypeKey,
      archetypeName: base.name,
      takenAt: new Date().toISOString(),
    });
    trackEvent("quiz_completed", {
      quiz_slug: quiz!.slug,
      archetype: archetypeKey,
      questions_answered: answers.filter(a => a >= 0).length,
    });

    const summary = quiz!.questions
      .map((q, qi) => {
        const ai = answers[qi];
        return ai >= 0 ? `${q.q} → ${q.options[ai]!.label}` : null;
      })
      .filter(Boolean)
      .join("\n");

    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: `Quiz: ${quiz!.title}`,
          prompt: [
            `The user just took the "${quiz!.title}" quiz and scored as "${base.name}".`,
            "Personalise the readout based on their actual answers below.",
            "Return ONLY a single JSON object with these keys:",
            '{ "tagline": string, "insight": string, "nextStep": string }',
            "tagline: one punchy sentence (max ~20 words) describing this archetype as it shows up for THIS person.",
            "insight: 2-3 sentences (max ~80 words) of specific, kind, sharp commentary tied to what they actually answered.",
            "nextStep: one specific concrete experiment they could try this week (max ~30 words).",
            "",
            "Their answers:",
            summary,
            "",
            "Return ONLY the JSON object. No prose, no markdown, no preamble.",
          ].join("\n"),
          context: { toolName: `Quiz: ${quiz!.title}`, formValues: { slug: quiz!.slug, archetypeKey, answers } },
        },
      });
      if (ai.isFallback || ai.validated === false || !ai.output.trim()) {
        setUsedFallback(true);
      } else {
        const parsed = tryParseOverride(ai.output);
        if (parsed) setOverride(parsed); else setUsedFallback(true);
      }
    } catch {
      setUsedFallback(true);
    }
  }

  async function handleSaveToWellness() {
    const items = extractWellnessAnswers(quiz!, answers);
    if (items.length === 0) {
      setSavedToWellness(true);
      toast({
        title: "Nothing to save",
        description: "This quiz didn't include any wellness-mapped questions to save.",
      });
      return;
    }
    let saved = 0;
    for (const item of items) {
      try {
        await createWellnessAnswer.mutateAsync({
          data: {
            questionId: item.questionId,
            dimension: item.dimension,
            category: item.category ?? null,
            questionText: item.questionText,
            answer: item.answer,
            consentLevel: "coaching",
          },
        });
        saved += 1;
      } catch {
        // continue, count failures via the diff at the end
      }
    }
    trackEvent("quiz_wellness_saved", { quiz_slug: quiz!.slug, items_saved: saved });
    if (saved > 0) {
      setSavedToWellness(true);
      toast({
        title: "Saved to your wellness profile",
        description: `${saved} ${saved === 1 ? "answer" : "answers"} from this quiz are now part of your dating second-brain.`,
      });
    } else {
      toast({
        title: "Couldn't save right now",
        description: "Your network or session may have hiccuped. Try again in a moment.",
        variant: "destructive",
      });
    }
  }

  function handleRetake() {
    setAnswers(Array(quiz!.questions.length).fill(-1));
    setStep(0);
    setResult(null);
    setOverride({});
    setUsedFallback(false);
    setSavedToWellness(false);
  }

  const currentQ = quiz.questions[step];
  const allAnswered = answers.every(a => a >= 0);
  const submitting = enhance.isPending;

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-5rem)] mesh-bg py-8 md:py-16 px-4">
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Breadcrumb */}
          <motion.div {...fadeUp()} className="mb-8">
            <Link href="/quizzes" className="text-sm font-semibold text-muted-foreground hover:text-[hsl(248_62%_52%)] inline-flex items-center gap-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> All quizzes
            </Link>
          </motion.div>

          {!result && (
            <motion.div {...fadeUp(0.05)} className="mb-10 text-center">
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground leading-tight mb-3">{quiz.title}</h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto">{quiz.pitch}</p>
              <div className="mt-4 flex justify-center">
                <FallbackRateBadge toolName={`Quiz: ${quiz.title}`} />
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="quiz" {...fadeUp(0.1)} className="space-y-8">
                {/* Progress bar */}
                <div className="px-2">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progress</span>
                    <span className="text-xs font-bold text-foreground">
                      {step + 1} / {quiz.questions.length}
                    </span>
                  </div>
                  <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Question card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="glass-strong border border-foreground/10 rounded-[2rem] p-6 md:p-10 shadow-lg"
                  >
                    <h2 className="font-serif font-bold text-foreground text-xl md:text-2xl mb-8 leading-snug">{currentQ!.q}</h2>
                    <div className="space-y-3">
                      {currentQ!.options.map((opt, oi) => {
                        const isSelected = answers[step] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => handleAnswer(oi)}
                            className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 text-sm md:text-base font-medium ${
                              isSelected
                                ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)] text-[hsl(248_62%_40%)] dark:text-[hsl(248_62%_70%)] shadow-sm transform scale-[1.01]"
                                : "border-foreground/10 text-foreground/80 hover:border-[hsl(248_62%_52%/0.3)] hover:text-foreground hover:bg-foreground/5"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Nav */}
                <div className="flex items-center justify-between px-2 pt-2">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="rounded-full text-muted-foreground font-semibold"
                  >
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  
                  {step < quiz.questions.length - 1 ? (
                    <Button
                      size="lg"
                      onClick={() => setStep(s => Math.min(quiz.questions.length - 1, s + 1))}
                      disabled={answers[step] < 0}
                      className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 font-bold"
                    >
                      Next <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleSubmit}
                      disabled={!allAnswered || submitting}
                      className="rounded-full px-8 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                    >
                      {submitting ? (<><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Reading your pattern…</>) : (<>Reveal My Result <Sparkles className="ml-2 w-4 h-4" /></>)}
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : personalised ? (
              <motion.div key="result" {...fadeUp(0.1)} className="space-y-6">
                
                {/* Grand Badge Reveal */}
                <div
                  className="glass-strong border rounded-[2rem] p-8 md:p-12 text-center shadow-xl relative overflow-hidden"
                  style={{
                    borderColor: `hsl(${personalised.color} / 0.5)`,
                    background: `linear-gradient(135deg, hsl(${personalised.color} / 0.1), hsl(${personalised.color} / 0.02))`,
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-1" style={{ background: `hsl(${personalised.color})` }} />
                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-background/50 border border-foreground/5 text-xs uppercase tracking-widest text-muted-foreground font-bold mb-6 backdrop-blur-md">
                    <Award className="w-3.5 h-3.5" style={{ color: `hsl(${personalised.color})` }} /> 
                    Your Result
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">{personalised.name}</h2>
                  <p className="text-lg md:text-xl font-medium text-foreground/80 leading-relaxed max-w-lg mx-auto">
                    {personalised.tagline}
                  </p>
                </div>

                {usedFallback && (
                  <FallbackNotice
                    label="Using your baseline readout, the AI layer didn't return a clean personalisation, so you're seeing the deterministic result (still based on your actual answers)."
                    onRetry={handleSubmit}
                    loading={submitting}
                  />
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Insight */}
                  <div className="glass border border-foreground/10 rounded-[2rem] p-8 hover:border-[hsl(248_62%_52%/0.3)] transition-colors">
                    <h3 className="font-bold text-foreground text-lg mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[hsl(248_62%_52%)]" /> The Read
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed">{personalised.insight}</p>
                  </div>

                  {/* Next step */}
                  <div className="glass border border-foreground/10 rounded-[2rem] p-8 hover:border-[hsl(326_100%_59%/0.3)] transition-colors">
                    <h3 className="font-bold text-foreground text-lg mb-4 flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-[hsl(326_100%_59%)]" /> The Move
                    </h3>
                    <p className="text-base text-muted-foreground leading-relaxed">{personalised.nextStep}</p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button asChild size="lg" className="flex-1 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-bold h-14 text-base shadow-lg">
                    <Link href={personalised.cta.href}>{personalised.cta.label} <ArrowRight className="ml-2 w-5 h-5" /></Link>
                  </Button>
                  
                  <div className="flex gap-3">
                    <ShareButton
                      surface="quiz-result"
                      variant="ghost"
                      title={`I'm a ${personalised.name}`}
                      text={`I just took "${quiz.title}" on MatchLab Club and got: ${personalised.name}\n\n${personalised.tagline}\n\nTry it free →`}
                      path={`/quizzes/${quiz.slug}`}
                      ref={`quiz-${quiz.slug}`}
                      label="Share"
                      className="flex-1 sm:flex-none rounded-full h-14 px-6 border-foreground/20 hover:bg-foreground/5 font-bold"
                    />
                    <Button variant="outline" size="lg" onClick={handleRetake} className="flex-1 sm:flex-none rounded-full h-14 px-6 border-foreground/20 hover:bg-foreground/5 font-bold text-muted-foreground">
                      <RefreshCw className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Save to wellness (auth gate) */}
                <div className="mt-8 glass-elevated border border-foreground/10 rounded-[2rem] p-8 text-center sm:text-left sm:flex items-center gap-6">
                  {isAuthenticated ? (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3D35CC]/10 to-[#FF2D9B]/10 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0 mb-4 sm:mb-0 border border-foreground/5">
                        <Activity className="w-8 h-8 text-[hsl(248_62%_52%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-foreground mb-2">
                          {savedToWellness ? "Saved to your profile" : "Make your second-brain smarter"}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-0 max-w-md">
                          {savedToWellness
                            ? "These answers are now part of your wellness map and inform every coaching read."
                            : "Your quiz answers map to your wellness dimensions. Save them so they show up in your reads."}
                        </p>
                      </div>
                      {!savedToWellness && (
                        <Button
                          onClick={handleSaveToWellness}
                          disabled={createWellnessAnswer.isPending}
                          className="rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold px-6 h-12 w-full sm:w-auto flex-shrink-0"
                        >
                          {createWellnessAnswer.isPending ? (<><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Saving…</>) : "Save to my profile"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3D35CC]/10 to-[#FF2D9B]/10 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0 mb-4 sm:mb-0 border border-foreground/5">
                        <Award className="w-8 h-8 text-[hsl(326_100%_59%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-foreground mb-2">Keep this result forever</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-0 max-w-md">
                          Sign in to save results across devices and let every quiz answer feed your full Connection Style readout.
                        </p>
                      </div>
                      <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold px-6 h-12 w-full sm:w-auto flex-shrink-0">
                        <Link href="/start">Start free → save</Link>
                      </Button>
                    </>
                  )}
                </div>

              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
