import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useEnhanceAi, useCreateJournalEntry } from "@workspace/api-client-react";
import { BarChart2, CheckCircle2, Circle, Loader2, Sparkles, RefreshCw, ArrowLeft } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const FOCUS_AREAS = ["More matches", "Better first messages", "Stronger profile", "More confident in-person", "Understanding patterns", "Meeting more people IRL", "Processing recent experiences"];
const STORAGE_KEY = "nldc_weekly_plan";

interface PlanAction { id: string; action: string; tool?: string; toolHref?: string; done: boolean; }
interface WeeklyPlan { weekOf: string; actions: PlanAction[]; wingmanNote: string; }

function makeId() { return Math.random().toString(36).slice(2, 9); }

function buildFallback(focus: string, wins: string, challenge: string): WeeklyPlan {
  const focusLow = focus.toLowerCase();
  const actions: PlanAction[] = [];

  if (focusLow.includes("match") || focusLow.includes("profile")) {
    actions.push({ id: makeId(), action: "Update one profile prompt with a specific, personal detail (not a generic opener)", tool: "Profile Glow-Up", toolHref: "/glow-up", done: false });
    actions.push({ id: makeId(), action: "Send 3 openers this week — each referencing something specific from their profile", tool: "Message Coach", toolHref: "/coach", done: false });
  }
  if (focusLow.includes("message") || focusLow.includes("first")) {
    actions.push({ id: makeId(), action: "Write and send one message that asks a real question — not 'how's your week'", tool: "Next Message", toolHref: "/next-message", done: false });
    actions.push({ id: makeId(), action: "Run a conversation through Message Lab to get tone feedback", tool: "Message Lab", toolHref: "/lab", done: false });
  }
  if (focusLow.includes("pattern") || focusLow.includes("processing")) {
    actions.push({ id: makeId(), action: "Log the most interesting thing that happened this week in My Timeline", tool: "My Timeline", toolHref: "/progress/timeline", done: false });
    actions.push({ id: makeId(), action: "Run a Debrief on any interaction that left you with a question", tool: "Debrief", toolHref: "/copilot/debrief", done: false });
  }
  if (focusLow.includes("confident") || focusLow.includes("irl")) {
    actions.push({ id: makeId(), action: "Prepare one specific conversation topic you're genuinely interested in before your next date", done: false });
    actions.push({ id: makeId(), action: "Run your Wellness Check — see which dimension needs the most attention this week", tool: "Wellness Center", toolHref: "/wellness", done: false });
  }

  while (actions.length < 5) {
    const extras = [
      { id: makeId(), action: "Check your Signal Score and identify the one dimension with the most room to grow", tool: "Signal Check", toolHref: "/signal-check", done: false },
      { id: makeId(), action: "Review your Dating Blueprint and pick one growth edge to act on this week", tool: "Dating Blueprint", toolHref: "/blueprint", done: false },
      { id: makeId(), action: "Add one win to My Timeline — even a small one. Small wins compound.", tool: "My Timeline", toolHref: "/progress/timeline", done: false },
      { id: makeId(), action: "Try one thing from your Compatibility Compass — one dynamic to seek or avoid", tool: "Compatibility Compass", toolHref: "/compatibility-compass", done: false },
      { id: makeId(), action: "Spend 10 minutes with your Profile Glow-Up results and make one real change", tool: "Profile Glow-Up", toolHref: "/glow-up", done: false },
    ];
    actions.push(extras[actions.length % extras.length]);
  }

  const winNote = wins.trim() ? ` You mentioned "${wins.trim().slice(0, 60)}" as a recent win — build on that energy.` : "";
  const challengeNote = challenge.trim() ? ` The challenge you mentioned ("${challenge.trim().slice(0, 60)}") is worth tracking across the week.` : "";

  return {
    weekOf: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    actions: actions.slice(0, 5),
    wingmanNote: `Five small moves beat one big intention.${winNote}${challengeNote} Pick the one that feels most doable today and start there.`,
  };
}

function tryParseAi(raw: string | undefined, fb: WeeklyPlan): WeeklyPlan {
  if (!raw) return fb;
  try {
    const p = JSON.parse(raw) as { actions?: unknown[]; wingmanNote?: string };
    if (!Array.isArray(p.actions) || p.actions.length < 3) return fb;
    return {
      ...fb,
      actions: (p.actions as { action?: string; tool?: string; toolHref?: string }[])
        .filter(a => a.action)
        .slice(0, 5)
        .map((a, i) => ({ id: fb.actions[i]?.id ?? makeId(), action: a.action ?? "", tool: a.tool, toolHref: a.toolHref, done: fb.actions[i]?.done ?? false })),
      wingmanNote: typeof p.wingmanNote === "string" ? p.wingmanNote : fb.wingmanNote,
    };
  } catch { return fb; }
}

function loadPlan(): WeeklyPlan | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw) as WeeklyPlan; } catch { /**/ }
  return null;
}
function savePlan(plan: WeeklyPlan) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch { /**/ }
}

