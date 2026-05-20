import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, RefreshCw, Copy, Check, AlertCircle, Heart } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useSavedContext } from "@/hooks/useSavedContext";
import { SavedContextChip } from "@/components/SavedContextChip";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const FELT_BEFORE = ["Excited / hopeful", "Anxious / nervous", "Calm / easy", "Uncertain but curious", "Detached / going through the motions"];
const DURING_FEEL = ["Like myself — relaxed and real", "A bit performed / on", "Awkward at first, then better", "Good in moments, off in others", "Not quite like myself throughout"];
const MUTUAL_FEEL = ["Yes — effort and interest felt balanced", "I put in more", "They put in more", "Hard to tell — both guarded", "No — it felt one-sided"];
const AFTERWARD = ["They reached out", "I reached out", "We both did", "Nothing yet", "It went quiet / faded"];
const WANT_NEXT = ["Pursue — I want to see where this goes", "One more interaction to decide", "Take space and reassess", "Let it go gracefully", "Still figuring it out"];

interface ReflectionResult {
  positiveSigns: string[];
  cautionSigns: string[];
  patternShowing: string;
  recommendedNextStep: string;
  suggestedNote: string;
  recommendation: "pursue" | "pause" | "pass";
  recommendationNote: string;
}

function analyzeReflection(
  before: string, during: string, mutual: string,
  afterward: string, wantNext: string, notes: string
): ReflectionResult {
  const lower = notes.toLowerCase();
  const isPursueing = wantNext === WANT_NEXT[0];
  const isPausing = wantNext === WANT_NEXT[1] || wantNext === WANT_NEXT[2];
  const isPassing = wantNext === WANT_NEXT[3];
  const feltLikeMyself = during === DURING_FEEL[0];
  const feltBalanced = mutual === MUTUAL_FEEL[0];
  const theyReached = afterward === AFTERWARD[0];
  const bothReached = afterward === AFTERWARD[2];
  const wentQuiet = afterward === AFTERWARD[4];
  const anxiousBefore = before === FELT_BEFORE[1];
  const excitedBefore = before === FELT_BEFORE[0];
  const putInMore = mutual === MUTUAL_FEEL[1];
  const theyPutInMore = mutual === MUTUAL_FEEL[2];

  const positives: string[] = [];
  const cautions: string[] = [];

  if (excitedBefore) positives.push("You felt genuine anticipation beforehand — that's your nervous system registering something real, not just anxiety.");
  if (feltLikeMyself) positives.push("You felt like yourself during — this matters more than most people realize. It means the context was safe enough to stop performing.");
  if (feltBalanced) positives.push("The effort felt mutual — both people were bringing something. This is the baseline for anything worth pursuing.");
  if (theyReached) positives.push("They reached out afterward, which is a clear signal of interest. It's a small action, but it removes ambiguity.");
  if (bothReached) positives.push("You both reached out, which suggests real mutual pull without anyone feeling like they're chasing.");
  if (theyPutInMore) positives.push("They were investing more than you — which either means they're genuinely interested, or they're further along in deciding. Worth noticing.");
  if (lower.includes("laugh") || lower.includes("fun") || lower.includes("easy")) positives.push("Something about it felt easy or fun — the best connections tend to feel simple, not effortful.");
  if (lower.includes("honest") || lower.includes("real") || lower.includes("genuine")) positives.push("Something honest or real happened — those moments are worth paying attention to. They're where actual connection lives.");

  if (anxiousBefore) cautions.push("You went in anxious, which can shape the whole interaction. Anxiety is information — worth asking whether it was about this person specifically or about dating in general.");
  if (!feltLikeMyself) cautions.push("You didn't quite feel like yourself. That's worth tracking — it might be nerves, or it might be a signal that the dynamic isn't quite right for you yet.");
  if (putInMore) cautions.push("You put in noticeably more effort. Early asymmetry is normal; consistent asymmetry is data. One more data point would help clarify the pattern.");
  if (wentQuiet) cautions.push("It's gone quiet afterward. This doesn't necessarily mean it's over — but it means someone needs to move, and the quality of that move matters.");
  if (positives.length === 0) cautions.push("Nothing is standing out as clearly positive — which may mean the connection needs more time, or may mean it's not quite right. More information would help.");
  if (during === DURING_FEEL[1]) cautions.push("You felt like you were performing — which is exhausting and signals that the 'safe to be real' threshold hasn't been crossed yet. That can change with time or context.");

  if (positives.length === 0) positives.push("You showed up. That counts. Sometimes the most useful output from an interaction is information about what you do and don't want.");

  const patternIndex = anxiousBefore && putInMore ? 0 : !feltLikeMyself ? 1 : wentQuiet ? 2 : excitedBefore && feltLikeMyself ? 3 : 4;
  const patterns = [
    "An anxious-investment pattern may be showing up — going in nervous and then over-giving to compensate. The giving comes from a good place; the question is whether it's coming from genuine enthusiasm or from managing the anxiety.",
    "A performance pattern may be showing up — showing up as a slightly managed version of yourself rather than the real thing. This often means the situation doesn't feel safe enough yet, or that a people-pleasing instinct is running.",
    "A drift-and-fade pattern: real momentum at the time, then things go quiet, and neither person makes a clear move. Someone who cares needs to be the one to break it.",
    "This looks like a genuinely good interaction — you felt like yourself, there was real energy, and the follow-through was clean. The pattern here is the one you want: mutual, real, low-drama.",
    "The picture here is mixed — enough positive to be interesting, enough uncertain to warrant more information before deciding. That's not a bad place to be.",
  ];

  const nextSteps = [
    "Give it 24-48 hours and then reach out with something specific and low-stakes — a reference to something from the conversation, not a 'hey.' Keep it short. The goal is to restart the thread, not to make a declaration.",
    "One more interaction in a slightly lower-stakes context would give you cleaner information. A walk, a coffee, something that doesn't have the pressure of a 'real date.' See who shows up when the stakes are lighter.",
    "You don't need to make a decision right now. If it's gone quiet and you're uncertain, let it sit for a week and see whether you still care. The answer is usually in whether you think about it.",
    "If you want to pursue this, a clear and warm message now would move things forward. You have enough positive signal to act on.",
    "The clearest next step is getting more information — which means one more genuine interaction. Decide after that.",
  ];

  const notes_ = [
    "Hey — I keep thinking about [specific thing from the conversation]. Made me want to reach back out.",
    "I had a really good time the other day. Want to [low-stakes activity] sometime this week?",
    "I've been a bit in my head since — in a good way. Would you want to meet again?",
    "I'd love to see you again. Are you free [specific day]?",
    "Just wanted to check in — I had a good time and didn't want things to go quiet without saying so.",
  ];

  let rec: "pursue" | "pause" | "pass" = "pause";
  let recNote = "";
  if (isPassing) { rec = "pass"; recNote = "You already know. Trust that. A graceful, kind close is a dignified move — for both people."; }
  else if (positives.length >= 3 && (feltLikeMyself || feltBalanced)) { rec = "pursue"; recNote = "The signals here are strong enough to act on. The cost of reaching out is almost always lower than the cost of wondering."; }
  else if (wentQuiet && putInMore) { rec = "pause"; recNote = "Give the space a bit more time and watch what happens. Clarity tends to arrive when you stop filling the gap."; }
  else if (feltLikeMyself && (theyReached || bothReached)) { rec = "pursue"; recNote = "You felt like yourself and they followed up — that's the combination. Act on it."; }
  else { rec = "pause"; recNote = "More information would help. One more interaction in a lower-stakes context would give you a cleaner read."; }

  return {
    positiveSigns: positives.slice(0, 4),
    cautionSigns: cautions.slice(0, 3),
    patternShowing: patterns[patternIndex],
    recommendedNextStep: nextSteps[patternIndex],
    suggestedNote: notes_[patternIndex],
    recommendation: rec,
    recommendationNote: recNote,
  };
}

