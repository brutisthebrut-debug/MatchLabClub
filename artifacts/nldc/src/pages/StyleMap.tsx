import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, BarChart2, AlertCircle, RefreshCw } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { FallbackNotice } from "@/components/FallbackNotice";
import { FallbackRateBadge } from "@/components/FallbackRateBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface StyleMapResult {
  meters: { label: string; value: number; note: string; color: string }[];
  readout: string;
  topStrength: string;
  growthEdge: string;
}

function analyzeStyle(text: string): StyleMapResult {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).length;
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const avgSentenceLen = words / sentences;
  const questions = (text.match(/\?/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  const emojis = (text.match(/[\p{Emoji}]/gu) || []).length;
  const hasHumor = /haha|lol|jk|kidding|funny|laugh|irony|wit|banter/.test(lower);
  const hasEmotional = /feel|miss|hurt|care|love|sorry|sad|happy|excit|worry/.test(lower);
  const hasWarm = /hey|hi|hope|great|nice|good|sweet|lovely|perfect|wonderful/.test(lower);
  const hasDirect = /can we|let's|want to|would you|are you free|when are|i'd like|we should/.test(lower);
  const hasHedge = /maybe|kind of|sort of|i guess|i think|not sure|probably|idk|perhaps/.test(lower);
  const hasFollowUp = (text.match(/\n/g) || []).length > 3;
  const longMessages = avgSentenceLen > 20;

  const warmth = Math.min(100, Math.max(10,
    45 + (hasWarm ? 20 : 0) + (emojis * 5) + (hasEmotional ? 15 : 0) - (hasDirect && !hasWarm ? 10 : 0)
  ));
  const clarity = Math.min(100, Math.max(10,
    60 + (hasDirect ? 20 : 0) - (hasHedge ? 25 : 0) - (longMessages ? 10 : 0)
  ));
  const effortBalance = Math.min(100, Math.max(10,
    50 + (longMessages ? 15 : 0) + (questions * 3) - (hasFollowUp ? 0 : 5)
  ));
  const playfulness = Math.min(100, Math.max(5,
    20 + (hasHumor ? 40 : 0) + (emojis * 8) + (exclamations * 5)
  ));
  const pacing = Math.min(100, Math.max(10,
    50 + (hasDirect ? 20 : 0) - (longMessages ? 15 : 0) + (questions > 3 ? -10 : 0)
  ));
  const availability = Math.min(100, Math.max(10,
    55 + (hasEmotional ? 20 : 0) + (hasWarm ? 10 : 0) - (hasHedge ? 15 : 0)
  ));
  const directness = Math.min(100, Math.max(5,
    30 + (hasDirect ? 40 : 0) - (hasHedge ? 20 : 0) + (questions < 2 ? 10 : 0)
  ));
  const pressure = Math.min(100, Math.max(5,
    10 + (questions > 4 ? 20 : 0) + (exclamations > 3 ? 15 : 0) + (hasDirect && longMessages ? 15 : 0)
  ));
  const ambiguity = Math.min(100, Math.max(5,
    10 + (hasHedge ? 35 : 0) + (!hasDirect ? 20 : 0) + (longMessages && !hasDirect ? 15 : 0)
  ));

  const METERS = [
    { label: "Warmth",          value: warmth,       note: warmth > 70 ? "High — your warmth is legible and welcoming" : warmth > 45 ? "Moderate — present but could be more overt in early interactions" : "Low — may read as cool or transactional to some readers", color: "hsl(348 55% 65%)" },
    { label: "Clarity",         value: clarity,      note: clarity > 70 ? "High — people know where they stand with you" : clarity > 45 ? "Moderate — some hedge language creates occasional ambiguity" : "Low — the intent isn't coming through clearly enough", color: "hsl(190 55% 60%)" },
    { label: "Effort",          value: effortBalance,note: effortBalance > 70 ? "High — you're investing noticeably in the exchange" : effortBalance > 45 ? "Balanced — neither over- nor under-contributing" : "Low — may read as low investment or passive", color: "hsl(268 52% 68%)" },
    { label: "Playfulness",     value: playfulness,  note: playfulness > 70 ? "High — levity is present and creates ease" : playfulness > 40 ? "Moderate — some lightness, but room to let it breathe more" : "Low — could benefit from occasional humor or lightness", color: "hsl(43 65% 65%)" },
    { label: "Pacing",          value: pacing,       note: pacing > 70 ? "Moves forward — you're steering toward something, which is good" : pacing > 45 ? "Measured — neither rushing nor stalling" : "Slow — may feel meandering without a clear direction", color: "hsl(285 45% 65%)" },
    { label: "Availability",    value: availability, note: availability > 70 ? "High — emotional openness is present and legible" : availability > 45 ? "Present — some warmth is accessible" : "Guarded — emotional availability isn't coming through clearly yet", color: "hsl(142 55% 60%)" },
    { label: "Directness",      value: directness,   note: directness > 70 ? "High — you say what you mean" : directness > 45 ? "Moderate — direct in some areas, soft-pedaling in others" : "Low — more indirection than serves you; try naming what you want", color: "hsl(190 55% 60%)" },
    { label: "Pressure",        value: pressure,     note: pressure > 65 ? "Elevated — the intensity may be creating mild pressure; ease off slightly" : pressure > 35 ? "Moderate — present but not excessive" : "Low — no sense of pressure; relaxed energy", color: "hsl(43 65% 65%)" },
    { label: "Ambiguity",       value: ambiguity,    note: ambiguity > 65 ? "High — the intent isn't clear enough; name what you want more explicitly" : ambiguity > 35 ? "Some — a few unclear signals worth tightening" : "Low — signals are clear and legible", color: "hsl(228 18% 65%)" },
  ];

  const readoutParts: string[] = [];
  if (warmth > 65) readoutParts.push("Your warmth comes through clearly");
  else readoutParts.push("Your warmth is harder to read than you might intend");
  if (clarity > 65) readoutParts.push("you communicate with good clarity");
  else if (hasHedge) readoutParts.push("hedging language is softening your signal more than it needs to");
  if (playfulness > 60) readoutParts.push("there's real levity here");
  if (directness > 65) readoutParts.push("your directness is a strength");
  else if (ambiguity > 60) readoutParts.push("the intent could be clearer");
  if (pressure > 60) readoutParts.push("watch the intensity — it may be creating mild pressure");

  const strengths = [
    { cond: warmth > 70, s: "Your warmth — it's legible and creates safety" },
    { cond: clarity > 70, s: "Your clarity — people know where they stand" },
    { cond: playfulness > 65, s: "Your playfulness — lightness is a connector" },
    { cond: directness > 70, s: "Your directness — people appreciate knowing what you want" },
    { cond: availability > 70, s: "Your emotional availability — it builds trust quickly" },
  ];
  const topStrength = strengths.find(s => s.cond)?.s || "Your steadiness — you're not creating noise or pressure";

  const edges = [
    { cond: ambiguity > 65, e: "Reduce ambiguity — name what you want more directly in at least one place per conversation" },
    { cond: pressure > 65, e: "Ease off the intensity slightly — a pause or lighter message can reset the energy" },
    { cond: clarity < 45, e: "Be more direct about what you're looking for — clarity is attractive, not aggressive" },
    { cond: warmth < 45, e: "Add one more signal of warmth — a specific compliment, a 'this made me smile,' something that shows you're present" },
    { cond: playfulness < 35, e: "Let in a little more lightness — one observation, one self-deprecating note, one moment of levity" },
  ];
  const growthEdge = edges.find(e => e.cond)?.e || "Your balance is good — the main thing is consistency as the interaction develops";

  return {
    meters: METERS,
    readout: readoutParts.join(", ") + ". " + (pressure > 60 ? "The overall energy is engaged but slightly intense — a lighter touch on the next exchange would help." : ambiguity > 60 ? "The main thing to tighten: what you actually want. Say it once, clearly." : "The overall signal is balanced and readable."),
    topStrength,
    growthEdge,
  };
}

const DEMO: StyleMapResult = {
  meters: [
    { label: "Warmth",       value: 72, note: "High — your warmth is legible and welcoming",                                                                                 color: "hsl(348 55% 65%)" },
    { label: "Clarity",      value: 58, note: "Moderate — some hedge language creates occasional ambiguity",                                                                 color: "hsl(190 55% 60%)" },
    { label: "Effort",       value: 65, note: "Balanced — neither over- nor under-contributing",                                                                              color: "hsl(268 52% 68%)" },
    { label: "Playfulness",  value: 48, note: "Moderate — some lightness, but room to let it breathe more",                                                                  color: "hsl(43 65% 65%)"  },
    { label: "Pacing",       value: 55, note: "Measured — neither rushing nor stalling",                                                                                      color: "hsl(285 45% 65%)" },
    { label: "Availability", value: 68, note: "Present — emotional openness is accessible",                                                                                   color: "hsl(142 55% 60%)" },
    { label: "Directness",   value: 44, note: "Moderate — direct in some areas, soft-pedaling in others",                                                                     color: "hsl(190 55% 60%)" },
    { label: "Pressure",     value: 22, note: "Low — no sense of pressure; relaxed energy",                                                                                   color: "hsl(43 65% 65%)"  },
    { label: "Ambiguity",    value: 38, note: "Some — a few unclear signals worth tightening",                                                                                color: "hsl(228 18% 65%)" },
  ],
  readout: "Your warmth comes through clearly, and there's a steady, non-pressuring quality to the exchange. The main opportunity: be a little more direct about what you want. Clarity is attractive — it's not the same as intensity.",
  topStrength: "Your warmth — it's legible and creates safety for the other person",
  growthEdge: "Be more direct about what you're looking for — clarity is attractive, not aggressive",
};

function Meter({ label, value, note, color }: { label: string; value: number; note: string; color: string }) {
  const getLevel = (v: number) => v > 70 ? "High" : v > 45 ? "Mid" : "Low";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground/80">{label}</span>
        <span className="text-xs text-muted-foreground font-mono">{value}<span className="text-muted-foreground/40">/100</span></span>
      </div>
      <div className="h-2 rounded-full bg-[hsl(232_28%_18%)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.1 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="text-xs text-muted-foreground/60 leading-snug">{note}</p>
    </div>
  );
}

