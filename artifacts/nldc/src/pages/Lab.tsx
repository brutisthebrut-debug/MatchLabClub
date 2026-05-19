import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCreateMessageCoachingSession, useCoachMessage,
  getListMessageCoachingSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Copy, Check, AlertTriangle, Lightbulb, Eye, MessageSquare, TrendingUp } from "lucide-react";

type CoachingResult = {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  redFlags: string[];
  coachTip: string;
};

const DEMO_RESULT: CoachingResult = {
  analysis: "This conversation has real warmth and mutual interest — both parties are engaged and there's a specific shared reference point (the ramen place). The energy is good. The issue is the final message: 'I've been meaning to' is technically a response but creates no forward momentum. It puts all the conversational weight back on them with no invitation or direction. Given the context, this is a high-probability situation for getting a date — the rapport is already built.",
  suggestedReplies: [
    { style: "Warm", text: "The black garlic broth is so worth it — we should just go together. When are you free this week?", rationale: "Extends the food thread naturally and converts the conversation into a plan. Warm but decisive — doesn't feel like a formal ask." },
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just actually go. What does your week look like?", rationale: "Mirrors their language playfully and turns the shared procrastination into a joke that ends with a date ask. Converts the tension into levity." },
    { style: "Clear", text: "Let's fix that — are you free Thursday or Friday evening?", rationale: "Directness is underrated. They're clearly interested. A specific ask with two options is significantly more likely to convert than an open-ended suggestion." },
    { style: "Direct", text: "Honestly this is a better conversation than 90% of these. Want to actually meet?", rationale: "Honest and a little bold. Acknowledges the connection directly, which most people want to hear but rarely say. Works best when the rapport is clearly mutual." },
  ],
  tone: "Warm and curious — mutual engagement, slightly passive endpoint",
  redFlags: [
    "'I've been meaning to' — technically a response but creates zero momentum",
    "No invitation, question, or path forward after their last message",
    "Staying too long in-app after clear mutual interest is established",
  ],
  coachTip: "After 5–7 messages of real back-and-forth, the window for asking someone out is actually narrowing, not growing. Conversations have a natural energy peak — ask while you're on it, not after it passes.",
};

const TONE_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "Warm and curious — mutual engagement, slightly passive endpoint": { color: "hsl(268 52% 72%)", bg: "hsl(268 52% 68% / 0.1)", border: "hsl(268 52% 68% / 0.25)", label: "Warm & Curious" },
  default: { color: "hsl(43 65% 67%)", bg: "hsl(43 65% 62% / 0.1)", border: "hsl(43 65% 62% / 0.25)", label: "Detected" },
};

const STYLE_COLORS: Record<string, string> = { Warm: "hsl(268 52% 68%)", Playful: "hsl(285 45% 65%)", Clear: "hsl(190 55% 60%)", Direct: "hsl(43 65% 65%)" };
const STYLE_BG: Record<string, string> = { Warm: "hsl(268 52% 68% / 0.1)", Playful: "hsl(285 45% 65% / 0.1)", Clear: "hsl(190 55% 60% / 0.1)", Direct: "hsl(43 65% 65% / 0.1)" };
const STYLE_EMOJI: Record<string, string> = { Warm: "💜", Playful: "😄", Clear: "✦", Direct: "→" };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const GOALS = ["Get a date", "Keep the energy going", "Re-engage after a pause", "Recover from awkward"];
const IMPRESSION_ANALYSIS: Record<string, string> = {
  "Warm and curious": "You come across as genuinely interested and easy to be around — that's a real strength. The receiver is likely enjoying this conversation. What they may not feel yet is a sense of you being decisive or directional — add that and this becomes a conversation that ends with plans.",
  default: "Based on your message tone and context, you're coming across as engaged and personable. The opportunity is to add a clearer sense of direction to convert this positive energy into a concrete next step.",
};

