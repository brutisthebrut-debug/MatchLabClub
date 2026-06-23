import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, Sparkles, User, Target, MessageSquare, Edit3 } from "lucide-react";
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
  "Reading your bio for what feels real...",
  "Spotting the lines that show up in 10,000 other profiles...",
  "Listening for your tone and warmth...",
  "Working out your Dating Readiness Score...",
  "Writing you a rewrite in your own voice...",
  "Putting your action plan together...",
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

const STEP_ICONS = [User, User, Target, Edit3, MessageSquare];

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const carried = window.sessionStorage.getItem("matchlab.signalCheckBio");
      if (carried && carried.trim().length > 0) {
        setForm((f) => (f.bio.trim().length === 0 ? { ...f, bio: carried } : f));
        window.sessionStorage.removeItem("matchlab.signalCheckBio");
        toast({
          title: "Carrying over your Signal Check bio.",
          description: "You can edit it before generating the full audit.",
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const totalSteps = 5;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

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
      "Noticing your strengths and the rough spots…",
      "Writing you a rewrite in your own voice…",
      "Putting your 7-day plan together…",
    ];
    const stepIdx = Math.min(tipIndex, ANALYSIS_STEPS.length - 1);
    return (
      <AppLayout>
        <div className="min-h-[100dvh] mesh-bg flex flex-col items-center justify-center px-4 relative overflow-hidden">
          <div className="orb orb-violet absolute w-[600px] h-[600px] -top-20 -right-20 opacity-40 pointer-events-none" />
          <div className="orb orb-rose absolute w-[400px] h-[400px] bottom-10 -left-20 opacity-30 pointer-events-none" />
          
          <motion.div
            className="relative z-10 text-center max-w-md w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div 
              className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center mx-auto mb-10 shadow-[0_0_60px_hsl(248_62%_52%/0.4)]"
              animate={{ 
                boxShadow: ["0 0 40px hsl(248 62% 52% / 0.3)", "0 0 80px hsl(326 100% 59% / 0.5)", "0 0 40px hsl(248 62% 52% / 0.3)"]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-12 h-12 text-white animate-pulse" />
            </motion.div>
            <h2 className="text-3xl font-serif font-bold mb-3 text-foreground tracking-tight">Getting my read on you...</h2>
            <p className="text-base text-muted-foreground mb-10">
              I'm taking it all in. This usually takes about 20 seconds.
            </p>
            <div className="glass-strong border-white/20 rounded-3xl p-8 text-left space-y-5 mb-8 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
              {ANALYSIS_STEPS.map((stepText, i) => {
                const done = i < stepIdx;
                const active = i === stepIdx;
                return (
                  <div key={i} className={`flex items-center gap-4 transition-all duration-500 relative z-10 ${done || active ? "opacity-100 translate-x-0" : "opacity-30 -translate-x-2"}`}>
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {done ? <CheckCircle className="w-5 h-5 text-[hsl(142_55%_60%)]" /> :
                        active ? <Loader2 className="w-5 h-5 text-[hsl(248_62%_52%)] animate-spin" /> :
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
                    </div>
                    <p className={`text-base font-medium ${done ? "text-muted-foreground line-through decoration-muted-foreground/30" : active ? "text-foreground" : "text-muted-foreground"}`}>
                      {stepText}
                    </p>
                  </div>
                );
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={tipIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm font-medium text-[hsl(248_62%_52%)]"
              >
                {LOADING_TIPS[tipIndex % LOADING_TIPS.length]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  const CurrentIcon = STEP_ICONS[step - 1];

  return (
    <AppLayout>
      <HubTabs hub="audit" />
      <div className="min-h-[100dvh] bg-background relative overflow-x-hidden flex flex-col">
        <div className="orb orb-violet fixed w-[800px] h-[800px] -top-[400px] -right-[200px] opacity-30 pointer-events-none" />
        <div className="orb orb-rose fixed w-[600px] h-[600px] -bottom-[300px] -left-[200px] opacity-20 pointer-events-none" />
        
        {/* Progress header */}
        <div className="sticky top-0 z-50 glass border-b border-white/10 px-4 py-4 md:py-6 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 w-full">
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(248_62%_52%/0.1)] text-[hsl(248_62%_52%)] font-bold text-sm">
                {step}/{totalSteps}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  <span>Leveling Up</span>
                  <span className="text-[hsl(248_62%_52%)]">{Math.round(progress)}% Complete</span>
                </div>
                <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col py-8 md:py-16 px-4">
          <div className="max-w-2xl w-full mx-auto relative z-10 flex-1 flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="w-full"
              >
                <div className="mb-10 text-center sm:text-left flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%/0.15)] to-[hsl(326_100%_59%/0.15)] border border-[hsl(248_62%_52%/0.2)] flex items-center justify-center text-[hsl(248_62%_52%)] shadow-inner">
                    <CurrentIcon className="w-6 h-6" />
                  </div>
                  <div>
                    {step === 1 && (
                      <>
                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 tracking-tight">The Basics</h2>
                        <p className="text-muted-foreground md:text-lg">First impressions matter. We'll start simple.</p>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 tracking-tight">Your Identity</h2>
                        <p className="text-muted-foreground md:text-lg">Help us read your profile in the right context. Skip any that don't fit.</p>
                      </>
                    )}
                    {step === 3 && (
                      <>
                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 tracking-tight">The Mission</h2>
                        <p className="text-muted-foreground md:text-lg">What are we aiming for? Honesty drives better coaching.</p>
                      </>
                    )}
                    {step === 4 && (
                      <>
                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 tracking-tight">The Profile</h2>
                        <p className="text-muted-foreground md:text-lg">Paste exactly what's on your profile right now.</p>
                      </>
                    )}
                    {step === 5 && (
                      <>
                        <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-3 tracking-tight">The Approach</h2>
                        <p className="text-muted-foreground md:text-lg">Drop in a recent chat to let us read your communication style.</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="glass-strong border border-white/20 rounded-[2rem] p-6 sm:p-10 shadow-xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                  
                  <div className="relative z-10">
                    {step === 1 && (
                      <div className="space-y-8">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First name</Label>
                            <Input
                              id="firstName"
                              data-testid="input-first-name"
                              placeholder="e.g. Jordan"
                              value={form.firstName}
                              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                              className="h-14 text-lg bg-background/50 border-foreground/10 focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] rounded-xl"
                            />
                          </div>
                          <div className="space-y-3">
                            <Label htmlFor="age" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Age</Label>
                            <Input
                              id="age"
                              data-testid="input-age"
                              type="number"
                              placeholder="e.g. 28"
                              value={form.age}
                              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                              className="h-14 text-lg bg-background/50 border-foreground/10 focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] rounded-xl"
                            />
                          </div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-border/40">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Which apps are you on? <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {APPS.map(app => (
                              <label key={app} className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-border/50 hover:border-[hsl(248_62%_52%/0.4)] hover:bg-[hsl(248_62%_52%/0.03)] transition-all" data-testid={`checkbox-app-${app.toLowerCase().replace(/ /g, "-")}`}>
                                <Checkbox
                                  checked={form.currentApps.includes(app)}
                                  onCheckedChange={() => toggleApp(app)}
                                  className="w-5 h-5 border-foreground/20 data-[state=checked]:bg-[hsl(248_62%_52%)] data-[state=checked]:border-[hsl(248_62%_52%)]"
                                />
                                <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors">{app}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="pt-2 text-center sm:text-left">
                          <Link href="/sample-report" data-testid="link-wizard-sample-report" className="inline-flex items-center gap-1.5 text-sm font-bold text-[hsl(248_62%_52%)] hover:text-[hsl(248_62%_62%)] transition-colors">
                            <Sparkles className="w-4 h-4" /> Want to see a real example first? <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-8">
                        <div className="space-y-3">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Gender <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <div className="flex flex-wrap gap-2.5">
                            {GENDERS.map(g => (
                              <button
                                key={g}
                                data-testid={`button-gender-${g.toLowerCase().replace(/ /g, "-")}`}
                                onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? "" : g }))}
                                className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.gender === g ? "bg-[hsl(248_62%_52%)] text-white border-[hsl(248_62%_52%)] shadow-md" : "border-border/60 bg-background/40 text-foreground/80 hover:border-[hsl(248_62%_52%/0.4)]"}`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Pronouns <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <div className="flex flex-wrap gap-2.5">
                            {PRONOUNS.map(p => (
                              <button
                                key={p}
                                data-testid={`button-pronouns-${p.toLowerCase().replace(/\//g, "-")}`}
                                onClick={() => setForm(f => ({ ...f, pronouns: f.pronouns === p ? "" : p }))}
                                className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.pronouns === p ? "bg-[hsl(248_62%_52%)] text-white border-[hsl(248_62%_52%)] shadow-md" : "border-border/60 bg-background/40 text-foreground/80 hover:border-[hsl(248_62%_52%/0.4)]"}`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            You're dating <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Multiple ok</span>
                          </Label>
                          <div className="flex flex-wrap gap-2.5">
                            {SEEKING.map(s => (
                              <button
                                key={s}
                                data-testid={`button-seeking-${s.toLowerCase().replace(/[ /]+/g, "-")}`}
                                onClick={() => toggleSeeking(s)}
                                className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.seeking.includes(s) ? "bg-[hsl(248_62%_52%)] text-white border-[hsl(248_62%_52%)] shadow-md" : "border-border/60 bg-background/40 text-foreground/80 hover:border-[hsl(248_62%_52%/0.4)]"}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            How you identify <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <div className="flex flex-wrap gap-2.5">
                            {ORIENTATIONS.map(o => (
                              <button
                                key={o}
                                data-testid={`button-orientation-${o.toLowerCase()}`}
                                onClick={() => setForm(f => ({ ...f, orientation: f.orientation === o ? "" : o }))}
                                className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.orientation === o ? "bg-[hsl(248_62%_52%)] text-white border-[hsl(248_62%_52%)] shadow-md" : "border-border/60 bg-background/40 text-foreground/80 hover:border-[hsl(248_62%_52%/0.4)]"}`}
                              >
                                {o}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dating Goal</Label>
                          <div className="grid sm:grid-cols-2 gap-4">
                            {GOALS.map(goal => (
                              <button
                                key={goal.value}
                                data-testid={`button-goal-${goal.value.replace(/ /g, "-")}`}
                                onClick={() => setForm(f => ({ ...f, datingGoal: goal.value }))}
                                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${form.datingGoal === goal.value ? "border-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.08)] shadow-md" : "border-border/60 bg-background/30 hover:border-[hsl(248_62%_52%/0.3)]"}`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <p className={`font-bold text-base ${form.datingGoal === goal.value ? "text-[hsl(248_62%_52%)]" : "text-foreground"}`}>{goal.label}</p>
                                  {form.datingGoal === goal.value && <CheckCircle className="w-5 h-5 text-[hsl(248_62%_52%)]" />}
                                </div>
                                <p className="text-sm text-muted-foreground leading-snug">{goal.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-border/40">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Biggest challenge right now <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <div className="flex flex-wrap gap-2.5">
                            {CHALLENGES.map(c => (
                              <button
                                key={c}
                                data-testid={`button-challenge-${c.toLowerCase().replace(/ /g, "-").substring(0, 20)}`}
                                onClick={() => setForm(f => ({ ...f, biggestChallenge: f.biggestChallenge === c ? "" : c }))}
                                className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${form.biggestChallenge === c ? "bg-[hsl(248_62%_52%)] text-white border-[hsl(248_62%_52%)] shadow-md" : "border-border/60 bg-background/40 text-foreground/80 hover:border-[hsl(248_62%_52%/0.4)]"}`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-8">
                        <div className="space-y-3">
                          <Label htmlFor="bio" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your bio <span className="text-[hsl(248_62%_52%)]">*</span></Label>
                          <Textarea
                            id="bio"
                            data-testid="textarea-bio"
                            placeholder="Software engineer by day, amateur chef by night. I take food seriously, the kind of person who'll drive 45 minutes for the right ramen..."
                            value={form.bio}
                            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                            className="min-h-[180px] resize-none text-base p-5 bg-background/60 border-foreground/10 focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] rounded-2xl shadow-inner"
                          />
                          <p className="text-xs font-medium text-muted-foreground text-right">{form.bio.length} characters</p>
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="prompts" className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Your prompts <span className="font-medium text-[10px] bg-[hsl(248_62%_52%/0.1)] text-[hsl(248_62%_52%)] px-2 py-1 rounded">Recommended</span>
                          </Label>
                          <Textarea
                            id="prompts"
                            data-testid="textarea-prompts"
                            placeholder={"The way to win me over is...\nI'll never shut up about...\nA green flag I look for..."}
                            value={form.prompts}
                            onChange={e => setForm(f => ({ ...f, prompts: e.target.value }))}
                            className="min-h-[140px] resize-none text-base p-5 bg-background/60 border-foreground/10 focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] rounded-2xl shadow-inner"
                          />
                          <p className="text-xs font-medium text-muted-foreground">Add each prompt response on a new line.</p>
                        </div>
                      </div>
                    )}

                    {step === 5 && (
                      <div className="space-y-8">
                        <div className="bg-[hsl(248_62%_52%/0.05)] border border-[hsl(248_62%_52%/0.15)] rounded-2xl p-5 text-sm text-foreground/80 flex gap-4 items-start shadow-sm">
                          <div className="mt-0.5 p-1.5 rounded-full bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_52%)]">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground mb-1">Privacy note</p>
                            <p className="leading-relaxed">This conversation stays secure and is only used to generate your coaching insights. We never store conversations in a way that identifies who you were talking to.</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="messages" className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                            Paste a recent conversation <span className="font-medium text-[10px] bg-secondary px-2 py-1 rounded">Optional</span>
                          </Label>
                          <Textarea
                            id="messages"
                            data-testid="textarea-messages"
                            placeholder={"Me: Hey, I saw you're into hiking too, have you done the Marin Headlands trail?\nThem: Yes! Last month actually, the views were incredible\nMe: Right? I was just there in spring..."}
                            value={form.recentMessageSample}
                            onChange={e => setForm(f => ({ ...f, recentMessageSample: e.target.value }))}
                            className="min-h-[200px] resize-none font-mono text-sm p-5 bg-background/60 border-foreground/10 focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%)] rounded-2xl shadow-inner"
                          />
                        </div>
                        <div className="bg-background/40 border border-border/50 rounded-2xl p-6">
                          <p className="font-bold text-foreground mb-4 uppercase tracking-widest text-xs">Your report will include:</p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {[
                              "Signal Score (0–100)",
                              "Full bio audit, honest and specific",
                              "AI-rewritten bio and prompts",
                              "Photo guidance checklist",
                              "Top strengths and risks",
                              "Your 7-day action plan",
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2.5">
                                <CheckCircle className="w-4 h-4 text-[hsl(248_62%_52%)] flex-shrink-0" />
                                <span className="text-sm font-semibold text-foreground/80">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-10">
              {step > 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep(s => s - 1)}
                  data-testid="button-back"
                  disabled={isLoading}
                  className="h-14 px-6 rounded-full font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                >
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back
                </Button>
              ) : <div />}
              
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canNext()}
                  data-testid="button-next"
                  className="h-14 px-8 rounded-full text-base font-bold bg-foreground hover:bg-foreground/90 text-background shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Continue <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="h-14 px-10 rounded-full text-base font-bold bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] text-white shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0 border-none relative group overflow-hidden"
                  data-testid="button-generate-audit"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <span className="relative flex items-center">
                    {isLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    Generate My Audit
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
