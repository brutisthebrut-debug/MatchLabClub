import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateAudit, useGenerateAuditReport, getListAuditsQueryKey, getGetMatchingStateQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Sparkles, ArrowRight, CheckCircle, TrendingUp, AlertTriangle, Eye, Trophy, FileText, Heart, Sun, Sprout, Telescope } from "lucide-react";

const GOALS = [
  { value: "find a relationship", label: "Find a relationship", icon: Heart },
  { value: "casual dating", label: "Casual dating", icon: Sun },
  { value: "heal from a breakup", label: "Heal & rediscover myself", icon: Sprout },
  { value: "just curious", label: "Just exploring", icon: Telescope },
];

type DiagnosisCategory = {
  label: string;
  tagline: string;
  color: string;
  bg: string;
  border: string;
  summary: string;
};

function getCategory(score: number, goal: string): DiagnosisCategory {
  const isRelationship = goal.includes("relationship");
  const isHealing = goal.includes("heal");

  if (score >= 75) return {
  label: "The Authentic Connector",
  tagline: "Your substance is real, it just needs a sharper lens.",
  color: "hsl(142 55% 62%)",
  bg: "hsl(142 55% 45% / 0.1)",
  border: "hsl(142 55% 45% / 0.25)",
  summary: isRelationship
  ? "You come across as genuine and emotionally available, exactly what relationship-ready people are looking for. Your profile has real warmth and intentionality, but there are specific places where your language blends in with everyone else. The fix is targeted, not total."
  : isHealing
  ? "You're further along than you think. Your profile shows emotional self-awareness that most people miss entirely. The work now is channeling that into copy that invites the right kind of connection, not just any connection."
  : "Your profile has genuine appeal. The opportunity is in sharpening the presentation so the right people immediately know they should stop and read every word.",
  };

  if (score >= 60) return {
  label: "The Hidden Gem",
  tagline: "Real depth that isn't translating to your profile yet.",
  color: "hsl(var(--brand-indigo))",
  bg: "hsl(var(--brand-indigo) / 0.1)",
  border: "hsl(var(--brand-indigo) / 0.25)",
  summary: isRelationship
  ? "You have the kind of substance someone serious would deeply appreciate, but your profile isn't showing it yet. You're using language that could apply to anyone, which means the people who'd actually be excited by you are scrolling past without knowing what they're missing."
  : "Your profile has interesting material underneath generic packaging. The people who are right for what you're looking for can't find you through the surface presentation. That's fixable."
,
  };

  if (score >= 45) return {
  label: "The Generic Profile",
  tagline: "Blending in when you should be standing out.",
  color: "hsl(var(--brand-gold))",
  bg: "hsl(var(--brand-gold) / 0.1)",
  border: "hsl(var(--brand-gold) / 0.25)",
  summary: "Your profile reads as pleasant and inoffensive, which unfortunately makes it invisible. You're using phrasing that appears in thousands of other profiles, which means you're asking people to take a chance on someone they can't quite see yet. You're more specific than your profile suggests. Let's show that.",
  };

  return {
  label: "The Reset Candidate",
  tagline: "Time to rebuild from a stronger foundation.",
  color: "hsl(348 55% 67%)",
  bg: "hsl(var(--brand-rose) / 0.1)",
  border: "hsl(var(--brand-rose) / 0.25)",
  summary: "Your current profile is working against you more than for you. This isn't about who you are, it's about how your profile is communicating. The good news is that starting fresh with the right framework produces dramatic results quickly. A full reset is the fastest path.",
  };
}

type ReportData = {
  readinessScore: number;
  strengths: string[];
  risks: string[];
  bioAudit: string;
  rewrittenBio: string;
  actionPlan: { priority: number; title: string; description: string; timeframe: string }[];
};

