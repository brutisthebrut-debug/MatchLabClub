import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListMessageCoachingSessions, useCreateMessageCoachingSession,
  useCoachMessage, getListMessageCoachingSessionsQueryKey,
  useGetCoachFollowUpStats, getGetCoachFollowUpStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { MessageSquare, Loader2, Copy, Check, AlertTriangle, Lightbulb, Clock, ArrowRight, Sparkles, Send } from "lucide-react";

const GOALS = ["Get a date", "Keep it going", "Recover from awkward", "Re-engage after ghosting"];
const SOURCE_APPS = ["Hinge", "Bumble", "Tinder"] as const;
type SourceApp = (typeof SOURCE_APPS)[number];

function detectAppFromText(text: string): SourceApp | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  return null;
}

type CoachingResult = {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  redFlags: string[];
  coachTip: string;
};

const DEMO_RESULT: CoachingResult = {
  analysis: "This conversation has real momentum — you both found a specific, concrete point of interest (ramen). Your last message is passive though: 'I've been meaning to' puts the conversational weight entirely on them without a clear path forward. The goal of getting a date is very achievable here — you have built-in context for a suggestion.",
  suggestedReplies: [
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?", rationale: "Uses the shared 'meaning to' thread to naturally suggest a date. Playful and low-stakes — converts the existing joke into a moment." },
    { style: "Direct", text: "Let's fix that — are you free Thursday or Friday evening?", rationale: "Directness converts at 3× the rate of hinting. They clearly like you — just ask. The cost of asking is almost always lower than people think." },
    { style: "Warm", text: "The black garlic broth is worth the hype, I promise. We should go together — when are you free?", rationale: "Continues the food thread naturally, builds excitement, and ends with a date ask. Feels like the obvious next step." },
  ],
  tone: "Light and playful — this is working. Both sides are engaged.",
  redFlags: ["'I've been meaning to' is a non-answer — shows interest but gives them nothing to respond to", "Staying in app too long after real rapport builds reduces date conversion significantly"],
  coachTip: "You have everything you need here. After 5–7 messages of real rapport, it's time to ask. The best conversations end with plans — not more conversation.",
};

