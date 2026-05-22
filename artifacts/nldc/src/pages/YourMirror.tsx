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
} from "lucide-react";
import { useGetMirrorTrends } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function YourMirror() {
  const { data, isLoading, isError } = useGetMirrorTrends();

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
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/15 p-3">
                    <Sparkles className="h-6 w-6 text-primary" />
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
                        {data.engagementWindow.avgGapDays !== null
                          ? ` · avg ${data.engagementWindow.avgGapDays.toFixed(1)}-day gap`
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
