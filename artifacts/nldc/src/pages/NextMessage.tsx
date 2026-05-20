import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, MessageCircle, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";
import { useEnhanceAi } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { nextMessageSchema, parseAiJson } from "@/lib/aiSchemas";
import { ToneBar, ConfidenceLabel, getConfidenceLevel } from "@/components/ToneBar";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface MessageOption {
  style: string;
  text: string;
  when: string;
  color: string;
  bg: string;
}

interface NextMessageResult {
  options: MessageOption[];
  coachNote: string;
}

const GOALS = ["Keep it alive", "Suggest meeting", "Re-engage after quiet", "Follow up on something", "Wind it down gracefully"];

function generateMessages(context: string, lastMsg: string, name: string, goal: string): NextMessageResult {
  const lower = (context + " " + lastMsg).toLowerCase();
  const isQuiet = goal === GOALS[2];
  const isMeeting = goal === GOALS[1];
  const isWindDown = goal === GOALS[4];
  const hasHumor = /laugh|fun|joke|haha|lol|banter|wit/.test(lower);
  const hasShared = /we|both|us|our|together|same/.test(lower);
  const n = name || "them";

  const options: MessageOption[] = [
    {
      style: "Safe",
      text: isQuiet
        ? `Hey — I was thinking about what you said about [thing from conversation]. Still thinking about it.`
        : isMeeting
        ? `I'd genuinely love to meet up. When does your week open up?`
        : `I keep coming back to [something specific from the conversation]. What made you say that?`,
      when: "When you want to restart without pressure. Low-stakes, references something real.",
      color: "hsl(228 18% 65%)",
      bg: "hsl(228 18% 65% / 0.08)",
    },
    {
      style: "Warm",
      text: isQuiet
        ? `I didn't want things to go quiet without saying — I had a really good time talking with you.`
        : isMeeting
        ? `I've been thinking about you. Would love to actually meet — are you free this week?`
        : `I really enjoy talking with you. This has been one of the better conversations I've had on here.`,
      when: "When there's real warmth and you want to signal genuine interest without pressure.",
      color: "hsl(348 55% 65%)",
      bg: "hsl(348 55% 65% / 0.08)",
    },
    {
      style: "Playful",
      text: isQuiet
        ? `You went quiet on me. I'm choosing to interpret that as you thinking of something really good to say.`
        : hasHumor
        ? `Okay I have to know — [follow-up on something funny they said]. This has been bothering me.`
        : `I feel like we've been building up to an actual conversation. When does that happen?`,
      when: "When the vibe has been light and banter-y. Keeps things easy.",
      color: "hsl(43 65% 65%)",
      bg: "hsl(43 65% 65% / 0.08)",
    },
    {
      style: "Bold",
      text: isMeeting
        ? `I like you. Let's meet — Thursday or Friday?`
        : isWindDown
        ? `I want to be honest with you — I've been a bit unsure about the direction here. Worth a conversation?`
        : `I'm going to say the thing nobody says: I'm actually interested in getting to know you properly. Let's do something about that.`,
      when: "When you've been dancing around the obvious thing. Clear, confident, attractive.",
      color: "hsl(268 52% 68%)",
      bg: "hsl(268 52% 68% / 0.08)",
    },
    {
      style: "Direct",
      text: isMeeting
        ? `Are you free Thursday evening? I know a good place.`
        : isQuiet
        ? `I noticed things got quiet. I'd rather name it than let it drift — are we still good?`
        : `What are you actually looking for right now? I'd rather know than guess.`,
      when: "Direct without being blunt. Works when you want real information fast.",
      color: "hsl(190 55% 60%)",
      bg: "hsl(190 55% 60% / 0.08)",
    },
    {
      style: "Invitation",
      text: isMeeting
        ? `There's a [place / thing] I've been wanting to try — would you want to come?`
        : `This is the kind of conversation that's better in person. Want to find out if that's true?`,
      when: "Suggests something without making it a big ask. Feels natural, not pressured.",
      color: "hsl(142 55% 60%)",
      bg: "hsl(142 55% 60% / 0.08)",
    },
    {
      style: "Clean Exit",
      text: isWindDown
        ? `I've really enjoyed talking with you. I think I'm in a slightly different place than what might work for you right now — but I'm genuinely glad we connected.`
        : `I've been reflecting on where things are and I think I owe you some honesty. I've had a great time chatting — I just don't think I can give this what it deserves right now. I hope you find someone who can.`,
      when: "A kind, clean close. No ambiguity, no hard feelings, no bridge burned.",
      color: "hsl(228 18% 55%)",
      bg: "hsl(228 18% 55% / 0.08)",
    },
  ];

  const coachNotes = [
    isWindDown ? "A kind exit is a dignified move. The version of it that leaves the other person's dignity intact is always worth writing." : "",
    isMeeting ? "The best time to ask for the meeting was a few messages ago. The second best time is now. Just ask." : "",
    isQuiet ? "Going quiet doesn't always mean loss of interest — but it does mean someone needs to move. The one who cares more should be the one to break it." : "",
    hasShared ? "There's real shared ground in your conversation — use it. Reference something specific. Generic openers get generic responses." : "",
    "Copy-paste is a starting point. The version that works is the one with one specific detail from your actual conversation swapped in.",
  ].filter(Boolean);

  return {
    options,
    coachNote: coachNotes[0] || "Personalize before sending — replace any bracketed text with something real from your conversation. The more specific, the better it lands.",
  };
}

