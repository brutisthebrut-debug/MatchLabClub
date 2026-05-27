import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useEnhanceAi } from "@workspace/api-client-react";
import { Calendar, Copy, Check, Loader2, Sparkles, RefreshCw, ArrowLeft } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const VENUE_TYPES = ["Coffee / daytime", "Drinks / evening", "Dinner", "Walk / outdoor", "Activity", "Virtual first"];
const INTENTIONS  = ["Get to know them properly", "See if there's real chemistry", "Keep it relaxed and fun", "Decide if I want to continue", "It's early — staying open"];
const KNOW_CHIPS  = ["Their job / career", "Shared interests", "How they communicate", "Something personal they shared", "Mutual friend connection", "Not much yet"];

interface PrepCard {
  mindset:    string;
  questions:  string[];
  toRemember: string[];
  followUp:   string;
}

function buildFallback(venue: string, knowChips: string[], intention: string, notes: string): PrepCard {
  const isEarly    = intention.toLowerCase().includes("open") || intention.toLowerCase().includes("relaxed");
  const isDinner   = venue.toLowerCase().includes("dinner");
  const isActivity = venue.toLowerCase().includes("activity") || venue.toLowerCase().includes("walk");
  const hasContext = knowChips.length > 0 || notes.trim().length > 0;

  const mindset = isEarly
    ? "Go in curious, not evaluative. You don't need to decide anything today — your job is to be genuinely present and see what emerges naturally."
    : intention.includes("chemistry")
    ? "Pay attention to how you feel during the pauses, not just when conversation flows. Chemistry usually shows up in the gaps."
    : "You already know you like them enough to show up. The pressure's off — this is just two people finding out if what's been good on a screen is good in person too.";

  const questions: string[] = [];
  if (knowChips.includes("Their job / career")) {
    questions.push("What's the part of your work that surprises people when you describe it?");
  } else {
    questions.push("What are you working on right now that's actually interesting to you — work or otherwise?");
  }
  if (knowChips.includes("Shared interests")) {
    questions.push("What's the last thing you did related to [shared interest] that you were genuinely excited about?");
  } else {
    questions.push("What's something you've been really into lately that most people in your life don't share?");
  }
  if (knowChips.includes("Something personal they shared")) {
    questions.push("You mentioned [thing they shared] — I'd love to hear more about that if you're up for it.");
  } else {
    questions.push("What does a weekend look like when it actually goes the way you want it to?");
  }
  questions.push("What made you try [app / venue / this thing] — what were you actually hoping to find?");

  const toRemember: string[] = [];
  toRemember.push("Silence is fine. Not every pause needs filling.");
  if (isDinner) toRemember.push("Dinner dates have more unstructured time — go in with 2-3 topics you genuinely want to explore, not a list to get through.");
  if (isActivity) toRemember.push("Activity dates lower the pressure of direct eye contact — let the activity carry some of the conversation.");
  if (hasContext) toRemember.push("You know a bit about them already — reference something specific from your conversations. It signals you were paying attention.");
  toRemember.push("Be the person you are when you're most comfortable. The version of you that's trying is less magnetic than the version that's just present.");

  const followUp = intention.includes("continue") || intention.includes("chemistry")
    ? "If it went well: send a short message within 24 hours referencing something specific from the date — not 'I had a great time' but one actual moment."
    : "After: give yourself 30 minutes before deciding what you think. First impressions can be colored by nerves from both sides.";

  return { mindset, questions, toRemember, followUp };
}

