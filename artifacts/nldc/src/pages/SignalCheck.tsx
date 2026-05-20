import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateAudit, useGenerateAuditReport, getListAuditsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Headphones, ArrowRight, Lock, CheckCircle, Sparkles, TrendingUp, Mail } from "lucide-react";
import { useMeta } from "@/hooks/useMeta";
import { captureLead } from "@/lib/apiClient";

const GOALS = [
  { value: "find a relationship", label: "Find a relationship", emoji: "💍" },
  { value: "casual dating", label: "Casual dating", emoji: "☀️" },
  { value: "heal from a breakup", label: "Heal & rediscover", emoji: "🌱" },
  { value: "just curious", label: "Just exploring", emoji: "🔭" },
];

type TeaseReport = {
  score: number;
  category: string;
  keyImprovement: string;
  rewrittenLine: string;
  originalLine: string;
  suggestedOpener: string;
  auditId: number;
};

const DEMO_TEASE: TeaseReport = {
  score: 64,
  category: "The Hidden Gem",
  keyImprovement: "Generic language is masking your actual personality. Phrases like 'loves hiking and cooking' appear in thousands of profiles and become invisible. The fix is replacing general with specific — one sentence can change everything.",
  rewrittenLine: "I make a genuinely great first date — I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to.",
  originalLine: "Software engineer who loves hiking and cooking. I'm told I'm easy to talk to and have a great sense of humor.",
  suggestedOpener: "Okay I have a question about your [specific thing from profile] — what's the actual story there?",
  auditId: 0,
};

const GOAL_CATEGORY_MAP: Record<string, string[]> = {
  "find a relationship": ["The Authentic Connector", "The Hidden Gem", "The Overlooked Catch", "The Reset Candidate"],
  "casual dating": ["The Casually Confident", "The Unclear Signal", "The Generic Browser", "The Confused Sender"],
  "heal from a breakup": ["The Quietly Ready", "The Healing in Progress", "The Still Searching", "The Early Explorer"],
  default: ["The Hidden Gem", "The Generic Profile", "The Authentic Connector", "The Reset Candidate"],
};

function getCategory(score: number, goal: string): string {
  const cats = GOAL_CATEGORY_MAP[goal] ?? GOAL_CATEGORY_MAP.default;
  if (score >= 75) return cats[0];
  if (score >= 60) return cats[1];
  if (score >= 45) return cats[2];
  return cats[3];
}

function AnimatedScore({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let frame: number;
    const start = Date.now();
    const duration = 1600;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(ease * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div className="relative w-48 h-48 mx-auto" data-testid="signal-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160" style={{ filter: `drop-shadow(0 0 18px ${color}50)` }}>
        <circle cx="80" cy="80" r={radius} strokeWidth="12" stroke="hsl(232 28% 18%)" fill="none" />
        <circle
          cx="80" cy="80" r={radius} strokeWidth="12"
          stroke={color} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color }} data-testid="signal-score-number">{displayed}</span>
        <span className="text-xs text-muted-foreground font-medium">Signal Strength</span>
      </div>
    </div>
  );
}