export default function StyleMap() {
  useMeta("Communication Style Map", "Paste a conversation and see meters for warmth, clarity, playfulness, pacing, directness, pressure, and more — plus a short practical readout.");
  const [text, setText] = useState("");
  const [result, setResult] = useState<StyleMapResult | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;

  function tryParseStyleMap(raw: string, deterministic: StyleMapResult): StyleMapResult | null {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        readout?: unknown;
        topStrength?: unknown;
        growthEdge?: unknown;
      };
      const readout = typeof parsed.readout === "string" && parsed.readout.trim().length >= 30 ? parsed.readout.trim() : null;
      const topStrength = typeof parsed.topStrength === "string" && parsed.topStrength.trim().length >= 10 ? parsed.topStrength.trim() : null;
      const growthEdge = typeof parsed.growthEdge === "string" && parsed.growthEdge.trim().length >= 10 ? parsed.growthEdge.trim() : null;
      if (!readout || !topStrength || !growthEdge) return null;
      return { meters: deterministic.meters, readout, topStrength, growthEdge };
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (!text.trim()) return;
    const deterministic = analyzeStyle(text);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Communication Style Map",
          prompt: [
            "Analyze the communication style in this conversation. Return ONLY a single JSON object:",
            '{ "readout": string, "topStrength": string, "growthEdge": string }',
            "readout: 2-3 sentence practical summary of the communication style.",
            "topStrength: one specific strength (1-2 sentences).",
            "growthEdge: one concrete adjustment to try (1-2 sentences).",
            "",
            `Conversation:\n${text}`,
            "",
            "Return ONLY the JSON object. No prose, no markdown.",
          ].join("\n"),
          context: { toolName: "Communication Style Map", formValues: { conversation: text } },
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        setResult(deterministic);
        return;
      }
      const parsed = tryParseStyleMap(ai.output, deterministic);
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
        <div className="orb orb-violet fixed w-[340px] h-[340px] top-10 right-0 opacity-25 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-[hsl(190_55%_60%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Communication Tools</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Communication Style Map</h1>
            <FallbackRateBadge toolName="Communication Style Map" className="mt-1" />

            <p className="text-muted-foreground mt-2">Paste a conversation, message thread, or anything you've written. Get a read on nine communication dimensions and a practical note on what to adjust.</p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div {...fadeUp(0.03)} className="mb-6" data-testid="stylemap-empty-state">
              <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-4 flex items-center justify-center">
                  <BarChart2 className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Welcome to Style Map</p>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground mb-2">Map your communication style</h2>
                <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                  Paste a conversation or a few messages and we'll plot your warmth, clarity, pacing, and pressure — plus the one thing worth adjusting.
                </p>
              </div>
            </motion.div>
          )}

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Paste your conversation or messages</Label>
              <Textarea
                placeholder={"Paste the conversation thread here — your messages, their messages, or just your side. The more text, the sharper the read.\n\nFormat: Name: message — each on a new line, or just paste naturally."}
                value={text} onChange={e => setText(e.target.value)}
                className="min-h-[180px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
              <p className="text-xs text-muted-foreground/50">{text.trim().split(/\s+/).filter(Boolean).length} words — {text.trim().split(/\s+/).filter(Boolean).length < 50 ? "more text = sharper read" : "good amount to work with"}</p>
            </div>
            <Button onClick={handleAnalyze} disabled={loading || !text.trim()}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Mapping your style…</> : <><BarChart2 className="mr-2 h-4 w-4" />Map My Style</>}
            </Button>
          </motion.div>

          <AnimatePresence>
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example output — paste your messages above to get yours
                  </p>
                </div>
              )}
              {!isDemo && usedFallback && (
                <FallbackNotice
                  onRetry={handleAnalyze}
                  loading={loading}
                  label="style read"
                  testId="button-retry-stylemap"
                />
              )}
              <div className="space-y-5">
                {/* Meters */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <h2 className="text-base font-bold text-foreground mb-6">Nine Dimensions</h2>
                  <div className="space-y-5">
                    {show.meters.map((m, i) => <Meter key={i} {...m} />)}
                  </div>
                </div>

                {/* Readout */}
                <div className="glass border border-white/8 rounded-2xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-2">Practical Readout</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.readout}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl p-5 border border-[hsl(142_55%_60%/0.25)] bg-[hsl(142_55%_60%/0.07)]">
                    <p className="font-semibold text-foreground text-sm mb-2">Top strength</p>
                    <p className="text-sm text-muted-foreground">{show.topStrength}</p>
                  </div>
                  <div className="rounded-2xl p-5 border border-[hsl(43_65%_65%/0.25)] bg-[hsl(43_65%_65%/0.07)]">
                    <p className="font-semibold text-foreground text-sm mb-2">Growth edge</p>
                    <p className="text-sm text-muted-foreground">{show.growthEdge}</p>
                  </div>
                </div>
              </div>
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setText(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />Map another conversation
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