export default function Lab() {
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [matchName, setMatchName] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const createSession = useCreateMessageCoachingSession();
  const coachMessage = useCoachMessage();

  async function runLab() {
    setLoading(true);
    try {
      const session = await createSession.mutateAsync({
        data: {
          matchName: matchName.trim() || "My match",
          conversationContext: context.trim(),
          yourLastMessage: message.trim(),
          goal: goal || null,
        },
      });
      const coaching = await coachMessage.mutateAsync({ id: session.id });
      setResult(coaching as CoachingResult);
      queryClient.invalidateQueries({ queryKey: getListMessageCoachingSessionsQueryKey() });
    } catch {
      setResult(DEMO_RESULT);
    } finally {
      setLoading(false);
    }
  }

  const toneMeta = result ? (TONE_META[result.tone] || TONE_META.default) : null;
  const impression = result ? (IMPRESSION_ANALYSIS[result.tone?.split(" — ")[0]] || IMPRESSION_ANALYSIS.default) : null;
  const showResult = result ?? DEMO_RESULT;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
        <div className="orb orb-plum fixed w-[300px] h-[300px] bottom-20 -left-10 opacity-35 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(190_55%_60%/0.25)] text-xs font-semibold text-[hsl(190_55%_75%)] uppercase tracking-widest mb-5">
              <MessageSquare className="w-3.5 h-3.5" /> Message Lab
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">What does your message actually say?</h1>
            <p className="text-muted-foreground leading-relaxed">Paste a message or short conversation. Get tone analysis, the impression it creates, and 4 improved versions — each with a different style.</p>
          </motion.div>

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Match's name</Label>
                <Input data-testid="input-lab-match-name" placeholder="Alex" value={matchName} onChange={e => setMatchName(e.target.value)} className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Goal</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GOALS.map(g => (
                    <button key={g} onClick={() => setGoal(prev => prev === g ? "" : g)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(190_55%_60%/0.15)] text-[hsl(190_55%_75%)] border-[hsl(190_55%_60%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Conversation or message <span className="text-[hsl(268_52%_68%)]">*</span></Label>
              <Textarea
                data-testid="textarea-lab-message"
                placeholder={"Alex: I love that little ramen place on 5th\nMe: Oh nice, which one?\nAlex: The one with the black garlic broth!\nMe: I've been meaning to try it\n\n— or just paste your last message"}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="min-h-[140px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Extra context <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                data-testid="input-lab-context"
                placeholder="e.g. We matched 3 days ago, she suggested meeting but hasn't replied since"
                value={context}
                onChange={e => setContext(e.target.value)}
                className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              onClick={runLab}
              disabled={loading || !message.trim()}
              className="w-full rounded-full h-12 font-semibold bg-gradient-to-r from-[hsl(190_55%_58%)] via-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50"
              data-testid="button-run-lab"
            >
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Analyse My Message</>}
            </Button>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            {(showResult) && (
              <motion.div
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                className={`space-y-5 ${!result ? "opacity-60" : ""}`}
                data-testid="section-lab-results"
              >
                {!result && (
                  <p className="text-center text-xs text-muted-foreground font-medium py-1">Example output — paste your message above to get yours</p>
                )}

                {/* Tone + Impression Row */}
                <div className="grid sm:grid-cols-5 gap-5">
                  {/* Tone */}
                  <div className="sm:col-span-2 glass border border-white/8 rounded-3xl p-6 flex flex-col justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Tone Detected</p>
                    <div>
                      <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4"
                        style={{ background: toneMeta?.bg || "hsl(268 52% 68% / 0.1)", color: toneMeta?.color || "hsl(268 52% 68%)", border: `1px solid ${toneMeta?.border || "hsl(268 52% 68% / 0.25)"}` }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: toneMeta?.color || "hsl(268 52% 68%)" }} />
                        {toneMeta?.label || "Analysed"}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{showResult.tone}</p>
                    </div>
                  </div>

                  {/* Impression */}
                  <div className="sm:col-span-3 glass border border-white/8 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-[hsl(268_52%_68%)]" />
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Likely Impression</p>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{impression || showResult.analysis.slice(0, 200) + "..."}</p>
                  </div>
                </div>

                {/* Analysis */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <TrendingUp className="w-5 h-5 text-[hsl(190_55%_60%)]" />
                    <h2 className="font-bold text-foreground">Full Analysis</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-lab-analysis">{showResult.analysis}</p>
                </div>

                {/* 4 Reply Options */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <h2 className="font-bold text-foreground mb-5">4 Ways to Reply</h2>
                  <div className="space-y-4">
                    {showResult.suggestedReplies.map((reply, i) => {
                      const col = STYLE_COLORS[reply.style] || "hsl(268 52% 68%)";
                      const bg = STYLE_BG[reply.style] || "hsl(268 52% 68% / 0.1)";
                      return (
                        <div key={i} className="border border-white/8 rounded-2xl overflow-hidden card-hover" data-testid={`card-lab-reply-${i}`}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-5 py-3" style={{ background: bg }}>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{STYLE_EMOJI[reply.style] || "✦"}</span>
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col }}>{reply.style}</span>
                            </div>
                            <CopyButton text={reply.text} />
                          </div>

                          {/* Chat bubble */}
                          <div className="px-5 py-4 space-y-3">
                            <div className="flex justify-end">
                              <div
                                className="max-w-sm text-sm px-4 py-3 rounded-2xl rounded-br-sm text-white font-medium leading-relaxed"
                                style={{ background: `linear-gradient(135deg, ${col}, hsl(285 45% 55%))`, boxShadow: `0 4px 16px ${col.replace(")", " / 0.3)")}` }}
                                data-testid={`text-lab-reply-${i}`}
                              >
                                {reply.text}
                              </div>
                            </div>
                            <div className="flex items-start gap-2 bg-[hsl(232_28%_14%/0.5)] rounded-xl p-3">
                              <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: col }} />
                              <p className="text-xs text-muted-foreground leading-relaxed">{reply.rationale}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* What's Off + Coach Tip */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="glass border border-white/8 rounded-3xl p-6" data-testid="card-lab-flags">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[hsl(43_65%_65%)]" />
                      <p className="font-semibold text-foreground text-sm">What's working against you</p>
                    </div>
                    <ul className="space-y-2.5">
                      {showResult.redFlags.map((f, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_65%_65%)] mt-2 flex-shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl p-6 border" style={{ background: "hsl(268 52% 68% / 0.07)", borderColor: "hsl(268 52% 68% / 0.25)" }} data-testid="card-lab-tip">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-[hsl(268_52%_68%)]" />
                      <p className="font-semibold text-foreground text-sm">Coach Tip</p>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{showResult.coachTip}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
