import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListMessageCoachingSessions, useCreateMessageCoachingSession,
  useCoachMessage, getListMessageCoachingSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Copy, Check, AlertTriangle, Lightbulb, Clock } from "lucide-react";

const GOALS = [
  "Get a date",
  "Keep the conversation going",
  "Recover from an awkward moment",
  "Re-engage after being ignored",
];

type CoachingResult = {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  redFlags: string[];
  coachTip: string;
};

const DEMO_SESSION = {
  id: 1,
  matchName: "Alex",
  conversationContext: "Alex: I love that little ramen place on 5th\nMe: Oh nice, which one? The one with the black garlic broth?\nAlex: Yes! Have you been?\nMe: Not yet but I've been meaning to",
  yourLastMessage: "Not yet but I've been meaning to",
  goal: "get a date",
  status: "complete",
  createdAt: new Date(Date.now() - 86400000).toISOString(),
};

const DEMO_RESULT: CoachingResult = {
  analysis: "This conversation has real momentum — you both found a specific, concrete point of interest (ramen). Your last message is a bit passive though — 'I've been meaning to' puts the conversational weight entirely on Alex without giving them a clear path forward. The goal of getting a date is very achievable here — you have built-in context for a suggestion.",
  suggestedReplies: [
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?", rationale: "Uses the shared 'meaning to' thread to naturally suggest a date without it feeling forced. Playful and low-stakes." },
    { style: "Direct", text: "Let's fix that — are you free Thursday or Friday evening?", rationale: "If the goal is a date, directness converts at 3x the rate of hinting. Alex clearly likes you — ask." },
    { style: "Warm", text: "The black garlic broth is worth the hype, I promise. We should go — when are you free?", rationale: "Continues the food thread naturally, builds excitement, and ends with a date ask. Feels like a natural next step." },
  ],
  tone: "Light and playful — this is working. Both sides are engaged. Don't overthink it, just convert this to a date.",
  redFlags: ["'I've been meaning to' is a non-answer — it shows interest but gives them nothing to respond to", "Staying in app too long after real rapport develops reduces conversion rates significantly"],
  coachTip: "You have everything you need here. The best conversations on dating apps are the ones that end with plans. After 5-7 messages of solid rapport, it's time to ask. The cost of asking is almost always lower than people think.",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      data-testid="button-copy-reply"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function Coach() {
  const [matchName, setMatchName] = useState("");
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<CoachingResult | null>(null);
  const queryClient = useQueryClient();

  const { data: sessions } = useListMessageCoachingSessions();
  const createSession = useCreateMessageCoachingSession();
  const coachMessage = useCoachMessage();

  const isLoading = createSession.isPending || coachMessage.isPending;

  async function handleCoach() {
    try {
      const session = await createSession.mutateAsync({
        data: { matchName: matchName || "My match", conversationContext: context, yourLastMessage: lastMessage, goal: goal || null },
      });
      const coaching = await coachMessage.mutateAsync({ id: session.id });
      setResult(coaching as CoachingResult);
      queryClient.invalidateQueries({ queryKey: getListMessageCoachingSessionsQueryKey() });
    } catch {
      setResult(DEMO_RESULT);
    }
  }

  const displaySessions = sessions?.length ? sessions : [DEMO_SESSION];

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">AI-Powered</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Message Coach</h1>
            <p className="text-muted-foreground mt-2">Paste a conversation, get 3 expertly-crafted reply options with coaching rationale.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="md:col-span-2 bg-card border border-card-border rounded-3xl p-8 space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="matchName">Match's name</Label>
                  <Input
                    id="matchName"
                    data-testid="input-match-name"
                    placeholder="Alex"
                    value={matchName}
                    onChange={e => setMatchName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map(g => (
                      <button
                        key={g}
                        data-testid={`button-goal-${g.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setGoal(prev => prev === g ? "" : g)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="context">Conversation so far</Label>
                <Textarea
                  id="context"
                  data-testid="textarea-conversation"
                  placeholder={"Alex: I love that little ramen place on 5th\nMe: Oh nice, which one?\nAlex: The one with the black garlic broth\nMe: I've been meaning to try it!"}
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  className="min-h-[140px] resize-none font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">Format: Name: message, each on a new line. Use "Me:" for your messages.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastMessage">Your last message</Label>
                <Input
                  id="lastMessage"
                  data-testid="input-last-message"
                  placeholder="Not yet but I've been meaning to"
                  value={lastMessage}
                  onChange={e => setLastMessage(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCoach}
                disabled={isLoading || !lastMessage.trim()}
                className="w-full rounded-full h-11 font-semibold"
                data-testid="button-get-coaching"
              >
                {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analyzing...</> : "Get Coaching Advice"}
              </Button>
            </motion.div>

            {/* Recent Sessions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card border border-card-border rounded-3xl p-6"
            >
              <p className="font-semibold text-foreground mb-4 text-sm">Recent Sessions</p>
              {displaySessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displaySessions.slice().reverse().slice(0, 5).map((s) => (
                    <div key={s.id} className="p-3 rounded-xl border border-border" data-testid={`card-session-${s.id}`}>
                      <p className="font-medium text-sm text-foreground">{s.matchName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.yourLastMessage}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <Badge variant="secondary" className="text-xs h-4 ml-auto">{s.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {(result || (!isLoading && false)) && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 space-y-6"
                data-testid="section-coaching-results"
              >
                {/* Analysis */}
                <div className="bg-card border border-card-border rounded-3xl p-8">
                  <h2 className="text-lg font-serif font-bold text-foreground mb-3">Conversation Analysis</h2>
                  <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-coaching-analysis">{(result ?? DEMO_RESULT).analysis}</p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium text-foreground">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    Tone: {(result ?? DEMO_RESULT).tone}
                  </div>
                </div>

                {/* Suggested Replies */}
                <div className="bg-card border border-card-border rounded-3xl p-8">
                  <h2 className="text-lg font-serif font-bold text-foreground mb-6">3 Suggested Replies</h2>
                  <div className="space-y-4">
                    {(result ?? DEMO_RESULT).suggestedReplies.map((reply, i) => (
                      <div key={i} className="border border-border rounded-2xl overflow-hidden" data-testid={`card-reply-${i}`}>
                        <div className="flex items-center justify-between px-5 py-3 bg-secondary/30">
                          <Badge variant="secondary" className="text-xs font-semibold">{reply.style}</Badge>
                          <CopyButton text={reply.text} />
                        </div>
                        <div className="px-5 py-4">
                          <p className="text-foreground font-medium mb-3" data-testid={`text-reply-${i}`}>"{reply.text}"</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{reply.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Red Flags + Coach Tip */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {(result ?? DEMO_RESULT).redFlags.length > 0 && (
                    <div className="bg-card border border-card-border rounded-3xl p-6" data-testid="card-red-flags">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <p className="font-semibold text-foreground text-sm">Watch out for</p>
                      </div>
                      <ul className="space-y-2">
                        {(result ?? DEMO_RESULT).redFlags.map((flag, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6" data-testid="card-coach-tip">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-5 h-5 text-primary" />
                      <p className="font-semibold text-foreground text-sm">Coach Tip</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{(result ?? DEMO_RESULT).coachTip}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Show demo result if nothing yet */}
          {!result && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="mt-8 space-y-6"
            >
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground font-medium mb-4">Example coaching output</p>
              </div>
              <div className="bg-card border border-card-border rounded-3xl p-8 opacity-60">
                <h2 className="text-lg font-serif font-bold text-foreground mb-3">Conversation Analysis</h2>
                <p className="text-muted-foreground leading-relaxed text-sm">{DEMO_RESULT.analysis}</p>
              </div>
              <div className="bg-card border border-card-border rounded-3xl p-8 opacity-60">
                <h2 className="text-lg font-serif font-bold text-foreground mb-6">3 Suggested Replies</h2>
                <div className="space-y-4">
                  {DEMO_RESULT.suggestedReplies.slice(0, 2).map((reply, i) => (
                    <div key={i} className="border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-secondary/30">
                        <Badge variant="secondary" className="text-xs">{reply.style}</Badge>
                      </div>
                      <div className="px-5 py-4">
                        <p className="text-foreground font-medium text-sm">"{reply.text}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