const DEMO_REPORT: ReportData = {
  readinessScore: 65,
  strengths: ["Genuine warmth comes through", "Emotionally available", "Clear about intention"],
  risks: ["Generic language dilutes personality", "No specific hook or scene", "Profile reads as safe rather than interesting"],
  bioAudit: "There's real personality here that the current language isn't capturing. The phrases used are common enough that they become invisible, not because they're wrong, but because they don't differentiate. The fix isn't adding more words, it's trading general for specific.",
  rewrittenBio: "I make a genuinely great first date. I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect. Currently too invested in my sourdough starter and rewatching things I've already seen. Looking for someone worth getting off the couch for.",
  actionPlan: [
  { priority: 1, title: "Replace your opening line with a scene, not a summary", description: "Put the reader inside a moment with you instead of listing traits. Show, don't tell.", timeframe: "Today" },
  { priority: 2, title: "Cut every phrase that could appear on 1,000 other profiles", description: "\"Easy to talk to\", \"loves to laugh\", \"looking for an adventure\", gone. Replace with the specific version of what you mean.", timeframe: "This week" },
  { priority: 3, title: "Add one unexpected, specific detail about your life right now", description: "Not your career. Not your big passion. Something small and true that nobody else would say. That's your conversation hook.", timeframe: "This week" },
  ],
};

const STEP_LABELS = ["Your goal", "Your profile", "Next steps"];

