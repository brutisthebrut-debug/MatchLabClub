import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Flag,
  Heart,
  MapPin,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  UserX,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DateChapterCard } from "@/components/journey/DateChapterCard";
import {
  useGetConnection,
  getGetConnectionQueryKey,
  useGetConnectionMessages,
  getGetConnectionMessagesQueryKey,
  useGetConnectionProfile,
  getGetConnectionProfileQueryKey,
  useGetConnectionStarters,
  getGetConnectionStartersQueryKey,
  useSuggestConnectionDateIdeas,
  useCheckOutgoingMessage,
  useSendConnectionMessage,
  useMarkConnectionRead,
  useUnmatchConnection,
  useReportConnection,
  getGetConnectionsQueryKey,
  type ConnectionMessage,
  type ConnectionStarter,
  type DateIdea,
  type ReportConnectionInputReason,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.4,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// Relative serving URLs (e.g. "storage/objects/<id>") are served by the API,
// which lives under /api. Absolute or already-rooted URLs are passed through.
function photoSrc(url: string): string {
  if (url.startsWith("http") || url.startsWith("/")) return url;
  return `/api/${url}`;
}

const REPORT_REASONS: { value: ReportConnectionInputReason; label: string }[] = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "scam", label: "Scam or spam" },
  { value: "safety", label: "Safety concern" },
  { value: "underage", label: "Looks underage" },
  { value: "other", label: "Something else" },
];

// Demo compatibility + openers so the page never looks empty for signed-out
// visitors. The real values come from the API once you sign in.
const DEMO_COMPATIBILITY = {
  score: 82,
  summary: "Strong overall fit, and you are about 8 miles apart.",
};

const DEMO_STARTERS: ConnectionStarter[] = [
  {
    text: "Hey there. Glad we matched. What is something you are genuinely into right now that you could talk about for an hour?",
    rationale: "Opens with warmth and an easy, open question.",
  },
  {
    text: "Real question to kick us off: are you more of a plan-the-weekend person or a see-where-the-day-goes person?",
    rationale: "A light either-or is simple to answer.",
  },
  {
    text: "Quick one to break the ice: give me your most defensible hot take. Could be food, could be movies.",
    rationale: "Playful and low stakes, it sparks a real reply.",
  },
];

// Demo date ideas so the page never looks empty for signed-out visitors. The
// real set comes from the API once you sign in and ask for ideas.
const DEMO_DATE_IDEAS: DateIdea[] = [
  {
    title: "Coffee and a walk",
    description:
      "Meet for coffee near both of you and take a slow walk after. Low pressure, easy to leave early or keep going.",
    category: "coffee",
  },
  {
    title: "Shared plates dinner",
    description:
      "Pick a spot with small plates so you can try a few things and compare notes. Ordering together is its own little icebreaker.",
    category: "food",
  },
  {
    title: "Something outdoors",
    description:
      "Find a park or an easy trail and spend an hour outside. Walking side by side takes the pressure off.",
    category: "outdoors",
  },
];

// 70+ reads as a strong fit, 40-69 as forming, below that as early days.
function scoreLabel(score: number): string {
  if (score >= 70) return "looks strong";
  if (score >= 40) return "is forming";
  return "is early";
}

const DEMO_MESSAGES: ConnectionMessage[] = [
  {
    id: "d1",
    connectionId: "demo",
    senderUserId: "them",
    body: "Hey, glad we matched. Your readiness profile is impressive.",
    mine: false,
    createdAt: new Date(Date.now() - 5_400_000).toISOString(),
    readAt: new Date().toISOString(),
  },
  {
    id: "d2",
    connectionId: "demo",
    senderUserId: "me",
    body: "Thank you. Yours too. What is your ideal weekend?",
    mine: true,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    readAt: new Date().toISOString(),
  },
];

