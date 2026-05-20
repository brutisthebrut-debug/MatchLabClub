import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, MapPin, RefreshCw, AlertCircle, Copy, Check } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const PATTERNS = [
  "Getting close, then pulling back",
  "Attracting people who aren't fully available",
  "Great starts that slowly fizzle",
  "Moving too fast or too slow",
  "Staying too long / leaving too soon",
  "Other",
];

const WANTS = [
  "A real, lasting partnership",
  "Something exciting and alive",
  "Ease — it should feel natural",
  "Still figuring it out",
];

interface BlueprintResult {
  firstImpression: string;
  repeatingPattern: string;
  communicationStyle: string;
  attractionPattern: string;
  comfortNeeds: string;
  riskLoop: string;
  growthEdge: string;
}

function analyzeBlueprint(text: string, pattern: string, misread: string, want: string): BlueprintResult {
  const lower = text.toLowerCase();
  const words = text.trim().split(/\s+/).length;
  const isEmotional = /feel|heart|care|love|connect|vulnerable|miss|tender|open|hurt/.test(lower);
  const isGuarded = /careful|trust|slow|wall|past|hurt|cautious|protect|guard|alone|independent/.test(lower);
  const isHighEnergy = /fun|excit|adventur|spontan|laugh|joy|alive|energy|move|bold/.test(lower);
  const isThoughtful = /think|consider|reflect|understand|deep|meaning|curious|learn|value/.test(lower);
  const isLong = words > 70;
  const wantsPartnership = want === WANTS[0];
  const wantsSpark = want === WANTS[1];

  const pi = isEmotional && isGuarded ? 0 : isHighEnergy && !isGuarded ? 1 : isThoughtful ? 2 : 3;
  const pati = pattern.includes("pull") ? 0 : pattern.includes("available") ? 1 : pattern.includes("fizzle") ? 2 : pattern.includes("fast") ? 3 : 4;

  const firstImpressions = [
    "Warm, genuine, and slightly held-back. People read you as someone who cares — but sense that you're not fully there yet. Some find the layers intriguing; others move on before you open up. The impression before the real you shows up is slightly softer than the actual you.",
    "Present and energetic — you tend to fill space in a way that makes people feel at ease. The first-impression risk is that your comfort in social situations can read as casual when you actually want something real. People sometimes think you want less than you do.",
    "Thoughtful and considered. You come across as someone who has thought about things — which is attractive to the right people and intimidating to others. You may read as more serious or selective than you feel, which can make first conversations feel higher-stakes than you'd like.",
    "Steady and easy to be around — genuinely low-drama, which is rare and undervalued. The risk is that 'easy' can read as 'not that invested.' The parts of you that would make someone think I need to know more might be staying behind the surface longer than serves you.",
  ];

  const repeatingPatterns = [
    "You tend to move toward connection and then, at some threshold — sometimes conscious, sometimes not — create distance. The pull-back often feels protective in the moment but costs you opportunities that were actually real. The pattern is not random: it tends to activate when things feel like they might actually matter.",
    "You keep finding people who are emotionally, logistically, or situationally unavailable — and somewhere in the dynamic, the unavailability makes them feel safer or more compelling. Availability can feel low-stakes; the chase can feel like proof of worth. Worth examining.",
    "Connections start with real energy, then something dims. Often this is a pacing issue — the early momentum isn't sustained with enough depth or novelty. Sometimes it's that neither person takes the step from 'this is nice' to 'let's make this something.' The fizzle is usually addressable.",
    "You tend to move at a pace that doesn't match the other person — either arriving fully before they're ready, or holding back while they're already in. Calibrating tempo is one of the highest-leverage skills in early dating; it's learnable.",
    "You tend to stay past the point of fit, or exit before things have had time to develop. The pattern often has a consistent internal cue — learning to recognize it is the work.",
  ];

  const commStyles = [
    "You communicate with warmth and sincerity but sometimes hold the real thing back — sharing the surface of your experience before you've decided if someone's earned the rest. Once you trust, you're probably a very good communicator. The gap between your guarded early style and your open later style can create mixed signals.",
    "You tend to be lively and engaging — easy to talk to, good at finding common ground. The risk is that your ease in conversation can make depth feel optional. You can keep things fun almost indefinitely; the challenge is initiating the shift to something more real when you want it.",
    "You think before you speak and mean what you say — which people often appreciate as rare. You may under-communicate what you're feeling in real time, assuming others will read the context. They often don't. More real-time expression would help.",
    "You communicate clearly and directly when you feel safe. When you don't, you tend to go quieter or more careful. Your default is to understate — which is read by some as mysterious and by others as detached. A little more of the real-time internal experience goes a long way.",
  ];

  const attractionPatterns = [
    "You tend to be drawn to people with warmth and depth — but also a certain quality of withholding that creates something to move toward. The irony is that what makes them compelling early (the slightly-out-of-reach quality) is exactly what makes things hard later. You don't need unavailability — you need real depth.",
    "You're drawn to energy, spontaneity, and the feeling of being alive in someone's presence. The risk is mistaking activation for compatibility. High-energy, low-predictability connections feel exciting and can produce real chemistry — but they often don't hold. The steadier option tends to get undervalued.",
    "You're drawn to people with substance — intelligence, values, specificity. You can tell very quickly when someone is interesting and when they're not. The challenge is that your filter sometimes runs before the person has had a chance to show up. Not everyone slow-starts. Some people are worth the wait.",
    "You tend to be drawn to ease — people who feel comfortable, who don't require a lot of performance or tension. This is healthy. The growth edge is making sure 'comfortable' isn't becoming a substitute for 'alive.' Ease and spark are not opposites.",
  ];

  const comfortNeeds = [
    "You relax when the pressure is off — when there's no agenda, no performance requirement, no 'where is this going.' Casual context (a walk, a shared task, a low-stakes second setting) tends to unlock you faster than formal date formats. You show up most fully when you've been given time to feel safe.",
    "You relax when there's energy and momentum — when the other person is clearly engaged and the conversation has somewhere to go. Flat or ambiguous interactions create doubt for you. When the vibe is good, you're probably one of the best dates someone has had.",
    "You relax when the conversation has real content — when there's something to think about together, disagree on gently, or discover. Small talk is genuinely taxing for you. A context that naturally generates real conversation (a museum, an activity, a topic with stakes) lets you show up.",
    "You relax when there's no urgency. You need time to settle in — and the best early interactions for you tend to have natural pauses, unhurried pacing, and no feeling of being assessed. Being rushed, even subtly, sends you slightly inward.",
  ];

  const riskLoops = [
    "The loop: something real starts to form → you feel it → you protect yourself by creating a little distance → they misread the distance as disinterest → they pull back → you take their pulling back as confirmation it wasn't going anywhere anyway. The exit point is in the first beat: catching the protection instinct before it shapes behavior.",
    "The loop: you feel something promising → the other person shows signs of inconsistency or unavailability → the inconsistency makes you more invested, not less → you put in more effort → they stay inconsistent → you eventually exit, burned. The exit point is early: inconsistency in the first few weeks is data, not a phase.",
    "The loop: great start → natural lull → neither person takes the step to go deeper → both interpret the lull as 'maybe it's not there' → gradual fade. The exit point is the lull: someone needs to name it or move toward it. That someone is usually the more self-aware person.",
    "The loop: you move at your natural pace (which may be faster or slower than theirs) → they feel off-rhythm → they start pulling back → you interpret the pull as personal → the dynamic gets careful → connection cools. Pace calibration is a skill, not a personality trait. It's learnable.",
  ];

  const growthEdges = [
    wantsPartnership
      ? "Show up for the version of you that exists after five minutes together, not just the version that walks in. You're more compelling when people see what you're like when you've had a moment to arrive — which means your job is to create more conditions for that to happen, earlier."
      : "Practice naming what you want, out loud, slightly before you're completely certain. Holding your cards until you've decided creates a self-fulfilling pattern where you decide alone. The experiment: say one real thing earlier than feels comfortable.",
    wantsSpark
      ? "The next time you feel undeniable chemistry, give it 30 days before treating it as evidence of fit. Track how the spark behaves over time — whether it deepens or just loops. Chemistry is real and worth paying attention to. It's also a terrible decision-making tool on its own."
      : "The next time something promising starts slowly, give it three interactions before drawing a conclusion. Your pattern-recognition is fast and often accurate — but it can close off things that needed a longer runway. Some of the best connections feel like a slow build, not an arrival.",
    isLong
      ? "Practice the version of you that says the important thing in one sentence instead of three paragraphs. You process by elaborating — which is genuine — but it can fill the space where the other person was about to meet you. Leave room."
      : "The next connection that feels promising: say one more thing than you normally would. Your natural register is understated, which reads as confident to some and closed-off to others. The data is in the experiment.",
    "The next time you feel the pull to protect yourself, make it conscious. Ask: what am I protecting against, specifically? Is that thing actually likely here? Protection is a tool, not a setting — use it intentionally rather than as a default.",
  ];

  return {
    firstImpression: firstImpressions[pi],
    repeatingPattern: repeatingPatterns[Math.min(pati, repeatingPatterns.length - 1)],
    communicationStyle: commStyles[pi],
    attractionPattern: attractionPatterns[pi],
    comfortNeeds: comfortNeeds[pi],
    riskLoop: riskLoops[Math.min(pati, riskLoops.length - 1)],
    growthEdge: growthEdges[isEmotional && isGuarded ? 0 : wantsSpark ? 1 : isLong ? 2 : 3],
  };
}

