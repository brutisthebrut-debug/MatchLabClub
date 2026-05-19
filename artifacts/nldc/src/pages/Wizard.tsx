import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, Sparkles } from "lucide-react";
import { useCreateAudit, useGenerateAuditReport } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAuditsQueryKey } from "@workspace/api-client-react";

const APPS = ["Hinge", "Bumble", "Tinder", "Coffee Meets Bagel", "The League", "Feeld", "OkCupid", "Other"];
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

type FormData = {
  firstName: string;
  age: string;
  gender: string;
  orientation: string;
  currentApps: string[];
  datingGoal: string;
  biggestChallenge: string;
  bio: string;
  prompts: string;
  recentMessageSample: string;
};

const initial: FormData = {
  firstName: "", age: "", gender: "", orientation: "",
  currentApps: [], datingGoal: "", biggestChallenge: "",
  bio: "", prompts: "", recentMessageSample: "",
};

export default function Wizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initial);
  const [, setLocation] = useLocation();
  const [tipIndex, setTipIndex] = useState(0);
  const queryClient = useQueryClient();

  const createAudit = useCreateAudit();
  const generateReport = useGenerateAuditReport();

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

  function canNext(): boolean {
    if (step === 1) return !!(form.firstName && form.age && form.gender);
    if (step === 2) return !!(form.datingGoal);
    if (step === 3) return !!(form.bio.trim().length > 20);
    return true;
  }

  async function handleSubmit() {
    let tipInterval: ReturnType<typeof setInterval>;
    tipInterval = setInterval(() => {
      setTipIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 1800);

    try {
      const audit = await createAudit.mutateAsync({
        data: {
          firstName: form.firstName,
          age: parseInt(form.age, 10),
          gender: form.gender,
          orientation: form.orientation || "Prefer not to say",
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

      await generateReport.mutateAsync({ id: audit.id });
      queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
      clearInterval(tipInterval);
      setLocation(`/report/${audit.id}`);
    } catch (e) {
      clearInterval(tipInterval);
    }
  }

  const isLoading = createAudit.isPending || generateReport.isPending;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <motion.div
            className="text-center max-w-md"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
              <Sparkles className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-3 text-foreground">Building your audit...</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              We're analyzing everything carefully. This usually takes about 20 seconds.
            </p>
            <div className="bg-card border border-border rounded-2xl p-6">
              <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-4" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm text-muted-foreground font-medium"
                >
                  {LOADING_TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
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
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Let's start with you</h2>
                    <p className="text-muted-foreground">The more honest you are, the better your audit will be.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        data-testid="input-first-name"
                        placeholder="Jordan"
                        value={form.firstName}
                        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
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
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <div className="flex flex-wrap gap-2">
                      {GENDERS.map(g => (
                        <button
                          key={g}
                          data-testid={`button-gender-${g.toLowerCase().replace(/ /g, "-")}`}
                          onClick={() => setForm(f => ({ ...f, gender: g }))}
                          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.gender === g ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sexual orientation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {ORIENTATIONS.map(o => (
                        <button
                          key={o}
                          data-testid={`button-orientation-${o.toLowerCase()}`}
                          onClick={() => setForm(f => ({ ...f, orientation: f.orientation === o ? "" : o }))}
                          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.orientation === o ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:border-primary/40"}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Which apps are you on?</Label>
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
                </div>
              )}

              {step === 2 && (
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
                        onClick={() => setForm(f => ({ ...f, datingGoal: goal.value }))}
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
                          onClick={() => setForm(f => ({ ...f, biggestChallenge: f.biggestChallenge === c ? "" : c }))}
                          className={`px-4 py-2 rounded-full border text-sm transition-all ${form.biggestChallenge === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/30"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Paste your current bio</h2>
                    <p className="text-muted-foreground">Copy it exactly as it appears on your profile — we'll audit it as-is and then rewrite it.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Your bio <span className="text-primary">*</span></Label>
                    <Textarea
                      id="bio"
                      data-testid="textarea-bio"
                      placeholder="Software engineer by day, amateur chef by night. I take food seriously — the kind of person who'll drive 45 minutes for the right ramen..."
                      value={form.bio}
                      onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
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
                      onChange={e => setForm(f => ({ ...f, prompts: e.target.value }))}
                      className="min-h-[120px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">Add each prompt response on a new line.</p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">Add a message sample</h2>
                    <p className="text-muted-foreground">
                      Optional but powerful. Paste a recent conversation from any dating app. We'll analyze your communication style and tell you what's working.
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
                      placeholder={"Me: Hey, I saw you're into hiking too — have you done the Marin Headlands trail?\nThem: Yes! Last month actually, the views were incredible\nMe: Right? I was just there in spring..."}
                      value={form.recentMessageSample}
                      onChange={e => setForm(f => ({ ...f, recentMessageSample: e.target.value }))}
                      className="min-h-[180px] resize-none font-mono text-xs"
                    />
                  </div>
                  <button
                    className="text-sm text-muted-foreground underline underline-offset-2"
                    onClick={() => setStep(5)}
                  >
                    Skip this step
                  </button>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">
                      You're ready, {form.firstName || "friend"}.
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                      We have everything we need to build your personalized Dating Readiness Report. This takes about 20 seconds.
                    </p>
                  </div>
                  <div className="bg-secondary/30 rounded-2xl p-6 text-left space-y-3 text-sm">
                    <p className="font-semibold text-foreground mb-3">Your report will include:</p>
                    {[
                      "Dating Readiness Score (0-100)",
                      "Full bio audit — honest, specific, no fluff",
                      "AI-rewritten bio and prompts",
                      "Photo guidance checklist",
                      "Top strengths and risks",
                      "Your personalized 5-step action plan",
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
