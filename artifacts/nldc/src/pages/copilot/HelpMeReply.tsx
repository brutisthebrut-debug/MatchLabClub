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
import { MessageSquare, Copy, Check, Loader2, Sparkles, RefreshCw, ArrowLeft, AlertCircle } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const TONES = ["Warm & genuine", "Playful & light", "Direct & clear", "Bold", "Low-pressure"];
const GOALS = ["Keep the conversation going", "Suggest meeting up", "Re-engage after quiet", "Show more interest", "Wind it down kindly"];

interface ReplyOption { style: string; text: string; rationale: string; color: string; bg: string; }
interface ReplyResult { options: ReplyOption[]; coachNote: string; }

const PALETTE: { color: string; bg: string }[] = [
  { color: "hsl(268 52% 68%)", bg: "hsl(268 52% 68% / 0.08)" },
  { color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.08)"  },
  { color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.08)" },
  { color: "hsl(348 55% 65%)", bg: "hsl(348 55% 65% / 0.08)" },
  { color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.08)" },
];

function buildFallback(context: string, tone: string, goal: string): ReplyResult {
  const hasName    = /\b(alex|sam|jordan|taylor|casey|morgan|riley|drew|jamie)\b/i.test(context);
  const hasDates   = /\b(coffee|drink|dinner|meet|hang|weekend|tomorrow|saturday|sunday)\b/i.test(context);
  const isReEngage = goal.toLowerCase().includes("re-engage") || goal.toLowerCase().includes("quiet");

  const options: ReplyOption[] = [
    {
      style: "Warm",
      text: isReEngage
        ? "Hey — I keep thinking about what you said about [something specific]. How's that going?"
        : "I've genuinely enjoyed this. What's been the best part of your week so far?",
      rationale: "Warm openers land best when they reference something real. Swap the brackets for a detail from the thread.",
      color: PALETTE[0].color, bg: PALETTE[0].bg,
    },
    {
      style: "Playful",
      text: hasDates
        ? "Okay, I think we've earned an actual conversation. What does your week look like?"
        : "I feel like we keep almost getting somewhere and then stop. Let's fix that.",
      rationale: "Keeps the energy light without making it a big deal. Works well if the vibe's been easy.",
      color: PALETTE[1].color, bg: PALETTE[1].bg,
    },
    {
      style: "Direct",
      text: hasDates
        ? "I'd like to actually meet. Would [day] work for coffee?"
        : "What are you actually looking for right now? I'd rather know than guess.",
      rationale: "Direct messages often feel risky but land extremely well when delivered without apology.",
      color: PALETTE[2].color, bg: PALETTE[2].bg,
    },
    {
      style: "Curious",
      text: "Quick question — [something from the conversation you actually want to know]. I'm asking because I'm genuinely interested, not making small talk.",
      rationale: "Signals real interest without pressure. Replace the brackets with something specific.",
      color: PALETTE[3].color, bg: PALETTE[3].bg,
    },
    {
      style: "Low-key",
      text: "No pressure — but I'd like to keep talking. What's a good time for you?",
      rationale: "Takes the stakes off. Useful when you sense the other person might be hesitant.",
      color: PALETTE[4].color, bg: PALETTE[4].bg,
    },
  ];

  const goalNote = goal ? ` Since your goal is to "${goal.toLowerCase()}", lean toward the option that moves things forward without feeling forced.` : "";
  const toneNote = tone ? ` You picked "${tone}" — keep that energy throughout.` : "";

  return {
    options,
    coachNote: `Personalize before you send — the bracketed parts need real details from your conversation.${goalNote}${toneNote} Specific always beats clever.`,
  };
}

function tryParseAi(raw: string | undefined, fallback: ReplyResult): ReplyResult {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as { options?: unknown[]; coachNote?: string };
    if (!Array.isArray(p.options) || p.options.length < 3) return fallback;
    const options = (p.options as { style?: string; text?: string; rationale?: string }[])
      .map((o, i) => ({
        style:    typeof o.style === "string"    ? o.style    : `Option ${i + 1}`,
        text:     typeof o.text === "string"     ? o.text     : "",
        rationale: typeof o.rationale === "string" ? o.rationale : "",
        color: PALETTE[i % PALETTE.length].color,
        bg:    PALETTE[i % PALETTE.length].bg,
      }))
      .filter(o => o.text.length > 10);
    if (options.length < 3) return fallback;
    return { options, coachNote: typeof p.coachNote === "string" ? p.coachNote : fallback.coachNote };
  } catch { return fallback; }
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast({ title: "Copied!" }); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs font-medium transition-colors flex-shrink-0"
      style={{ color: copied ? "hsl(142 55% 60%)" : undefined }}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={copied ? "" : "text-muted-foreground"}>{label ?? (copied ? "Copied" : "Copy")}</span>
    </button>
  );
}

