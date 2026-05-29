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
import { FallbackRateBadge } from "@/components/FallbackRateBadge";
import { Flame, Copy, Check, Loader2, RefreshCw, ArrowLeft, Shield } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const GOALS = [
  { label: "Flirt playfully", emoji: "✨", desc: "Keep it light and fun, warm interest, no pressure" },
  { label: "Be direct about interest", emoji: "⚡", desc: "Say what you want clearly, without games" },
  { label: "Set a clear boundary", emoji: "🛡️", desc: "Decline or redirect firmly but kindly" },
  { label: "Ask for consent", emoji: "💬", desc: "Check in before escalating, explicit and natural" },
  { label: "Escalate appropriately", emoji: "🔥", desc: "Move things forward when the moment is right" },
  { label: "Ask for a date", emoji: "📅", desc: "Make a specific, confident ask to meet IRL" },
  { label: "Ask for clarity", emoji: "🧭", desc: "Find out where things stand without spiralling" },
  { label: "Exit cleanly", emoji: "🚪", desc: "Close things off kind and clear, no ghosting" },
];

const TONES = ["Warm & natural", "Playful & flirty", "Direct & confident", "Soft & gentle", "Bold & explicit", "Thoughtful & clear"];

interface Reply {
  style: string;
  text: string;
  why: string;
}

interface FlirtResult {
  replies: Reply[];
  coachNote: string;
}