export default function MatchThread() {
  const [, params] = useRoute("/matches/:id");
  const id = params?.id ?? "";
  useMeta("Conversation", "Your conversation with a mutual match.");

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDemo = !isAuthenticated;

  const [draft, setDraft] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [safetyAdvice, setSafetyAdvice] = useState<string | null>(null);
  const [reportReason, setReportReason] =
    useState<ReportConnectionInputReason>("harassment");
  const endRef = useRef<HTMLDivElement>(null);

  const connectionQuery = useGetConnection(id, {
    query: {
      queryKey: getGetConnectionQueryKey(id),
      enabled: isAuthenticated && id.length > 0,
      retry: false,
    },
  });
  const messagesQuery = useGetConnectionMessages(id, {
    query: {
      queryKey: getGetConnectionMessagesQueryKey(id),
      enabled: isAuthenticated && id.length > 0,
      retry: false,
      refetchInterval: 15_000,
    },
  });
  // Profile loads eagerly (not gated on the reveal toggle) so the compatibility
  // score shows up front. The server still withholds name and photos until the
  // counterpart turns reveal consent on; only the symmetric score and aggregate
  // summary come through pre-reveal.
  const profileQuery = useGetConnectionProfile(id, {
    query: {
      queryKey: getGetConnectionProfileQueryKey(id),
      enabled: isAuthenticated && id.length > 0,
      retry: false,
    },
  });
  // Starters only render on an active thread with no messages yet (see the
  // StartersCard gate below), so we only fetch them under that exact condition.
  // Firing eagerly on every thread open would burn a Claude daily-cap token for
  // consent-on users on a card that never shows (closed threads, ongoing chats).
  const startersQuery = useGetConnectionStarters(id, {
    query: {
      queryKey: getGetConnectionStartersQueryKey(id),
      enabled:
        isAuthenticated &&
        id.length > 0 &&
        connectionQuery.isSuccess &&
        connectionQuery.data?.status !== "closed" &&
        messagesQuery.isSuccess &&
        (messagesQuery.data?.length ?? 0) === 0,
      retry: false,
    },
  });

  const sendMessage = useSendConnectionMessage();
  const checkMessage = useCheckOutgoingMessage();
  const markRead = useMarkConnectionRead();
  const unmatch = useUnmatchConnection();
  const report = useReportConnection();

  const connection = connectionQuery.data ?? null;
  const messages = isDemo ? DEMO_MESSAGES : (messagesQuery.data ?? []);
  const closed = connection?.status === "closed";
  const starters = isDemo
    ? DEMO_STARTERS
    : (startersQuery.data?.starters ?? []);

  // Mark the thread read on open and whenever new inbound messages arrive.
  useEffect(() => {
    if (isDemo || !id || !connection) return;
    if (messages.some((m) => !m.mine && m.readAt === null)) {
      markRead.mutate(
        { id },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getGetConnectionsQueryKey(),
            });
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, id, connection, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const invalidateThread = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionMessagesQueryKey(id),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionQueryKey(id),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetConnectionsQueryKey(),
    });
  };

  const performSend = (body: string) => {
    if (isDemo || !body || sendMessage.isPending || closed) return;
    setSafetyAdvice(null);
    sendMessage.mutate(
      { id, data: { body } },
      {
        onSuccess: () => {
          setDraft("");
          invalidateThread();
        },
        onError: () => {
          toast({ title: "Couldn't send that message. Try again." });
        },
      },
    );
  };

  // Pre-send safety nudge. The deterministic engine screens every outgoing
  // draft (plus the recent thread, which the user already sees) for
  // romance-scam patterns. Only an elevated read pauses the send with an "are
  // you sure?" confirm; a clean or low read sends straight through. The check
  // is best-effort: if it errors, we never block the message.
  const handleSend = () => {
    const body = draft.trim();
    if (
      isDemo ||
      !body ||
      sendMessage.isPending ||
      checkMessage.isPending ||
      closed
    )
      return;
    const recentContext = messages
      .slice(-8)
      .map((m) => `${m.mine ? "You" : "Them"}: ${m.body}`)
      .join("\n")
      .slice(0, 8000);
    checkMessage.mutate(
      {
        data: {
          draft: body,
          conversationContext: recentContext.length > 0 ? recentContext : null,
        },
      },
      {
        onSuccess: (result) => {
          if (result.risk === "elevated") {
            setSafetyAdvice(
              result.advice.trim().length > 0
                ? result.advice
                : "This message could be heading toward a scam. Take a moment before you send.",
            );
          } else {
            performSend(body);
          }
        },
        onError: () => {
          performSend(body);
        },
      },
    );
  };

  const handleUnmatch = () => {
    if (isDemo) return;
    unmatch.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateThread();
          toast({ title: "You unmatched. This conversation is now closed." });
        },
      },
    );
  };

  const handleReport = () => {
    if (isDemo) return;
    report.mutate(
      { id, data: { reason: reportReason } },
      {
        onSuccess: () => {
          setReportOpen(false);
          invalidateThread();
          toast({
            title: "Report sent.",
            description:
              "We closed this conversation and our team will review it.",
          });
        },
      },
    );
  };

  if (isDemo) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg py-10 px-4">
          <div className="max-w-2xl mx-auto relative z-10">
            <Link
              href="/matches"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to matches
            </Link>
            <div
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              data-testid="banner-thread-sample"
            >
              <p className="text-sm text-muted-foreground">
                This is a sample conversation. Sign in to talk to your real
                matches.
              </p>
              <Button
                onClick={() => login()}
                size="sm"
                className="rounded-full"
                data-testid="button-thread-signin"
              >
                Sign in
              </Button>
            </div>
            <CompatibilityCard
              score={DEMO_COMPATIBILITY.score}
              summary={DEMO_COMPATIBILITY.summary}
            />
            <div className="glass border border-white/10 rounded-2xl p-4 space-y-3">
              {DEMO_MESSAGES.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
            </div>
            <div className="mt-4">
              <DateIdeasCard id={id} isDemo />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!connectionQuery.isLoading && !connection) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg py-10 px-4">
          <div className="max-w-2xl mx-auto relative z-10 text-center pt-16">
            <p className="text-sm text-muted-foreground mb-4">
              This conversation could not be found.
            </p>
            <Link href="/matches">
              <Button size="sm" className="rounded-full">
                Back to matches
              </Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const reveal = profileQuery.data;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-8 px-4">
        <div className="orb orb-indigo fixed w-[360px] h-[360px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-5">
            <Link
              href="/matches"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              data-testid="link-back-matches"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Matches
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => setShowReveal((v) => !v)}
                data-testid="button-toggle-reveal"
              >
                {showReveal ? "Hide profile" : "View profile"}
              </Button>
              {!closed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs text-muted-foreground"
                  onClick={handleUnmatch}
                  disabled={unmatch.isPending}
                  data-testid="button-unmatch"
                >
                  <UserX className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  Unmatch
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-xs text-[hsl(350_80%_72%)]"
                onClick={() => setReportOpen((v) => !v)}
                data-testid="button-open-report"
              >
                <Flag className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Report
              </Button>
            </div>
          </div>

          {!closed && <DateChapterCard />}

          {reveal?.compatibilityScore != null && (
            <CompatibilityCard
              score={reveal.compatibilityScore}
              summary={reveal.matchSummary}
            />
          )}

          {closed && (
            <div
              className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-muted-foreground"
              data-testid="banner-thread-closed"
            >
              This conversation is closed
              {connection?.closedReason
                ? ` (${connection.closedReason})`
                : ""}
              . You can no longer send messages here.
            </div>
          )}

          {reportOpen && (
            <motion.div
              {...fadeUp(0)}
              className="mb-4 glass border border-[hsl(350_70%_60%/0.25)] rounded-2xl p-4"
              data-testid="panel-report"
            >
              <p className="text-sm font-semibold text-foreground mb-1">
                Report this match
              </p>
              <p className="text-xs text-muted-foreground/70 mb-3">
                We will close the conversation and our team will review it.
                Reporting never affects your Match Readiness.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={reportReason}
                  onValueChange={(v) =>
                    setReportReason(v as ReportConnectionInputReason)
                  }
                >
                  <SelectTrigger
                    className="w-56 rounded-full"
                    data-testid="select-report-reason"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={handleReport}
                  disabled={report.isPending}
                  data-testid="button-submit-report"
                >
                  Send report
                </Button>
              </div>
            </motion.div>
          )}

          {showReveal && (
            <motion.div
              {...fadeUp(0)}
              className="mb-4 glass border border-white/10 rounded-2xl p-5"
              data-testid="panel-reveal"
            >
              {profileQuery.isLoading ? (
                <p className="text-sm text-muted-foreground/60">
                  Loading profile...
                </p>
              ) : reveal ? (
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(326_100%_62%)] flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {reveal.revealed && reveal.displayName
                          ? reveal.displayName
                          : "Your match"}
                      </p>
                      {!reveal.revealed && (
                        <Badge variant="secondary" className="text-[10px] mt-0.5">
                          Name and photos hidden until they opt in
                        </Badge>
                      )}
                    </div>
                  </div>
                  {reveal.revealed && reveal.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {reveal.photos.slice(0, 6).map((p, i) => (
                        <img
                          key={i}
                          src={photoSrc(p)}
                          alt="Match photo"
                          className="aspect-square w-full rounded-xl object-cover"
                          data-testid={`reveal-photo-${i}`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/80 leading-relaxed mb-1">
                    {reveal.readinessSummary}
                  </p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    {reveal.valuesSummary}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60">
                  Profile is not available yet.
                </p>
              )}
            </motion.div>
          )}

          {!closed && messages.length === 0 && starters.length > 0 && (
            <StartersCard starters={starters} onPick={setDraft} />
          )}

          <div
            className="glass border border-white/10 rounded-2xl p-4 min-h-[320px] flex flex-col"
            data-testid="thread-messages"
          >
            <div className="flex-1 space-y-3">
              {messagesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground/60">
                  Loading conversation...
                </p>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <Heart
                    className="w-7 h-7 text-muted-foreground/30 mx-auto mb-3"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted-foreground/70">
                    You matched. Send the first message.
                  </p>
                </div>
              ) : (
                messages.map((m) => <Bubble key={m.id} message={m} />)
              )}
              <div ref={endRef} />
            </div>
          </div>

          {safetyAdvice && (
            <motion.div
              {...fadeUp(0)}
              className="mt-3 glass border border-[hsl(38_92%_60%/0.35)] rounded-2xl p-4"
              data-testid="panel-safety-confirm"
            >
              <div className="flex items-start gap-2.5 mb-3">
                <ShieldAlert
                  className="w-4 h-4 text-[hsl(38_92%_60%)] flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Are you sure you want to send this?
                  </p>
                  <p
                    className="text-xs text-muted-foreground/80 leading-relaxed"
                    data-testid="text-safety-advice"
                  >
                    {safetyAdvice}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setSafetyAdvice(null)}
                  data-testid="button-safety-cancel"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => performSend(draft.trim())}
                  disabled={sendMessage.isPending || draft.trim().length === 0}
                  data-testid="button-safety-send-anyway"
                >
                  Send anyway
                </Button>
              </div>
            </motion.div>
          )}

          {!closed && (
            <div className="mt-3 flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (safetyAdvice) setSafetyAdvice(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Write a message..."
                rows={2}
                maxLength={4000}
                className="resize-none rounded-2xl"
                data-testid="input-message"
              />
              <Button
                onClick={handleSend}
                disabled={
                  sendMessage.isPending ||
                  checkMessage.isPending ||
                  draft.trim().length === 0
                }
                className="rounded-full h-11 w-11 p-0 flex-shrink-0"
                data-testid="button-send-message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {!closed && (
            <div className="mt-4">
              <DateIdeasCard id={id} isDemo={false} />
            </div>
          )}

          <div className="mt-5 flex items-start gap-2.5">
            <Shield
              className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-[11px] text-muted-foreground/45 leading-relaxed">
              Keep the conversation here until you trust each other. Never send
              money. You can unmatch or report at any time, and a report always
              closes the thread.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// Symmetric compatibility, shown up front. The score and aggregate summary are
// reveal-safe; name and photos stay behind the reveal toggle and server gate.
function CompatibilityCard({
  score,
  summary,
}: {
  score: number;
  summary: string | null;
}) {
  return (
    <motion.div
      {...fadeUp(0)}
      className="mb-4 glass border border-white/10 rounded-2xl p-4 flex items-center gap-3.5"
      data-testid="card-compatibility"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(326_100%_62%)] flex items-center justify-center flex-shrink-0">
        <span
          className="text-lg font-bold text-white"
          data-testid="text-compatibility-score"
        >
          {score}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Compatibility {scoreLabel(score)}
        </p>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {summary ??
            "How your readiness and values line up. The more you both share, the sharper this gets."}
        </p>
      </div>
    </motion.div>
  );
}

// Cold-start openers the user can drop into the composer and edit before sending.
function StartersCard({
  starters,
  onPick,
}: {
  starters: ConnectionStarter[];
  onPick: (text: string) => void;
}) {
  return (
    <motion.div
      {...fadeUp(0.05)}
      className="mb-4 glass border border-white/10 rounded-2xl p-4"
      data-testid="card-starters"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles
          className="w-4 h-4 text-[hsl(326_100%_70%)]"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-foreground">
          Openers to break the ice
        </p>
      </div>
      <p className="text-xs text-muted-foreground/60 mb-3">
        Tap one to drop it in, then make it yours before you send.
      </p>
      <div className="space-y-2">
        {starters.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s.text)}
            className="w-full text-left rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] p-3 transition-colors"
            data-testid={`button-starter-${i}`}
          >
            <p className="text-sm text-foreground leading-relaxed">{s.text}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {s.rationale}
            </p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// On-demand date ideas. It is a POST mutation, so it only spends the deep AI
// lane (for consent-on accounts) when the user actually asks. Demo mode shows a
// fixed set immediately; the real card stays collapsed behind a button until the
// user taps it. The location label is reveal-safe phrasing built by the server.
function DateIdeasCard({ id, isDemo }: { id: string; isDemo: boolean }) {
  const suggest = useSuggestConnectionDateIdeas();
  const ideas: DateIdea[] = isDemo
    ? DEMO_DATE_IDEAS
    : (suggest.data?.ideas ?? []);
  const locationLabel = isDemo
    ? "near both of you"
    : (suggest.data?.locationLabel ?? null);
  const hasResult = isDemo || suggest.isSuccess;

  const handleSuggest = () => {
    if (isDemo || suggest.isPending) return;
    suggest.mutate({ id });
  };

  return (
    <motion.div
      {...fadeUp(0.05)}
      className="glass border border-white/10 rounded-2xl p-4"
      data-testid="card-date-ideas"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <MapPin className="w-4 h-4 text-[hsl(326_100%_70%)]" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">
          Date ideas {locationLabel ?? "near both of you"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/60 mb-3">
        A few ways to take this off the app when you are both ready.
      </p>
      {hasResult && ideas.length > 0 ? (
        <div className="space-y-2">
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
              data-testid={`date-idea-${i}`}
            >
              <p className="text-sm text-foreground leading-relaxed">
                {idea.title}
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed">
                {idea.description}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full"
          onClick={handleSuggest}
          disabled={suggest.isPending}
          data-testid="button-suggest-date-ideas"
        >
          {suggest.isPending ? "Thinking..." : "Suggest date ideas"}
        </Button>
      )}
      {!isDemo && suggest.isError && (
        <p className="text-xs text-muted-foreground/50 mt-2">
          Could not load ideas just now. Try again.
        </p>
      )}
    </motion.div>
  );
}

function Bubble({ message }: { message: ConnectionMessage }) {
  return (
    <div
      className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.mine ? "mine" : "theirs"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          message.mine
            ? "bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_60%)] text-white"
            : "bg-white/[0.06] text-foreground border border-white/8"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}
