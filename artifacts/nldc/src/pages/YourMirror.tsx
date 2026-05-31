import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useMeta } from "@/hooks/useMeta";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  FileText,
  Heart,
  Eye,
  EyeOff,
  MessageCircle,
  Lightbulb,
  Send,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMirrorTrends,
  useGetMirrorPortrait,
  getGetMirrorPortraitQueryKey,
  useAskMirror,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useListJournalEntries,
  useListPostDateNotes,
  type MirrorPortrait,
} from "@workspace/api-client-react";
import { ClimbCard } from "@/components/climb/ClimbCard";
import { NextBestActionCoach } from "@/components/coach/NextBestActionCoach";
import { DEMO_PORTRAIT } from "@/lib/mirrorDemo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";

function ReadinessGauge({ score }: { score: number }) {
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const tone =
  score >= 75 ? "hsl(var(--brand-green))" : score >= 50 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";
  return (
  <div className="relative flex h-32 w-32 items-center justify-center">
  <svg viewBox="0 0 140 140" className="h-32 w-32 -rotate-90">
  <circle
  cx="70"
  cy="70"
  r={radius}
  stroke="hsl(var(--muted))"
  strokeWidth="10"
  fill="none"
  />
  <circle
  cx="70"
  cy="70"
  r={radius}
  stroke={tone}
  strokeWidth="10"
  fill="none"
  strokeLinecap="round"
  strokeDasharray={circ}
  strokeDashoffset={offset}
  />
  </svg>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="font-serif text-3xl font-bold">{score}</span>
  <span className="text-xs text-muted-foreground">/ 100</span>
  </div>
  </div>
  );
}