const DEMO: NextMessageResult = {
  options: [
    { style: "Safe",       text: "I keep coming back to what you said about [thing from conversation]. What made you say that?",                                           when: "When you want to restart without pressure.",                                  color: "hsl(228 18% 65%)", bg: "hsl(228 18% 65% / 0.08)" },
    { style: "Warm",       text: "I really enjoy talking with you. This has been one of the better conversations I've had on here.",                                        when: "When there's real warmth and you want to signal genuine interest.",           color: "hsl(348 55% 65%)", bg: "hsl(348 55% 65% / 0.08)" },
    { style: "Playful",    text: "I feel like we've been building up to an actual conversation. When does that happen?",                                                    when: "When the vibe has been light. Keeps things easy.",                            color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.08)"  },
    { style: "Bold",       text: "I'm going to say the thing nobody says: I'm actually interested in getting to know you properly. Let's do something about that.",          when: "When you've been dancing around the obvious thing.",                          color: "hsl(268 52% 68%)", bg: "hsl(268 52% 68% / 0.08)" },
    { style: "Direct",     text: "What are you actually looking for right now? I'd rather know than guess.",                                                                when: "Works when you want real information fast.",                                 color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.08)" },
    { style: "Invitation", text: "This is the kind of conversation that's better in person. Want to find out if that's true?",                                             when: "Suggests something without making it a big ask.",                            color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.08)" },
    { style: "Clean Exit", text: "I've had a great time chatting — I just don't think I can give this what it deserves right now. I hope you find someone who can.",        when: "A kind, clean close. No ambiguity, no bridge burned.",                        color: "hsl(228 18% 55%)", bg: "hsl(228 18% 55% / 0.08)" },
  ],
  coachNote: "Personalize before sending — replace any bracketed text with something real from your conversation. The more specific, the better it lands.",
};