const DEMO: ReflectionResult = {
  positiveSigns: [
    "You felt genuine anticipation beforehand — your nervous system registered something real.",
    "You felt like yourself during — the context was safe enough to stop performing.",
    "The effort felt mutual — both people were bringing something.",
    "They reached out afterward, which removes the ambiguity.",
  ],
  cautionSigns: [
    "You went in anxious — worth asking whether that was about this person or about dating in general.",
    "You felt performed in moments — the 'safe to be real' threshold may not be fully crossed yet.",
  ],
  patternShowing: "This looks like a genuinely good interaction — you felt like yourself, there was real energy, and the follow-through was clean. The pattern here is the one you want: mutual, real, low-drama.",
  recommendedNextStep: "If you want to pursue this, a clear and warm message now would move things forward. You have enough positive signal to act on.",
  suggestedNote: "I'd love to see you again. Are you free [specific day]?",
  recommendation: "pursue",
  recommendationNote: "The signals here are strong enough to act on. The cost of reaching out is almost always lower than the cost of wondering.",
};

const STEP_LABELS = ["Before", "During", "Mutual?", "Afterward", "You want"];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const REC_STYLES = {
  pursue: { label: "Pursue", color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.1)", border: "hsl(142 55% 60% / 0.25)" },
  pause:  { label: "Pause",  color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.1)",  border: "hsl(43 65% 65% / 0.25)"  },
  pass:   { label: "Pass",   color: "hsl(228 18% 60%)", bg: "hsl(228 18% 60% / 0.1)", border: "hsl(228 18% 60% / 0.25)" },
};

