import { Link } from "wouter";
import { motion } from "framer-motion";
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
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useGetMirrorTrends,
  useListJournalEntries,
  useListPostDateNotes,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function YourMirror() {
  const { data, isLoading, isError } = useGetMirrorTrends();
  const { data: journalData } = useListJournalEntries({ view: "active", limit: 3 });
  const { data: notesData } = useListPostDateNotes({ view: "active", limit: 3 });
  const recentReflections = journalData?.entries ?? [];
  const recentDates = notesData?.notes ?? [];

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
            Patterns across every audit you've run
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
            The deterministic view: what keeps coming up as a strength, what
            keeps coming up as a risk, and how your score has moved since you
            started. No external AI — every signal here is computed from your
            own audit history.
          </p>
        </motion.div>

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
                    {data.scoreDelta.first ?? "—"} → {data.scoreDelta.latest ?? "—"} ·{" "}
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
                    v{data.engineVersion} · no external AI
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
                      No themes have repeated yet — run another audit to start
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
                      Nothing is recurring as a risk yet — that's a good sign.
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