const DEMO_RESULT: BlueprintResult = {
  firstImpression: "Warm, genuine, and slightly held-back. People read you as someone who cares — but sense that you're not fully there yet. Some find the layers intriguing; others move on before you open up. The impression before the real you shows up is slightly softer than the actual you.",
  repeatingPattern: "You tend to move toward connection and then, at some threshold — sometimes conscious, sometimes not — create distance. The pull-back often feels protective in the moment but costs you opportunities that were actually real.",
  communicationStyle: "You communicate with warmth and sincerity but sometimes hold the real thing back — sharing the surface of your experience before you've decided if someone's earned the rest. Once you trust, you're a very good communicator. The gap between your guarded early style and your open later style can create mixed signals.",
  attractionPattern: "You tend to be drawn to people with warmth and depth — but also a certain quality of withholding that creates something to move toward. You don't need unavailability — you need real depth. They're not the same thing.",
  comfortNeeds: "You relax when the pressure is off — when there's no agenda, no performance requirement, no 'where is this going.' Casual context tends to unlock you faster than formal date formats.",
  riskLoop: "The loop: something real starts to form → you feel it → you protect yourself by creating distance → they misread it as disinterest → they pull back → you take that as confirmation it wasn't going anywhere anyway. The exit point is in the first beat.",
  growthEdge: "Show up for the version of you that exists after five minutes together, not just the version that walks in. Your job is to create more conditions for that to happen, earlier.",
};

