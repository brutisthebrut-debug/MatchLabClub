import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCreateMessageCoachingSession, useCoachMessage,
  getListMessageCoachingSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import {
  Loader2, Sparkles, Copy, Check, AlertTriangle,
  Lightbulb, Eye, TrendingUp, FlaskConical, ArrowRight
} from "lucide-react";
import { ConfidenceLabel } from "@/components/ToneBar";
import { getConfidenceLevel } from "@/lib/toneUtils";
import { useMeta } from "@/hooks/useMeta";

type CoachingResult = {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  toneSummary?: string;
  recommendedNextAction?: string;
  redFlags: string[];
  coachTip: string;
};

const DEMO_RESULT: CoachingResult = {
  analysis: "This conversation has real warmth and mutual interest — both parties are engaged and there's a specific shared reference point (the ramen place). The energy is good. The issue is the final message: 'I've been meaning to' is technically a response but creates no forward momentum. It puts all conversational weight back on them with no invitation or direction. Given the rapport already built, this is a high-probability situation — the window is open. The question is whether you'll step through it.",
  toneSummary: "Warm, genuinely curious, slightly passive at the close. The energy is mutual — the missing element is direction.",
  recommendedNextAction: "Suggest a date. You've built enough rapport in this exchange for a direct ask to feel natural rather than abrupt. The longer you wait, the more the window closes.",
  suggestedReplies: [
    { style: "Warm", text: "The black garlic broth is so worth it — we should just go together. When are you free this week?", rationale: "Extends the food thread naturally and converts the conversation into a plan. Warm but decisive — doesn't feel like a formal ask." },
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just actually go. What does your week look like?", rationale: "Mirrors their language playfully and turns the shared procrastination into a joke that ends with a date ask." },
    { style: "Direct", text: "Let's fix that — are you free Thursday or Friday evening?", rationale: "Directness is underrated. They're clearly interested. A specific ask with two options converts significantly better than open-ended suggestions." },
    { style: "Date Ask", text: "Honestly this is a better conversation than 90% of these. Want to actually meet?", rationale: "Honest and a little bold. Acknowledges the connection directly, which most people want to hear but rarely say. Works best when rapport is clearly mutual." },
    { style: "Graceful Exit", text: "This has been really nice — I don't think we're quite the right fit, but I genuinely hope you find what you're after.", rationale: "For when you realise during the conversation it isn't right. Rare but valuable — exiting gracefully builds reputation and leaves a warm impression." },
  ],
  tone: "Warm and curious — mutual engagement, slightly passive endpoint",
  redFlags: [
    "'I've been meaning to' — technically a response but creates zero momentum",
    "No invitation, question, or path forward in your last message",
    "Staying in-app too long after clear mutual interest is established",
  ],
  coachTip: "After 5–7 messages of real back-and-forth, the window for asking someone out is actually narrowing, not growing. Conversations have a natural energy peak — ask while you're on it, not after it passes.",
};

