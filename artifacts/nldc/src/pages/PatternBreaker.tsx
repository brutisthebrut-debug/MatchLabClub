import { withAlpha } from "@/lib/brandColor";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Zap, CheckCircle2, Circle, RefreshCw, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useRecordGrowthEvent,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface ActionItem {
  id: string;
  text: string;
  why: string;
  category: "profile" | "message" | "mindset" | "real-world";
}

const ACTIONS: ActionItem[] = [
  {
  id: "a1", category: "message",
  text: "Send one message today without editing it more than once.",
  why: "Over-editing signals anxiety. One-pass messages tend to sound more natural and confident.",
  },
  {
  id: "a2", category: "profile",
  text: "Swap one generic word in your bio for a specific one. 'Coffee' → the café name. 'Travel' → the place.",
  why: "Specific details do more work than categories. One swap is enough to test the difference.",
  },
  {
  id: "a3", category: "mindset",
  text: "Before opening the app today, decide what kind of interaction you actually have energy for.",
  why: "Dating from a depleted state produces the worst outcomes. A 10-second check-in changes your tone.",
  },
  {
  id: "a4", category: "real-world",
  text: "Do one thing this week that isn't about dating, something you'd tell a match about.",
  why: "Your life off the app is the raw material for your profile. Interesting people do interesting things.",
  },
  {
  id: "a5", category: "message",
  text: "The next time you feel the urge to send a 'just checking in' message, try a specific question or observation instead.",
  why: "Check-ins ask for nothing. A real question gives someone something to actually respond to.",
  },
  {
  id: "a6", category: "profile",
  text: "Read your profile out loud. Anything that sounds stiff or written → rewrite it in your speaking voice.",
  why: "If you wouldn't say it out loud, it probably shouldn't be in your profile. The read-aloud test is brutal and useful.",
  },
  {
  id: "a7", category: "mindset",
  text: "Identify one pattern from your last three conversations that you'd like to change.",
  why: "Patterns only shift when you can name them. You don't have to fix it this week, just see it clearly.",
  },
  {
  id: "a8", category: "message",
  text: "Write a first message that references something specific from their profile, not their photos.",
  why: "Photo compliments are forgettable. Profile-specific openers show you actually looked and were curious.",
  },
  {
  id: "a9", category: "mindset",
  text: "Give yourself a 2-hour no-app window today. Notice whether that changes your energy when you open it again.",
  why: "Constant low-grade checking drains focus and creates a scarcity feeling that comes through in your messages.",
  },
  {
  id: "a10", category: "real-world",
  text: "Ask a friend who knows you well: 'What's one thing you'd put in my dating profile that I'd never think to write?'",
  why: "We're notoriously bad at describing ourselves. The people who know us best see things we've normalised.",
  },
];

const CATEGORY_COLORS: Record<ActionItem["category"], string> = {
  "profile": "hsl(var(--brand-indigo))",
  "message": "hsl(190 55% 60%)",
  "mindset": "hsl(var(--brand-gold))",
  "real-world": "hsl(var(--brand-green))",
};

const CATEGORY_LABELS: Record<ActionItem["category"], string> = {
  "profile": "Profile",
  "message": "Message",
  "mindset": "Mindset",
  "real-world": "Real World",
};

function getWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 864e5 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

const STORAGE_KEY = "nldc_pattern_breaker";

interface StoredState {
  weekKey: string;
  checked: string[];
  selectedIds: string[];
}