const SECTIONS = [
  { key: "firstImpression",    title: "First Impression",      color: "hsl(268 52% 68%)",  desc: "What you project before anyone knows you well" },
  { key: "repeatingPattern",   title: "Repeating Pattern",     color: "hsl(43 65% 65%)",   desc: "What keeps showing up across dating experiences" },
  { key: "communicationStyle", title: "Communication Style",   color: "hsl(190 55% 60%)",  desc: "How you tend to move through early connection" },
  { key: "attractionPattern",  title: "Attraction Pattern",    color: "hsl(285 45% 65%)",  desc: "What you're drawn to and why that makes sense" },
  { key: "comfortNeeds",       title: "Comfort Needs",         color: "hsl(142 55% 60%)",  desc: "What helps you relax and show up as yourself" },
  { key: "riskLoop",           title: "Risk Loop",             color: "hsl(348 55% 65%)",  desc: "What tends to derail promising connections" },
  { key: "growthEdge",         title: "Growth Edge",           color: "hsl(43 65% 65%)",   desc: "One concrete shift that would change your results" },
];

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast({ title: "Copied to clipboard", description: label ? `${label} ready to paste.` : undefined });
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs transition-colors flex-shrink-0"
      style={{ color: copied ? "hsl(142 55% 60%)" : undefined }}
      title="Copy to clipboard"
      data-testid="button-copy-blueprint"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground/50" />}
    </button>
  );
}

