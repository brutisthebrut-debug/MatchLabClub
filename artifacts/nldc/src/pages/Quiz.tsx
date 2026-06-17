import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Share2, Check, RefreshCw } from "lucide-react";
import { Glyph } from "@/lib/glyphs";
import { useToast } from "@/hooks/use-toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type ArchetypeKey = "connector" | "pursuer" | "adventurer" | "diver" | "anchor" | "builder";

interface Option {
  label: string;
  scores: Partial<Record<ArchetypeKey, number>>;
}

interface Question {
  q: string;
  note?: string;
  options: Option[];
}

const QUESTIONS: Question[] = [
  {
  q: "A new match just messaged you. What do you actually do?",
  options: [
  { label: "Respond fast. I'm excited and I show it", scores: { pursuer: 2, adventurer: 1 } },
  { label: "Take a beat, craft something thoughtful", scores: { diver: 2, connector: 1 } },
  { label: "Match their energy and keep it light", scores: { adventurer: 2, anchor: 1 } },
  { label: "Check if they look like someone I'd actually want to meet", scores: { builder: 2, diver: 1 } },
  ],
  },
  {
  q: "What does 'connection' mean to you, honestly?",
  options: [
  { label: "That electric feeling you can't manufacture", scores: { diver: 2, adventurer: 1 } },
  { label: "Someone who really gets you, no performance needed", scores: { connector: 2, anchor: 1 } },
  { label: "Ease. Laughter. No effort required", scores: { adventurer: 2, pursuer: 1 } },
  { label: "Shared values and a clear sense of direction together", scores: { builder: 2, connector: 1 } },
  ],
  },
  {
  q: "Someone you've been seeing goes quiet for 4 days. You:",
  options: [
  { label: "Send a low-key message after 2–3 days, then move on", scores: { pursuer: 2, builder: 1 } },
  { label: "Give them space, they'll come back or they won't", scores: { anchor: 2, adventurer: 1 } },
  { label: "Reread the last conversation looking for clues", scores: { diver: 2, connector: 1 } },
  { label: "Open two more apps and keep your options warm", scores: { adventurer: 2, pursuer: 1 } },
  ],
  },
  {
  q: "A first date is going really well. What's your move?",
  options: [
  { label: "Suggest a second spot, keep the night going", scores: { pursuer: 2, adventurer: 1 } },
  { label: "End on a high note and text within 24 hours", scores: { anchor: 2, builder: 1 } },
  { label: "Get lost in conversation, time just disappears", scores: { diver: 2, connector: 1 } },
  { label: "Stay present and let it unfold naturally", scores: { connector: 2, adventurer: 1 } },
  ],
  },
  {
  q: "Your closest friends would say your dating style is:",
  options: [
  { label: "Bold, you go for what you want", scores: { pursuer: 2, adventurer: 1 } },
  { label: "Selective, you wait for someone worth it", scores: { diver: 2, builder: 1 } },
  { label: "Warm, you make everyone feel safe", scores: { connector: 2, anchor: 1 } },
  { label: "Careful, you take it slow and watch how people act", scores: { anchor: 2, builder: 1 } },
  ],
  },
  {
  q: "What's your biggest honest obstacle right now?",
  options: [
  { label: "I attract people I'm not actually excited by", scores: { builder: 2, diver: 1 } },
  { label: "I match a lot but conversations fizzle fast", scores: { connector: 2, pursuer: 1 } },
  { label: "I pull back when it starts to get real", scores: { diver: 2, anchor: 1 } },
  { label: "I can't find anyone who feels worth pursuing", scores: { builder: 2, connector: 1 } },
  ],
  },
  {
  q: "When you picture the relationship you actually want:",
  options: [
  { label: "It's specific. I know what I'm looking for", scores: { builder: 2, pursuer: 1 } },
  { label: "It's a feeling more than a picture", scores: { diver: 2, connector: 1 } },
  { label: "It changes with who I meet", scores: { adventurer: 2, connector: 1 } },
  { label: "I try to stay open rather than prescribe it", scores: { anchor: 2, adventurer: 1 } },
  ],
  },
  {
  q: "What would a real upgrade to your dating life look like?",
  options: [
  { label: "Meeting people who genuinely excite me", scores: { diver: 2, adventurer: 1 } },
  { label: "Clearer, calmer communication, theirs and mine", scores: { connector: 2, anchor: 1 } },
  { label: "More confidence in who I am when I'm on a date", scores: { pursuer: 2, connector: 1 } },
  { label: "A smarter strategy, not just more effort", scores: { builder: 2, pursuer: 1 } },
  ],
  },
];