export default function HelpMeReply() {
  useMeta("Help Me Reply", "Context in, copy-ready options out. Paste the thread, choose your goal, get 5 styled replies with rationale.");
  const [context, setContext] = useState("");
  const [tone, setTone]       = useState("");
  const [goal, setGoal]       = useState("");
  const [result, setResult]   = useState<ReplyResult | null>(null);
  const [step, setStep]       = useState(0);

  const enhance = useEnhanceAi();

  function handleGenerate() {
    const fallback = buildFallback(context, tone, goal);
    setResult(fallback);
    setStep(1);

    const prompt = [
      context.trim() && `Conversation context:\n${context}`,
      tone           && `Preferred tone: ${tone}`,
      goal           && `Goal: ${goal}`,
    ].filter(Boolean).join("\n\n") +
    `\n\nReturn a JSON object: { "options": [ { "style": string, "text": string, "rationale": string } ] (exactly 5), "coachNote": string }. Each message should be copy-ready, warm, and non-generic.`;

    enhance.mutate(
      { data: { toolName: "Help Me Reply", prompt, expectJson: true } },
      {
        onSuccess: (data) => {
          const raw = (data as { output?: string } | undefined)?.output;
          const parsed = tryParseAi(raw, fallback);
          setResult(parsed);
        },
      }
    );
  }

  function reset() { setResult(null); setContext(""); setTone(""); setGoal(""); setStep(0); enhance.reset(); }

  const isDemo   = !result;
  const show     = result ?? buildFallback("", "", "");
  const aiActive = enhance.isPending;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 -right-10 opacity-25 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp(0)} className="mb-6">
            <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
            </Link>
          </motion.div>

          <motion.div {...fadeUp(0.03)} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-[hsl(190_55%_60%)]" />
              <p className="text-sm font-medium text-[hsl(190_55%_72%)]">Wingman Studio</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Help Me Reply</h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Context in, copy-ready options out. Paste the thread, pick your tone and goal, get 5 replies with rationale.
            </p>
          </motion.div>

          {/* Step indicator */}
          <motion.div {...fadeUp(0.05)} className="flex items-center gap-2 mb-6">
            {[0, 1].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(190_55%_60%)]" : "w-6 bg-white/10"}`} />
            ))}
            <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="form" {...fadeUp(0.06)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                    Conversation context <span className="font-normal normal-case text-muted-foreground/40">(paste the thread or describe the situation)</span>
                  </Label>
                  <Textarea value={context} onChange={e => setContext(e.target.value)}
                    placeholder={"Alex: I love that little wine bar on Oak Street\nMe: The one with exposed brick? I've been wanting to go\nAlex: Yes! We should go sometime\n\n...or just describe what's happened so far"}
                    className="min-h-[130px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/35" />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your preferred tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map(t => (
                      <button key={t} onClick={() => setTone(prev => prev === t ? "" : t)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${tone === t ? "bg-[hsl(190_55%_60%/0.2)] text-[hsl(190_55%_80%)] border-[hsl(190_55%_60%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your goal with this reply</Label>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map(g => (
                      <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(190_55%_60%/0.2)] text-[hsl(190_55%_80%)] border-[hsl(190_55%_60%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleGenerate} disabled={!context.trim()}
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(190_55%_55%)] to-[hsl(268_52%_65%)] border-0 glow-pulse disabled:opacity-50">
                  <Sparkles className="mr-2 h-4 w-4" /> Get My 5 Options
                </Button>
              </motion.div>
            ) : (
              <motion.div key="results" {...fadeUp(0.05)}>
                {/* Demo notice */}
                {isDemo && (
                  <div className="flex items-center gap-1.5 justify-center text-xs text-muted-foreground mb-4">
                    <AlertCircle className="w-3.5 h-3.5" /> Example output — fill in context above to get yours
                  </div>
                )}

                {/* AI loading banner */}
                {aiActive && (
                  <motion.div {...fadeUp(0)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(190_55%_60%/0.08)] border border-[hsl(190_55%_60%/0.2)] mb-4 text-xs text-[hsl(190_55%_72%)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Wingman is refining your options with AI…
                  </motion.div>
                )}

                <div className="space-y-3">
                  {show.options.map((opt, i) => (
                    <motion.div key={i} {...fadeUp(0.04 * i)} className="rounded-2xl border overflow-hidden"
                      style={{ borderColor: opt.color.replace(")", " / 0.2)") }}>
                      <div className="flex items-center justify-between px-5 py-2.5" style={{ background: opt.bg }}>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: opt.color }}>{opt.style}</span>
                        <CopyBtn text={opt.text} label={`Copy ${opt.style}`} />
                      </div>
                      <div className="px-5 py-4">
                        <div className="flex justify-end mb-2">
                          <p className="text-sm px-4 py-3 rounded-2xl rounded-br-md text-white font-medium max-w-sm"
                            style={{ background: `linear-gradient(135deg, ${opt.color}, hsl(285 45% 55%))` }}>
                            {opt.text}
                          </p>
                        </div>
                        {opt.rationale && (
                          <p className="text-xs text-muted-foreground/60 leading-relaxed italic mt-1">{opt.rationale}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Coach note */}
                <motion.div {...fadeUp(0.3)} className="mt-4 rounded-2xl border border-[hsl(190_55%_60%/0.2)] bg-[hsl(190_55%_60%/0.06)] px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(190_55%_60%)]">Wingman Note</p>
                    {aiActive && <Loader2 className="w-3 h-3 animate-spin text-[hsl(190_55%_60%)]" />}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{show.coachNote}</p>
                </motion.div>

                <motion.div {...fadeUp(0.35)} className="mt-5 flex justify-center">
                  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> New conversation
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