export default function Blueprint() {
  useMeta("Personal Blueprint", "A coaching lens on your first impression, dating patterns, communication style, and growth edge — based only on what you choose to share.");
  const [text, setText] = useState("");
  const [pattern, setPattern] = useState("");
  const [misread, setMisread] = useState("");
  const [want, setWant] = useState("");
  const [result, setResult] = useState<BlueprintResult | null>(null);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;

  const BLUEPRINT_KEYS: (keyof BlueprintResult)[] = [
    "firstImpression",
    "repeatingPattern",
    "communicationStyle",
    "attractionPattern",
    "comfortNeeds",
    "riskLoop",
    "growthEdge",
  ];

  function tryParseBlueprint(raw: string): BlueprintResult | null {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Partial<BlueprintResult> = {};
      for (const k of BLUEPRINT_KEYS) {
        const v = parsed[k];
        if (typeof v !== "string" || v.trim().length < 20) return null;
        out[k] = v.trim();
      }
      return out as BlueprintResult;
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!text.trim()) return;
    const deterministic = analyzeBlueprint(text, pattern, misread, want);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Personal Blueprint",
          prompt: [
            "Generate a personal dating blueprint as JSON with exactly these string keys (each 2-4 sentences, warm, specific, never generic):",
            "firstImpression, repeatingPattern, communicationStyle, attractionPattern, comfortNeeds, riskLoop, growthEdge.",
            "",
            `Self-description: ${text}`,
            pattern ? `Repeating pattern: ${pattern}` : "",
            misread ? `What people misread: ${misread}` : "",
            want ? `What they want: ${want}` : "",
          ].filter(Boolean).join("\n"),
          context: {
            toolName: "Personal Blueprint",
            formValues: { selfDescription: text, pattern, misread, want },
          },
          expectJson: true,
        },
      });
      if (ai.isFallback || !ai.output.trim()) {
        setResult(deterministic);
        return;
      }
      const parsed = tryParseBlueprint(ai.output);
      setResult(parsed ?? deterministic);
    } catch {
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO_RESULT;
  const isDemo = !result;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -left-20 opacity-30 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Self-Insight</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Personal Blueprint</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">A coaching lens on how you show up, what patterns keep appearing, and where one shift would make the most difference.<br /><span className="text-xs text-muted-foreground/60">Based only on what you choose to share. Practical coaching guidance — not clinical advice.</span></p>
          </motion.div>

          {/* Form */}
          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-6 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">How would you describe yourself to someone who's never met you?</Label>
              <Textarea
                placeholder="Be as honest or vague as you like. The more specific, the sharper the output — but this works even with a paragraph."
                value={text}
                onChange={e => setText(e.target.value)}
                className="min-h-[120px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
              <p className="text-xs text-muted-foreground/50">{text.trim().split(/\s+/).filter(Boolean).length} words</p>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">A pattern that keeps showing up in your dating life</Label>
              <div className="flex flex-wrap gap-2">
                {PATTERNS.map(p => (
                  <button key={p} onClick={() => setPattern(prev => prev === p ? "" : p)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${pattern === p ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do people misread about you at first? <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <Textarea
                placeholder="e.g. I come across as confident but I'm actually pretty self-conscious early on"
                value={misread}
                onChange={e => setMisread(e.target.value)}
                className="min-h-[72px] resize-none bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you most want from a connection right now?</Label>
              <div className="flex flex-wrap gap-2">
                {WANTS.map(w => (
                  <button key={w} onClick={() => setWant(prev => prev === w ? "" : w)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${want === w ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !text.trim()}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Building your blueprint…</> : <><Sparkles className="mr-2 h-4 w-4" />Build My Blueprint</>}
            </Button>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example blueprint — fill in the form above to get yours
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {SECTIONS.map((s, i) => (
                  <motion.div key={s.key} {...fadeUp(0.05 * i)} className="glass border border-white/8 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: s.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground text-sm">{s.title}</p>
                          <CopyBtn text={show[s.key as keyof BlueprintResult]} />
                        </div>
                        <p className="text-xs text-muted-foreground/60">{s.desc}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-5">{show[s.key as keyof BlueprintResult]}</p>
                  </motion.div>
                ))}
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setText(""); setPattern(""); setMisread(""); setWant(""); }}
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