export default function Reflection() {
  useMeta("Post-Meeting Reflection", "Process how a date or connection felt — get a pattern read, positive signs, caution notes, a suggested next message, and a pursue/pause/pass recommendation.");
  const [before, setBefore] = useState("");
  const [during, setDuring] = useState("");
  const [mutual, setMutual] = useState("");
  const [afterward, setAfterward] = useState("");
  const [wantNext, setWantNext] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ReflectionResult | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;
  const savedCtx = useSavedContext();

  const canSubmit = before && during && mutual && afterward;

  function tryParseReflection(raw: string, deterministic: ReflectionResult): ReflectionResult | null {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        positiveSigns?: unknown;
        cautionSigns?: unknown;
        patternShowing?: unknown;
        recommendedNextStep?: unknown;
        suggestedNote?: unknown;
        recommendationNote?: unknown;
      };
      const asStrArr = (v: unknown, min: number, max: number): string[] | null => {
        if (!Array.isArray(v)) return null;
        const arr = v.filter((x): x is string => typeof x === "string" && x.trim().length >= 15).map(s => s.trim());
        if (arr.length < min) return null;
        return arr.slice(0, max);
      };
      const asStr = (v: unknown, minLen: number): string | null =>
        typeof v === "string" && v.trim().length >= minLen ? v.trim() : null;
      const positiveSigns = asStrArr(parsed.positiveSigns, 1, 4);
      const cautionSigns = Array.isArray(parsed.cautionSigns)
        ? parsed.cautionSigns.filter((x): x is string => typeof x === "string" && x.trim().length >= 15).map(s => s.trim()).slice(0, 3)
        : null;
      const patternShowing = asStr(parsed.patternShowing, 30);
      const recommendedNextStep = asStr(parsed.recommendedNextStep, 30);
      const suggestedNote = asStr(parsed.suggestedNote, 10);
      const recommendationNote = asStr(parsed.recommendationNote, 20);
      if (!positiveSigns || cautionSigns === null || !patternShowing || !recommendedNextStep || !suggestedNote || !recommendationNote) return null;
      return {
        positiveSigns,
        cautionSigns,
        patternShowing,
        recommendedNextStep,
        suggestedNote,
        recommendation: deterministic.recommendation,
        recommendationNote,
      };
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!canSubmit) return;
    const deterministic = analyzeReflection(before, during, mutual, afterward, wantNext, notes);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Post-Meeting Reflection",
          prompt: [
            "Reflect on this dating interaction. Return ONLY a single JSON object:",
            '{ "positiveSigns": string[], "cautionSigns": string[], "patternShowing": string, "recommendedNextStep": string, "suggestedNote": string, "recommendationNote": string }',
            "positiveSigns: 2-4 specific observations (each 1-2 sentences).",
            "cautionSigns: 0-3 specific observations worth noting (each 1-2 sentences).",
            "patternShowing: 2-3 sentences naming the underlying pattern.",
            "recommendedNextStep: 2-3 sentences of concrete next move.",
            "suggestedNote: a copy-ready message (1-2 sentences) if they reach out.",
            "recommendationNote: 1-2 sentences explaining the recommendation.",
            "",
            `Before the date: ${before}`,
            `During: ${during}`,
            `Mutual feel: ${mutual}`,
            `Afterward: ${afterward}`,
            wantNext ? `What they want next: ${wantNext}` : "",
            notes.trim() ? `Notes: ${notes}` : "",
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].filter(Boolean).join("\n"),
          context: {
            toolName: "Post-Meeting Reflection",
            formValues: { before, during, mutual, afterward, wantNext, notes },
          },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        setResult(deterministic);
        return;
      }
      const parsed = tryParseReflection(ai.output, deterministic);
      setUsedFallback(parsed == null);
      setResult(parsed ?? deterministic);
    } catch {
      setUsedFallback(true);
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO;
  const isDemo = !result;
  const recStyle = REC_STYLES[show.recommendation];

  function ChipGroup({ opts, value, onSelect }: { opts: string[]; value: string; onSelect: (v: string) => void }) {
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map(o => (
          <button key={o} onClick={() => onSelect(value === o ? "" : o)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${value === o ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
            {o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] top-10 -right-20 opacity-25 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-[hsl(348_55%_65%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Meeting Reflection</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Post-Meeting Reflection</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <FallbackRateBadge toolName="Post-Meeting Reflection" />
              {!isBrandNewUser && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Using your saved profile
                </span>
              )}
            </div>

            <p className="text-muted-foreground mt-2">Process how it felt, get a pattern read, and decide what's next — with a suggested message if you want one.</p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Heart className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Post-Meeting Reflection"
              title="Process your next connection"
              description="After a date or call, jot down what happened and how it felt. We'll surface the signals worth paying attention to and a suggested next move."
              testId="reflection-empty-state"
            />
          )}

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-6 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Before the date, you felt…</Label>
              <ChipGroup opts={FELT_BEFORE} value={before} onSelect={setBefore} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">During, you felt…</Label>
              <ChipGroup opts={DURING_FEEL} value={during} onSelect={setDuring} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Did interest and effort feel mutual?</Label>
              <ChipGroup opts={MUTUAL_FEEL} value={mutual} onSelect={setMutual} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What happened afterward?</Label>
              <ChipGroup opts={AFTERWARD} value={afterward} onSelect={setAfterward} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you want next?</Label>
              <ChipGroup opts={WANT_NEXT} value={wantNext} onSelect={setWantNext} />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Anything else worth noting? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <Textarea placeholder="Any specific moments, things they said, how you felt driving home, or anything that stuck with you…"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="min-h-[80px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !canSubmit}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading the signals…</> : <><Sparkles className="mr-2 h-4 w-4" />Get My Reflection</>}
            </Button>
            {savedCtx.hasSavedContext && (
              <SavedContextChip summary={savedCtx.summary} className="justify-center" />
            )}
          </motion.div>

          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example output — complete the form above to get yours
                  </p>
                </div>
              )}
              {!isDemo && usedFallback && (
                <FallbackNotice
                  onRetry={handleAnalyze}
                  loading={loading}
                  label="reflection"
                  testId="button-retry-reflection"
                />
              )}
              <div className="space-y-4">
                {/* Recommendation */}
                <div className="rounded-2xl p-6 border flex items-start gap-4" style={{ background: recStyle.bg, borderColor: recStyle.border }}>
                  <div className="px-4 py-2 rounded-full text-sm font-bold flex-shrink-0" style={{ background: recStyle.bg, color: recStyle.color, border: `1px solid ${recStyle.border}` }}>
                    {recStyle.label}
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{show.recommendationNote}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Positive Signs */}
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)]" />Positive signs
                    </p>
                    <ul className="space-y-2.5">
                      {show.positiveSigns.map((s, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{s}</li>)}
                    </ul>
                  </div>
                  {/* Caution Signs */}
                  <div className="glass border border-white/8 rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[hsl(43_65%_65%)]" />Worth noting
                    </p>
                    {show.cautionSigns.length > 0 ? (
                      <ul className="space-y-2.5">
                        {show.cautionSigns.map((s, i) => <li key={i} className="text-xs text-muted-foreground leading-relaxed">{s}</li>)}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">Nothing concerning stands out here.</p>}
                  </div>
                </div>

                {/* Pattern */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-2">Pattern showing up</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.patternShowing}</p>
                </div>

                {/* Next Step */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-2">Recommended next step</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.recommendedNextStep}</p>
                </div>

                {/* Suggested Note */}
                <div className="glass border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-foreground text-sm">If you reach out — suggested message</p>
                    <CopyBtn text={show.suggestedNote} />
                  </div>
                  <div className="bg-[hsl(268_52%_68%/0.08)] border border-[hsl(268_52%_68%/0.2)] rounded-xl px-4 py-3">
                    <p className="text-sm text-foreground/80 italic">"{show.suggestedNote}"</p>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-2">Customize before sending — make it specific to your actual conversation.</p>
                </div>
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setBefore(""); setDuring(""); setMutual(""); setAfterward(""); setWantNext(""); setNotes(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Reflect on another
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
