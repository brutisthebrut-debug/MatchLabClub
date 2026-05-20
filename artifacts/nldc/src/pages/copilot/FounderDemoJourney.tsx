import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, ArrowRight, ArrowLeft, CheckCircle2, Circle, ChevronRight } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const AUDIENCE_TYPES = [
  { id: "collaborator", label: "Collaborator / Co-founder",    focus: "architecture and roadmap" },
  { id: "earlyuser",    label: "Early user / Beta tester",     focus: "experience and first impression" },
  { id: "investor",     label: "Potential investor / Advisor", focus: "market and revenue model" },
  { id: "media",        label: "Media / Podcast feature",      focus: "story and product value" },
];

interface DemoStop {
  id: string;
  title: string;
  route: string;
  talkingPoints: string[];
  audienceNotes: Record<string, string>;
}

const STOPS: DemoStop[] = [
  {
    id: "landing",
    title: "Landing Page",
    route: "/",
    talkingPoints: [
      "Opens with the core promise: a smart trusted wingman, not a generic chatbot.",
      "No account required to start — lowest-friction entry in the category.",
      "Privacy-first framing immediately: coaching not surveillance.",
      "Three tiers visible at a scroll — free entry point, clear upgrade path.",
    ],
    audienceNotes: {
      collaborator: "The no-key, no-API-dependency model means zero marginal cost to serve users at scale. The entire engine is deterministic — it never fails from rate limits.",
      earlyuser:    "You can start right now with no account. The free audit is the value — everything else builds on it.",
      investor:     "Unit economics: zero AI API cost per user until they're on a paid tier. The $97 and $197 tiers are where margin lives.",
      media:        "The hook: a dating app that doesn't need your data, never shares it with anyone, and can't be manipulated by the algorithm. The AI is entirely local.",
    },
  },
  {
    id: "wizard",
    title: "Signal Audit (5-step wizard)",
    route: "/start",
    talkingPoints: [
      "5 steps, under 3 minutes — name, goal, bio, message sample, review.",
      "Every field optional after step 1 — removes abandonment friction.",
      "Produces a Signal Score (0–100), bio critique, message pattern read, photo checklist.",
      "Deterministic engine means results are instant — no waiting for an API.",
    ],
    audienceNotes: {
      collaborator: "The engine is in aiEngine.ts — a structured prompt-to-output system. It produces the same quality analysis whether 1 or 10,000 people use it simultaneously.",
      earlyuser:    "Fill in as much or as little as you want. Even a one-line bio produces useful output. The score is a starting point, not a verdict.",
      investor:     "This is the lead-gen moment. Free value → email capture → upgrade path. The wizard completion rate is the core metric.",
      media:        "Show this live. 3 minutes from blank to a personalised audit with a score and action plan. That's the demo.",
    },
  },
  {
    id: "dashboard",
    title: "Dashboard",
    route: "/dashboard",
    talkingPoints: [
      "Signal Score history chart — motivates return visits to track progress.",
      "Next Best Action engine — surfaces one clear recommended move based on score.",
      "'Continue where you left off' rail — deep links back to relevant tools.",
      "28 quick-action tools — the full toolkit visible from one screen.",
    ],
    audienceNotes: {
      collaborator: "The dashboard is the retention engine. Score history creates accountability loops. The quick action grid is intentionally dense — power users find what they need fast.",
      earlyuser:    "The score will change every time you run an audit. The trend over time is the real product — one session doesn't tell the full story.",
      investor:     "DAU/WAU ratio is driven by the score history chart. Users come back to see if they improved. That's the habit loop.",
      media:        "This is the 'control room' — show the score ring, the history chart, and tap into any tool. It reads visually in a screenshot.",
    },
  },
  {
    id: "tools",
    title: "Core Tools",
    route: "/coach",
    talkingPoints: [
      "Message Coach: paste a conversation → 3 styled reply options (Playful/Direct/Warm).",
      "Blueprint: 4-question self-insight → personalised coaching lens.",
      "Next Message: 7 copy-ready options for any situation — including a Clean Exit.",
      "Wingman Studio: 7 guided workflows — from profile rewrites to date prep.",
    ],
    audienceNotes: {
      collaborator: "Each tool is a standalone module. Adding a new tool requires a page, a deterministic engine, and an optional AI enhance call. Architectural surface area is low.",
      earlyuser:    "Start with the tool that's most relevant to where you're stuck right now. Message Coach if you're in a conversation. Blueprint if you want to understand your patterns.",
      investor:     "The tool breadth creates natural upgrade moments. The free tools are genuinely useful; the depth features are behind the paid tiers.",
      media:        "Demo the Message Coach live — paste a real (or staged) conversation and show the output. It's the most immediately impressive thing in the product.",
    },
  },
];