function tryParseAi(raw: string | undefined, fb: PrepCard): PrepCard {
  if (!raw) return fb;
  try {
    const p = JSON.parse(raw) as { mindset?: string; questions?: unknown[]; toRemember?: unknown[]; followUp?: string };
    return {
      mindset:    typeof p.mindset    === "string" && p.mindset.length    > 10 ? p.mindset    : fb.mindset,
      questions:  Array.isArray(p.questions)  ? (p.questions  as string[]).filter(q => typeof q === "string" && q.length > 5).slice(0, 5) : fb.questions,
      toRemember: Array.isArray(p.toRemember) ? (p.toRemember as string[]).filter(r => typeof r === "string" && r.length > 5).slice(0, 5) : fb.toRemember,
      followUp:   typeof p.followUp   === "string" && p.followUp.length   > 10 ? p.followUp   : fb.followUp,
    };
  } catch { return fb; }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast({ title: "Copied!" }); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs font-medium transition-colors flex-shrink-0"
      style={{ color: copied ? "hsl(var(--brand-green))" : undefined }}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={copied ? "" : "text-muted-foreground"}>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function PrepareForDate() {
  useMeta("Prepare for a Date", "Get a practical prep card — mindset, questions to ask, things to remember, and a follow-up plan.");
  const [venue,     setVenue]     = useState("");
  const [knowChips, setKnowChips] = useState<string[]>([]);
  const [intention, setIntention] = useState("");
  const [notes,     setNotes]     = useState("");
  const [result,    setResult]    = useState<PrepCard | null>(null);
  const [step,      setStep]      = useState(0);
  const enhance = useEnhanceAi();

  function toggleChip(v: string) {
    setKnowChips(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function handleGenerate() {
    const fb = buildFallback(venue, knowChips, intention, notes);
    setResult(fb); setStep(1);
    const prompt = [
      venue         && `Venue: ${venue}`,
      knowChips.length > 0 && `What I know about them: ${knowChips.join(", ")}`,
      intention     && `My intention: ${intention}`,
      notes.trim()  && `Additional context: ${notes}`,
    ].filter(Boolean).join("\n") +
    `\n\nReturn JSON: { "mindset": string (2-3 sentences — practical, warm, not generic), "questions": string[] (4 specific conversation questions), "toRemember": string[] (3-4 practical reminders), "followUp": string (1-2 sentence follow-up guidance) }. Avoid clichés. Make it feel like advice from a smart friend.`;
    enhance.mutate({ data: { toolName: "Prepare for a Date", prompt, expectJson: true } }, {
      onSuccess: data => { const raw = (data as { output?: string } | undefined)?.output; setResult(tryParseAi(raw, fb)); },
    });
  }

  function reset() { setResult(null); setVenue(""); setKnowChips([]); setIntention(""); setNotes(""); setStep(0); enhance.reset(); }

  const show = result ?? buildFallback("", [], "", "");
  const canGenerate = venue || intention || knowChips.length > 0;

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
              <Calendar className="w-4 h-4 text-[hsl(326_100%_65%)]" />
              <p className="text-sm font-medium text-[hsl(326_100%_75%)]">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Prepare for a Date</h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              A practical prep card — mindset, questions, things to remember, and a follow-up plan.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-6">
            {[0, 1].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(326_100%_65%)]" : "w-6 bg-white/10"}`} />
            ))}
            <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="form" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Type of date</Label>
                  <div className="flex flex-wrap gap-2">
                    {VENUE_TYPES.map(v => (
                      <button key={v} onClick={() => setVenue(prev => prev === v ? "" : v)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${venue === v ? "bg-[hsl(326_100%_65%/0.2)] text-[hsl(326_100%_80%)] border-[hsl(326_100%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you already know about them?</Label>
                  <div className="flex flex-wrap gap-2">
                    {KNOW_CHIPS.map(k => (
                      <button key={k} onClick={() => toggleChip(k)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${knowChips.includes(k) ? "bg-[hsl(326_100%_65%/0.2)] text-[hsl(326_100%_80%)] border-[hsl(326_100%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your intention for this date</Label>
                  <div className="flex flex-wrap gap-2">
                    {INTENTIONS.map(i => (
                      <button key={i} onClick={() => setIntention(prev => prev === i ? "" : i)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${intention === i ? "bg-[hsl(326_100%_65%/0.2)] text-[hsl(326_100%_80%)] border-[hsl(326_100%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Anything else to factor in? <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Something they mentioned, a dynamic you've noticed, something you want to bring up…" className="min-h-[80px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
                </div>

                <Button onClick={handleGenerate} disabled={!canGenerate}
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(326_100%_59%)] to-[hsl(248_62%_55%)] border-0 glow-pulse disabled:opacity-50">
                  <Sparkles className="mr-2 h-4 w-4" /> Build My Prep Card
                </Button>
              </motion.div>
            ) : (
              <motion.div key="results" {...fadeUp(0.05)} className="space-y-4">
                {enhance.isPending && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(326_100%_65%/0.08)] border border-[hsl(326_100%_65%/0.2)] text-xs text-[hsl(326_100%_75%)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Wingman is building your prep card…
                  </div>
                )}

                {[
                  { title: "Mindset going in", content: show.mindset, color: "hsl(326 100% 65%)", isList: false },
                ].map(s => (
                  <div key={s.title} className="glass border border-white/8 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">{s.title}</p>
                      <CopyBtn text={s.content} />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                  </div>
                ))}

                <div className="glass border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Questions to ask</p>
                    <CopyBtn text={show.questions.join("\n")} />
                  </div>
                  <div className="space-y-2.5">
                    {show.questions.map((q, i) => (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                        <span className="text-[hsl(326_100%_65%)] font-semibold flex-shrink-0">{i + 1}.</span> {q}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="glass border border-white/8 rounded-2xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Things to remember</p>
                  <div className="space-y-2">
                    {show.toRemember.map((r, i) => (
                      <p key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                        <span className="text-[hsl(326_100%_65%)] flex-shrink-0">·</span> {r}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[hsl(326_100%_65%/0.2)] bg-[hsl(326_100%_65%/0.06)] px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(326_100%_65%)]">Follow-up plan</p>
                    <CopyBtn text={show.followUp} />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.followUp}</p>
                </div>

                <div className="flex justify-center">
                  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> New date prep
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