function ScoreDirectionIcon({
  direction,
}: {
  direction: "up" | "down" | "flat";
}) {
  if (direction === "up") return <TrendingUp className="h-5 w-5 text-emerald-500" />;
  if (direction === "down")
  return <TrendingDown className="h-5 w-5 text-rose-500" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

function ToneIcon({ tone }: { tone: "positive" | "watch" | "neutral" }) {
  if (tone === "positive")
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (tone === "watch")
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Sparkles className="h-4 w-4 text-muted-foreground" />;
}

function fmtShort(iso: string): string {
  try {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
  return "";
  }
}

function MirrorPortraitSection({
  portrait,
  isDemo,
}: {
  portrait: MirrorPortrait;
  isDemo: boolean;
}) {
  return (
  <div className="space-y-6">
  <Card
  data-testid="card-mirror-portrait"
  className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
  >
  <CardContent className="py-6">
  <div className="flex flex-wrap items-center gap-2">
  <Badge variant="secondary" className="gap-1">
  <Eye className="h-3 w-3" />
  {portrait.stageLabel}
  </Badge>
  <Badge variant="outline" className="text-xs">
  {portrait.coveragePercent}% of you mapped
  </Badge>
  {isDemo && (
  <Badge variant="outline" className="text-xs">
  Sample view, sign in for your own
  </Badge>
  )}
  </div>
  <p
  data-testid="text-mirror-headline"
  className="mt-4 font-serif text-xl leading-relaxed md:text-2xl"
  >
  {portrait.headline}
  </p>
  <p className="mt-2 text-sm text-muted-foreground">{portrait.stageBlurb}</p>
  </CardContent>
  </Card>

  <div className="grid gap-6 md:grid-cols-2">
  <Card data-testid="card-mirror-known">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <Eye className="h-5 w-5 text-violet-500" />
  What I can see so far
  </CardTitle>
  </CardHeader>
  <CardContent>
  {portrait.known.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  Nothing yet. Feed me one signal and I will start to know you.
  </p>
  ) : (
  <ul className="space-y-4">
  {portrait.known.map((k) => (
  <li key={k.key} data-testid={`row-known-${k.key}`}>
  <div className="flex items-center justify-between gap-2">
  <span className="text-sm font-medium">{k.label}</span>
  <span className="text-xs text-muted-foreground">
  {k.coverage}% covered · {k.confidence}% sure
  </span>
  </div>
  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
  <div
  className="h-full rounded-full bg-violet-500"
  style={{ width: `${k.coverage}%` }}
  />
  </div>
  <p className="mt-1.5 text-xs text-muted-foreground">{k.insight}</p>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>

  <Card data-testid="card-mirror-blindspots">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <EyeOff className="h-5 w-5 text-amber-500" />
  What I cannot see yet
  </CardTitle>
  </CardHeader>
  <CardContent>
  {portrait.blindSpots.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  I have a fairly full picture of you. Keep feeding outcomes and it
  stays sharp.
  </p>
  ) : (
  <ul className="space-y-3">
  {portrait.blindSpots.map((b) => (
  <li
  key={b.key}
  data-testid={`row-blindspot-${b.key}`}
  className="rounded-lg border bg-card/40 p-3"
  >
  <p className="text-sm font-medium">{b.label}</p>
  <p className="mt-1 text-xs text-muted-foreground">{b.why}</p>
  <Link
  href={b.href}
  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-500 hover:text-violet-400"
  data-testid={`link-blindspot-${b.key}`}
  >
  {b.actionLabel}
  <ArrowUpRight className="h-3 w-3" />
  </Link>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>
  </div>

  <NextBestActionCoach
  action={
  portrait.nextSignal
  ? {
  key: portrait.nextSignal.key,
  label: portrait.nextSignal.label,
  detail: portrait.nextSignal.detail,
  points: portrait.nextSignal.points,
  href: portrait.nextSignal.href,
  }
  : null
  }
  eligible={portrait.eligible}
  testId="card-mirror-next"
  />
  </div>
  );
}

interface MirrorTurn {
  role: "you" | "mirror";
  text: string;
  grounding?: string[];
  followUp?: string;
  isFallback?: boolean;
}

const STARTER_QUESTIONS = [
  "What do you actually know about me?",
  "Am I ready to match?",
  "What should I work on next?",
  "Who should I be looking for?",
];

function MirrorChat({ disabled }: { disabled: boolean }) {
  const qc = useQueryClient();
  const ask = useAskMirror();
  const [turns, setTurns] = useState<MirrorTurn[]>([]);
  const [draft, setDraft] = useState("");

  async function send(question: string): Promise<void> {
  const q = question.trim();
  if (!q || ask.isPending) return;
  setTurns((t) => [...t, { role: "you", text: q }]);
  setDraft("");
  try {
  const res = await ask.mutateAsync({ data: { question: q } });
  setTurns((t) => [
  ...t,
  {
  role: "mirror",
  text: res.answer,
  grounding: res.grounding,
  followUp: res.followUp,
  isFallback: res.isFallback,
  },
  ]);
  // Talking to the Mirror reflects the live readiness picture; refresh the
  // matching meter so it stays in sync across the app.
  qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
  } catch {
  setTurns((t) => [
  ...t,
  {
  role: "mirror",
  text: "I could not reach my deeper read just now. Try again in a moment, and your signals are safe either way.",
  },
  ]);
  }
  }

  return (
  <Card data-testid="card-mirror-chat">
  <CardHeader>
  <CardTitle className="flex items-center gap-2 text-base">
  <MessageCircle className="h-5 w-5 text-violet-500" />
  Ask your Mirror anything
  </CardTitle>
  </CardHeader>
  <CardContent>
  {disabled ? (
  <p className="text-sm text-muted-foreground">
  Sign in to talk to your Mirror. It only ever speaks from the real
  signals on your own account.
  </p>
  ) : (
  <>
  {turns.length === 0 ? (
  <p className="mb-4 text-sm text-muted-foreground">
  I answer only from what your real signals tell me. If I cannot see
  something, I will say so and point you to the signal that would fill
  the gap.
  </p>
  ) : (
  <ul className="mb-4 space-y-3" data-testid="list-mirror-turns">
  {turns.map((t, i) => (
  <li
  key={i}
  data-testid={`turn-${t.role}-${i}`}
  className={
  t.role === "you"
  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2"
  : "mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border bg-card/50 px-3 py-2"
  }
  >
  <p className="whitespace-pre-wrap text-sm">{t.text}</p>
  {t.grounding && t.grounding.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1">
  {t.grounding.map((g, gi) => (
  <Badge key={gi} variant="secondary" className="text-[10px]">
  {g}
  </Badge>
  ))}
  </div>
  )}
  {t.followUp && (
  <button
  type="button"
  onClick={() => void send(t.followUp!)}
  data-testid={`followup-${i}`}
  className="mt-2 inline-flex items-center gap-1 text-left text-xs font-medium text-violet-500 hover:text-violet-400"
  >
  <Lightbulb className="h-3 w-3 shrink-0" />
  {t.followUp}
  </button>
  )}
  {t.role === "mirror" && t.isFallback === false && (
  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
  Deep AI lane
  </p>
  )}
  </li>
  ))}
  </ul>
  )}

  {turns.length === 0 && (
  <div className="mb-4 flex flex-wrap gap-2">
  {STARTER_QUESTIONS.map((q) => (
  <button
  key={q}
  type="button"
  onClick={() => void send(q)}
  data-testid={`starter-${q.slice(0, 10)}`}
  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-500/50 hover:text-foreground"
  >
  {q}
  </button>
  ))}
  </div>
  )}

  <form
  onSubmit={(e) => {
  e.preventDefault();
  void send(draft);
  }}
  className="flex items-end gap-2"
  >
  <Textarea
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
  e.preventDefault();
  void send(draft);
  }
  }}
  placeholder="Ask me what I see in you..."
  rows={2}
  className="resize-none"
  data-testid="input-mirror-question"
  />
  <Button
  type="submit"
  size="icon"
  disabled={ask.isPending || !draft.trim()}
  data-testid="button-send-mirror"
  >
  <Send className="h-4 w-4" />
  </Button>
  </form>
  {ask.isPending && (
  <p className="mt-2 text-xs text-muted-foreground">
  Reading your signals...
  </p>
  )}
  </>
  )}
  </CardContent>
  </Card>
  );
}

export default function YourMirror() {
  useMeta(
    "Your Mirror",
    "See your patterns over time, the trends in how you date, and what is moving your readiness.",
  );
  const { data, isLoading, isError } = useGetMirrorTrends();
  const { data: journalData } = useListJournalEntries({ view: "active", limit: 3 });
  const { data: notesData } = useListPostDateNotes({ view: "active", limit: 3 });
  const recentReflections = journalData?.entries ?? [];
  const recentDates = notesData?.notes ?? [];

  // The portrait endpoint 401s for signed-out visitors; we do not retry that and
  // fall back to a clearly-labelled sample so the page never looks empty. A
  // signed-in user who hits a real server error should see an error state, not
  // a silent sample, so we only treat the unauthenticated case as demo.
  const { isAuthenticated } = useAuth();
  const { data: matchingState } = useGetMatchingState({
    query: { queryKey: getGetMatchingStateQueryKey(), enabled: isAuthenticated },
  });
  const {
    data: portrait,
    isLoading: portraitLoading,
    isError: portraitError,
  } = useGetMirrorPortrait({
    query: { queryKey: getGetMirrorPortraitQueryKey(), retry: false },
  });
  const portraitFailedForUser = isAuthenticated && portraitError && !portrait;
  const isDemo = !portrait && !portraitFailedForUser;
  const shownPortrait = portrait ?? DEMO_PORTRAIT;

  return (
  <div className="min-h-screen bg-background">
  <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
  <Link href="/dashboard">
  <Button variant="ghost" size="sm" className="mb-6" data-testid="link-back-dashboard">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Dashboard
  </Button>
  </Link>

  <motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4 }}
  className="mb-8"
  >
  <Badge variant="secondary" className="mb-3">
  <Sparkles className="mr-1 h-3 w-3" />
  Your Mirror
  </Badge>
  <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
  The machine's read on you, so far
  </h1>
  <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
  Your Mirror is the model MatchLab keeps of you, built only from the
  real signals you feed it. It tells you what it can see, where it is
  still guessing, and the one move that sharpens the picture most. Ask
  it anything below.
  </p>
  </motion.div>

  {/* Conversational spine: the portrait the machine has built, plus the
      ask-it-anything chat. Both read real per-account signals. */}
  <div className="mb-12 space-y-6">
  {portraitLoading ? (
  <div className="space-y-4">
  <Skeleton className="h-28 w-full" />
  <Skeleton className="h-48 w-full" />
  </div>
  ) : portraitFailedForUser ? (
  <Card className="border-destructive/40 bg-destructive/5">
  <CardContent className="py-6">
  <p className="text-sm text-destructive" data-testid="text-portrait-error">
  Couldn't load your Mirror right now. Try refreshing the page in a
  moment.
  </p>
  </CardContent>
  </Card>
  ) : (
  <>
  <MirrorPortraitSection portrait={shownPortrait} isDemo={isDemo} />
  {!isDemo && (
  <ClimbCard
  score={matchingState?.readiness?.score ?? 0}
  threshold={matchingState?.readinessThreshold ?? 50}
  streak={matchingState?.activityStreak}
  />
  )}
  <MirrorChat disabled={isDemo} />
  </>
  )}
  </div>

  <div className="mb-6 mt-12 border-t pt-8">
  <h2 className="font-serif text-2xl font-bold tracking-tight">
  Your patterns over time
  </h2>
  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
  The deterministic trend view across every audit you have run: what
  keeps coming up as a strength, what keeps coming up as a risk, and how
  your score has moved. No Claude pass on this section.
  </p>
  </div>

  {isLoading && (
  <div className="space-y-4">
  <Skeleton className="h-32 w-full" />
  <Skeleton className="h-48 w-full" />
  <Skeleton className="h-48 w-full" />
  </div>
  )}

  {isError && (
  <Card className="border-destructive/40 bg-destructive/5">
  <CardContent className="py-6">
  <p className="text-sm text-destructive">
  Couldn't load your Mirror right now. Try refreshing the page in a
  moment.
  </p>
  </CardContent>
  </Card>
  )}

  {data && (
  <div className="space-y-6">
  <Card data-testid="card-headline" className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
  <CardContent className="py-6">
  <div className="flex flex-col items-start gap-6 md:flex-row">
  <div data-testid="readiness-gauge" className="flex flex-col items-center gap-2">
  <ReadinessGauge score={data.readinessScore} />
  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
  Readiness
  </p>
  </div>
  <div className="flex-1">
  <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
  Headline
  </p>
  <p className="mt-1 font-serif text-xl leading-relaxed md:text-2xl">
  {data.headlineInsight}
  </p>
  {data.hasEnoughData && (
  <p className="mt-3 text-xs text-muted-foreground">
  {data.totalAudits} audit
  {data.totalAudits === 1 ? "" : "s"}
  {data.spanDays > 0
  ? ` across ${data.spanDays} day${data.spanDays === 1 ? "" : "s"}`
  : ""}
  {data.engagementWindow.auditsPerMonth > 0
  ? ` · ~${data.engagementWindow.auditsPerMonth}/mo`
  : ""}
  {data.engagementWindow.mostActiveDay
  ? ` · most active on ${data.engagementWindow.mostActiveDay}s`
  : ""}
  </p>
  )}
  </div>
  </div>
  </CardContent>
  </Card>

  {data.scoreHistory.length >= 2 && (
  <Card data-testid="card-sparkline">
  <CardHeader className="pb-2">
  <CardTitle className="flex items-center justify-between text-base">
  <span className="flex items-center gap-2">
  <TrendingUp className="h-5 w-5 text-emerald-500" />
  Score history
  </span>
  <span className="text-xs font-normal text-muted-foreground">
  latest vs previous:{" "}
  {data.scoreDelta.currentVsPrevious > 0 ? "+" : ""}
  {data.scoreDelta.currentVsPrevious}
  {" · "}30-day:{" "}
  {data.scoreDelta.rolling30Delta > 0 ? "+" : ""}
  {data.scoreDelta.rolling30Delta}
  </span>
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="h-32 w-full">
  <ResponsiveContainer width="100%" height="100%">
  <AreaChart
  data={data.scoreHistory.map((p) => ({
  score: p.score,
  date: new Date(p.createdAt).toLocaleDateString(
  undefined,
  { month: "short", day: "numeric" },
  ),
  }))}
  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
  >
  <defs>
  <linearGradient id="mirrorScoreFill" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stopColor="hsl(var(--brand-indigo))" stopOpacity={0.4} />
  <stop offset="100%" stopColor="hsl(var(--brand-indigo))" stopOpacity={0} />
  </linearGradient>
  </defs>
  <XAxis
  dataKey="date"
  tick={{ fontSize: 11 }}
  stroke="hsl(var(--muted-foreground))"
  />
  <YAxis
  domain={[0, 100]}
  tick={{ fontSize: 11 }}
  stroke="hsl(var(--muted-foreground))"
  width={32}
  />
  <RechartsTooltip
  contentStyle={{
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  }}
  />
  <Area
  type="monotone"
  dataKey="score"
  stroke="hsl(var(--brand-indigo))"
  strokeWidth={2}
  fill="url(#mirrorScoreFill)"
  />
  </AreaChart>
  </ResponsiveContainer>
  </div>
  </CardContent>
  </Card>
  )}

  {data.scoreHistory.length > 0 && (
  <Card data-testid="card-timeline">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center gap-2 text-base">
  <Calendar className="h-5 w-5 text-violet-500" />
  Growth timeline
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="flex flex-wrap gap-2">
  {data.scoreHistory.map((p, i) => (
  <Link
  key={`pt-${p.auditId ?? i}`}
  href={p.auditId ? `/report/${p.auditId}` : "/your-mirror"}
  >
  <Badge
  variant="secondary"
  className="cursor-pointer gap-1.5 text-xs"
  data-testid={`timeline-chip-${i}`}
  >
  <FileText className="h-3 w-3" />
  {new Date(p.createdAt).toLocaleDateString(undefined, {
  month: "short",
  day: "numeric",
  })}
  <span className="font-mono opacity-75">· {p.score}</span>
  </Badge>
  </Link>
  ))}
  {data.engagementWindow.dormancyGapCount > 0 && (
  <Badge variant="outline" className="gap-1.5 text-xs">
  <Heart className="h-3 w-3" />
  {data.engagementWindow.dormancyGapCount} dormancy gap
  {data.engagementWindow.dormancyGapCount === 1 ? "" : "s"} &gt;30 days
  </Badge>
  )}
  </div>
  </CardContent>
  </Card>
  )}

  <div className="grid gap-6 md:grid-cols-3">
  <Card data-testid="card-score-delta">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
  <ScoreDirectionIcon direction={data.scoreDelta.direction} />
  Score delta
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="font-serif text-3xl font-bold">
  {data.scoreDelta.delta > 0 ? "+" : ""}
  {data.scoreDelta.delta}
  <span className="ml-1 text-base font-normal text-muted-foreground">
  pts
  </span>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">
  {data.scoreDelta.first ?? "-"} → {data.scoreDelta.latest ?? "-"} ·{" "}
  {data.scoreDelta.direction === "up"
  ? "climbing"
  : data.scoreDelta.direction === "down"
  ? "slipping"
  : "holding steady"}
  </p>
  </CardContent>
  </Card>

  <Card data-testid="card-engagement">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
  <Calendar className="h-5 w-5 text-violet-500" />
  Engagement
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="font-serif text-3xl font-bold">
  {data.totalAudits}
  <span className="ml-1 text-base font-normal text-muted-foreground">
  audit{data.totalAudits === 1 ? "" : "s"}
  </span>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">
  {data.engagementWindow.avgGapDays !== null
  ? `~${Math.round(data.engagementWindow.avgGapDays)}-day rhythm`
  : "first audit pending"}
  {data.engagementWindow.daysSinceLatest !== null
  ? ` · last was ${data.engagementWindow.daysSinceLatest} day${data.engagementWindow.daysSinceLatest === 1 ? "" : "s"} ago`
  : ""}
  </p>
  </CardContent>
  </Card>

  <Card data-testid="card-engine">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
  <Sparkles className="h-5 w-5 text-amber-500" />
  Computed by
  </CardTitle>
  </CardHeader>
  <CardContent>
  <div className="font-serif text-lg font-bold">
  Deterministic engine
  </div>
  <p className="mt-2 text-xs text-muted-foreground">
  v{data.engineVersion} · deterministic only on this view
  </p>
  </CardContent>
  </Card>
  </div>

  <div className="grid gap-6 md:grid-cols-2">
  <Card data-testid="card-strengths">
  <CardHeader>
  <CardTitle className="flex items-center gap-2">
  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  Repeated strengths
  </CardTitle>
  </CardHeader>
  <CardContent>
  {data.repeatedStrengths.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  No themes have repeated yet, run another audit to start
  surfacing your reliable strengths.
  </p>
  ) : (
  <ul className="space-y-3">
  {data.repeatedStrengths.map((t) => (
  <li
  key={t.key}
  className="flex items-center justify-between gap-3"
  >
  <span className="text-sm">{t.label}</span>
  <Badge variant="secondary" className="text-xs">
  {t.count}× across audits
  </Badge>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>

  <Card data-testid="card-risks">
  <CardHeader>
  <CardTitle className="flex items-center gap-2">
  <AlertTriangle className="h-5 w-5 text-amber-500" />
  Recurring risks
  </CardTitle>
  </CardHeader>
  <CardContent>
  {data.recurringRisks.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  Nothing is recurring as a risk yet, that's a good sign.
  </p>
  ) : (
  <ul className="space-y-3">
  {data.recurringRisks.map((t) => (
  <li
  key={t.key}
  className="flex items-center justify-between gap-3"
  >
  <span className="text-sm">{t.label}</span>
  <Badge
  variant="outline"
  className="border-amber-400/40 text-xs text-amber-700 dark:text-amber-300"
  >
  {t.count}× across audits
  </Badge>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>
  </div>

  {data.themeShifts.length > 0 && (
  <Card data-testid="card-theme-shifts">
  <CardHeader>
  <CardTitle className="flex items-center gap-2">
  <ArrowUpRight className="h-5 w-5 text-violet-500" />
  Theme shifts since you started
  </CardTitle>
  </CardHeader>
  <CardContent>
  <ul className="grid gap-3 sm:grid-cols-2">
  {data.themeShifts.slice(0, 6).map((s) => (
  <li
  key={s.key}
  className="flex items-center justify-between gap-3 rounded-lg border bg-card/40 p-3"
  >
  <span className="text-sm font-medium">{s.label}</span>
  <Badge
  variant={
  s.direction === "emerged"
  ? "default"
  : s.direction === "faded"
  ? "secondary"
  : "outline"
  }
  className="text-xs capitalize"
  >
  {s.direction} · {s.from} → {s.to}
  </Badge>
  </li>
  ))}
  </ul>
  </CardContent>
  </Card>
  )}

  {data.readinessSignals.length > 0 && (
  <Card data-testid="card-signals">
  <CardHeader>
  <CardTitle>Readiness signals</CardTitle>
  </CardHeader>
  <CardContent>
  <ul className="space-y-3">
  {data.readinessSignals.map((s, i) => (
  <li
  key={`${s.tone}-${i}`}
  className="flex items-start gap-3 rounded-lg border bg-card/30 p-3"
  >
  <span className="mt-0.5">
  <ToneIcon tone={s.tone} />
  </span>
  <span className="text-sm">{s.label}</span>
  </li>
  ))}
  </ul>
  </CardContent>
  </Card>
  )}

  <div className="grid gap-6 md:grid-cols-2">
  <Card data-testid="card-recent-reflections">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center justify-between gap-2 text-base">
  <span className="flex items-center gap-2">
  <BookOpen className="h-5 w-5 text-violet-500" />
  Recent reflections
  </span>
  <Link
  href="/mirror/journal"
  className="text-xs font-medium text-violet-500 hover:text-violet-400"
  data-testid="link-all-journal"
  >
  View all →
  </Link>
  </CardTitle>
  </CardHeader>
  <CardContent>
  {recentReflections.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  No reflections yet. Build a{" "}
  <Link href="/copilot/weekly-plan" className="text-violet-400 underline-offset-2 hover:underline">
  Weekly Growth Plan
  </Link>{" "}
  to start your journal.
  </p>
  ) : (
  <ul className="space-y-3">
  {recentReflections.map((e) => (
  <li
  key={e.id}
  data-testid={`row-recent-journal-${e.id}`}
  className="rounded-lg border bg-card/40 p-3"
  >
  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
  <span>{fmtShort(e.createdAt)}</span>
  {e.tags?.slice(0, 2).map((t) => (
  <Badge key={t} variant="secondary" className="text-[10px]">
  {t}
  </Badge>
  ))}
  </div>
  {e.prompt ? (
  <p className="text-xs font-semibold text-foreground line-clamp-1">
  {e.prompt}
  </p>
  ) : null}
  <p className="line-clamp-2 text-xs text-muted-foreground">{e.body}</p>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>

  <Card data-testid="card-last-dates">
  <CardHeader className="pb-3">
  <CardTitle className="flex items-center justify-between gap-2 text-base">
  <span className="flex items-center gap-2">
  <Heart className="h-5 w-5 text-rose-500" />
  Last 3 dates
  </span>
  <Link
  href="/mirror/dates"
  className="text-xs font-medium text-rose-500 hover:text-rose-400"
  data-testid="link-all-dates"
  >
  View all →
  </Link>
  </CardTitle>
  </CardHeader>
  <CardContent>
  {recentDates.length === 0 ? (
  <p className="text-sm text-muted-foreground">
  No post-date notes yet. After your next date, run a{" "}
  <Link href="/copilot/debrief" className="text-rose-400 underline-offset-2 hover:underline">
  Debrief
  </Link>{" "}
  to capture what happened.
  </p>
  ) : (
  <ul className="space-y-3">
  {recentDates.map((n) => (
  <li
  key={n.id}
  data-testid={`row-recent-date-${n.id}`}
  className="rounded-lg border bg-card/40 p-3"
  >
  <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
  <span>{fmtShort(n.dateAt ?? n.createdAt)}</span>
  {n.personLabel ? (
  <Badge variant="secondary" className="text-[10px]">
  {n.personLabel}
  </Badge>
  ) : null}
  </div>
  <p className="line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>
  </li>
  ))}
  </ul>
  )}
  </CardContent>
  </Card>
  </div>

  <Card className="bg-muted/30">
  <CardContent className="flex flex-col items-start gap-4 py-6 md:flex-row md:items-center md:justify-between">
  <div>
  <p className="font-serif text-lg font-semibold">
  Run another audit to deepen the pattern.
  </p>
  <p className="mt-1 text-sm text-muted-foreground">
  Every audit you add sharpens what the Mirror can show you.
  </p>
  </div>
  <Link href="/start">
  <Button data-testid="button-new-audit">Start a new audit</Button>
  </Link>
  </CardContent>
  </Card>
  </div>
  )}
  </div>
  </div>
  );
}