export default function SignalCheck() {
  useMeta("Free 3-Min Signal Check", "Paste your dating bio and get your Signal Strength score, profile category, #1 improvement, and a rewritten line — free, instant, no account needed.");
  const [firstName, setFirstName] = useState("");
  const [bio, setBio] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<TeaseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);

  const queryClient = useQueryClient();
  const createAudit = useCreateAudit();
  const generateReport = useGenerateAuditReport();
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result && !loading;

  const LOADING_STEPS = [
    "Scanning your bio for signal strength...",
    "Identifying your profile category...",
    "Finding your highest-impact improvement...",
    "Writing your rewritten line...",
  ];

  async function runCheck() {
    setLoading(true);
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 1600);
    try {
      const audit = await createAudit.mutateAsync({
        data: {
          firstName: firstName.trim() || "You",
          age: 0,
          gender: "not specified",
          orientation: "not specified",
          currentApps: [],
          datingGoal: goal || "find a relationship",
          biggestChallenge: "Not sure how I come across",
          bio: bio.trim(),
          prompts: null,
          recentMessageSample: null,
          photoCount: null,
          relationshipHistory: null,
        },
      });
      rememberAnonymousId("audits", audit.id);
      const report = await generateReport.mutateAsync({ id: audit.id }) as {
        readinessScore: number;
        risks: string[];
        rewrittenBio: string;
      };
      const score = report.readinessScore ?? 64;
      const keyImprovement = report.risks?.[0] ?? DEMO_TEASE.keyImprovement;
      const firstLine = bio.split(".")[0] + (bio.includes(".") ? "." : "");
      const rewrittenLine = report.rewrittenBio
        ? report.rewrittenBio.split(".").slice(0, 2).join(".") + "."
        : DEMO_TEASE.rewrittenLine;

      setResult({
        score,
        category: getCategory(score, goal),
        keyImprovement,
        rewrittenLine,
        originalLine: firstLine || bio.slice(0, 120),
        suggestedOpener: DEMO_TEASE.suggestedOpener,
        auditId: audit.id,
      });
      queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
    } catch {
      setResult({ ...DEMO_TEASE, category: getCategory(DEMO_TEASE.score, goal) });
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  const scoreColor = result
    ? result.score >= 75 ? "hsl(142 55% 60%)" : result.score >= 55 ? "hsl(268 52% 68%)" : "hsl(43 65% 65%)"
    : "hsl(268 52% 68%)";

  const LOCKED_ITEMS = [
    "Complete bio rewrite (not just one line)",
    "All profile prompts rewritten",
    "Full photo checklist (5 categories)",
    "Messaging style analysis",
    "5-step personalised action plan",
    "Score history tracking",
  ];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-gold fixed w-[500px] h-[500px] -top-40 -right-40 opacity-40 pointer-events-none" />
        <div className="orb orb-violet fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-40 pointer-events-none" />

        <div className="max-w-xl mx-auto relative z-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[hsl(43_65%_62%/0.25)] text-sm font-medium text-[hsl(43_65%_72%)] mb-5">
              <Headphones className="w-4 h-4" /> Free for Podcast Listeners · 3 Minutes
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Your 3-Minute Signal Check</h1>
            <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
              Paste your bio. Get your Signal Strength score, your profile category, your #1 improvement, and a rewritten line — in 3 minutes flat.
            </p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="mb-6" data-testid="signalcheck-empty-state">
              <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Welcome to Signal Check</p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-2">Get an instant read on your profile</h2>
                <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                  Paste your bio for a quick Signal Strength score, your category, your #1 improvement area, and one rewritten line you can use today.
                </p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* RESULT */}
            {result && !loading && (
              <motion.div key="result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Score Card */}
                <div
                  className="glass rounded-3xl p-8 text-center shimmer"
                  style={{ borderColor: `${scoreColor.replace(")", " / 0.3)")}`, borderWidth: "1px", borderStyle: "solid", boxShadow: `0 0 60px ${scoreColor.replace(")", " / 0.1)")}` }}
                  data-testid="card-signal-score"
                >
                  <AnimatedScore target={result.score} color={scoreColor} />
                  <div className="mt-6">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Your Profile Category</p>
                    <span
                      className="inline-block px-5 py-2 rounded-full text-sm font-bold"
                      style={{ background: `${scoreColor.replace(")", " / 0.12)")}`, color: scoreColor, border: `1px solid ${scoreColor.replace(")", " / 0.3)")}` }}
                      data-testid="text-signal-category"
                    >
                      {result.category}
                    </span>
                  </div>
                </div>

                {/* Key Improvement */}
                <div className="glass border border-[hsl(43_65%_62%/0.2)] rounded-3xl p-7" data-testid="card-signal-improvement">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(43_65%_62%/0.15)]">
                      <TrendingUp className="w-4 h-4 text-[hsl(43_65%_67%)]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[hsl(43_65%_67%)] mb-2">#1 Improvement Area</p>
                      <p className="text-sm text-foreground/85 leading-relaxed">{result.keyImprovement}</p>
                    </div>
                  </div>
                </div>

                {/* Before / After Line */}
                <div className="glass border border-white/8 rounded-3xl p-7" data-testid="card-signal-rewrite">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">One Line, Rewritten ✦</p>
                  <div className="space-y-3">
                    <div className="rounded-2xl p-4 bg-[hsl(232_28%_14%)] border border-white/8">
                      <p className="text-xs text-muted-foreground font-medium mb-1.5">Your original</p>
                      <p className="text-sm text-muted-foreground/80 italic">"{result.originalLine || "Your bio text..."}"</p>
                    </div>
                    <div className="rounded-2xl p-4 border border-[hsl(268_52%_68%/0.3)] bg-[hsl(268_52%_68%/0.07)]">
                      <p className="text-xs text-[hsl(268_60%_78%)] font-semibold mb-1.5">Rewritten ✦</p>
                      <p className="text-sm text-foreground">{result.rewrittenLine}</p>
                    </div>
                  </div>
                </div>

                {/* Suggested Opener */}
                <div className="glass border border-white/8 rounded-3xl p-7" data-testid="card-signal-opener">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">One Opening Message to Try</p>
                  <div className="flex justify-end">
                    <div className="max-w-sm text-sm px-4 py-3 rounded-2xl rounded-br-sm text-white font-medium" style={{ background: "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))" }}>
                      {result.suggestedOpener}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">Personalise the [specific thing] to something real from their profile. Messages that reference something specific convert at 3× the rate of generic openers.</p>
                </div>

                {/* Email lead capture */}
                {!leadSaved ? (
                  <div className="glass border border-[hsl(268_52%_68%/0.2)] rounded-3xl p-6" data-testid="card-signal-lead-capture">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[hsl(268_52%_68%/0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Mail className="w-4 h-4 text-[hsl(268_52%_68%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground mb-0.5">Save your result</p>
                        <p className="text-xs text-muted-foreground mb-3">Get your score and rewrite emailed to you — and be first to know when your full audit is ready.</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="your@email.com"
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[hsl(268_52%_68%/0.5)] transition-colors"
                          />
                          <button
                            onClick={async () => {
                              if (!leadEmail.includes("@")) return;
                              try {
                                await captureLead({
                                  email: leadEmail,
                                  firstName: firstName || null,
                                  source: "signal-check",
                                  interest: "signal-audit",
                                  metadata: { score: result?.score, category: result?.category, auditId: result?.auditId },
                                });
                              } catch { /* silent — still show success */ }
                              setLeadSaved(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_55%)] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
                          >
                            Save
                          </button>
                        </div>
                        <button
                          onClick={() => setLeadSaved(true)}
                          className="mt-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          No thanks, skip →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-3xl p-5 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-foreground">Saved — we'll be in touch when your full audit is ready.</p>
                  </div>
                )}

                {/* Locked Preview */}
                <div className="relative glass border border-white/8 rounded-3xl p-7 overflow-hidden" data-testid="card-signal-locked">
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(232_38%_7%/0.97)] via-[hsl(232_38%_7%/0.8)] to-transparent z-10" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center px-6">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-[hsl(268_52%_68%/0.15)] border border-[hsl(268_52%_68%/0.3)]">
                      <Lock className="w-6 h-6 text-[hsl(268_52%_68%)]" />
                    </div>
                    <p className="font-bold text-foreground text-lg mb-2">Full Audit includes all of this</p>
                    <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">Your Signal Check is just the surface. The Full Dating Blueprint goes 6× deeper.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse" data-testid="button-signal-full-audit">
                        <Link href="/start">Start My Full Audit <ArrowRight className="ml-2 h-4 w-4" /></Link>
                      </Button>
                      <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5" data-testid="button-signal-waitlist">
                        <Link href="/waitlist">Join Waitlist — 40% off</Link>
                      </Button>
                    </div>
                  </div>
                  {/* Blurred content */}
                  <div className="blur-sm pointer-events-none">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Also in your Full Audit</p>
                    <div className="space-y-3">
                      {LOCKED_ITEMS.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4 text-[hsl(268_52%_68%)] flex-shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Run Again */}
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setResult(null); setFirstName(""); setBio(""); setGoal(""); }}
                    className="text-muted-foreground hover:text-foreground text-sm"
                    data-testid="button-run-again"
                  >
                    Run another Signal Check
                  </Button>
                </div>
              </motion.div>
            )}

            {/* LOADING */}
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass border border-white/8 rounded-3xl p-16 text-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-[hsl(268_52%_68%/0.15)] border border-[hsl(268_52%_68%/0.3)]" style={{ animation: "glow-pulse 2s ease-in-out infinite" }}>
                  <Loader2 className="w-8 h-8 text-[hsl(268_52%_68%)] animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Checking your signal...</h3>
                <p className="text-muted-foreground text-sm">{LOADING_STEPS[loadingStep]}</p>
                <div className="flex justify-center gap-1.5 mt-5">
                  {LOADING_STEPS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= loadingStep ? "w-6 bg-[hsl(268_52%_68%)]" : "w-2 bg-[hsl(232_28%_22%)]"}`} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* WELCOME EMPTY STATE for brand-new authenticated users */}
            {isBrandNewUser && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5"
                data-testid="signal-check-empty-state"
              >
                <div className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
                  style={{ background: "linear-gradient(135deg, hsl(43 65% 65% / 0.12), hsl(268 52% 68% / 0.08))" }}>
                  <div className="absolute inset-0 border border-[hsl(43_65%_65%/0.2)] rounded-3xl pointer-events-none" />
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-[hsl(43_65%_65%/0.15)] border border-[hsl(43_65%_65%/0.25)] mx-auto mb-4 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-[hsl(43_65%_72%)]" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[hsl(43_65%_72%)] mb-2">Welcome to Signal Check</p>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Run your first signal check</h2>
                    <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                      Paste your bio below and we'll give you a Signal Strength score, your profile category, your top improvement, and a rewritten line — in about three minutes.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FORM */}
            {!result && !loading && (
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass border border-white/8 rounded-3xl p-8 space-y-6">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">First name</Label>
                  <Input
                    data-testid="input-signal-name"
                    placeholder="Jordan"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your bio <span className="text-[hsl(268_52%_68%)]">*</span></Label>
                  <Textarea
                    data-testid="textarea-signal-bio"
                    placeholder={"Paste your dating profile bio here — just the text, no formatting needed.\n\nEven a first draft or a rough version works. The more honest, the better your Signal Check."}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    className="min-h-[140px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">No account required. Your bio is never stored longer than needed to generate your result.</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What are you looking for?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {GOALS.map(g => (
                      <button
                        key={g.value}
                        data-testid={`button-signal-goal-${g.value.replace(/ /g, "-")}`}
                        onClick={() => setGoal(g.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${goal === g.value ? "border-[hsl(268_52%_68%/0.5)] bg-[hsl(268_52%_68%/0.1)]" : "border-white/8 bg-[hsl(232_28%_14%/0.5)] hover:border-white/15"}`}
                      >
                        <span className="text-base block mb-1">{g.emoji}</span>
                        <span className="text-xs font-medium text-foreground">{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={runCheck}
                  disabled={!bio.trim() || bio.trim().length < 15}
                  className="w-full rounded-full h-12 text-base font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-40"
                  data-testid="button-run-signal-check"
                >
                  <Sparkles className="mr-2 h-5 w-5" /> Check My Signal
                </Button>

                <div className="pt-1 space-y-2">
                  <p className="text-xs text-muted-foreground text-center font-medium">Free · No account · No credit card · Instant results</p>
                  <p className="text-xs text-muted-foreground text-center">Podcast listeners get 40% off the Full Audit — use code <strong className="text-[hsl(43_65%_68%)]">PODCAST40</strong></p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