function pickRandom(n: number): string[] {
  const shuffled = [...ACTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map(a => a.id);
}

function loadState(): StoredState {
  try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { weekKey: getWeekKey(), checked: [], selectedIds: pickRandom(5) };
  const state = JSON.parse(raw) as StoredState;
  if (state.weekKey !== getWeekKey()) {
  const fresh = { weekKey: getWeekKey(), checked: [], selectedIds: pickRandom(5) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
  }
  return state;
  } catch {
  return { weekKey: getWeekKey(), checked: [], selectedIds: pickRandom(5) };
  }
}

function saveState(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function PatternBreaker() {
  useMeta("Pattern Breaker", "Five small pattern-breaking actions for this week, resets every Sunday.");

  const [state, setState] = useState<StoredState>(() => ({ weekKey: "", checked: [], selectedIds: [] }));
  const [expandedWhy, setExpandedWhy] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const recordGrowth = useRecordGrowthEvent();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  useEffect(() => {
  setState(loadState());
  }, []);

  const selectedActions = ACTIONS.filter(a => state.selectedIds.includes(a.id));
  const doneCount = state.checked.length;
  const isBrandNewUser = isAuthenticated && doneCount === 0;

  const toggle = (id: string) => {
  const wasChecked = state.checked.includes(id);
  const checked = wasChecked
  ? state.checked.filter(c => c !== id)
  : [...state.checked, id];
  const next = {...state, checked };
  setState(next);
  saveState(next);

  // Marking a step done is the meaningful commit. For signed-in users we also
  // record a real growth signal in addition to the local checklist so it feeds
  // the behavioralGrowth lane and the readiness meter climbs. The anon path is
  // untouched and keeps its existing local-only behavior.
  if (isAuthenticated && !wasChecked) {
  climb.snapshot();
  recordGrowth.mutate(
  { data: { type: "pattern_broken" } },
  { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() }); } },
  );
  }
  };

  const refresh = () => {
  const next: StoredState = { weekKey: getWeekKey(), checked: [], selectedIds: pickRandom(5) };
  setState(next);
  saveState(next);
  };

  if (state.selectedIds.length === 0) return null;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">

  {/* Hero */}
  <motion.div {...fadeUp(0)} className="mb-8">
  <div className="flex items-center gap-2.5 mb-3">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(190_55%_60%)] flex items-center justify-center shadow-[0_0_16px_hsl(248_62%_52%/0.4)]">
  <Zap className="w-4 h-4 text-white" />
  </div>
  <p className="text-sm font-semibold text-[hsl(248_62%_62%)]">Growth Tracker</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground mb-2">Pattern Breaker</h1>
  <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
  Five small actions for this week. Each one targets a common pattern that keeps people stuck.
  You don't have to do all five, even two shifts something.
  </p>
  </motion.div>

  {isBrandNewUser && (
  <WelcomePanel
  variant="shimmer"
  tint="violet-green"
  icon={<Zap className="w-6 h-6" />}
  eyebrow="Welcome to Pattern Breaker"
  title="Break your first pattern"
  description="Check off any action below this week. Even one small shift starts to interrupt the loops that keep people stuck."
  testId="pattern-breaker-empty-state"
  delay={0.04}
  />
  )}

  {/* Progress */}
  <motion.div {...fadeUp(0.06)} className="glass border border-white/8 rounded-2xl p-5 mb-6">
  <div className="flex items-center justify-between mb-3">
  <div>
  <p className="font-semibold text-foreground text-sm">{doneCount} of 5 done this week</p>
  <p className="text-xs text-muted-foreground/60 mt-0.5">Resets every Sunday</p>
  </div>
  <button
  onClick={refresh}
  className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
  >
  <RefreshCw className="w-3 h-3" />
  New list
  </button>
  </div>
  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
  <motion.div
  className="h-full rounded-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(142_55%_60%)]"
  initial={{ width: 0 }}
  animate={{ width: `${(doneCount / 5) * 100}%` }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
  />
  </div>
  </motion.div>

  {isAuthenticated && climb.before !== null && (
  <motion.div {...fadeUp(0.07)} className="mb-6">
  <ReadinessClimbReveal
  from={climb.before}
  to={climb.current}
  className="glass border border-white/8 rounded-2xl p-5"
  />
  </motion.div>
  )}

  {/* Action list */}
  <div className="space-y-3">
  {selectedActions.map((action, i) => {
  const done = state.checked.includes(action.id);
  const color = CATEGORY_COLORS[action.category];
  const whyOpen = expandedWhy === action.id;
  return (
  <motion.div key={action.id} {...fadeUp(0.1 + i * 0.05)}
  className={`glass border rounded-2xl overflow-hidden transition-all ${done ? "border-[hsl(142_55%_60%/0.3)] opacity-70" : "border-white/8"}`}
  >
  <div className="p-4 flex items-start gap-3">
  <button
  onClick={() => toggle(action.id)}
  className="flex-shrink-0 mt-0.5 transition-colors"
  >
  {done
  ? <CheckCircle2 className="w-5 h-5 text-[hsl(142_55%_60%)]" />
  : <Circle className="w-5 h-5 text-muted-foreground/30 hover:text-muted-foreground/60" />
  }
  </button>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1.5">
  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
  style={{ color, borderColor: withAlpha(color, 0.3), background: withAlpha(color, 0.1) }}>
  {CATEGORY_LABELS[action.category]}
  </span>
  </div>
  <p className={`text-sm leading-relaxed ${done ? "line-through text-muted-foreground/40" : "text-foreground"}`}>
  {action.text}
  </p>
  </div>
  </div>
  <div className="border-t border-white/5">
  <button
  onClick={() => setExpandedWhy(whyOpen ? null : action.id)}
  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
  >
  <span className="font-semibold uppercase tracking-wider text-[9px]">Why this works</span>
  {whyOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
  </button>
  {whyOpen && (
  <p className="px-4 pb-4 text-xs text-muted-foreground/60 leading-relaxed">{action.why}</p>
  )}
  </div>
  </motion.div>
  );
  })}
  </div>

  {doneCount === 5 && (
  <motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  className="mt-6 glass border border-[hsl(142_55%_60%/0.3)] rounded-2xl p-5 text-center"
  >
  <CheckCircle2 className="w-8 h-8 text-[hsl(142_55%_60%)] mx-auto mb-2" />
  <p className="font-semibold text-foreground mb-1">Full set done this week.</p>
  <p className="text-sm text-muted-foreground">That's five pattern interrupts in one week. Log a win in your Dating Wins Log if any of them led to something.</p>
  <Button
  onClick={refresh}
  variant="outline"
  size="sm"
  className="mt-3 rounded-xl text-xs border-white/10 text-muted-foreground hover:text-foreground"
  >
  <RefreshCw className="w-3 h-3 mr-1.5" />
  Get a fresh set
  </Button>
  </motion.div>
  )}

  {/* Trust note */}
  <motion.div {...fadeUp(0.5)} className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
  <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground/45 leading-relaxed">
  <strong className="text-muted-foreground/60">Coaching suggestions, not clinical advice.</strong>{" "}
  Your checklist is stored locally and resets each week. Nothing is tracked or shared.
  </p>
  </motion.div>
  </div>
  </div>
  </AppLayout>
  );
}