function buildFallback(situation: string, goal: string, tone: string): FlirtResult {
  const isFlattery = goal === "Flirt playfully";
  const isDirect = goal === "Be direct about interest";
  const isExit = goal === "Exit cleanly";
  const isBoundary = goal === "Set a clear boundary";
  const isDate = goal === "Ask for a date";
  const isConsent = goal === "Ask for consent";
  const isClarity = goal === "Ask for clarity";
  const isEscalate = goal === "Escalate appropriately";

  type ReplyStub = { style: string; text: string; why: string };

  const banks: Record<string, ReplyStub[]> = {
  "Flirt playfully": [
  { style: "Warm tease", text: "Okay you can't just say that and expect me not to be curious. Tell me more.", why: "Reflects genuine interest without over-explaining it. Invites them to keep going." },
  { style: "Playful callback", text: "I feel like this conversation is going to end with me agreeing to something I haven't decided yet.", why: "Creates light tension and a sense of inevitability, without pressure." },
  { style: "Honest + light", text: "I'm enjoying this more than I was expecting to, which I say as a compliment.", why: "Direct but still playful. Saying 'I enjoy you' without making it heavy." },
  ],
  "Be direct about interest": [
  { style: "Clean and clear", text: "I'll just say it. I'm genuinely interested in you. No games from me.", why: "Direct without being overwhelming. Leaves room for them to respond." },
  { style: "Grounded directness", text: "I like where this is going. I'd like to keep talking if you would.", why: "States interest calmly. Doesn't over-commit or apply pressure." },
  { style: "Inviting", text: "I find myself looking forward to your messages. Figured I'd just tell you that.", why: "Specific, honest, and warm. Not a declaration, an observation." },
  ],
  "Set a clear boundary": [
  { style: "Calm and kind", text: "Hey. I want to be honest, that's not something I'm into. Happy to keep talking but not going in that direction.", why: "Names the limit clearly without harsh judgment." },
  { style: "Firm redirect", text: "I'm going to pass on that. If you want to connect on something else, I'm open.", why: "Closes the door cleanly and leaves an opening if they want it." },
  { style: "Short and direct", text: "Not my thing, but thanks for being upfront. Let me know if you want to chat about something else.", why: "Brief and uncharged. Doesn't over-explain or apologise." },
  ],
  "Ask for consent": [
  { style: "Natural check-in", text: "I'm enjoying where this is going, are you? Just want to make sure we're on the same page.", why: "Checks in without making it clinical. Feels like a conversation, not a form." },
  { style: "Before escalating", text: "Would it be okay if I got a bit more direct? Want to check before I say the thing.", why: "Signals intent and asks for a green light. Playful but genuinely asks." },
  { style: "Open invitation", text: "Is this the kind of conversation you're open to? No pressure if not, just want to know.", why: "Clear opt-in framing. Gives them real room to say no." },
  ],
  "Escalate appropriately": [
  { style: "Confident step", text: "I've been thinking about what it would be like to actually meet you. What do you think?", why: "Expresses real desire and makes an implicit ask without being crude." },
  { style: "Warm push", text: "You're making me want to move this offline. I think we'd be good in person.", why: "States the interest clearly. Compliment + direction in one move." },
  { style: "Direct and warm", text: "I want to be honest. I'm pretty attracted to you. Figured you should know that.", why: "Consent-aware escalation: states attraction, gives them information to act on." },
  ],
  "Ask for a date": [
  { style: "Specific ask", text: "I'd like to get a drink with you. I'm free Thursday and Sunday, either of those work?", why: "Specific days close the loop. General asks ('sometime soon?') get vague answers." },
  { style: "Confident and easy", text: "I think we should meet. When are you free this week?", why: "Short, direct, and confident. Doesn't over-hedge or apologise for asking." },
  { style: "Callback to convo", text: "Okay you have to let me take you to that place you mentioned. Seriously, when are you free?", why: "References something from the conversation. Shows you were listening." },
  ],
  "Ask for clarity": [
  { style: "Honest and light", text: "Hey. I'm enjoying this but I realise I have no idea what you're looking for. Mind if I ask?", why: "Opens the door to clarity without drama. Frames it as curiosity, not accusation." },
  { style: "Direct but warm", text: "I want to be honest. I don't know what this is, and I'd rather ask than wonder.", why: "States the uncertainty directly and invites them to help resolve it." },
  { style: "Clear ask", text: "Are you in a good place to actually date right now? I'm asking because I like you and I want to know where I stand.", why: "Specific question + clear context. No ambiguity about why you're asking." },
  ],
  "Exit cleanly": [
  { style: "Kind and clear", text: "Hey. I've enjoyed chatting but I don't think this is going somewhere for me. I wanted to tell you rather than just disappear. Take care.", why: "Closes it with honesty and respect. Harder to say, kinder to receive." },
  { style: "Low-key fade", text: "I don't think we're quite the right fit, but this was a good conversation. Wishing you well.", why: "Warm without being performative. Says what's true and leaves clean." },
  { style: "After a date", text: "I had a good time, you're a great person. I just don't think the chemistry is there for me. I didn't want to leave you guessing.", why: "Post-date clarity. Specific and kind. 'You're great' without false promises." },
  ],
  };

  const fallbackKey = Object.keys(banks).includes(goal) ? goal : "Flirt playfully";
  const replies = (banks[fallbackKey] ?? banks["Flirt playfully"]) as Reply[];

  void isFlattery; void isDirect; void isExit; void isBoundary; void isDate; void isConsent; void isClarity; void isEscalate; void tone;

  return {
  replies,
  coachNote: `These are drafts, you know the conversation, the person, and the vibe. Adjust the words to sound like you. The goal is to give you a clear starting point, not a script.`,
  };
}

function tryParseAi(raw: string | undefined, fallback: FlirtResult): FlirtResult {
  if (!raw) return fallback;
  try {
  const p = JSON.parse(raw) as { replies?: unknown[]; coachNote?: string };
  if (!Array.isArray(p.replies) || p.replies.length < 2) return fallback;
  return {
  replies: (p.replies as { style?: string; text?: string; why?: string }[])
.filter(r => r.text && r.text.length > 5)
.map(r => ({ style: r.style ?? "Option", text: r.text ?? "", why: r.why ?? "" })),
  coachNote: typeof p.coachNote === "string" ? p.coachNote : fallback.coachNote,
  };
  } catch { return fallback; }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
  <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast({ title: "Copied!" }); setTimeout(() => setCopied(false), 2000); }}
  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
  style={{ color: copied ? "hsl(var(--brand-green))" : undefined }}>
  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
  <span className={copied ? "" : "text-muted-foreground"}>{copied ? "Copied" : "Copy"}</span>
  </button>
  );
}

