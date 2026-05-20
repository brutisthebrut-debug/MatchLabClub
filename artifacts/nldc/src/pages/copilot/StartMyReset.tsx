import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Zap, CheckCircle2, Circle, ArrowRight, ArrowLeft,
  FileText, BookOpen, Star, MessageSquare, LayoutDashboard,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface ResetStep {
  id: string;
  icon: React.ElementType;
  title: string;
  tagline: string;
  why: string;
  href: string;
  color: string;
  time: string;
}

const STEPS: ResetStep[] = [
  {
    id: "signal",
    icon: Zap,
    title: "Signal Check",
    tagline: "Your 3-minute baseline",
    why: "Gives you a starting score so every other step has something to compare against. Most people skip this and then don't know if anything's working.",
    href: "/signal-check",
    color: "hsl(268 52% 68%)",
    time: "3 min",
  },
  {
    id: "blueprint",
    icon: BookOpen,
    title: "Dating Blueprint",
    tagline: "Your personalized self-insight",
    why: "A coaching lens on how you show up — patterns, first impressions, growth edge. Worth doing before rewriting your profile because it tells you *what* to fix.",
    href: "/blueprint",
    color: "hsl(43 65% 65%)",
    time: "5 min",
  },
  {
    id: "profile",
    icon: Star,
    title: "Profile Glow-Up",
    tagline: "10 platform-specific rewrites",
    why: "Takes your actual bio and prompts and produces better versions — specific, warm, and platform-appropriate. Pick what resonates; discard the rest.",
    href: "/glow-up",
    color: "hsl(190 55% 60%)",
    time: "4 min",
  },
  {
    id: "message",
    icon: MessageSquare,
    title: "Message Coach",
    tagline: "Coached replies for a real conversation",
    why: "Paste a thread you're actually in. You'll get 3 styled reply options (Playful / Direct / Warm) plus a coaching note on how to approach it.",
    href: "/coach",
    color: "hsl(285 45% 65%)",
    time: "3 min",
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Your Dashboard",
    tagline: "See your full picture",
    why: "Now that you've run the core tools, your Dashboard will surface your Signal Score, score history, and a personalised next best action.",
    href: "/dashboard",
    color: "hsl(142 55% 60%)",
    time: "2 min",
  },
];

const GOALS = [
  "Get more matches",
  "Improve conversations",
  "Find something serious",
  "Get back out there",
  "Understand what's not working",
  "Just exploring",
];

const STORAGE_KEY = "nldc_reset_done";

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /**/ }
  return new Set();
}
function saveDone(done: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...done])); } catch { /**/ }
}

export default function StartMyReset() {
  useMeta("Start My Reset", "A guided journey through your 5 core tools — Signal Check, Blueprint, Profile, Messaging, and your Dashboard.");
  const [phase, setPhase] = useState<"goal" | "journey">("goal");
  const [goal, setGoal] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => { setDone(loadDone()); }, []);

  function markDone(id: string) {
    setDone(prev => {
      const next = new Set(prev); next.add(id); saveDone(next); return next;
    });
  }
  function unmark(id: string) {
    setDone(prev => {
      const next = new Set(prev); next.delete(id); saveDone(next); return next;
    });
  }

  const completedCount = STEPS.filter(s => done.has(s.id)).length;
  const allDone = completedCount === STEPS.length;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-25 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          {/* Back */}
          <motion.div {...fadeUp(0)} className="mb-6">
            <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div {...fadeUp(0.03)} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Start My Reset</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              A guided path through your 5 core tools. Takes about 15 minutes total.
              {completedCount > 0 && <span className="text-[hsl(142_55%_60%)] font-semibold"> {completedCount}/{STEPS.length} done.</span>}
            </p>
          </motion.div>

          {/* Phase 1: Goal */}
          {phase === "goal" ? (
            <motion.div {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Before you start — what's your focus?</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                    className={`px-3 py-2 rounded-full border text-sm font-medium transition-all ${
                      goal === g
                        ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]"
                        : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
              {goal && (
                <p className="text-sm text-muted-foreground/70 mb-5 italic">
                  Got it. The tools below are ordered to help with that specifically.
                </p>
              )}
              <Button onClick={() => setPhase("journey")} className="rounded-full w-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0">
                {goal ? "Start My Journey →" : "Skip & Start"}
              </Button>
            </motion.div>
          ) : (

            /* Phase 2: Step-by-step journey */
            <div className="space-y-3">
              {allDone && (
                <motion.div {...fadeUp(0)} className="glass border border-[hsl(142_55%_60%/0.3)] rounded-2xl p-5 mb-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[hsl(142_55%_60%)] mx-auto mb-2" />
                  <p className="font-semibold text-foreground mb-1">Reset complete — nice work.</p>
                  <p className="text-sm text-muted-foreground mb-4">Your Dashboard now has your baseline. From here, work on whatever your score and blueprint suggest.</p>
                  <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0">
                    <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                  </Button>
                </motion.div>
              )}

              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone = done.has(step.id);
                return (
                  <motion.div key={step.id} {...fadeUp(0.04 + i * 0.06)}
                    className={`glass border rounded-2xl p-5 transition-all ${isDone ? "border-[hsl(142_55%_60%/0.25)] opacity-70" : "border-white/8"}`}>
                    <div className="flex items-start gap-4">
                      {/* Step indicator */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <button onClick={() => isDone ? unmark(step.id) : markDone(step.id)}>
                          {isDone
                            ? <CheckCircle2 className="w-6 h-6 text-[hsl(142_55%_60%)]" />
                            : <Circle className="w-6 h-6 text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors" />
                          }
                        </button>
                        <span className="text-[10px] font-bold text-muted-foreground/30">{i + 1}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${step.color.replace(")", " / 0.15)")}` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: step.color }} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{step.title}</p>
                            <p className="text-[10px] text-muted-foreground/50">{step.tagline} · {step.time}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground/65 leading-relaxed mb-3">{step.why}</p>
                        <div className="flex items-center gap-3">
                          <Button asChild size="sm" className="rounded-full text-xs px-4 border-0 font-semibold"
                            style={{ background: step.color, color: "hsl(232 38% 7%)" }}>
                            <Link href={step.href}>Open Tool <ArrowRight className="ml-1 h-3 w-3" /></Link>
                          </Button>
                          <button onClick={() => isDone ? unmark(step.id) : markDone(step.id)}
                            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1">
                            {isDone ? <><CheckCircle2 className="w-3 h-3" /> Done</> : "Mark done"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <motion.div {...fadeUp(0.35)} className="mt-2">
                <button onClick={() => setPhase("goal")} className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Change goal
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