const DEMO_SESSION = {
  id: 1,
  matchName: "Alex",
  conversationContext: "conversation context",
  yourLastMessage: "Not yet but I've been meaning to",
  goal: "get a date",
  sourceApp: "Hinge",
  status: "complete" as const,
  createdAt: new Date(Date.now() - 86400000).toISOString(),
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex-shrink-0"
      data-testid="button-copy-reply"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const STYLE_COLORS: Record<string, string> = {
  Playful: "hsl(268 52% 68%)",
  Direct: "hsl(190 55% 60%)",
  Warm: "hsl(43 65% 65%)",
};

const STYLE_BG: Record<string, string> = {
  Playful: "hsl(268 52% 68% / 0.1)",
  Direct: "hsl(190 55% 60% / 0.1)",
  Warm: "hsl(43 65% 62% / 0.1)",
};

export default function Coach() {
  useMeta("Message Coach", "Paste any dating app conversation and get three personalised reply options — Playful, Direct, and Warm — with coaching rationale for each.");
  const [matchName, setMatchName] = useState("");
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [sourceApp, setSourceApp] = useState<SourceApp | "">("");
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [resultApp, setResultApp] = useState<SourceApp | null>(null);
  const detectedApp = sourceApp || detectAppFromText(`${context}\n${lastMessage}`) || "";
  const queryClient = useQueryClient();

  const { isAuthenticated } = useAuth();
  const { data: sessions, isLoading: sessionsLoading } = useListMessageCoachingSessions();
  const { data: followUpStats } = useGetCoachFollowUpStats({
    query: { enabled: isAuthenticated, queryKey: getGetCoachFollowUpStatsQueryKey() },
  });
  const createSession = useCreateMessageCoachingSession();
  const coachMessage = useCoachMessage();
  const isLoading = createSession.isPending || coachMessage.isPending;
  const hasSessions = !!(sessions && sessions.length > 0);
  const isBrandNewUser = isAuthenticated && !sessionsLoading && !hasSessions && !result;

  async function handleCoach() {
    const appForRequest =
      sourceApp || detectAppFromText(`${context}\n${lastMessage}`) || null;
    try {
      const session = await createSession.mutateAsync({
        data: { matchName: matchName || "My match", conversationContext: context, yourLastMessage: lastMessage, goal: goal || null, sourceApp: appForRequest },
      });
      rememberAnonymousId("messageSessions", session.id);
      const coaching = await coachMessage.mutateAsync({ id: session.id });
      setResult(coaching as CoachingResult);
      setResultApp(appForRequest);
      queryClient.invalidateQueries({ queryKey: getListMessageCoachingSessionsQueryKey() });
    } catch {
      setResult(DEMO_RESULT);
      setResultApp(appForRequest);
    }
  }

  const displaySessions = hasSessions ? sessions! : (isAuthenticated ? [] : [DEMO_SESSION]);
  const showResult = result ?? ((!isLoading && !isAuthenticated) ? DEMO_RESULT : null);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">AI-Powered</p>
            <h1 className="text-3xl font-bold text-foreground">Message Coach</h1>
            <p className="text-muted-foreground mt-2">Paste a conversation, get 3 expertly-crafted reply options — each with coaching rationale.</p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
              className="mb-6"
              data-testid="coach-empty-state"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
                style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.12), hsl(285 45% 60% / 0.08))" }}>
                <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(285_45%_62%/0.15)] border border-[hsl(285_45%_62%/0.25)] mx-auto mb-4 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[hsl(285_52%_78%)]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(285_60%_82%)] mb-2">Welcome to Message Coach</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Coach your first message</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                    Paste any dating app conversation below and we'll deliver three calibrated reply options — Playful, Direct, and Warm — each with the rationale a real coach would give.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid md:grid-cols-3 gap-5">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="md:col-span-2 glass border border-white/8 rounded-3xl p-7 space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Match's name</Label>
                  <Input
                    data-testid="input-match-name"
                    placeholder="Alex"
                    value={matchName}
                    onChange={e => setMatchName(e.target.value)}
                    className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Goal</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GOALS.map(g => (
                      <button
                        key={g}
                        data-testid={`button-goal-${g.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setGoal(prev => prev === g ? "" : g)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                  Source app
                  {!sourceApp && detectedApp ? (
                    <span className="ml-2 normal-case tracking-normal text-[10px] text-muted-foreground" data-testid="text-source-app-detected">
                      detected: {detectedApp}
                    </span>
                  ) : null}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCE_APPS.map(a => (
                    <button
                      key={a}
                      type="button"
                      data-testid={`button-source-app-${a.toLowerCase()}`}
                      onClick={() => setSourceApp(prev => prev === a ? "" : a)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${sourceApp === a ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Conversation so far</Label>
                <Textarea
                  data-testid="textarea-conversation"
                  placeholder={"Alex: I love that little ramen place on 5th\nMe: Oh nice, which one?\nAlex: The one with the black garlic broth!\nMe: I've been meaning to try it"}
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  className="min-h-[140px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
                />
                <p className="text-xs text-muted-foreground">Format: Name: message — each on a new line. Use "Me:" for your messages.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your last message</Label>
                <Input
                  data-testid="input-last-message"
                  placeholder="Not yet but I've been meaning to"
                  value={lastMessage}
                  onChange={e => setLastMessage(e.target.value)}
                  className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <Button
                onClick={handleCoach}
                disabled={isLoading || !lastMessage.trim()}
                className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50"
                data-testid="button-get-coaching"
              >
                {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Get Coaching Advice</>}
              </Button>
            </motion.div>

            <div className="space-y-5">
            {/* Send-through stats */}
            {isAuthenticated && followUpStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="glass border border-white/8 rounded-3xl p-5"
                data-testid="card-send-through-stats"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-4 h-4 text-[hsl(190_55%_60%)]" />
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Send-through</p>
                </div>
                {followUpStats.totalPrompts === 0 ? (
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="stats-empty-state">
                    Answer the "did you send it?" prompts in the mobile app and we'll track how often your coached replies actually go out.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground" data-testid="stats-total-prompts">{followUpStats.totalPrompts}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Prompts</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[hsl(142_55%_60%)]" data-testid="stats-sent-count">{followUpStats.sentCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-muted-foreground" data-testid="stats-not-sent-count">{followUpStats.notSentCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Skipped</p>
                      </div>
                    </div>
                    {followUpStats.lastAnswer && followUpStats.lastAnsweredAt && (
                      <div className="pt-3 border-t border-white/8">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last answer</p>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: followUpStats.lastAnswer === "sent" ? "hsl(142 55% 60% / 0.15)" : "hsl(232 28% 22%)",
                              color: followUpStats.lastAnswer === "sent" ? "hsl(142 55% 70%)" : "hsl(0 0% 70%)",
                            }}
                            data-testid="stats-last-answer"
                          >
                            {followUpStats.lastAnswer === "sent" ? "Sent" : "Not sent"}
                          </span>
                          <span className="text-xs text-muted-foreground" data-testid="stats-last-answered-at">
                            {new Date(followUpStats.lastAnsweredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Recent Sessions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass border border-white/8 rounded-3xl p-5"
            >
              <p className="font-semibold text-foreground text-sm mb-4 uppercase tracking-wider text-xs text-muted-foreground">Recent Sessions</p>
              {displaySessions.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="sessions-empty-state">
                  Your coached conversations will appear here once you analyze your first one.
                </p>
              ) : (
              <div className="space-y-3">
                {displaySessions.slice().reverse().slice(0, 5).map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-white/8 bg-[hsl(232_28%_14%/0.5)]" data-testid={`card-session-${s.id}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{s.matchName}</p>
                      {s.sourceApp ? (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(268_52%_68%/0.12)] text-[hsl(268_60%_78%)] border border-[hsl(268_52%_68%/0.3)]"
                          data-testid={`badge-session-${s.id}-app`}
                        >
                          {s.sourceApp}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.yourLastMessage}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span className="ml-auto text-xs tag-strength border px-2 py-0.5 rounded-full">{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </motion.div>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`mt-6 space-y-5 ${!result ? "opacity-60" : ""}`}
                data-testid="section-coaching-results"
              >
                {!result && (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground font-medium">Example coaching output — fill in the form above to get yours</p>
                  </div>
                )}

                {/* Analysis */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <h2 className="text-lg font-bold text-foreground">Conversation Analysis</h2>
                    {(result ? resultApp : (DEMO_SESSION.sourceApp as SourceApp)) ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(268_52%_68%/0.12)] text-[hsl(268_60%_78%)] border border-[hsl(268_52%_68%/0.3)]"
                        data-testid="badge-source-app"
                      >
                        {result ? resultApp : DEMO_SESSION.sourceApp}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-coaching-analysis">{showResult.analysis}</p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(232_28%_16%)] border border-white/8 text-sm font-medium text-foreground">
                    <span className="w-2 h-2 rounded-full bg-[hsl(268_52%_68%)]" />
                    Tone: {showResult.tone}
                  </div>
                </div>

                {/* 3 Reply Options */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <h2 className="text-lg font-bold text-foreground mb-5">3 Suggested Replies</h2>
                  <div className="space-y-4">
                    {showResult.suggestedReplies.map((reply, i) => (
                      <div
                        key={i}
                        className="border border-white/8 rounded-2xl overflow-hidden card-hover"
                        data-testid={`card-reply-${i}`}
                        style={{ borderColor: `${STYLE_COLORS[reply.style] || "hsl(268 52% 68%)"} / 0.2` }}
                      >
                        <div className="flex items-center justify-between px-5 py-3" style={{ background: STYLE_BG[reply.style] || "hsl(268 52% 68% / 0.08)" }}>
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: STYLE_COLORS[reply.style] || "hsl(268 52% 68%)" }}>
                            {reply.style}
                          </span>
                          <CopyButton text={reply.text} />
                        </div>
                        {/* Chat bubble */}
                        <div className="px-5 py-4">
                          <div className="flex justify-end mb-3">
                            <div
                              className="max-w-xs text-sm px-4 py-3 rounded-2xl rounded-br-md text-white font-medium"
                              style={{ background: `linear-gradient(135deg, ${STYLE_COLORS[reply.style] || "hsl(268 52% 68%)"}, hsl(285 45% 55%))` }}
                              data-testid={`text-reply-${i}`}
                            >
                              {reply.text}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{reply.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Red Flags + Coach Tip */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="glass border border-white/8 rounded-3xl p-6" data-testid="card-red-flags">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-[hsl(43_65%_65%)]" />
                      <p className="font-semibold text-foreground text-sm">Watch out for</p>
                    </div>
                    <ul className="space-y-2.5">
                      {showResult.redFlags.map((flag, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_65%_65%)] mt-2 flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl p-6 border" style={{ background: "hsl(268 52% 68% / 0.07)", borderColor: "hsl(268 52% 68% / 0.2)" }} data-testid="card-coach-tip">
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