export default function FounderDemoJourney() {
  useMeta("Founder Demo Journey", "A guided walkthrough of NLDC for demos, partner previews, and early-user onboarding.");
  const [audience, setAudience] = useState("");
  const [phase, setPhase] = useState<"pick" | "journey">("pick");
  const [activeStop, setActiveStop] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggleCheck(key: string) {
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  const stop = STOPS[activeStop];
  const audienceNote = stop.audienceNotes[audience] ?? stop.audienceNotes["earlyuser"];
  const audLabel = AUDIENCE_TYPES.find(a => a.id === audience)?.label ?? "your audience";

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
              <Compass className="w-4 h-4 text-[hsl(228_18%_62%)]" />
              <p className="text-sm font-medium text-muted-foreground">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Founder Demo Journey</h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Guided talking points for every stop in the product — tailored to who you're showing it to.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {phase === "pick" ? (
              <motion.div key="pick" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Who are you showing this to?</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-6">
                  {AUDIENCE_TYPES.map(a => (
                    <button key={a.id} onClick={() => setAudience(a.id)}
                      className={`text-left rounded-2xl border p-4 transition-all ${audience === a.id ? "border-[hsl(268_52%_68%/0.4)] bg-[hsl(268_52%_68%/0.08)]" : "border-white/8 hover:border-white/15"}`}>
                      <p className="text-sm font-semibold text-foreground mb-0.5">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground/50">Focus: {a.focus}</p>
                    </button>
                  ))}
                </div>
                <Button onClick={() => setPhase("journey")} disabled={!audience}
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(228_18%_55%)] to-[hsl(268_52%_65%)] border-0 disabled:opacity-50">
                  Start Demo Journey <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div key="journey" {...fadeUp(0.05)}>
                {/* Stop tabs */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                  {STOPS.map((s, i) => (
                    <button key={s.id} onClick={() => setActiveStop(i)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${i === activeStop ? "border-[hsl(268_52%_68%/0.4)] bg-[hsl(268_52%_68%/0.12)] text-[hsl(268_52%_78%)]" : "border-white/8 text-muted-foreground/50 hover:border-white/15 hover:text-muted-foreground"}`}>
                      {i + 1}. {s.title.split(" ")[0]}
                    </button>
                  ))}
                </div>

                <div className="glass border border-white/8 rounded-2xl p-5 sm:p-6 mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Stop {activeStop + 1}</p>
                      <h2 className="text-lg font-semibold text-foreground">{stop.title}</h2>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-full text-xs border-white/15 flex-shrink-0">
                      <Link href={stop.route}>Open <ChevronRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                  </div>

                  {/* Talking points */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Talking points</p>
                  <div className="space-y-2 mb-4">
                    {stop.talkingPoints.map((pt, i) => {
                      const key = `${stop.id}-${i}`;
                      const done = checked.has(key);
                      return (
                        <button key={key} onClick={() => toggleCheck(key)} className={`flex items-start gap-2.5 text-left w-full group ${done ? "opacity-40" : ""}`}>
                          {done
                            ? <CheckCircle2 className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
                            : <Circle className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 flex-shrink-0 mt-0.5 transition-colors" />
                          }
                          <p className={`text-sm leading-snug ${done ? "line-through text-muted-foreground/40" : "text-muted-foreground"}`}>{pt}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Audience note */}
                  <div className="rounded-xl border border-[hsl(268_52%_68%/0.2)] bg-[hsl(268_52%_68%/0.06)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(268_52%_68%)] mb-1.5">For {audLabel}</p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">{audienceNote}</p>
                  </div>
                </div>

                {/* Nav */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" disabled={activeStop === 0}
                    onClick={() => setActiveStop(prev => Math.max(0, prev - 1))}
                    className="rounded-full border-white/15 text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Previous
                  </Button>
                  {activeStop < STOPS.length - 1 ? (
                    <Button size="sm" onClick={() => setActiveStop(prev => prev + 1)}
                      className="rounded-full bg-gradient-to-r from-[hsl(228_18%_50%)] to-[hsl(268_52%_65%)] border-0 text-xs">
                      Next stop <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => { setPhase("pick"); setActiveStop(0); setChecked(new Set()); }}
                      className="rounded-full bg-[hsl(142_55%_45%)] border-0 text-xs">
                      Done ✓ Reset
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
