import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Compass, RefreshCw, AlertCircle } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const OWN_STYLES = [
  "Spark Chaser — I feel fast and act on it",
  "Slow Burn — I open gradually, invest deeply",
  "Quality Filter — high standards, early assessment",
  "Steady Seeker — consistent, want partnership",
  "Guarded Romantic — want depth, protect myself",
  "Anxious Confirmer — need reassurance, care deeply",
  "Secure Builder — comfortable with intimacy, steady",
  "Intensity Responder — alive in high-stakes moments",
  "Avoidant Editor — need space, withdraw when close",
  "Low-Trust Dater — careful with trust, earned slowly",
  "Not sure yet",
];

const PATTERNS = [
  "Attracted to unavailable people",
  "Great starts that slowly fizzle",
  "Getting close then pulling back (me)",
  "They pull back once I'm invested",
  "Moving too fast",
  "Moving too slow / never getting traction",
  "Attracting emotionally immature people",
  "Relationships that feel intense but unstable",
  "Nothing seems to land",
];

interface CompassResult {
  supportiveTraits: string[];
  commonPull: string;
  cautionDynamics: string[];
  bestDynamic: string;
  nonNegotiables: string[];
  falseSpark: string;
}

function analyzeCompass(ownStyle: string, patterns: string[], notes: string): CompassResult {
  const isSparkChaser = ownStyle.startsWith("Spark");
  const isSlowBurn = ownStyle.startsWith("Slow");
  const isQuality = ownStyle.startsWith("Quality");
  const isSteady = ownStyle.startsWith("Steady");
  const isGuarded = ownStyle.startsWith("Guarded");
  const isAnxious = ownStyle.startsWith("Anxious");
  const isSecure = ownStyle.startsWith("Secure");
  const isIntensity = ownStyle.startsWith("Intensity");
  const isAvoidant = ownStyle.startsWith("Avoidant");
  const isLowTrust = ownStyle.startsWith("Low-Trust");

  const attractsUnavailable = patterns.includes(PATTERNS[0]);
  const fizzles = patterns.includes(PATTERNS[1]);
  const pullsBack = patterns.includes(PATTERNS[2]);
  const theyPullBack = patterns.includes(PATTERNS[3]);
  const tooFast = patterns.includes(PATTERNS[4]);
  const tooSlow = patterns.includes(PATTERNS[5]);

  const supportive: string[][] = [
    isSparkChaser ? ["Calm consistency — someone who holds steady when you're fluctuating", "Enough confidence that they don't require constant attention", "Someone who can match your enthusiasm without mirroring your anxiety"] : [],
    isSlowBurn ? ["Patient enough to let you arrive — not because they're passive, but because they're interested", "Real depth to discover — someone who gets more interesting, not less", "Low-pressure energy early on — they don't need you to perform"] : [],
    isQuality ? ["Someone who can hold their own — you need to respect them to be attracted", "Genuine substance (values, curiosity, self-awareness) over surface-level appeal", "Someone who also has standards — mutual selectivity creates real chemistry"] : [],
    isSteady ? ["Someone who's also genuinely trying — directness and availability should be met with the same", "Emotional reciprocity — they invest as things develop, not just receive", "Clarity about what they want — you're giving that, they should too"] : [],
    isGuarded ? ["Someone who earns trust through consistency, not declarations", "Patience without passivity — they stay interested without requiring you to arrive immediately", "Security in themselves — not someone who needs your openness to feel okay"] : [],
    isAnxious ? ["Someone who communicates clearly and proactively — not someone who makes you guess", "Consistency over time — the same person at day 1 and day 30", "Someone who can tolerate your care without finding it excessive"] : [],
    isSecure ? ["Someone who's doing their own work — matched self-awareness and willingness to grow", "Reciprocal investment — not someone who anchors to your stability without building toward it", "Real emotional presence, not just availability"] : [],
    isIntensity ? ["Someone who can handle your depth without needing to de-escalate it", "Someone with their own intense interior — you need to be met, not managed", "Capacity for both the peaks and the ordinary middle"] : [],
    isAvoidant ? ["Someone who doesn't require frequent reassurance — secure enough not to chase", "Respects your need for space without reading it as rejection", "Patience, without performing patience — it should be natural"] : [],
    isLowTrust ? ["Someone who shows consistency before asking for trust", "Actions that match words — over weeks, not days", "Someone who doesn't require you to open up before they've earned it"] : [],
  ];

  const supportiveTraits = supportive.flat().length > 0
    ? supportive.flat().slice(0, 3)
    : [
        "Someone who shows up consistently rather than intensely",
        "Genuine emotional availability — present, not just accessible",
        "Self-awareness — they understand their own patterns",
      ];

  const commonPulls: Record<string, string> = {
    Spark: "You tend to be pulled toward people who are exciting and slightly unpredictable — because the excitement registers as chemistry. The risk is that excitement and compatibility are different things, and the people who produce the most spark are often the ones with the least to offer over time.",
    Slow: "You tend to be pulled toward depth and substance — and sometimes toward people who seem to have more going on beneath the surface than they actually do. Real depth reveals itself slowly; projected depth is designed to attract.",
    Quality: "You tend to be pulled toward people who seem to meet your standard — high-performing, interesting, self-possessed. The risk is that performance and character aren't the same thing. Someone who looks like the right fit can still be the wrong person.",
    Steady: "You tend to be pulled toward people who seem to want what you want — which means you can overweight early declarations of interest. What someone says they want and what they do when they have it are different data.",
    Guarded: "You tend to be pulled toward people who are slightly out of reach — because they feel safer. If someone is fully available, something in you may question whether they're worth wanting. This is worth examining directly.",
    Anxious: "You tend to be pulled toward people who create just enough uncertainty that you have to work for the connection — because effort feels like love. The cost: the people who require the most work are often the ones who have the least to give.",
    Secure: "You tend to attract people who want your stability more than they want you — and the pull can go toward people who need rescuing or grounding. Watch for whether someone is investing in the relationship or anchoring to your groundedness.",
    Intensity: "You tend to be pulled toward situations that produce the most feeling — beginning energy, conflict, dramatic moments. The risk is that the intensity of the feeling becomes the measure of the connection's worth.",
    Avoidant: "You tend to be pulled toward people who create enough pressure to confirm your need for space, or toward people who are so easygoing they don't challenge your edges at all. Neither produces real growth.",
    "Low-Trust": "You tend to be pulled toward people who feel familiar — and familiar often means repeating a dynamic you already know. Safety and familiarity are not the same thing.",
  };

  const styleKey = ownStyle.split(" ")[0];
  const commonPull = commonPulls[styleKey] || "You tend to be pulled toward intensity and the feeling of chemistry — which is real information, and also not the whole picture. The people who produce the most feeling early on are not always the ones with the most to offer over time.";

  const cautionList: string[] = [];
  if (attractsUnavailable) cautionList.push("Emotionally unavailable people — where the distance creates the pull. Unavailability isn't depth. It's just distance.");
  if (fizzles) cautionList.push("People who are great at the beginning and unclear about the middle — the ones who can generate connection but not sustain it.");
  if (pullsBack || isGuarded || isAvoidant) cautionList.push("Dynamics where you have to manage someone else's discomfort with closeness while managing your own — this is exhausting and unsustainable.");
  if (theyPullBack || isAnxious) cautionList.push("Dynamics where you're consistently pursuing more than you're being pursued. Consistent asymmetry is data, not a temporary phase.");
  if (tooFast || isSparkChaser || isIntensity) cautionList.push("Connections that move very fast at the start — where the early intensity substitutes for the slower work of actually knowing someone.");
  if (cautionList.length === 0) cautionList.push("Dynamics where the exciting early stage doesn't develop into real substance — where chemistry was mistaken for compatibility.");

  const bestDynamics: Record<string, string> = {
    Spark: "Someone who is consistent enough to keep you grounded, interesting enough to keep you engaged, and secure enough not to need your validation. The best dynamic for you is one where the spark deepens into substance — not one where the spark is the whole thing.",
    Slow: "Someone patient enough to let you arrive — ideally someone who is also investing slowly and revealing themselves gradually. Mutual slow-burn dynamics tend to produce the most durable connections. The challenge is that neither person signals interest quickly enough; someone needs to go first.",
    Quality: "Someone who meets your standard and also challenges it slightly. A relationship that's genuinely equal — where you both respect each other's judgment and push each other's thinking. Admiration that goes both directions.",
    Steady: "Someone who matches your investment level naturally — who doesn't need to be chased or managed, who brings what you bring. The best dynamic is one where your consistency is met with equal consistency, not just appreciated and consumed.",
    Guarded: "Someone secure enough not to need you to be open before they've earned it — who earns trust through behavior rather than asking for it. Patience without pressure, investment without demand. This is rarer than it sounds.",
    Anxious: "Someone who communicates proactively and consistently — who doesn't leave you guessing, and who can handle your care without reading it as too much. Secure attachment style on their end tends to be the most stabilizing dynamic for you.",
    Secure: "Someone doing their own work — who isn't looking for stability from you but is building something alongside you. Genuine partnership with mutual investment and matched self-awareness.",
    Intensity: "Someone who can hold depth and be present for the ordinary — who makes the quiet moments feel like something, not just the peaks. The best dynamic for you is one with real emotional range, not just drama.",
    Avoidant: "Someone secure enough not to need frequent reassurance — who can give you space without interpreting it as abandonment, and who respects your need for room without enabling an endless retreat. This person exists; they're just also not going to chase you.",
    "Low-Trust": "Someone who is willing to earn it slowly — who shows up consistently before asking for your openness. Patient, clear, and not offended by your caution. They exist. The work is creating enough of a path for them to reach you.",
  };

  const bestDynamic = bestDynamics[styleKey] || "A dynamic with genuine reciprocity — both people investing, both people honest about what they want, both people willing to do the slower work of actually knowing each other.";

  const nonNegotiables: string[] = [];
  if (isAnxious || isLowTrust) nonNegotiables.push("Consistency — the same person at day 1 and day 30. Inconsistency creates the anxiety loop.");
  if (isGuarded || isAvoidant) nonNegotiables.push("Patience without pressure — someone who stays interested without requiring you to arrive immediately.");
  if (isSparkChaser || isIntensity) nonNegotiables.push("Substance beneath the chemistry — someone who gets more interesting, not less, as you know them better.");
  if (isQuality || isSteady) nonNegotiables.push("Genuine reciprocity — someone who invests at a level that directionally matches yours.");
  if (isSecure || isSlowBurn) nonNegotiables.push("Matched self-awareness — someone doing their own work, not just benefiting from yours.");
  if (nonNegotiables.length === 0) nonNegotiables.push("Genuine presence — someone who's actually there, not performing being there.");
  nonNegotiables.push("Honesty about what they want — declarations are cheap; behavior over time is the real data.");
  nonNegotiables.push("The capacity to handle difficulty without exiting or exploding — relationships are tested in the uncomfortable moments.");

  const falseSparks: Record<string, string> = {
    Spark: "Unavailability mistaken for depth. When someone is just out of reach, it can produce a feeling that reads like intensity — but it's mostly anxiety. Real depth feels different: it settles you, not excites you.",
    Slow: "Intrigue mistaken for compatibility. Someone who seems to have layers — who seems mysterious or complex — can feel like a match for your depth-seeking nature. But mystery that never resolves isn't depth, it's withholding.",
    Quality: "Performance mistaken for character. Someone who presents very well — who is polished, interesting, accomplished — can seem to meet your standard. The filter catches performance before it catches character; give it time.",
    Steady: "Early enthusiasm mistaken for sustained interest. Someone who matches your energy in the first few weeks and then settles into receiving more than they give. The beginning is not the whole picture.",
    Guarded: "Unavailability mistaken for safety. When someone is partially out of reach, it can feel like a more manageable risk — if it doesn't fully develop, it can't fully hurt. The cost: you miss the connections that were actually safe.",
    Anxious: "Relief mistaken for love. When someone who usually produces anxiety suddenly gives you reassurance, the relief can feel like profound connection. It's not — it's the absence of a specific kind of pain.",
    Secure: "Neediness mistaken for passion. When someone is very invested in you very quickly, it can feel like evidence of real chemistry. Sometimes it is. Sometimes it's urgency that has nothing to do with you specifically.",
    Intensity: "Drama mistaken for aliveness. High-conflict, high-emotion dynamics can produce a feeling of being very present and very alive — but the aliveness is from the nervous system activation, not from genuine connection.",
    Avoidant: "Distance mistaken for self-respect. When someone doesn't need you, it can feel like they have something worth wanting. Sometimes they do. Sometimes it's just unavailability with good packaging.",
    "Low-Trust": "Familiarity mistaken for safety. When someone feels familiar — even if familiar means repeating a pattern that's hurt you before — it can register as comfort. Familiarity is not the same as safety.",
  };

  const falseSpark = falseSparks[styleKey] || "Intensity mistaken for compatibility. The feeling of strong early chemistry can overshadow the slower signals — consistency, honesty, reciprocity — that actually predict whether something will last.";

  return { supportiveTraits, commonPull, cautionDynamics: cautionList.slice(0, 3), bestDynamic, nonNegotiables: nonNegotiables.slice(0, 3), falseSpark };
}

