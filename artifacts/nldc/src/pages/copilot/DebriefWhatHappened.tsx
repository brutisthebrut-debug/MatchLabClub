import { useRef, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { ToolHandoff } from "@/components/ToolHandoff";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  useEnhanceAi,
  useCreatePostDateNote,
  PostDateOutcome,
} from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { Heart, Loader2, Sparkles, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const FELT_GOOD_CHIPS = ["Good chemistry", "Easy conversation", "Mutual curiosity", "Real connection", "I felt like myself", "They were engaged", "Physical attraction"];
const FELT_OFF_CHIPS = ["Forced conversation", "Felt one-sided", "Wasn't present", "Mixed signals", "Felt judged", "Too much pressure", "Something was off but I can't say what"];
const OUTCOMES = ["We're continuing to talk", "It fizzled naturally", "I ended it", "They ended it", "Still figuring it out", "Just processing, no outcome yet"];

interface DebriefResult {
  patternRead: string;
  coachInsight: string;
  nextStep: { label: string; href: string; action: string };
}

function buildFallback(what: string, feltGood: string[], feltOff: string[], outcome: string): DebriefResult {
  const wasPositive = feltGood.length > feltOff.length;
  const mixedSignals = feltOff.includes("Mixed signals");
  const oneSided = feltOff.includes("Felt one-sided");
  const goodChem = feltGood.includes("Good chemistry") || feltGood.includes("Real connection");
  const selfConsc = feltOff.includes("Felt judged") || feltOff.includes("Too much pressure");

  let patternRead = "";
  if (wasPositive && goodChem) {
  patternRead = "This one had real signal, the combination of good chemistry and feeling like yourself is worth paying attention to. That doesn't happen by default.";
  } else if (mixedSignals || (!wasPositive && feltGood.length > 0)) {
  patternRead = "The mixed signals you noticed are worth sitting with. When something feels good in some ways and off in others, it usually means one of two things: the timing isn't right, or the fit is real but the circumstances need to change.";
  } else if (oneSided) {
  patternRead = "One-sided conversations are a pattern worth tracking. It can come from nerves on their end, or from a mismatch in how much each person is investing. Either way, it's data, not a verdict.";
  } else if (selfConsc) {
  patternRead = "The feeling of being judged or under pressure usually says more about the environment than about you. Some situations just have that energy, and the right person won't create it.";
  } else if (wasPositive) {
  patternRead = "On balance, this sounds like it went well. The things you noticed going right are the real signal, they're what to look for more of.";
  } else {
  patternRead = "Not every interaction gives you clear signal, and that's fine. Sometimes the most useful debrief is just: what do I want more of? What was missing?";
  }

  const outcomeText = outcome || "still processing";
  const coachInsight = `Outcome: ${outcomeText}. ${
  outcome.includes("continuing") ? "Keep the energy consistent, don't over-invest before you've had more time together." :
  outcome.includes("fizzled") ? "Fading out naturally is normal data. If you wanted it to continue, the question is: what would one direct, low-stakes message have looked like?" :
  outcome.includes("ended it") ? "Knowing what you don't want is as useful as knowing what you do. Note what made you decide." :
  outcome.includes("they ended") ? "When someone else ends it, the instinct is to find what went wrong. Sometimes the answer is: it just wasn't the right match." :
  "Processing without an outcome is completely valid. Give it 24 hours before you decide what (if anything) to do next."
  }`;

  const nextStep = wasPositive && outcome.includes("continuing")
  ? { label: "Message Coach", href: "/coach", action: "Get a coached reply for your next message" }
  : outcome.includes("fizzled") || outcome.includes("ended")
  ? { label: "My Timeline", href: "/progress/timeline", action: "Log this as a pattern note while it's fresh" }
  : { label: "Dating Blueprint", href: "/blueprint", action: "Review what you actually want from a connection" };

  return { patternRead, coachInsight, nextStep };
}

function tryParseAi(raw: string | undefined, fb: DebriefResult): DebriefResult {
  if (!raw) return fb;
  try {
  const p = JSON.parse(raw) as { patternRead?: string; coachInsight?: string; nextStep?: { label?: string; href?: string; action?: string } };
  return {
  patternRead: typeof p.patternRead === "string" && p.patternRead.length > 10 ? p.patternRead : fb.patternRead,
  coachInsight: typeof p.coachInsight === "string" && p.coachInsight.length > 10 ? p.coachInsight : fb.coachInsight,
  nextStep: fb.nextStep,
  };
  } catch { return fb; }
}

export default function DebriefWhatHappened() {
  useMeta("Debrief What Happened", "Reflect on an interaction, identify what felt good or confusing, and choose a clear next step.");
  const [what, setWhat] = useState("");
  const [feltGood, setFeltGood] = useState<string[]>([]);
  const [feltOff, setFeltOff] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [result, setResult] = useState<DebriefResult | null>(null);
  const [step, setStep] = useState(0);
  const enhance = useEnhanceAi();
  const createNote = useCreatePostDateNote();
  const savedRef = useRef(false);

  function mapOutcome(o: string): PostDateOutcome | undefined {
  if (!o) return undefined;
  if (o.includes("continuing")) return PostDateOutcome.another_date;
  if (o.includes("they ended")) return PostDateOutcome.ghosted;
  if (o.includes("ended it") || o.includes("fizzled")) return PostDateOutcome.no_more;
  return PostDateOutcome.unsure;
  }

  function toggleChip(arr: string[], setArr: (a: string[]) => void, v: string) {
  setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  }

  function handleGenerate() {
  const fb = buildFallback(what, feltGood, feltOff, outcome);
  setResult(fb);
  setStep(1);
  if (!savedRef.current) {
  savedRef.current = true;
  const summary = what.trim() || "Debrief captured from chip selections.";
  const mappedOutcome = mapOutcome(outcome);
  createNote.mutate(
  {
  data: {
  summary: summary.slice(0, 20000),
  whatWentWell: feltGood.join(", ").slice(0, 20000),
  whatDidnt: feltOff.join(", ").slice(0, 20000),
...(mappedOutcome ? { outcome: mappedOutcome } : {}),
  },
  },
  {
  onSuccess: (note) => { rememberAnonymousId("postDateNotes", note.id); },
  onError: () => { savedRef.current = false; },
  },
  );
  }
  const prompt = [
  what.trim() && `What happened:\n${what}`,
  feltGood.length > 0 && `What felt good: ${feltGood.join(", ")}`,
  feltOff.length > 0 && `What felt off: ${feltOff.join(", ")}`,
  outcome && `Outcome: ${outcome}`,
  ].filter(Boolean).join("\n\n") +
  `\n\nReturn JSON: { "patternRead": string (2-3 sentences of thoughtful pattern recognition, emotionally intelligent, not prescriptive), "coachInsight": string (1-2 sentences on what to carry forward) }. Tone: warm, direct, honest, like a smart friend who's been in therapy.`;
  enhance.mutate({ data: { toolName: "Debrief", prompt, expectJson: true } }, {
  onSuccess: data => { const raw = (data as { output?: string } | undefined)?.output; setResult(tryParseAi(raw, fb)); },
  });
  }

  function reset() { setResult(null); setWhat(""); setFeltGood([]); setFeltOff([]); setOutcome(""); setStep(0); enhance.reset(); savedRef.current = false; }

  const show = result ?? buildFallback("", [], [], "");
  const canGenerate = what.trim().length > 0 || feltGood.length > 0 || feltOff.length > 0;

  return (
  <AppLayout>
  <HubTabs hub="journal" />
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-rose fixed w-[360px] h-[360px] -top-10 -right-10 opacity-20 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">

  <motion.div {...fadeUp(0)} className="mb-6">
  <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
  <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
  </Link>
  </motion.div>

  <motion.div {...fadeUp(0.03)} className="mb-6">
  <div className="flex items-center gap-2 mb-2">
  <Heart className="w-4 h-4 text-[hsl(348_55%_65%)]" />
  <p className="text-sm font-medium text-[hsl(348_55%_75%)]">Wingman Studio</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">Debrief What Happened</h1>
  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
  Capture what felt good or confusing while it's fresh. Get a pattern read and a suggested next step.
  </p>
  </motion.div>

  <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-6">
  {[0, 1].map(s => (
  <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(348_55%_65%)]" : "w-6 bg-white/10"}`} />
  ))}
  <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
  </motion.div>

  <AnimatePresence mode="wait">
  {step === 0 ? (
  <motion.div key="form" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-5">
  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
  What happened? <span className="font-normal normal-case text-muted-foreground/40">(brief, a date, a conversation, a message exchange)</span>
  </Label>
  <Textarea value={what} onChange={e => setWhat(e.target.value)}
  placeholder="We met for coffee. First 30 min was a bit awkward, then it opened up. Talked about work and travel. She seemed engaged but I couldn't tell if she was interested or just being polite."
  className="min-h-[110px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
  </div>

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What felt good? <span className="font-normal normal-case text-muted-foreground/40">(pick all that apply)</span></Label>
  <div className="flex flex-wrap gap-2">
  {FELT_GOOD_CHIPS.map(c => (
  <button key={c} onClick={() => toggleChip(feltGood, setFeltGood, c)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${feltGood.includes(c) ? "bg-[hsl(142_55%_60%/0.2)] text-[hsl(142_55%_75%)] border-[hsl(142_55%_60%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
  {c}
  </button>
  ))}
  </div>
  </div>

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What felt off or confusing? <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {FELT_OFF_CHIPS.map(c => (
  <button key={c} onClick={() => toggleChip(feltOff, setFeltOff, c)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${feltOff.includes(c) ? "bg-[hsl(348_55%_65%/0.2)] text-[hsl(348_55%_80%)] border-[hsl(348_55%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
  {c}
  </button>
  ))}
  </div>
  </div>

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">How did it end up? <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {OUTCOMES.map(o => (
  <button key={o} onClick={() => setOutcome(prev => prev === o ? "" : o)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${outcome === o ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)] border-[hsl(248_62%_52%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
  {o}
  </button>
  ))}
  </div>
  </div>

  <Button onClick={handleGenerate} disabled={!canGenerate}
  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(348_55%_60%)] to-[hsl(248_62%_55%)] border-0 glow-pulse disabled:opacity-50">
  <Sparkles className="mr-2 h-4 w-4" /> Get My Debrief
  </Button>
  </motion.div>
  ) : (
  <motion.div key="results" {...fadeUp(0.05)} className="space-y-4">
  {enhance.isPending && (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(348_55%_65%/0.08)] border border-[hsl(348_55%_65%/0.2)] text-xs text-[hsl(348_55%_75%)]">
  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wingman is reading the pattern…
  </div>
  )}

  <div className="glass border border-white/8 rounded-2xl p-5 sm:p-6">
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Pattern read</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{show.patternRead}</p>
  </div>

  <div className="glass border border-white/8 rounded-2xl p-5 sm:p-6">
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Coaching note</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{show.coachInsight}</p>
  </div>

  <div className="rounded-2xl border border-[hsl(348_55%_65%/0.2)] bg-[hsl(348_55%_65%/0.06)] p-5">
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(348_55%_65%)] mb-2">Suggested next step</p>
  <p className="text-sm text-muted-foreground mb-3">{show.nextStep.action}</p>
  <Link href={show.nextStep.href}
  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(348_55%_75%)] hover:text-[hsl(348_55%_88%)] transition-colors">
  {show.nextStep.label} <ArrowRight className="w-3.5 h-3.5" />
  </Link>
  </div>

  <ToolHandoff
  testId="debrief-handoff"
  fedLine="Your debrief is saved as a post-date note, so the machine learns what you seek versus what you actually find. Keep the picture honest."
  steps={[
  { label: "See your dates", href: "/mirror/dates", desc: "Track the pattern across your debriefs." },
  { label: "Read your patterns", href: "/insights", desc: "See the communication style underneath." },
  { label: "Check your readiness", href: "/me", desc: "Watch your Match Readiness climb." },
  ]}
  />

  <div className="flex justify-center">
  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
  <RefreshCw className="w-3.5 h-3.5" /> New debrief
  </button>
  </div>
  </motion.div>
  )}
  </AnimatePresence>
  </div>
  </div>
  </AppLayout>
  );
}