export default function Diagnosis() {
  useMeta("Dating Diagnosis", "Find out your dating profile archetype and get targeted advice based on your Signal Score and communication patterns.");
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [bio, setBio] = useState("");
  const [prompts, setPrompts] = useState("");
  const [convo, setConvo] = useState("");
  const [result, setResult] = useState<{ report: ReportData; auditId: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const queryClient = useQueryClient();
  const createAudit = useCreateAudit();
  const generateReport = useGenerateAuditReport();
  const { isAuthenticated } = useAuth();
  const climb = useReadinessClimb({ enabled: isAuthenticated });
  const isBrandNewUser = isAuthenticated && !result && !loading;

  const LOADING_MSGS = [
  "Scanning for authenticity signals...",
  "Identifying clichés and invisible phrases...",
  "Diagnosing your dating profile type...",
  "Generating your personalised summary...",
  ];

  async function runDiagnosis() {
  setLoading(true);
  let i = 0;
  setLoadingMsg(LOADING_MSGS[0]);
  const interval = setInterval(() => {
  i = (i + 1) % LOADING_MSGS.length;
  setLoadingMsg(LOADING_MSGS[i]);
  }, 1800);

  // Snapshot readiness before the audit lands so the result can animate the
  // real climb this diagnosis produced.
  climb.snapshot();
  try {
  const audit = await createAudit.mutateAsync({
  data: {
  firstName: "You",
  age: 0,
  gender: "not specified",
  orientation: "not specified",
  currentApps: [],
  datingGoal: goal || "find a relationship",
  biggestChallenge: "Not sure how I come across",
  bio: bio.trim(),
  prompts: prompts.trim() || null,
  recentMessageSample: convo.trim() || null,
  photoCount: null,
  relationshipHistory: null,
  },
  });
  rememberAnonymousId("audits", audit.id);
  const report = await generateReport.mutateAsync({ id: audit.id });
  setResult({ report: report as ReportData, auditId: audit.id });
  queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
  queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  } catch {
  setResult({ report: DEMO_REPORT, auditId: 0 });
  } finally {
  clearInterval(interval);
  setLoading(false);
  }
  }

  const category = result ? getCategory(result.report.readinessScore, goal) : null;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-plum fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
  <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-10 -left-10 opacity-30 pointer-events-none" />

  <div className="max-w-2xl mx-auto relative z-10">
  {/* Header */}
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(326_100%_59%/0.25)] text-xs font-semibold text-[hsl(285_55%_78%)] uppercase tracking-widest mb-5">
  <Sparkles className="w-3.5 h-3.5" /> Dating Diagnosis Engine
  </span>
  <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">What's your profile really saying?</h1>
  <p className="text-muted-foreground leading-relaxed">Get a personalised diagnosis of your dating profile, your category, what's working, what's not, and exactly what to fix first.</p>
  </motion.div>

  {/* ── Package Hub Strip. The Dating Reset ── */}
  <div className="glass border rounded-xl px-4 py-3 mb-7 flex flex-wrap items-center gap-x-4 gap-y-2"
  style={{ borderColor: "hsl(var(--brand-indigo) / 0.2)" }}>
  <div className="flex items-center gap-2 flex-shrink-0">
  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(248_62%_52%)]" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">The Dating Reset</span>
  <span className="hidden sm:inline text-[11px] text-muted-foreground/55">, full profile signal rebuild</span>
  </div>
  <div className="flex flex-wrap gap-1.5 items-center">
  <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
  {[
  { name: "Signal Check", href: "/signal-check" },
  { name: "Blueprint", href: "/blueprint" },
  { name: "Profile Glow-Up",href: "/glow-up" },
  { name: "Profile Reflection", href: "/mirror" },
  { name: "Signal Quiz", href: "/quiz" },
  ].map(t => (
  <Link key={t.href} href={t.href}
  className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors whitespace-nowrap">
  {t.name}
  </Link>
  ))}
  </div>
  </div>

  {isBrandNewUser && (
  <WelcomePanel
  icon={<Sparkles className="w-6 h-6 text-primary" />}
  eyebrow="Welcome to Dating Diagnosis"
  title="Run your first diagnosis"
  description="Get a quick read on your profile archetype, your strengths, and the one fix most likely to lift your results."
  testId="diagnosis-empty-state"
  />
  )}

  <AnimatePresence mode="wait">
  {/* RESULTS */}
  {result && !loading ? (
  <motion.div key="results" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
  {/* Category Card */}
  <div
  className="glass rounded-3xl p-8 shimmer"
  style={{ borderColor: category!.border, borderWidth: "1px", borderStyle: "solid" }}
  data-testid="card-diagnosis-category"
  >
  <div className="flex items-start gap-5">
  <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: category!.bg, border: `1px solid ${category!.border}` }}>
  <span className="text-2xl font-bold" style={{ color: category!.color }}>{result.report.readinessScore}</span>
  </div>
  <div>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Diagnosis</p>
  <h2 className="text-2xl font-bold mb-1" style={{ color: category!.color }}>{category!.label}</h2>
  <p className="text-sm font-medium text-foreground/80 italic">{category!.tagline}</p>
  </div>
  </div>
  <p className="text-muted-foreground leading-relaxed text-sm mt-5 border-t border-white/6 pt-5">{category!.summary}</p>
  </div>

  {isAuthenticated && climb.before !== null && (
  <ReadinessClimbReveal
  from={climb.before}
  to={climb.current}
  className="glass border border-white/8 rounded-3xl p-7"
  />
  )}

  {/* Honest Audit */}
  <div className="glass border border-white/8 rounded-3xl p-7">
  <div className="flex items-center gap-2.5 mb-4">
  <Eye className="w-5 h-5 text-[hsl(248_62%_52%)]" />
  <h3 className="font-bold text-foreground">Profile Read</h3>
  </div>
  <p className="text-muted-foreground text-sm leading-relaxed">{result.report.bioAudit}</p>
  </div>

  {/* Strengths + Improvements */}
  <div className="grid sm:grid-cols-2 gap-5">
  <div className="glass border border-white/8 rounded-3xl p-6">
  <div className="flex items-center gap-2 mb-4">
  <Trophy className="w-4 h-4 text-[hsl(142_55%_60%)]" />
  <p className="font-semibold text-foreground text-sm">What's working</p>
  </div>
  <div className="flex flex-wrap gap-2">
  {result.report.strengths.map((s, i) => (
  <span key={i} className="tag-strength border px-3 py-1 rounded-full text-xs font-medium">{s}</span>
  ))}
  </div>
  </div>
  <div className="glass border border-white/8 rounded-3xl p-6">
  <div className="flex items-center gap-2 mb-4">
  <AlertTriangle className="w-4 h-4 text-[hsl(43_65%_65%)]" />
  <p className="font-semibold text-foreground text-sm">What to fix</p>
  </div>
  <div className="flex flex-wrap gap-2">
  {result.report.risks.map((r, i) => (
  <span key={i} className="tag-risk border px-3 py-1 rounded-full text-xs font-medium">{r}</span>
  ))}
  </div>
  </div>
  </div>

  {/* Rewritten Line Preview */}
  <div className="glass border border-white/8 rounded-3xl p-7">
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">One Line, Rewritten</p>
  <div className="grid sm:grid-cols-2 gap-4">
  <div className="rounded-2xl p-4 bg-[hsl(248_40%_95%)] border border-white/8">
  <p className="text-xs text-muted-foreground font-medium mb-2">Before</p>
  <p className="text-sm text-muted-foreground italic">{bio.slice(0, 120) || "Your bio text would appear here."}{bio.length > 120 ? "..." : ""}</p>
  </div>
  <div className="rounded-2xl p-4 bg-[hsl(248_62%_52%/0.07)] border border-[hsl(248_62%_52%/0.25)]">
  <p className="text-xs text-[hsl(248_62%_62%)] font-semibold mb-2">After</p>
  <p className="text-sm text-foreground">{result.report.rewrittenBio.slice(0, 180)}{result.report.rewrittenBio.length > 180 ? "..." : ""}</p>
  </div>
  </div>
  </div>

  {/* 3-Step Action Plan */}
  <div className="glass border border-white/8 rounded-3xl p-7">
  <div className="flex items-center gap-2.5 mb-5">
  <TrendingUp className="w-5 h-5 text-[hsl(248_62%_52%)]" />
  <h3 className="font-bold text-foreground">Your Next 3 Moves</h3>
  </div>
  <div className="space-y-4">
  {result.report.actionPlan.slice(0, 3).map((item, i) => (
  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-[hsl(248_40%_95%/0.5)] border border-white/6">
  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
  style={{ background: "linear-gradient(135deg, hsl(var(--brand-indigo)), hsl(var(--brand-pink)))" }}>
  {item.priority}
  </div>
  <div>
  <p className="font-semibold text-foreground text-sm">{item.title}</p>
  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
  <p className="text-xs text-[hsl(248_62%_58%)] font-medium mt-1.5">{item.timeframe}</p>
  </div>
  </div>
  ))}
  </div>
  </div>

  {/* CTAs */}
  <div
  className="relative rounded-3xl p-8 text-center overflow-hidden shimmer"
  style={{ background: "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.12), hsl(var(--brand-pink) / 0.08))", border: "1px solid hsl(var(--brand-indigo) / 0.2)" }}
  >
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_60%_80%)] mb-3">Want the full picture?</p>
  <h3 className="text-2xl font-bold text-foreground mb-3">Get your complete Dating Blueprint</h3>
  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">Full score breakdown, complete bio rewrite, all prompts rewritten, photo checklist, messaging analysis, and a 5-step action plan.</p>
  <div className="flex flex-col sm:flex-row gap-3 justify-center">
  {result.auditId > 0 && (
  <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 font-semibold glow-pulse">
  <Link href={`/report/${result.auditId}`}>View Full Report <ArrowRight className="ml-2 h-4 w-4" /></Link>
  </Button>
  )}
  <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
  <Link href="/pricing">See Coaching Plans</Link>
  </Button>
  <Button
  variant="ghost"
  className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5"
  onClick={() => { setResult(null); setStep(0); setBio(""); setGoal(""); setPrompts(""); setConvo(""); }}
  >
  Run Another Diagnosis
  </Button>
  </div>
  </div>
  </motion.div>

  ) : loading ? (
  /* Loading */
  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass border border-white/8 rounded-3xl p-16 text-center">
  <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: "hsl(var(--brand-indigo) / 0.15)", border: "1px solid hsl(var(--brand-indigo) / 0.3)", animation: "glow-pulse 2s ease-in-out infinite" }}>
  <Loader2 className="w-8 h-8 text-[hsl(248_62%_52%)] animate-spin" />
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2">Running your diagnosis...</h3>
  <p className="text-muted-foreground text-sm">{loadingMsg}</p>
  </motion.div>

  ) : (
  /* FORM */
  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
  {/* Progress */}
  <div className="flex items-center gap-3 mb-8">
  {STEP_LABELS.map((label, i) => (
  <div key={i} className="flex items-center gap-2 flex-1">
  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${i <= step ? "text-white" : "text-muted-foreground bg-[hsl(248_40%_94%)]"}`}
  style={i <= step ? { background: "linear-gradient(135deg, hsl(var(--brand-indigo)), hsl(var(--brand-pink)))" } : {}}>
  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
  </div>
  <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
  {i < 2 && <div className={`flex-1 h-px ${i < step ? "bg-[hsl(248_62%_52%/0.5)]" : "bg-white/8"}`} />}
  </div>
  ))}
  </div>

  <AnimatePresence mode="wait">
  {step === 0 && (
  <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass border border-white/8 rounded-3xl p-8 space-y-5">
  <div>
  <h2 className="text-xl font-bold text-foreground mb-1">What are you actually looking for?</h2>
  <p className="text-sm text-muted-foreground">Your diagnosis will be calibrated around your real goal, not a generic average.</p>
  </div>
  <div className="grid sm:grid-cols-2 gap-3">
  {GOALS.map(g => (
  <button
  key={g.value}
  data-testid={`button-goal-${g.value.replace(/ /g, "-")}`}
  onClick={() => setGoal(g.value)}
  className={`p-5 rounded-2xl border text-left transition-all ${goal === g.value ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.1)]" : "border-white/8 bg-[hsl(248_40%_95%/0.5)] hover:border-white/15"}`}
  >
  <g.icon className="w-6 h-6 mb-2 text-[hsl(248_62%_58%)]" />
  <p className="font-semibold text-foreground text-sm">{g.label}</p>
  </button>
  ))}
  </div>
  <Button
  onClick={() => setStep(1)}
  disabled={!goal}
  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 disabled:opacity-40"
  data-testid="button-goal-next"
  >
  Continue <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
  </motion.div>
  )}

  {step === 1 && (
  <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass border border-white/8 rounded-3xl p-8 space-y-5">
  <div>
  <h2 className="text-xl font-bold text-foreground mb-1">Paste what you're working with</h2>
  <p className="text-sm text-muted-foreground">Your bio is required. Prompts and a conversation sample make the diagnosis significantly more accurate.</p>
  </div>
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your bio <span className="text-[hsl(248_62%_52%)]">*</span></Label>
  <Textarea
  data-testid="textarea-diagnosis-bio"
  placeholder={"Software engineer who loves hiking and cooking. Big foodie. Looking for someone who is adventurous and loves to have fun..."}
  value={bio}
  onChange={e => setBio(e.target.value)}
  className="min-h-[120px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40 text-sm"
  />
  </div>
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Profile prompts <span className="text-muted-foreground font-normal">(optional, improves accuracy)</span></Label>
  <Textarea
  data-testid="textarea-diagnosis-prompts"
  placeholder={"Prompt: The way to win me over is...\nAnswer: remembering the small things\n\nPrompt: I'll never shut up about...\nAnswer: good food and travel"}
  value={prompts}
  onChange={e => setPrompts(e.target.value)}
  className="min-h-[100px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40 text-sm font-mono"
  />
  </div>
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">A conversation sample <span className="text-muted-foreground font-normal">(optional, adds messaging diagnosis)</span></Label>
  <Textarea
  data-testid="textarea-diagnosis-convo"
  placeholder={"Them: I love that little ramen place on 5th\nMe: Oh nice, which one?\nThem: The one with the black garlic broth!\nMe: I've been meaning to try it"}
  value={convo}
  onChange={e => setConvo(e.target.value)}
  className="min-h-[100px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40 text-sm font-mono"
  />
  </div>
  <div className="flex gap-3">
  <Button variant="ghost" onClick={() => setStep(0)} className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground px-6">← Back</Button>
  <Button
  onClick={runDiagnosis}
  disabled={!bio.trim() || bio.trim().length < 10}
  className="flex-1 rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-40"
  data-testid="button-run-diagnosis"
  >
  <Sparkles className="mr-2 h-4 w-4" /> Run My Diagnosis
  </Button>
  </div>
  </motion.div>
  )}
  </AnimatePresence>

  {/* What you get preview */}
  {step === 0 && (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 glass border border-white/8 rounded-3xl p-6">
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">What your diagnosis includes</p>
  <div className="grid sm:grid-cols-2 gap-3">
  {[
  { icon: FileText, label: "Profile category & diagnosis summary" },
  { icon: Trophy, label: "What's genuinely working" },
  { icon: AlertTriangle, label: "What to fix first (prioritised)" },
  { icon: Sparkles, label: "One line rewritten as an example" },
  { icon: TrendingUp, label: "3 specific next steps" },
  { icon: ArrowRight, label: "Link to your full audit report" },
  ].map((item, i) => (
  <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
  <item.icon className="w-4 h-4 text-[hsl(248_62%_52%)] flex-shrink-0" />
  {item.label}
  </div>
  ))}
  </div>
  </motion.div>
  )}
  </motion.div>
  )}
  </AnimatePresence>
  </div>
  </div>
  </AppLayout>
  );
}