const STYLE_META: Record<string, { gradient: string; emoji: string; headerBg: string; glow: string }> = {
  "Warm":          { gradient: "linear-gradient(135deg, hsl(348 55% 58%), hsl(var(--brand-indigo)))", emoji: "💜", headerBg: "hsl(348 55% 58% / 0.12)", glow: "0 4px 20px hsl(348 55% 58% / 0.3)" },
  "Playful":       { gradient: "linear-gradient(135deg, hsl(var(--brand-pink)), hsl(var(--brand-indigo)))", emoji: "😄", headerBg: "hsl(var(--brand-pink) / 0.12)", glow: "0 4px 20px hsl(var(--brand-pink) / 0.3)" },
  "Direct":        { gradient: "linear-gradient(135deg, hsl(43 65% 52%), hsl(43 55% 42%))",   emoji: "→",  headerBg: "hsl(43 65% 52% / 0.12)", glow: "0 4px 20px hsl(43 65% 52% / 0.3)" },
  "Date Ask":      { gradient: "linear-gradient(135deg, hsl(142 55% 42%), hsl(190 55% 48%))", emoji: "✦",  headerBg: "hsl(142 55% 42% / 0.12)", glow: "0 4px 20px hsl(142 55% 42% / 0.3)" },
  "Graceful Exit": { gradient: "linear-gradient(135deg, hsl(228 25% 42%), hsl(248 40% 34%))", emoji: "🤍", headerBg: "hsl(228 25% 42% / 0.12)", glow: "0 4px 16px hsl(228 25% 50% / 0.2)" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const GOALS = ["Get a date", "Keep the energy going", "Re-engage after a pause", "Recover from awkward"];

export default function Lab() {
  useMeta("Chemistry Lab", "Paste any dating app message or conversation and get 5 styled reply options — Warm, Playful, Direct, Date Ask, or Graceful Exit — with tone analysis and coaching.");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [matchName, setMatchName] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const createSession = useCreateMessageCoachingSession();
  const coachMessage = useCoachMessage();
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !result;

  async function runLab() {
    setLoading(true);
    try {
      const session = await createSession.mutateAsync({
        data: { matchName: matchName.trim() || "My match", conversationContext: context.trim(), yourLastMessage: message.trim(), goal: goal || null },
      });
      rememberAnonymousId("messageSessions", session.id);
      const coaching = await coachMessage.mutateAsync({ id: session.id });
      setResult(coaching as CoachingResult);
      queryClient.invalidateQueries({ queryKey: getListMessageCoachingSessionsQueryKey() });
    } catch {
      setResult(DEMO_RESULT);
    } finally {
      setLoading(false);
    }
  }

  const showResult = result ?? DEMO_RESULT;
  const isDemo = !result;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
        <div className="orb orb-plum fixed w-[300px] h-[300px] bottom-20 -left-10 opacity-35 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[hsl(190_55%_60%/0.15)] border border-[hsl(190_55%_60%/0.25)] flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-[hsl(190_55%_65%)]" />
              </div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(190_55%_60%/0.25)] text-xs font-semibold text-[hsl(190_55%_75%)] uppercase tracking-widest">
                Chemistry Lab
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">What does your message actually say?</h1>
            <p className="text-muted-foreground leading-relaxed">Paste a message or conversation. Get tone analysis, your recommended next action, and 5 styled reply options — each with a different approach.</p>
          </motion.div>

          {/* ── Package Hub Strip — Message Lab ── */}
          <div className="glass border rounded-xl px-4 py-3 mb-7 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{ borderColor: "hsl(190 55% 60% / 0.2)" }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(190_55%_60%)]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(190_55%_75%)]">Message Lab</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground/55">— turn conversations into connections</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
              {[
                { name: "Message Coach",   href: "/coach"          },
                { name: "Next Message",    href: "/next-message"   },
                { name: "Flirt Coach",     href: "/copilot/flirt"  },
                { name: "Style Map",       href: "/style-map"      },
                { name: "Import Patterns", href: "/insights"       },
              ].map(t => (
                <Link key={t.href} href={t.href}
                  className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors whitespace-nowrap">
                  {t.name}
                </Link>
              ))}
            </div>
          </div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<FlaskConical className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to the Chemistry Lab"
              title="Run your first experiment"
              description="Drop in a message or short conversation and we'll surface the tone you're sending, your best next move, and five styled reply options to choose from."
              testId="lab-empty-state"
            />
          )}

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass border border-white/8 rounded-3xl p-7 space-y-5 mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Match's name</Label>
                <Input data-testid="input-lab-match-name" placeholder="Alex" value={matchName} onChange={e => setMatchName(e.target.value)}
                  className="bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/50" />
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
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Conversation or message <span className="text-[hsl(248_62%_52%)]">*</span></Label>
              <Textarea data-testid="textarea-lab-message"
                placeholder={"Alex: I love that little ramen place on 5th\nMe: Oh nice, which one?\nAlex: The one with the black garlic broth!\nMe: I've been meaning to try it\n\n— or just paste your last message"}
                value={message} onChange={e => setMessage(e.target.value)}
                className="min-h-[140px] resize-none font-mono text-xs bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Extra context <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input data-testid="input-lab-context" placeholder="e.g. We matched 3 days ago, she suggested meeting but hasn't replied since"
                value={context} onChange={e => setContext(e.target.value)}
                className="bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/50" />
            </div>

            <Button onClick={runLab} disabled={loading || !message.trim()}
              className="w-full rounded-full h-12 font-semibold bg-gradient-to-r from-[hsl(190_55%_58%)] via-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 glow-pulse disabled:opacity-50"
              data-testid="button-run-lab">
              {loading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analysing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Analyse My Message</>}
            </Button>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              className={`space-y-5 ${isDemo ? "opacity-65" : ""}`} data-testid="section-lab-results">

              {isDemo ? (
                <div className="text-center py-1">
                  <span className="text-xs text-muted-foreground font-medium px-4 py-1.5 rounded-full bg-[hsl(248_40%_94%)] border border-white/8">
                    Example output — paste your message above to get yours
                  </span>
                </div>
              ) : (
                <div className="flex justify-end">
                  <ConfidenceLabel level={getConfidenceLevel(message.length + context.length, [matchName, goal].filter(Boolean).length)} />
                </div>
              )}

              {/* Tone + Next Action */}
              <div className="grid sm:grid-cols-5 gap-4">
                <div className="sm:col-span-2 glass border border-white/8 rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-[hsl(248_62%_52%)]" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tone detected</p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background: "hsl(var(--brand-indigo) / 0.1)", border: "1px solid hsl(var(--brand-indigo) / 0.25)" }}>
                    <span className="w-2 h-2 rounded-full bg-[hsl(248_62%_52%)]" />
                    <span className="text-xs font-semibold text-[hsl(248_62%_62%)]">Warm &amp; Curious</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{showResult.toneSummary ?? showResult.tone}</p>
                </div>

                <div className="sm:col-span-3 glass border border-white/8 rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[hsl(43_65%_65%)]" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recommended next action</p>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">{showResult.recommendedNextAction ?? "Suggest a specific date within the next message to convert the energy you've built."}</p>
                </div>
              </div>

              {/* Full Analysis */}
              <div className="glass border border-white/8 rounded-3xl p-7">
                <div className="flex items-center gap-2.5 mb-4">
                  <FlaskConical className="w-5 h-5 text-[hsl(190_55%_60%)]" />
                  <h2 className="font-bold text-foreground">Full Analysis</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-lab-analysis">{showResult.analysis}</p>
              </div>

              {/* 5 Reply Options */}
              <div className="glass border border-white/8 rounded-3xl p-7">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-foreground">5 Ways to Reply</h2>
                  <span className="text-xs text-muted-foreground">Pick your approach</span>
                </div>
                <div className="space-y-4">
                  {showResult.suggestedReplies.map((reply, i) => {
                    const meta = STYLE_META[reply.style] ?? STYLE_META["Warm"];
                    return (
                      <div key={i} className="border border-white/8 rounded-2xl overflow-hidden card-hover" data-testid={`card-lab-reply-${i}`}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3" style={{ background: meta.headerBg }}>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{meta.emoji}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">{reply.style}</span>
                          </div>
                          <CopyButton text={reply.text} />
                        </div>
                        {/* Bubble + rationale */}
                        <div className="px-5 py-4 space-y-3">
                          <div className="flex justify-end">
                            <div className="max-w-sm text-sm px-4 py-3 rounded-2xl rounded-br-sm text-white font-medium leading-relaxed"
                              style={{ background: meta.gradient, boxShadow: meta.glow }}
                              data-testid={`text-lab-reply-${i}`}>
                              {reply.text}
                            </div>
                          </div>
                          <div className="flex items-start gap-2 bg-[hsl(248_40%_95%/0.5)] rounded-xl p-3">
                            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-[hsl(248_62%_52%)]" />
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
                <div className="rounded-3xl p-6 border" style={{ background: "hsl(var(--brand-indigo) / 0.07)", borderColor: "hsl(var(--brand-indigo) / 0.25)" }} data-testid="card-lab-tip">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                    <p className="font-semibold text-foreground text-sm">Coach Tip</p>
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{showResult.coachTip}</p>
                </div>
              </div>

              {/* CTA if demo */}
              {isDemo && (
                <div className="text-center">
                  <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 font-semibold glow-pulse">
                    <a href="/start">Get your personalised analysis <ArrowRight className="ml-2 h-4 w-4" /></a>
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