interface Archetype {
  key: ArchetypeKey;
  name: string;
  icon: string;
  tagline: string;
  color: string;
  bg: string;
  description: string;
  strengths: string[];
  edges: string[];
  whatYouNeed: string;
  cta: { label: string; href: string };
}

const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  connector: {
  key: "connector",
  name: "The Connector",
  icon: "Sprout",
  tagline: "You make people feel seen, and you need that back",
  color: "hsl(var(--brand-green))",
  bg: "hsl(var(--brand-green) / 0.12)",
  description: "You're emotionally fluent, you create warmth quickly, and people open up to you. Your dating superpower is depth, you go somewhere real faster than most. The risk? You sometimes give more than you receive, or stay in things longer than they deserve.",
  strengths: ["Creates safety fast", "Remembers details", "Asks the right questions", "Makes people feel chosen"],
  edges: ["Can over-invest too early", "May avoid hard conversations to keep the peace", "Reads into silence too much"],
  whatYouNeed: "Someone who matches your emotional range, not just appreciates it from a distance.",
  cta: { label: "See Your Blueprint →", href: "/blueprint" },
  },
  pursuer: {
  key: "pursuer",
  name: "The Bold Pursuer",
  icon: "Zap",
  tagline: "You go for what you want, directly",
  color: "hsl(var(--brand-gold))",
  bg: "hsl(var(--brand-gold) / 0.12)",
  description: "You don't leave people guessing. When you're interested, you say it. When you're not, you move on. This directness is a gift in a world full of slow-fading and vague signals. The challenge: you can mistake pace for certainty, and push for resolution before it's ready.",
  strengths: ["Cuts through ambiguity", "Takes initiative", "Doesn't waste time", "Clear about intentions"],
  edges: ["Can push too hard when interest is developing", "May read unavailability as disinterest too fast", "Sometimes skips emotional depth in favour of forward movement"],
  whatYouNeed: "Someone who can keep up, and who'll push back on you occasionally.",
  cta: { label: "Run Your Signal Check →", href: "/signal-check" },
  },
  adventurer: {
  key: "adventurer",
  name: "The Adventurer",
  icon: "Flame",
  tagline: "You date with energy, lightness, and real presence",
  color: "hsl(var(--brand-rose))",
  bg: "hsl(var(--brand-rose) / 0.12)",
  description: "You bring spontaneity, warmth, and genuine presence to every interaction. Dating feels alive when you're in it. You're not afraid of new people or new scenarios, in fact, you thrive there. The edge: it's harder for you to slow down and let real depth develop.",
  strengths: ["Makes dates feel easy and alive", "Low pressure energy", "Curious and interested in people", "Doesn't catastrophize"],
  edges: ["Can keep things fun to avoid deeper vulnerability", "Hard to settle into one thing", "May underestimate chemistry without novelty"],
  whatYouNeed: "Someone who brings their own life to the relationship, and gives you room to be fully yourself.",
  cta: { label: "Try the Dating Reset →", href: "/checkout/dating-reset" },
  },
  diver: {
  key: "diver",
  name: "The Deep Diver",
  icon: "Waves",
  tagline: "You want something real, or nothing at all",
  color: "hsl(var(--brand-indigo))",
  bg: "hsl(var(--brand-indigo) / 0.12)",
  description: "Surface-level doesn't do it for you. You feel things intensely, you're drawn to people who have substance, and when you find something worth caring about, you care completely. That intensity is your gift. The challenge: it can make the dating process exhausting, because most of it isn't there yet.",
  strengths: ["High emotional intelligence", "Committed when committed", "Goes beneath the surface fast", "Remembers what matters"],
  edges: ["Easily overwhelmed by superficiality", "Can fall hard and fast before it's earned", "Struggles with uncertainty in between"],
  whatYouNeed: "A process that filters for the right people early, so you spend less energy on the wrong ones.",
  cta: { label: "See Your Blueprint →", href: "/blueprint" },
  },
  anchor: {
  key: "anchor",
  name: "The Steady Anchor",
  icon: "Anchor",
  tagline: "You're consistent, patient, and worth the wait",
  color: "hsl(190 55% 60%)",
  bg: "hsl(190 55% 60% / 0.12)",
  description: "You build slow and solid. You don't get swept away, you don't rush, and you tend to be right about people over time. The person who ends up with you gets something rare: consistency, safety, and real presence. The challenge: you can seem unavailable when you're just being careful.",
  strengths: ["Doesn't react impulsively", "Builds genuine trust", "Shows up consistently", "Long game player"],
  edges: ["Can read as disinterested early on", "May wait too long to express feelings", "Overthinks before acting"],
  whatYouNeed: "To trust that the right person will recognise steadiness as a gift, not a limitation.",
  cta: { label: "Run Your Signal Check →", href: "/signal-check" },
  },
  builder: {
  key: "builder",
  name: "The Intentional Builder",
  icon: "Compass",
  tagline: "You know what you want, and you're building toward it",
  color: "hsl(var(--brand-gold))",
  bg: "hsl(var(--brand-gold) / 0.12)",
  description: "You date with direction. You have a picture of what you want, or at least strong instincts about what fits, and you screen accordingly. You're not into wasted time. This intentionality is powerful. The challenge: if the filter is too tight, it screens out good things that needed more time to become visible.",
  strengths: ["Values-aligned decisions", "Doesn't settle for comfort", "Clear about life direction", "Efficient with energy and time"],
  edges: ["Can over-optimize and miss unexpected fits", "Screening can feel transactional to others", "May mistake chemistry for compatibility too fast"],
  whatYouNeed: "Profile and messaging that signals your specificity, so the right people self-select in.",
  cta: { label: "Improve My Profile →", href: "/copilot/profile" },
  },
};