function CopyBtn({ text, style: msgStyle }: { text: string; style?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast({ title: "Copied!", description: msgStyle ? `${msgStyle} message ready to paste.` : "Message copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs font-medium transition-colors flex-shrink-0"
      style={{ color: copied ? "hsl(142 55% 60%)" : undefined }}
      data-testid="button-copy-next-message"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
      <span className={copied ? "" : "text-muted-foreground"}>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function NextMessage() {
  useMeta("Next Message", "Paste context and get 7 copy-ready message options — safe, warm, playful, bold, direct, an invitation, and a clean exit. All with copy buttons.");
  const [context, setContext] = useState("");
  const [lastMsg, setLastMsg] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<NextMessageResult | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const enhance = useEnhanceAi();
  const loading = enhance.isPending;
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result && !loading;

  function tryParseNextMessage(raw: string, deterministic: NextMessageResult): NextMessageResult | null {
    const parsed = parseAiJson(nextMessageSchema, raw);
    if (!parsed) return null;
    const palette = deterministic.options;
    const options: MessageOption[] = parsed.options.map((o: { style: string; text: string; when?: string }, i: number) => {
      const fallback = palette[i] ?? palette[0];
      return {
        style: o.style,
        text: o.text,
        when: o.when || fallback.when,
        color: fallback.color,
        bg: fallback.bg,
      };
    });
    return { options, coachNote: parsed.coachNote };
  }

  async function handleGenerate(extraTone?: string) {
    if (!context.trim() && !lastMsg.trim()) return;
    const deterministic = generateMessages(context, lastMsg, name, goal);
    try {
      const ai = await enhance.mutateAsync({
        data: {
          toolName: "Next Message",
          prompt: [
            "Generate 7 reply options for the user's dating conversation as JSON.",
            "Shape: { options: [{ style: string, text: string, when: string }], coachNote: string }.",
            "Use these 7 style labels in order: Safe, Warm, Playful, Bold, Direct, Invitation, Clean Exit.",
            "Each text should be a copy-ready single message (1-3 sentences). 'when' is a one-line note on when to use it.",
            "coachNote is one short paragraph of practical advice for this specific conversation.",
            "",
            name ? `Their name: ${name}` : "",
            goal ? `User's goal: ${goal}` : "",
            context.trim() ? `Conversation context:\n${context}` : "",
            lastMsg.trim() ? `Their last message / user's last message: ${lastMsg}` : "",
            extraTone ? `Tone instruction: ${extraTone}` : "",
          ].filter(Boolean).join("\n"),
          context: {
            toolName: "Next Message",
            formValues: { name, goal, conversation: context, lastMessage: lastMsg },
          },
          expectJson: true,
        },
      });
      const validationFailed = ai.validated === false;
      if (ai.isFallback || validationFailed || !ai.output.trim()) {
        setUsedFallback(true);
        setResult(deterministic);
        return;
      }
      const parsed = tryParseNextMessage(ai.output, deterministic);
      setUsedFallback(parsed == null);
      setResult(parsed ?? deterministic);
    } catch {
      setUsedFallback(true);
      setResult(deterministic);
    }
  }

  const show = result ?? DEMO;
  const isDemo = !result && !isAuthenticated;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[360px] h-[360px] -top-10 -right-10 opacity-30 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Communication Tools</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Next Message</h1>
            <p className="text-muted-foreground mt-2">Give us context. Get seven copy-ready options — from safe to bold to clean exit. Pick the one that fits.</p>
          </motion.div>

          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Their name <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex"
                  className="w-full h-10 rounded-xl px-3 text-sm bg-[hsl(232_28%_14%)] border border-white/10 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[hsl(268_52%_68%/0.4)]" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your goal</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GOALS.map(g => (
                    <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                      className={`px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Conversation context</Label>
              <Textarea placeholder={"Paste the conversation or describe what's been happening…\n\nAlex: I love that little wine bar on Oak Street\nMe: The one with the exposed brick? I've been wanting to go\nAlex: Yes! We should go sometime"}
                value={context} onChange={e => setContext(e.target.value)}
                className="min-h-[120px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Last message sent <span className="font-normal normal-case text-muted-foreground/50">(optional)</span></Label>
              <input value={lastMsg} onChange={e => setLastMsg(e.target.value)} placeholder="What was the last thing you said?"
                className="w-full h-10 rounded-xl px-3 text-sm bg-[hsl(232_28%_14%)] border border-white/10 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[hsl(268_52%_68%/0.4)]" />
            </div>
            <Button onClick={() => { void handleGenerate(); }} disabled={loading || (!context.trim() && !lastMsg.trim())}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Writing options…</> : <><Sparkles className="mr-2 h-4 w-4" />Get My 7 Options</>}
            </Button>
          </motion.div>

          {isBrandNewUser && (
            <motion.div
              {...fadeUp(0.1)}
              className="mb-6"
              data-testid="next-message-empty-state"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
                style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.12), hsl(285 45% 60% / 0.08))" }}>
                <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(285_45%_62%/0.15)] border border-[hsl(285_45%_62%/0.25)] mx-auto mb-4 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-[hsl(285_52%_78%)]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(285_60%_82%)] mb-2">Welcome to Next Message</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Write your first reply</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                    Add a little context above and we'll deliver seven copy-ready options — Safe, Warm, Playful, Bold, Direct, an Invitation, and a Clean Exit.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {!isBrandNewUser && (
            <motion.div {...fadeUp(0.1)} className={isDemo ? "opacity-60" : ""}>
              {isDemo && (
                <div className="text-center mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />Example options — fill in context above to get yours
                  </p>
                </div>
              )}
              {!isDemo && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-muted-foreground/60">Your options</p>
                  <ConfidenceLabel level={getConfidenceLevel(context.length + lastMsg.length, [name, goal].filter(Boolean).length)} />
                </div>
              )}
              {!isDemo && usedFallback && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-[hsl(43_65%_65%/0.25)] bg-[hsl(43_65%_65%/0.08)] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[hsl(43_65%_70%)]" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="text-[hsl(43_65%_78%)] font-semibold">Using backup options.</span>{" "}
                      The AI couldn't return a clean answer this time, so we showed you our coach-written set. You can try again for a fresh take.
                    </p>
                  </div>
                  <Button
                    onClick={() => { void handleGenerate(); }}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs border-[hsl(43_65%_65%/0.4)] hover:border-[hsl(43_65%_65%/0.6)] hover:bg-[hsl(43_65%_65%/0.1)] flex-shrink-0"
                    data-testid="button-retry-next-message"
                  >
                    {loading ? <Loader2 className="animate-spin mr-1.5 h-3.5 w-3.5" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                    Try again
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {show.options.map((opt, i) => (
                  <motion.div key={i} {...fadeUp(0.04 * i)}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: opt.color.replace(")", " / 0.2)") }}>
                    <div className="flex items-center justify-between px-5 py-2.5" style={{ background: opt.bg }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: opt.color }}>{opt.style}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground/60 hidden sm:block">{opt.when}</span>
                        <CopyBtn text={opt.text} style={opt.style} />
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="flex justify-end">
                        <div className="max-w-sm text-sm px-4 py-3 rounded-2xl rounded-br-md text-white font-medium"
                          style={{ background: `linear-gradient(135deg, ${opt.color}, hsl(285 45% 55%))` }}>
                          {opt.text}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 sm:hidden">{opt.when}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div {...fadeUp(0.3)} className="mt-4 rounded-2xl border border-[hsl(268_52%_68%/0.2)] bg-[hsl(268_52%_68%/0.06)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(268_52%_68%)] mb-1.5">Coach Note</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{show.coachNote}</p>
              </motion.div>
              {result && (
                <ToneBar onApply={(hint) => { void handleGenerate(hint); }} loading={loading} />
              )}
              {result && (
                <div className="mt-5 flex justify-center">
                  <button onClick={() => { setResult(null); setContext(""); setLastMsg(""); setName(""); setGoal(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />New conversation
                  </button>
                </div>
              )}
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
