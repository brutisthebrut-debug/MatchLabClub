import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, Sparkles } from "lucide-react";
import { useCreateAudit, useGenerateAuditReport } from "@workspace/api-client-react";
import { trackEvent } from "@/lib/analytics";
import { useQueryClient } from "@tanstack/react-query";
import { getListAuditsQueryKey } from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";

const APPS = ["Hinge", "Bumble", "Tinder", "Grindr", "Feeld", "HER", "Scruff", "Coffee Meets Bagel", "The League", "OkCupid", "Other"];
const GOALS = [
  { value: "find a relationship", label: "Find a relationship", desc: "Looking for something real and lasting" },
  { value: "casual dating", label: "Casual dating", desc: "Open to connections without pressure" },
  { value: "heal from a breakup", label: "Heal and rediscover myself", desc: "Working through something and ready to move forward" },
  { value: "just curious", label: "Just curious", desc: "Exploring what's out there" },
];
const CHALLENGES = [
  "Not getting enough matches",
  "Getting matches but no responses",
  "Getting ghosted after a few messages",
  "Bad first dates that don't lead anywhere",
  "Not sure how I come across",
  "Just want to improve overall",
];
const GENDERS = ["Man", "Woman", "Non-binary", "Trans man", "Trans woman", "Other"];
const ORIENTATIONS = ["Straight", "Gay", "Lesbian", "Bisexual", "Queer", "Other"];

const LOADING_TIPS = [
  "Analyzing your bio for authenticity signals...",
  "Identifying phrases that appear in 10,000 other profiles...",
  "Checking your conversational tone and warmth...",
  "Calculating your Dating Readiness Score...",
  "Crafting your personalized rewrite...",
  "Finalizing your action plan...",
];

const PRONOUNS = ["she/her", "he/him", "they/them", "she/they", "he/they", "Other"];
const SEEKING = ["Women", "Men", "Non-binary people", "Everyone", "Other / it's complicated"];

type FormData = {
  firstName: string;
  age: string;
  gender: string;
  pronouns: string;
  orientation: string;
  seeking: string[];
  currentApps: string[];
  datingGoal: string;
  biggestChallenge: string;
  bio: string;
  prompts: string;
  recentMessageSample: string;
};

const initial: FormData = {
  firstName: "", age: "", gender: "", pronouns: "", orientation: "",
  seeking: [], currentApps: [], datingGoal: "", biggestChallenge: "",
  bio: "", prompts: "", recentMessageSample: "",
};

