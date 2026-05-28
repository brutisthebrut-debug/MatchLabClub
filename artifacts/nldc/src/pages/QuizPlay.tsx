import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Sparkles, RefreshCw, Loader2, Share2, Check, Award, Info } from "lucide-react";
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
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
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
    quiz ? `${quiz.title} — Quiz Lab` : "Quiz",
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
  const [copied, setCopied] = useState(false);
  const [savedToWellness, setSavedToWellness] = useState(false);

  const progress = useMemo(() => {
    if (!quiz) return 0;
    const answered = answers.filter(a => a >= 0).length;
    return Math.round((answered / quiz.questions.length) * 100);
  }, [answers, quiz]);

  if (!quiz) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-3">Quiz not found</h1>
            <p className="text-muted-foreground mb-6">That quiz doesn't exist — but the Quiz Lab is right here.</p>
            <Button asChild className="rounded-full">
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

  function handleAnswer(optIndex: number) {
    setAnswers(prev => {
      const next = [...prev];
      next[step] = optIndex;
      return next;
    });
    // Advance synchronously — no setTimeout race. The functional updater
    // also hard-clamps to the last question index so rapid taps can't
    // overshoot past `questions.length - 1`.
    const lastIndex = quiz!.questions.length - 1;
    setStep(s => (s < lastIndex ? s + 1 : s));
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
      // Total failure — keep the Save button visible so they can retry.
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

  function handleShare() {
    if (!personalised) return;
    const text = `I just took "${quiz!.title}" on MatchLab Club and got: ${personalised.name} ${personalised.emoji}\n\n${personalised.tagline}\n\nTry it free at`;
    const url = `${window.location.origin}/quizzes/${quiz!.slug}`;
    navigator.clipboard?.writeText(`${text} ${url}`).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 2200); },
      () => { /* swallow */ },
    );
  }

  const currentQ = quiz.questions[step];
  const allAnswered = answers.every(a => a >= 0);
  const submitting = enhance.isPending;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[420px] h-[420px] -top-20 -left-20 opacity-30 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          {/* Breadcrumb */}
          <motion.div {...fadeUp()} className="mb-4">
            <Link href="/quizzes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> All quizzes
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div {...fadeUp(0.05)} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">{quiz.emoji}</span>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{quiz.title}</h1>
                <FallbackRateBadge toolName={`Quiz: ${quiz.title}`} className="mt-1" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">{quiz.pitch}</p>
          </motion.div>

          {/* Disclaimer */}
          {!result && (
            <motion.div {...fadeUp(0.07)} className="mb-5 flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-[hsl(43_65%_65%/0.18)] bg-[hsl(43_65%_65%/0.05)]">
              <Info className="w-3.5 h-3.5 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground/70">Not a diagnosis.</span> A pattern lens, based on what you tell us. Real, honest answers → useful read.
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="quiz" {...fadeUp(0.1)} className="space-y-5">
                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    {step + 1} / {quiz.questions.length}
                  </span>
                </div>

                {/* Question card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                    className="glass border border-white/8 rounded-2xl p-6"
                  >
                    <p className="font-semibold text-foreground text-base mb-5">{currentQ!.q}</p>
                    <div className="space-y-2">
                      {currentQ!.options.map((opt, oi) => {
                        const isSelected = answers[step] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => handleAnswer(oi)}
                            data-testid={`option-q${step}-${oi}`}
                            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all text-sm ${
                              isSelected
                                ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)] text-foreground"
                                : "border-foreground/10 text-muted-foreground hover:border-[hsl(248_62%_52%/0.3)] hover:text-foreground hover:bg-foreground/3"
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
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    data-testid="button-prev"
                  >
                    <ArrowLeft className="mr-1 w-4 h-4" /> Back
                  </Button>
                  {step < quiz.questions.length - 1 ? (
                    <Button
                      onClick={() => setStep(s => Math.min(quiz.questions.length - 1, s + 1))}
                      disabled={answers[step] < 0}
                      className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white"
                      data-testid="button-next"
                    >
                      Next <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={!allAnswered || submitting}
                      className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white"
                      data-testid="button-submit"
                    >
                      {submitting ? (<><Loader2 className="mr-1 w-4 h-4 animate-spin" /> Reading…</>) : (<>Get my badge <Sparkles className="ml-1 w-4 h-4" /></>)}
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : personalised ? (
              <motion.div key="result" {...fadeUp(0.05)} className="space-y-5">
                {/* Badge card */}
                <div
                  className="glass border rounded-2xl p-6 md:p-8 text-center"
                  style={{
                    borderColor: `hsl(${personalised.color} / 0.4)`,
                    background: `linear-gradient(135deg, hsl(${personalised.color} / 0.08), hsl(${personalised.color} / 0.02))`,
                  }}
                >
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                    <Award className="w-3 h-3" /> Your badge
                  </div>
                  <div className="text-6xl mb-3">{personalised.emoji}</div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{personalised.name}</h2>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
                    {personalised.tagline}
                  </p>
                </div>

                {usedFallback && (
                  <FallbackNotice
                    label="Using your baseline readout — the AI layer didn't return a clean personalisation, so you're seeing the deterministic result (still based on your actual answers)."
                    onRetry={handleSubmit}
                    loading={submitting}
                    testId="quiz-fallback-notice"
                  />
                )}

                {/* Insight */}
                <div className="glass border border-foreground/8 rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[hsl(248_62%_62%)]" /> What this means
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{personalised.insight}</p>
                </div>

                {/* Next step */}
                <div className="glass border border-foreground/8 rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-[hsl(326_100%_65%)]" /> Try this week
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{personalised.nextStep}</p>
                </div>

                {/* CTAs */}
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white" data-testid="button-result-cta">
                    <Link href={personalised.cta.href}>{personalised.cta.label} <ArrowRight className="ml-1 w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" onClick={handleShare} className="rounded-full" data-testid="button-share">
                    {copied ? (<><Check className="mr-1 w-4 h-4" /> Copied</>) : (<><Share2 className="mr-1 w-4 h-4" /> Share</>)}
                  </Button>
                  <Button variant="ghost" onClick={handleRetake} className="rounded-full text-muted-foreground" data-testid="button-retake">
                    <RefreshCw className="mr-1 w-4 h-4" /> Retake
                  </Button>
                </div>

                {/* Save to wellness (auth gate) */}
                <div className="glass border border-foreground/8 rounded-2xl p-5">
                  {isAuthenticated ? (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[hsl(248_62%_52%/0.12)] flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-[hsl(248_62%_62%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground mb-1">
                          {savedToWellness ? "Saved to your wellness profile" : "Add this to your wellness profile"}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          {savedToWellness
                            ? "These answers are now part of your second-brain and inform every coaching read."
                            : "Your quiz answers map to your wellness dimensions. Save them so they show up in your reads — you can edit or delete them anytime in the Vault."}
                        </p>
                        {!savedToWellness && (
                          <Button
                            size="sm"
                            onClick={handleSaveToWellness}
                            disabled={createWellnessAnswer.isPending}
                            className="rounded-full text-xs h-8"
                            data-testid="button-save-wellness"
                          >
                            {createWellnessAnswer.isPending ? (<><Loader2 className="mr-1 w-3 h-3 animate-spin" /> Saving…</>) : "Save to my profile"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[hsl(326_100%_65%/0.12)] flex items-center justify-center flex-shrink-0">
                        <Award className="w-4 h-4 text-[hsl(326_100%_65%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground mb-1">Keep this badge forever</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          Sign in to save badges across devices and let every quiz answer feed your full Connection Style readout.
                        </p>
                        <Button asChild size="sm" className="rounded-full text-xs h-8 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white">
                          <Link href="/start">Start free → save automatically</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
                  Your badge is saved on this device.{" "}
                  <Link href="/quizzes" className="underline-offset-2 hover:underline">See all quizzes →</Link>
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