const DEMO: CompassResult = {
  supportiveTraits: ["Calm consistency — someone who holds steady when you're fluctuating", "Enough confidence that they don't require constant attention", "Someone who can match your enthusiasm without mirroring your anxiety"],
  commonPull: "You tend to be pulled toward people who are exciting and slightly unpredictable — because the excitement registers as chemistry. The risk is that excitement and compatibility are different things, and the people who produce the most spark are often the ones with the least to offer over time.",
  cautionDynamics: ["Connections that move very fast at the start — where the early intensity substitutes for the slower work of actually knowing someone.", "People who are great at the beginning and unclear about the middle — who can generate connection but not sustain it."],
  bestDynamic: "Someone consistent enough to keep you grounded, interesting enough to keep you engaged, and secure enough not to need your validation. The best dynamic for you is one where the spark deepens into substance — not one where the spark is the whole thing.",
  nonNegotiables: ["Substance beneath the chemistry — someone who gets more interesting, not less", "Genuine reciprocity — both people investing at a comparable level", "Honesty about what they want — declarations are cheap; behavior over time is the real data"],
  falseSpark: "Unavailability mistaken for depth. When someone is just out of reach, it produces a feeling that reads like intensity — but it's mostly anxiety. Real depth feels different: it settles you, not excites you.",
};