export default function Wizard() {
  useMeta("Start Your Profile Signal Audit", "Begin your free Profile Signal Audit. Takes 3 minutes. Get your Signal Score (0–100), bio rewrite, Signal Spectrum, and 7-day action plan.");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initial);
  const [, setLocation] = useLocation();
  const [tipIndex, setTipIndex] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createAudit = useCreateAudit();
  const generateReport = useGenerateAuditReport();

  // Carry-over from the 3-minute Signal Check. If the user landed here from
  // /signal-check we prefill their bio so they don't have to paste twice.
  useEffect(() => {
  if (typeof window === "undefined") return;
  try {
  const carried = window.sessionStorage.getItem("matchlab.signalCheckBio");
  if (carried && carried.trim().length > 0) {
  setForm((f) => (f.bio.trim().length === 0 ? {...f, bio: carried } : f));
  window.sessionStorage.removeItem("matchlab.signalCheckBio");
  toast({
  title: "Carrying over your Signal Check bio.",
  description: "You can edit it before generating the full audit.",
  });
  }
  } catch {
  // sessionStorage unavailable; ignore.
  }
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSteps = 5;
  const progress = ((step - 1) / totalSteps) * 100;

  function toggleApp(app: string) {
  setForm(f => ({
...f,
  currentApps: f.currentApps.includes(app)
  ? f.currentApps.filter(a => a !== app)
  : [...f.currentApps, app],
  }));
  }
  function toggleSeeking(s: string) {
  setForm(f => ({
...f,
  seeking: f.seeking.includes(s) ? f.seeking.filter(x => x !== s) : [...f.seeking, s],
  }));
  }

  function canNext(): boolean {
  if (step === 1) return !!(form.firstName && form.age);
  if (step === 2) return true;
  if (step === 3) return !!(form.datingGoal);
  if (step === 4) return !!(form.bio.trim().length > 20);
  return true;
  }

  async function handleSubmit() {
  let tipInterval: ReturnType<typeof setInterval>;
  tipInterval = setInterval(() => {
  setTipIndex(i => (i + 1) % LOADING_TIPS.length);
  }, 1800);

  trackEvent("audit_started", {
  goal: form.datingGoal,
  apps: form.currentApps.join(",") || "other",
  bio_length: form.bio.trim().length,
  });

  try {
  // We pack pronouns + seeking into existing free-text fields rather than
  // expanding the API schema in this sprint, keeps the contract stable while
  // still letting the coaching engine read the user's identity context.
  const genderField = [form.gender || "Prefer not to say", form.pronouns && `(${form.pronouns})`]
.filter(Boolean).join(" ");
  const orientationField = [form.orientation || "Prefer not to say", form.seeking.length && `· seeking ${form.seeking.join(", ").toLowerCase()}`]
.filter(Boolean).join(" ");
  const audit = await createAudit.mutateAsync({
  data: {
  firstName: form.firstName,
  age: parseInt(form.age, 10),
  gender: genderField,
  orientation: orientationField,
  datingGoal: form.datingGoal,
  currentApps: form.currentApps.length ? form.currentApps : ["Other"],
  bio: form.bio,
  prompts: form.prompts || null,
  recentMessageSample: form.recentMessageSample || null,
  biggestChallenge: form.biggestChallenge || null,
  photoCount: null,
  relationshipHistory: null,
  },
  });

  rememberAnonymousId("audits", audit.id);
  await generateReport.mutateAsync({ id: audit.id });
  queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
  trackEvent("audit_completed", { audit_id: audit.id, goal: form.datingGoal });
  clearInterval(tipInterval);
  setLocation(`/report/${audit.id}`);
  } catch (e) {
  trackEvent("audit_failed", { goal: form.datingGoal });
  clearInterval(tipInterval);
  }
  }

  const isLoading = createAudit.isPending || generateReport.isPending;

  if (isLoading) {
  const ANALYSIS_STEPS = [
  "Reading your bio and prompts…",
  "Scoring your Signal Spectrum…",
  "Mapping strengths and risk areas…",
  "Writing your personalised rewrite…",
  "Building your 7-day action plan…",
  ];
  const stepIdx = Math.min(tipIndex, ANALYSIS_STEPS.length - 1);
  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg flex items-center justify-center px-4 relative overflow-hidden">
  <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-35 pointer-events-none" />
  <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-0 -left-20 opacity-20 pointer-events-none" />
  <motion.div
  className="relative z-10 text-center max-w-md w-full"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  >
  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_hsl(248_62%_52%/0.45)]">
  <Sparkles className="w-10 h-10 text-white animate-pulse" />
  </div>
  <h2 className="text-2xl font-bold mb-2 text-foreground">Building your audit…</h2>
  <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
  Analyzing everything carefully, usually takes about 20 seconds.
  </p>
  <div className="glass border border-white/8 rounded-2xl p-6 text-left space-y-3.5 mb-6">
  {ANALYSIS_STEPS.map((step, i) => {
  const done = i < stepIdx;
  const active = i === stepIdx;
  return (
  <div key={i} className={`flex items-center gap-3 transition-opacity duration-500 ${done || active ? "opacity-100" : "opacity-25"}`}>
  <div className="w-4 h-4 flex-shrink-0">
  {done ? <CheckCircle className="w-4 h-4 text-[hsl(142_55%_60%)]" /> :
  active ? <Loader2 className="w-4 h-4 text-[hsl(248_62%_52%)] animate-spin" /> :
  <div className="w-4 h-4 rounded-full border border-white/15" />}
  </div>
  <p className={`text-sm leading-snug ${done ? "text-muted-foreground/50 line-through" : active ? "text-foreground font-medium" : "text-muted-foreground/35"}`}>
  {step}
  </p>
  </div>
  );
  })}
  </div>
  <AnimatePresence mode="wait">
  <motion.p
  key={tipIndex}
  initial={{ opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -6 }}
  className="text-xs text-muted-foreground/45 italic"
  >
  {LOADING_TIPS[tipIndex % LOADING_TIPS.length]}
  </motion.p>
  </AnimatePresence>
  </motion.div>
  </div>
  </AppLayout>
  );
  }

  return (
  <AppLayout>
  <div className="min-h-screen bg-background py-12 px-4">
  <div className="max-w-2xl mx-auto">
  {/* Header */}
  <div className="text-center mb-10">
  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-2">
  Step {step} of {totalSteps}
  </p>
  <Progress value={progress} className="h-1.5 rounded-full mb-6" />
  </div>

  <AnimatePresence mode="wait">
  <motion.div
  key={step}
  initial={{ opacity: 0, x: 24 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -24 }}
  transition={{ duration: 0.25 }}
  className="bg-card border border-card-border rounded-3xl p-8 md:p-12 shadow-sm"
  >
  {step === 1 && (
  <div className="space-y-6">
  <div>
  <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">First, the basics</h2>
  <p className="text-muted-foreground">Just your name and age, takes 5 seconds. We'll go deeper on the next screen.</p>
  </div>
  <div className="grid sm:grid-cols-2 gap-4">
  <div className="space-y-2">
  <Label htmlFor="firstName">First name</Label>
  <Input
  id="firstName"
  data-testid="input-first-name"
  placeholder="Jordan"
  value={form.firstName}
  onChange={e => setForm(f => ({...f, firstName: e.target.value }))}
  />
  </div>
  <div className="space-y-2">
  <Label htmlFor="age">Age</Label>
  <Input
  id="age"
  data-testid="input-age"
  type="number"
  placeholder="28"
  value={form.age}
  onChange={e => setForm(f => ({...f, age: e.target.value }))}
  />
  </div>
  </div>
  <div className="space-y-3">
  <Label>Which apps are you on? <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <div className="grid grid-cols-2 gap-3">
  {APPS.map(app => (
  <label key={app} className="flex items-center gap-3 cursor-pointer" data-testid={`checkbox-app-${app.toLowerCase().replace(/ /g, "-")}`}>
  <Checkbox
  checked={form.currentApps.includes(app)}
  onCheckedChange={() => toggleApp(app)}
  />
  <span className="text-sm font-medium">{app}</span>
  </label>
  ))}
  </div>
  </div>
  <div className="pt-2 border-t border-border/50">
  <Link
  href="/sample-report"
  data-testid="link-wizard-sample-report"
  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(248_62%_52%)] hover:underline"
  >
  <Sparkles className="w-3.5 h-3.5" /> Want to see a real example first?
  <ArrowRight className="w-3 h-3" />
  </Link>
  </div>
  </div>
  )}

  {step === 2 && (
  <div className="space-y-6">
  <div>
  <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Tell us about you</h2>
  <p className="text-muted-foreground">All optional. Sharing helps us write your rewrite in your actual voice, skip anything that doesn't fit.</p>
  </div>
  <div className="space-y-2">
  <Label>Gender <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {GENDERS.map(g => (
  <button
  key={g}
  data-testid={`button-gender-${g.toLowerCase().replace(/ /g, "-")}`}
  onClick={() => setForm(f => ({...f, gender: f.gender === g ? "" : g }))}
  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
  >
  {g}
  </button>
  ))}
  </div>
  </div>
  <div className="space-y-2">
  <Label>Pronouns <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {PRONOUNS.map(p => (
  <button
  key={p}
  data-testid={`button-pronouns-${p.toLowerCase().replace(/\//g, "-")}`}
  onClick={() => setForm(f => ({...f, pronouns: f.pronouns === p ? "" : p }))}
  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.pronouns === p ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
  >
  {p}
  </button>
  ))}
  </div>
  </div>
  <div className="space-y-2">
  <Label>You're dating <span className="text-muted-foreground font-normal">(optional · pick any that fit)</span></Label>
  <div className="flex flex-wrap gap-2">
  {SEEKING.map(s => (
  <button
  key={s}
  data-testid={`button-seeking-${s.toLowerCase().replace(/[ /]+/g, "-")}`}
  onClick={() => toggleSeeking(s)}
  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.seeking.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
  >
  {s}
  </button>
  ))}
  </div>
  </div>
  <div className="space-y-2">
  <Label>How you identify <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {ORIENTATIONS.map(o => (
  <button
  key={o}
  data-testid={`button-orientation-${o.toLowerCase()}`}
  onClick={() => setForm(f => ({...f, orientation: f.orientation === o ? "" : o }))}
  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.orientation === o ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
  >
  {o}
  </button>
  ))}
  </div>
  </div>
  </div>
  )}

  {step === 3 && (
  <div className="space-y-6">
  <div>
  <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">What brings you here?</h2>
  <p className="text-muted-foreground">There's no wrong answer. Honesty here makes your coaching far more useful.</p>
  </div>
  <div className="space-y-3">
  <Label>Dating goal</Label>
  {GOALS.map(goal => (
  <button
  key={goal.value}
  data-testid={`button-goal-${goal.value.replace(/ /g, "-")}`}
  onClick={() => setForm(f => ({...f, datingGoal: goal.value }))}
  className={`w-full text-left p-4 rounded-2xl border transition-all ${form.datingGoal === goal.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
  >
  <p className="font-semibold text-foreground">{goal.label}</p>
  <p className="text-sm text-muted-foreground mt-0.5">{goal.desc}</p>
  </button>
  ))}
  </div>
  <div className="space-y-3">
  <Label>Biggest challenge right now <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {CHALLENGES.map(c => (
  <button
  key={c}
  data-testid={`button-challenge-${c.toLowerCase().replace(/ /g, "-").substring(0, 20)}`}
  onClick={() => setForm(f => ({...f, biggestChallenge: f.biggestChallenge === c ? "" : c }))}
  className={`px-4 py-2 rounded-full border text-sm transition-all ${form.biggestChallenge === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30"}`}
  >
  {c}
  </button>
  ))}
  </div>
  </div>
  </div>
  )}

  {step === 4 && (
  <div className="space-y-6">
  <div>
  <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Paste your current bio</h2>
  <p className="text-muted-foreground">Copy it exactly as it appears on your profile, we'll audit it as-is and then rewrite it.</p>
  </div>
  <div className="space-y-2">
  <Label htmlFor="bio">Your bio <span className="text-primary">*</span></Label>
  <Textarea
  id="bio"
  data-testid="textarea-bio"
  placeholder="Software engineer by day, amateur chef by night. I take food seriously, the kind of person who'll drive 45 minutes for the right ramen..."
  value={form.bio}
  onChange={e => setForm(f => ({...f, bio: e.target.value }))}
  className="min-h-[160px] resize-none"
  />
  <p className="text-xs text-muted-foreground text-right">{form.bio.length} characters</p>
  </div>
  <div className="space-y-2">
  <Label htmlFor="prompts">
  Your prompts{" "}
  <span className="text-muted-foreground font-normal">(optional but recommended)</span>
  </Label>
  <Textarea
  id="prompts"
  data-testid="textarea-prompts"
  placeholder={"The way to win me over is...\nI'll never shut up about...\nA green flag I look for..."}
  value={form.prompts}
  onChange={e => setForm(f => ({...f, prompts: e.target.value }))}
  className="min-h-[120px] resize-none"
  />
  <p className="text-xs text-muted-foreground">Add each prompt response on a new line.</p>
  </div>
  </div>
  )}

  {step === 5 && (
  <div className="space-y-6">
  <div>
  <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Last thing, a recent conversation</h2>
  <p className="text-muted-foreground">
  Optional but powerful. Paste a recent chat from any app and we'll read your communication style. Leave it blank and hit Generate if you'd rather skip.
  </p>
  </div>
  <div className="bg-secondary/40 rounded-2xl p-4 text-sm text-muted-foreground">
  <p className="font-medium text-foreground mb-1">Privacy note</p>
  <p>This conversation stays secure and is only used to generate your coaching insights. We never store conversations in a way that identifies who you were talking to.</p>
  </div>
  <div className="space-y-2">
  <Label htmlFor="messages">Paste a recent conversation <span className="text-muted-foreground font-normal">(optional)</span></Label>
  <Textarea
  id="messages"
  data-testid="textarea-messages"
  placeholder={"Me: Hey, I saw you're into hiking too, have you done the Marin Headlands trail?\nThem: Yes! Last month actually, the views were incredible\nMe: Right? I was just there in spring..."}
  value={form.recentMessageSample}
  onChange={e => setForm(f => ({...f, recentMessageSample: e.target.value }))}
  className="min-h-[160px] resize-none font-mono text-xs"
  />
  </div>
  <div className="bg-secondary/30 rounded-2xl p-5 text-left space-y-2.5 text-sm">
  <p className="font-semibold text-foreground mb-2">Your report will include:</p>
  {[
  "Signal Score (0–100)",
  "Full bio audit, honest, specific, no fluff",
  "AI-rewritten bio and prompts in your voice",
  "Photo guidance checklist",
  "Top strengths and risks",
  "Your 7-day action plan",
  ].map((item, i) => (
  <div key={i} className="flex items-center gap-3">
  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
  <span className="text-foreground">{item}</span>
  </div>
  ))}
  </div>
  </div>
  )}
  </motion.div>
  </AnimatePresence>

  {/* Navigation */}
  <div className="flex items-center justify-between mt-8">
  {step > 1 ? (
  <Button
  variant="ghost"
  onClick={() => setStep(s => s - 1)}
  data-testid="button-back"
  disabled={isLoading}
  >
  <ArrowLeft className="mr-2 h-4 w-4" /> Back
  </Button>
  ) : <div />}
  {step < totalSteps ? (
  <Button
  onClick={() => setStep(s => s + 1)}
  disabled={!canNext()}
  data-testid="button-next"
  className="rounded-full px-8"
  >
  Continue <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
  ) : (
  <Button
  onClick={handleSubmit}
  disabled={isLoading}
  className="rounded-full px-10 h-12 text-base font-semibold"
  data-testid="button-generate-audit"
  >
  {isLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Sparkles className="mr-2 h-5 w-5" />}
  Generate My Audit
  </Button>
  )}
  </div>
  </div>
  </div>
  </AppLayout>
  );
}