export default function FlirtCoach() {
  useMeta("Flirt Coach", "Draft messages for any moment, flirting, consent, boundaries, date asks, and clean exits.");
  const [situation, setSituation] = useState("");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<FlirtResult | null>(null);
  const enhance = useEnhanceAi();

  function handleGenerate() {
  const fb = buildFallback(situation, goal, tone);
  setResult(fb);
  setStep(1);
  const goalObj = GOALS.find(g => g.label === goal);
  const prompt = [
  situation && `Situation:\n${situation}`,
  goal && `Goal: ${goal}, ${goalObj?.desc ?? ""}`,
  tone && `Preferred tone: ${tone}`,
  ].filter(Boolean).join("\n\n") +
  `\n\nReturn JSON: { "replies": [{ "style": string, "text": string, "why": string }] (3 items with complete ready-to-send message text), "coachNote": string }. Make messages specific, natural, and copy-ready. No manipulation, no pressure, no coercion. Frame as suggestions the user controls.`;
  enhance.mutate({ data: { toolName: "Flirt Coach", prompt, expectJson: true } }, {
  onSuccess: data => { const raw = (data as { output?: string } | undefined)?.output; setResult(tryParseAi(raw, fb)); },
  });
  }

  function reset() { setResult(null); setSituation(""); setGoal(""); setTone(""); setStep(0); enhance.reset(); }

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-rose fixed w-[360px] h-[360px] -top-10 -right-10 opacity-20 pointer-events-none" />
  <div className="orb orb-gold fixed w-[260px] h-[260px] bottom-10 -left-10 opacity-15 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">

  <motion.div {...fadeUp(0)} className="mb-6">
  <Link href="/copilot" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
  <ArrowLeft className="w-3.5 h-3.5" /> Wingman Studio
  </Link>
  </motion.div>

  <motion.div {...fadeUp(0.03)} className="mb-6">
  <div className="flex items-center gap-2 mb-2">
  <Flame className="w-4 h-4 text-[hsl(348_55%_65%)]" />
  <p className="text-sm font-medium text-[hsl(348_55%_75%)]">Wingman Studio</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">Flirt Coach</h1>
  <FallbackRateBadge toolName="Flirt Coach" className="mt-1" />

  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">Draft messages for any moment, flirting, setting limits, asking for what you want, or leaving clean. All of it, no shame.</p>
  </motion.div>

  {/* Safety statement */}
  <motion.div {...fadeUp(0.05)} className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
  <Shield className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground/50 leading-relaxed">
  <strong className="text-muted-foreground/65">All messages are draft suggestions.</strong>{" "}
  You decide what to send, how, and when. No manipulation techniques, no coercive framing, just clear, respectful options that sound like you.
  </p>
  </motion.div>

  <motion.div {...fadeUp(0.06)} className="flex items-center gap-2 mb-6">
  {[0, 1].map(s => (
  <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "flex-1 bg-[hsl(348_55%_65%)]" : "w-6 bg-white/10"}`} />
  ))}
  <span className="text-xs text-muted-foreground/40 ml-1">Step {step + 1} of 2</span>
  </motion.div>

  <AnimatePresence mode="wait">
  {step === 0 ? (
  <motion.div key="form" {...fadeUp(0.07)} className="glass border border-white/8 rounded-3xl p-6 sm:p-7 space-y-6">

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
  What's the situation? <span className="font-normal normal-case text-muted-foreground/40">(optional but helps)</span>
  </Label>
  <Textarea value={situation} onChange={e => setSituation(e.target.value)}
  placeholder={"Describe what's happened so far, just enough context.\n\nE.g. \"We've been texting for a week, good banter, she went quiet for 2 days and just came back. I want to ask her out but not seem desperate.\"\n\nOr leave blank for general options."}
  className="min-h-[110px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/35 text-sm" />
  </div>

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What do you want to do?</Label>
  <div className="grid sm:grid-cols-2 gap-2">
  {GOALS.map(g => (
  <button key={g.label} onClick={() => setGoal(prev => prev === g.label ? "" : g.label)}
  className={`px-4 py-3 rounded-xl border text-left transition-all ${goal === g.label ? "bg-[hsl(348_55%_65%/0.15)] border-[hsl(348_55%_65%/0.4)] text-foreground" : "border-white/8 text-muted-foreground hover:border-white/18 hover:text-foreground"}`}>
  <div className="flex items-center gap-2">
  <span className="text-base">{g.emoji}</span>
  <div>
  <p className="text-xs font-semibold leading-tight">{g.label}</p>
  <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-tight">{g.desc}</p>
  </div>
  </div>
  </button>
  ))}
  </div>
  </div>

  <div className="space-y-2">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Tone <span className="font-normal normal-case text-muted-foreground/40">(optional)</span></Label>
  <div className="flex flex-wrap gap-2">
  {TONES.map(t => (
  <button key={t} onClick={() => setTone(prev => prev === t ? "" : t)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${tone === t ? "bg-[hsl(348_55%_65%/0.15)] text-[hsl(348_55%_75%)] border-[hsl(348_55%_65%/0.35)]" : "border-white/8 text-muted-foreground hover:border-white/18 hover:text-foreground"}`}>
  {t}
  </button>
  ))}
  </div>
  </div>

  <Button onClick={handleGenerate} disabled={!goal}
  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(348_55%_60%)] to-[hsl(248_62%_55%)] border-0 disabled:opacity-40">
  <Flame className="mr-2 h-4 w-4" /> Draft My Messages
  </Button>
  </motion.div>
  ) : (
  <motion.div key="results" {...fadeUp(0.05)} className="space-y-4">
  {enhance.isPending && (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(348_55%_65%/0.08)] border border-[hsl(348_55%_65%/0.2)] text-xs text-[hsl(348_55%_75%)]">
  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing your options…
  </div>
  )}

  {result && (
  <>
  {/* Goal label */}
  <div className="flex items-center gap-2">
  <span className="text-xs font-bold uppercase tracking-wider text-[hsl(348_55%_65%)]">
  {goal || "Message drafts"}
  </span>
  {tone && <span className="text-xs text-muted-foreground/40">· {tone}</span>}
  </div>

  {/* Reply options */}
  <div className="glass border border-white/8 rounded-2xl p-5">
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Your options</p>
  <div className="space-y-5">
  {result.replies.map((r, i) => (
  <div key={i} className="border-t border-white/5 first:border-t-0 pt-5 first:pt-0 space-y-2">
  <div className="flex items-center justify-between">
  <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(348_55%_65%)]">{r.style}</span>
  <CopyBtn text={r.text} />
  </div>
  <p className="text-sm text-foreground leading-relaxed bg-white/3 rounded-xl px-4 py-3 border border-white/6">
  "{r.text}"
  </p>
  {r.why && (
  <p className="text-[11px] text-muted-foreground/45 leading-relaxed pl-1">{r.why}</p>
  )}
  </div>
  ))}
  </div>
  </div>

  {/* Coach note */}
  {result.coachNote && (
  <div className="rounded-2xl border border-[hsl(348_55%_65%/0.2)] bg-[hsl(348_55%_65%/0.06)] px-5 py-4">
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(348_55%_65%)] mb-1.5">Wingman Note</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{result.coachNote}</p>
  </div>
  )}
  </>
  )}

  <div className="flex justify-center">
  <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
  <RefreshCw className="w-3.5 h-3.5" /> Different situation
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