function scoreAnswers(answers: number[]): ArchetypeKey {
  const totals: Record<ArchetypeKey, number> = { connector: 0, pursuer: 0, adventurer: 0, diver: 0, anchor: 0, builder: 0 };
  answers.forEach((ans, qi) => {
  const scores = QUESTIONS[qi].options[ans].scores;
  (Object.entries(scores) as [ArchetypeKey, number][]).forEach(([k, v]) => { totals[k] += v; });
  });
  return (Object.entries(totals) as [ArchetypeKey, number][]).reduce((a, b) => b[1] > a[1] ? b : a)[0];
}

export default function Quiz() {
  useMeta("Dating Signal Type Quiz", "A quick, honest quiz that shows your dating archetype and what you actually need right now.");
  const [step, setStep] = useState<"intro" | "quiz" | "result">("intro");
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [shared, setShared] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  function selectOption(i: number) {
  setSelected(i);
  }

  function next() {
  if (selected === null) return;
  const newAnswers = [...answers, selected];
  if (qIdx < QUESTIONS.length - 1) {
  setAnswers(newAnswers);
  setQIdx(q => q + 1);
  setSelected(null);
  } else {
  const key = scoreAnswers(newAnswers);
  setArchetype(ARCHETYPES[key]);
  setStep("result");
  }
  }

  function restart() {
  setStep("intro");
  setQIdx(0);
  setAnswers([]);
  setSelected(null);
  setArchetype(null);
  setShared(false);
  }

  function share() {
  const text = archetype ? `I got "${archetype.name}" on the MatchLab Club Dating Signal Type Quiz, ${archetype.tagline}. Take yours at matchlab.club/quiz` : "";
  navigator.clipboard.writeText(text);
  setShared(true);
  toast({ title: "Copied to clipboard", description: "Share it wherever feels right." });
  }

  const progress = qIdx / QUESTIONS.length;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-20 opacity-20 pointer-events-none" />
  <div className="orb orb-rose fixed w-[300px] h-[300px] bottom-10 -left-10 opacity-20 pointer-events-none" />

  <div className="max-w-xl mx-auto relative z-10">
  <AnimatePresence mode="wait">

  {step === "intro" && (
  <motion.div key="intro" {...fadeUp(0)} className="space-y-6">
  <div className="text-center space-y-4 pt-8 pb-2">
  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] flex items-center justify-center shadow-[0_0_40px_hsl(248_62%_52%/0.4)]">
  <Sparkles className="w-7 h-7 text-white" />
  </div>
  <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Dating Signal Type</h1>
  <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
  8 honest questions. 6 archetypes. A clear picture of your dating style, and what you actually need right now.
  </p>
  </div>

  <div className="glass border border-white/8 rounded-2xl p-5 space-y-3">
  {[
  "Takes under 3 minutes",
  "No sign-up required",
  "Inclusive across all dating styles and identities",
  "Your results point you to the right next tool",
  ].map((item, i) => (
  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
  <div className="w-4 h-4 rounded-full bg-[hsl(142_55%_60%/0.15)] flex items-center justify-center flex-shrink-0">
  <Check className="w-2.5 h-2.5 text-[hsl(142_55%_60%)]" />
  </div>
  {item}
  </div>
  ))}
  </div>

  <Button onClick={() => setStep("quiz")}
  className="w-full h-12 rounded-full font-semibold bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] border-0 text-white glow-pulse">
  Start the quiz <ArrowRight className="ml-2 h-4 w-4" />
  </Button>

  <p className="text-center text-xs text-muted-foreground/40">
  Already know your type?{" "}
  <Link href="/signal-check" className="underline hover:text-muted-foreground">Run the full Signal Check →</Link>
  </p>
  </motion.div>
  )}

  {step === "quiz" && (
  <motion.div key={`q-${qIdx}`} {...fadeUp(0)} className="space-y-5">
  {/* Progress */}
  <div className="flex items-center gap-3">
  <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
  <motion.div
  className="h-full rounded-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)]"
  animate={{ width: `${progress * 100}%` }}
  transition={{ duration: 0.4 }}
  />
  </div>
  <span className="text-xs text-muted-foreground/40 tabular-nums">{qIdx + 1} / {QUESTIONS.length}</span>
  </div>

  {/* Question */}
  <div className="glass border border-white/8 rounded-2xl p-6 space-y-5">
  <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
  {QUESTIONS[qIdx].q}
  </h2>
  {QUESTIONS[qIdx].note && (
  <p className="text-xs text-muted-foreground/50 italic">{QUESTIONS[qIdx].note}</p>
  )}
  <div className="space-y-2.5">
  {QUESTIONS[qIdx].options.map((opt, i) => (
  <button
  key={i}
  onClick={() => selectOption(i)}
  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-all leading-snug ${
  selected === i
  ? "border-[hsl(248_62%_52%/0.6)] bg-[hsl(248_62%_52%/0.12)] text-foreground"
  : "border-white/8 text-muted-foreground hover:border-white/20 hover:text-foreground hover:bg-white/3"
  }`}
  >
  {opt.label}
  </button>
  ))}
  </div>
  </div>

  <Button
  onClick={next}
  disabled={selected === null}
  className="w-full h-11 rounded-full font-semibold bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] border-0 disabled:opacity-40"
  >
  {qIdx < QUESTIONS.length - 1 ? "Next →" : "See my type →"}
  </Button>
  </motion.div>
  )}

  {step === "result" && archetype && (
  <motion.div key="result" {...fadeUp(0)} className="space-y-4">
  {/* Hero card */}
  <div className="glass border border-white/8 rounded-3xl p-7 text-center space-y-4"
  style={{ boxShadow: `0 0 60px ${withAlpha(archetype.color, 0.15)}` }}>
  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
  style={{ background: archetype.bg }}>
  <Glyph name={archetype.icon} className="w-8 h-8" color={archetype.color} />
  </div>
  <div>
  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: archetype.color }}>Your Dating Signal Type</p>
  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{archetype.name}</h2>
  <p className="text-sm text-muted-foreground mt-1.5 italic">"{archetype.tagline}"</p>
  </div>
  <p className="text-sm text-muted-foreground leading-relaxed text-left">
  {archetype.description}
  </p>
  </div>

  {/* Strengths + edges */}
  <div className="grid sm:grid-cols-2 gap-3">
  <div className="glass border border-white/8 rounded-2xl p-5">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Your strengths</p>
  <div className="space-y-1.5">
  {archetype.strengths.map((s, i) => (
  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: archetype.color }} />
  {s}
  </div>
  ))}
  </div>
  </div>
  <div className="glass border border-white/8 rounded-2xl p-5">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Worth watching</p>
  <div className="space-y-1.5">
  {archetype.edges.map((e, i) => (
  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "hsl(var(--brand-gold))" }} />
  {e}
  </div>
  ))}
  </div>
  </div>
  </div>

  {/* What you need */}
  <div className="rounded-2xl border p-5" style={{ borderColor: withAlpha(archetype.color, 0.25), background: archetype.bg }}>
  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: archetype.color }}>What you actually need</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{archetype.whatYouNeed}</p>
  </div>

  {/* CTA */}
  <Button onClick={() => navigate(archetype.cta.href)}
  className="w-full h-12 rounded-full font-semibold border-0"
  style={{ background: `linear-gradient(135deg, ${archetype.color}, hsl(var(--brand-indigo)))` }}>
  {archetype.cta.label}
  </Button>

  {/* Share + retry */}
  <div className="flex items-center justify-center gap-4">
  <button onClick={share}
  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
  {shared ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Share2 className="w-3.5 h-3.5" />}
  {shared ? "Copied!" : "Share my result"}
  </button>
  <span className="text-white/15">·</span>
  <button onClick={restart}
  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
  <RefreshCw className="w-3.5 h-3.5" /> Retake quiz
  </button>
  </div>

  {/* Upsell strip */}
  <div className="glass border border-white/8 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
  <div className="flex-1">
  <p className="text-sm font-semibold text-foreground">Want the full picture?</p>
  <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">The free Signal Check audits your actual profile and gives you a scored breakdown, not just your type.</p>
  </div>
  <Link href="/signal-check"
  className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold bg-white/8 border border-white/10 hover:bg-white/12 transition-colors text-foreground">
  Free Signal Check →
  </Link>
  </div>
  </motion.div>
  )}

  </AnimatePresence>
  </div>
  </div>
  </AppLayout>
  );
}