export default function WeeklyGrowthPlan() {
  useMeta("Weekly Growth Plan", "Turn your goals and recent notes into a 5-action weekly plan with checkboxes you can actually track.");
  const [focus,     setFocus]     = useState("");
  const [wins,      setWins]      = useState("");
  const [challenge, setChallenge] = useState("");
  const [plan,      setPlan]      = useState<WeeklyPlan | null>(null);
  const [step,      setStep]      = useState(0);
  const enhance = useEnhanceAi();
  const createJournal = useCreateJournalEntry();
  const savedRef = useRef(false);

  function serializePlan(p: WeeklyPlan, f: string, w: string, c: string): string {
    const lines: string[] = [`Weekly Growth Plan — Week of ${p.weekOf}`];
    if (f) lines.push(`Focus: ${f}`);
    if (w.trim()) lines.push(`Recent win: ${w.trim()}`);
    if (c.trim()) lines.push(`Current challenge: ${c.trim()}`);
    lines.push("", "Actions:");
    p.actions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.action}${a.tool ? ` — ${a.tool}` : ""}`);
    });
    lines.push("", `Wingman note: ${p.wingmanNote}`);
    return lines.join("\n").slice(0, 20000);
  }

  useEffect(() => {
    const saved = loadPlan();
    if (saved) { setPlan(saved); setStep(1); }
  }, []);

  function toggleAction(id: string) {
    setPlan(prev => {
      if (!prev) return prev;
      const next = { ...prev, actions: prev.actions.map(a => a.id === id ? { ...a, done: !a.done } : a) };
      savePlan(next);
      return next;
    });
  }

  function handleGenerate() {
    const fb = buildFallback(focus, wins, challenge);
    setPlan(fb); savePlan(fb); setStep(1);
    if (!savedRef.current) {
      savedRef.current = true;
      createJournal.mutate(
        {
          data: {
            prompt: `Weekly Growth Plan — ${fb.weekOf}`,
            body: serializePlan(fb, focus, wins, challenge),
            tags: ["weekly"],
          },
        },
        { onError: () => { savedRef.current = false; } },
      );
    }
    const prompt = [
      focus      && `Focus area this week: ${focus}`,
      wins.trim()      && `Recent win: ${wins}`,
      challenge.trim() && `Current challenge: ${challenge}`,
    ].filter(Boolean).join("\n") +
    `\n\nReturn JSON: { "actions": [{ "action": string, "tool": string|null, "toolHref": string|null }] (exactly 5 specific, actionable items referencing NLDC tools where relevant), "wingmanNote": string (1-2 warm, direct sentences) }`;
    enhance.mutate({ data: { toolName: "Weekly Growth Plan", prompt, expectJson: true } }, {
      onSuccess: data => {
        const raw = (data as { output?: string } | undefined)?.output;
        const parsed = tryParseAi(raw, fb);
        setPlan(parsed); savePlan(parsed);
      },
    });
  }

  function reset() { setPlan(null); setFocus(""); setWins(""); setChallenge(""); setStep(0); enhance.reset(); localStorage.removeItem(STORAGE_KEY); savedRef.current = false; }

  const doneCount = plan?.actions.filter(a => a.done).length ?? 0;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 -right-10 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp(0)} className="mb-6">
            <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
            </Link>
          </motion.div>

          <motion.div {...fadeUp(0.03)} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-[hsl(142_55%_60%)]" />
              <p className="text-sm font-medium text-[hsl(142_55%_72%)]">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Weekly Growth Plan</h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              5 specific, achievable actions for the next 7 days — with checkboxes that persist across visits.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-6">
            {[0, 1].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(142_55%_60%)]" : "w-6 bg-white/10"}`} />
            ))}
            <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="form" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you most want to work on this week?</Label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_AREAS.map(f => (
                      <button key={f} onClick={() => setFocus(prev => prev === f ? "" : f)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${focus === f ? "bg-[hsl(142_55%_60%/0.2)] text-[hsl(142_55%_75%)] border-[hsl(142_55%_60%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">One thing that went well recently <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
                  <Textarea value={wins} onChange={e => setWins(e.target.value)} placeholder="A good conversation, a brave message you sent, something you noticed about yourself…" className="min-h-[80px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">One thing you're finding difficult <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
                  <Textarea value={challenge} onChange={e => setChallenge(e.target.value)} placeholder="Getting past small talk, re-engaging after silence, knowing if someone's interested…" className="min-h-[80px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
                </div>
                <Button onClick={handleGenerate} disabled={!focus}
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(142_55%_55%)] to-[hsl(268_52%_65%)] border-0 glow-pulse disabled:opacity-50">
                  <Sparkles className="mr-2 h-4 w-4" /> Build My Plan
                </Button>
              </motion.div>
            ) : plan ? (
              <motion.div key="results" {...fadeUp(0.05)} className="space-y-4">
                {enhance.isPending && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(142_55%_60%/0.08)] border border-[hsl(142_55%_60%/0.2)] text-xs text-[hsl(142_55%_72%)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wingman is tailoring your plan…
                  </div>
                )}

                {/* Plan header */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Week of {plan.weekOf}</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{doneCount}/{plan.actions.length} complete</p>
                    </div>
                    <div className="flex gap-1">
                      {plan.actions.map(a => (
                        <div key={a.id} className={`w-2 h-2 rounded-full transition-colors ${a.done ? "bg-[hsl(142_55%_60%)]" : "bg-white/15"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {plan.actions.map((action, i) => (
                      <div key={action.id} className={`flex items-start gap-3 transition-opacity ${action.done ? "opacity-50" : ""}`}>
                        <button onClick={() => toggleAction(action.id)} className="mt-0.5 flex-shrink-0">
                          {action.done
                            ? <CheckCircle2 className="w-5 h-5 text-[hsl(142_55%_60%)]" />
                            : <Circle className="w-5 h-5 text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${action.done ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                            {i + 1}. {action.action}
                          </p>
                          {action.tool && action.toolHref && !action.done && (
                            <Link href={action.toolHref} className="text-[10px] font-semibold text-[hsl(142_55%_60%)] hover:text-[hsl(142_55%_75%)] transition-colors mt-1 inline-block">
                              Open {action.tool} →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wingman note */}
                <div className="rounded-2xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_60%/0.06)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(142_55%_60%)] mb-1.5">Wingman Note</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{plan.wingmanNote}</p>
                </div>

                <div className="flex justify-center">
                  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> New week, new plan
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