export default function CompatibilityCompass() {
  useMeta("Compatibility Compass", "Tell us your connection style and dating patterns. Get supportive traits to look for, caution dynamics, your best-fit dynamic, and the false-spark pattern to watch for.");
  const [ownStyle, setOwnStyle] = useState("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CompassResult | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;

  function togglePattern(p: string) {
    setPatterns(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function tryParseCompass(raw: string): CompassResult | null {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        supportiveTraits?: unknown;
        commonPull?: unknown;
        cautionDynamics?: unknown;
        bestDynamic?: unknown;
        nonNegotiables?: unknown;
        falseSpark?: unknown;
      };
      const asArr = (v: unknown, min: number, max: number, minLen: number): string[] | null => {
        if (!Array.isArray(v)) return null;
        const arr = v.filter((x): x is string => typeof x === "string" && x.trim().length >= minLen).map(s => s.trim());
        if (arr.length < min) return null;
        return arr.slice(0, max);
      };
      const asStr = (v: unknown, minLen: number): string | null =>
        typeof v === "string" && v.trim().length >= minLen ? v.trim() : null;
      const supportiveTraits = asArr(parsed.supportiveTraits, 2, 3, 15);
      const cautionDynamics = asArr(parsed.cautionDynamics, 1, 3, 20);
      const nonNegotiables = asArr(parsed.nonNegotiables, 2, 3, 15);
      const commonPull = asStr(parsed.commonPull, 60);
      const bestDynamic = asStr(parsed.bestDynamic, 60);
      const falseSpark = asStr(parsed.falseSpark, 60);
      if (!supportiveTraits || !cautionDynamics || !nonNegotiables || !commonPull || !bestDynamic || !falseSpark) return null;
      return { supportiveTraits, commonPull, cautionDynamics, bestDynamic, nonNegotiables, falseSpark };
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!ownStyle) return;
    const deterministic = analyzeCompass(ownStyle, patterns, notes);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Compatibility Compass",
          prompt: [
            "Given this person's connection style and recurring dating patterns, return ONLY a single JSON object:",
            '{ "supportiveTraits": string[], "commonPull": string, "cautionDynamics": string[], "bestDynamic": string, "nonNegotiables": string[], "falseSpark": string }',
            "supportiveTraits: 2-3 specific traits to look for (each 1-2 sentences).",
            "commonPull: 2-3 sentences naming their typical pull and its risk.",
            "cautionDynamics: 1-3 dynamics to watch for (each 1-2 sentences).",
            "bestDynamic: 2-3 sentences describing their best-supporting dynamic.",
            "nonNegotiables: 2-3 specific non-negotiables (each 1-2 sentences).",
            "falseSpark: 2-3 sentences naming the false-spark pattern.",
            "",
            `Connection style: ${ownStyle}`,
            patterns.length ? `Recurring patterns: ${patterns.join("; ")}` : "Recurring patterns: none specified",
            notes.trim() ? `Notes: ${notes}` : "",
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].filter(Boolean).join("\n"),
          context: { toolName: "Compatibility Compass", formValues: { ownStyle, patterns, notes } },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        setResult(deterministic);
        return;
      }
      const parsed = tryParseCompass(ai.output);
      setUsedFallback(parsed == null);
      setResult(parsed ?? deterministic);
    } catch {
      setUsedFallback(true);
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO;
  const isDemo = !result;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[380px] h-[380px] top-10 right-0 opacity-25 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Self-Insight</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Compatibility Compass</h1>
            <FallbackRateBadge toolName="Compatibility Compass" className="mt-1" />

            <p className="text-muted-foreground mt-2 leading-relaxed">Tell us your connection style and the patterns that keep showing up. Get a read on what dynamics tend to support you — and what to watch for.<br /><span className="text-xs text-muted-foreground/60">Suggests rather than dictates. Based on what you share — not a clinical assessment.</span></p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<Compass className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Compatibility Compass"
              title="Find the dynamics that fit you"
              description="Share your connection style and the patterns that keep showing up — we'll surface supportive traits to look for, dynamics to watch, and the false-spark pattern that pulls you off course."
              testId="compass-empty-state"
            />
          )}

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-6 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">How would you describe your connection style?</Label>
              <div className="flex flex-wrap gap-2">
                {OWN_STYLES.map(s => (
                  <button key={s} onClick={() => setOwnStyle(prev => prev === s ? "" : s)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${ownStyle === s ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Patterns that keep showing up <span className="font-normal normal-case text-muted-foreground/50">(select all that apply)</span></Label>
              <div className="flex flex-wrap gap-2">
                {PATTERNS.map(p => (
                  <button key={p} onClick={() => togglePattern(p)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${patterns.includes(p) ? "bg-[hsl(43_65%_65%/0.15)] text-[hsl(43_65%_80%)] border-[hsl(43_65%_65%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Anything else worth adding? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <Textarea placeholder="e.g. I tend to attract people who need a lot of reassurance. Or: I'm drawn to people I have to work for."
                value={notes} onChange={e => setNotes(e.target.value)}
                className="min-h-[72px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !ownStyle}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Reading your compass…</> : <><Compass className="mr-2 h-4 w-4" />Find My Compass</>}
            </Button>
          </motion.div>

          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example output — select your style above to get yours
                  </p>
                </div>
              )}
              {!isDemo && usedFallback && (
                <FallbackNotice
                  onRetry={handleAnalyze}
                  loading={loading}
                  label="compass read"
                  testId="button-retry-compass"
                />
              )}
              <div className="space-y-4">
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)]" />Likely supportive traits
                  </p>
                  <ul className="space-y-2.5">
                    {show.supportiveTraits.map((t, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] mt-2 flex-shrink-0" />{t}</li>)}
                  </ul>
                </div>

                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(43_65%_65%)]" />Your common pull
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.commonPull}</p>
                </div>

                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(348_55%_65%)]" />Caution dynamics
                  </p>
                  <ul className="space-y-2.5">
                    {show.cautionDynamics.map((c, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(348_55%_65%)] mt-2 flex-shrink-0" />{c}</li>)}
                  </ul>
                </div>

                <div className="rounded-2xl p-6 border border-[hsl(268_52%_68%/0.25)] bg-[hsl(268_52%_68%/0.07)]">
                  <p className="font-semibold text-foreground text-sm mb-2">Best-supporting dynamic</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.bestDynamic}</p>
                </div>

                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-3">Non-negotiables to consider</p>
                  <ul className="space-y-2.5">
                    {show.nonNegotiables.map((n, i) => <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[hsl(190_55%_60%)] mt-2 flex-shrink-0" />{n}</li>)}
                  </ul>
                </div>

                <div className="rounded-2xl p-6 border border-[hsl(43_65%_65%/0.25)] bg-[hsl(43_65%_65%/0.07)]">
                  <p className="font-semibold text-foreground text-sm mb-2">False-spark pattern to watch for</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.falseSpark}</p>
                </div>
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setOwnStyle(""); setPatterns([]); setNotes(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Start over
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
