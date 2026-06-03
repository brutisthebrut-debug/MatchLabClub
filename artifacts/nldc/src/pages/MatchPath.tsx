import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Heart,
  Lock,
  MapPin,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useGetMatchingBenchmarks,
  getGetMatchingBenchmarksQueryKey,
  type MatchReadinessBreakdown,
  type ReadinessNextAction,
} from "@workspace/api-client-react";
import { BREAKDOWN_ROWS } from "@/lib/readinessLanes";
import { ReadinessDeltaCard } from "@/components/ReadinessDeltaCard";
import { MatchBenchmarkCard } from "@/components/MatchBenchmarkCard";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

// A clearly-labelled sample so a signed-out visitor sees a full, honest page
// instead of an empty shell. It mirrors the real derivation (lane coverage 0-100,
// readiness below the gate) so the story reads the same as a real account.
const DEMO_BREAKDOWN: Partial<Record<keyof MatchReadinessBreakdown, number>> = {
  compass: 60,
  wellness: 45,
  audits: 80,
  coaching: 50,
  journal: 30,
  quizzes: 40,
  taste: 25,
  calendar: 20,
};
const DEMO_NEXT_ACTIONS: ReadinessNextAction[] = [
  {
    key: "wellness",
    label: "Answer a wellness prompt",
    detail: "Cover more of your wellness map so the match has something honest to stand on.",
    points: 8,
    href: "/wellness",
  },
  {
    key: "compass",
    label: "Run a compass read",
    detail: "Each read sharpens what you actually respond to.",
    points: 6,
    href: "/compatibility-compass",
  },
  {
    key: "journal",
    label: "Add a journal entry",
    detail: "A few entries show your patterns, not just one moment.",
    points: 5,
    href: "/mirror/journal",
  },
];

function ReadinessRing({
  score,
  threshold,
  eligible,
}: {
  score: number;
  threshold: number;
  eligible: boolean;
}) {
  const pct = Math.min(100, Math.round((score / Math.max(1, threshold)) * 100));
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-foreground/10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={eligible ? "hsl(142 55% 45%)" : "url(#mp-grad)"}
          strokeDasharray={`${dash} ${circ}`}
        />
        <defs>
          <linearGradient id="mp-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3D35CC" />
            <stop offset="100%" stopColor="#FF2D9B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none text-foreground">
          {score}
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          of {threshold}
        </span>
      </div>
    </div>
  );
}

export default function MatchPath() {
  useMeta(
    "What it takes to get matched",
    "The honest path to your first match: become genuinely ready, then get introduced to people near you that you would never have found on your own.",
  );
  const { isAuthenticated } = useAuth();
  const { data } = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const { data: benchmarks } = useGetMatchingBenchmarks({
    query: {
      queryKey: getGetMatchingBenchmarksQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const isDemo = !isAuthenticated || !data;

  const score = isDemo ? 34 : Math.round(data!.readiness?.score ?? 0);
  const threshold = isDemo ? 50 : data!.readinessThreshold ?? 50;
  const eligible = isDemo ? false : data!.eligible ?? false;
  const nextActions: ReadinessNextAction[] = isDemo
    ? DEMO_NEXT_ACTIONS
    : data!.nextActions ?? [];
  const breakdown: Partial<Record<keyof MatchReadinessBreakdown, number>> = isDemo
    ? DEMO_BREAKDOWN
    : (data!.readiness?.breakdown ?? {});
  const cityDensity = isDemo ? 0 : data!.cityDensity ?? 0;
  const totalPool = isDemo ? 0 : data!.totalPoolCount ?? 0;
  const radiusKm = isDemo ? null : data!.preferences?.distanceKm ?? null;

  const pointsToMatch = Math.max(0, threshold - score);

  const lanes = useMemo(
    () =>
      BREAKDOWN_ROWS.map((row) => ({
        ...row,
        value: Math.max(0, Math.min(100, breakdown[row.key] ?? 0)),
      })),
    [breakdown],
  );
  const covered = lanes.filter((l) => l.value > 0);
  const untouched = lanes.filter((l) => l.value === 0);
  const radiusLabel =
    radiusKm == null
      ? "any distance"
      : `${Math.round(radiusKm * 0.621371)} miles`;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        {isDemo && (
          <div
            className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            data-testid="match-path-demo-banner"
          >
            <Sparkles className="h-4 w-4 text-[hsl(326_100%_50%)]" aria-hidden="true" />
            Sample view. Sign in to see your own path and live readiness.
            <Link
              href="/start"
              className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* Hero */}
        <motion.header {...fadeUp(0)} className="mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
            The path to a match
          </span>
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            What it takes to get matched
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            One honest promise: become genuinely ready, then get introduced to
            people near you that you would never have found on your own. Readiness
            leads. Matching is the payoff. The more the machine understands you,
            the better it matches you. Here is exactly how that works and where
            you stand.
          </p>
        </motion.header>

        {/* The gate */}
        <motion.div {...fadeUp(0.05)}>
          <Card className="overflow-hidden border-foreground/10">
            <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
              <ReadinessRing score={score} threshold={threshold} eligible={eligible} />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                {eligible ? (
                  <>
                    <Badge className="mb-2 border-0 bg-[hsl(142_55%_45%/0.15)] text-[hsl(142_55%_32%)]">
                      <Check className="mr-1 h-3 w-3" aria-hidden="true" /> Match
                      ready
                    </Badge>
                    <h2 className="text-2xl font-bold text-foreground">
                      You have cleared the gate
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      Your Match Readiness is high enough for the introductions
                      pool. Set your radius and preferences, and the machine starts
                      working on people near you.
                    </p>
                    <Button asChild className="mt-4">
                      <Link href="/matching" data-testid="match-path-see-matches">
                        See your matches
                        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge
                      variant="outline"
                      className="mb-2 border-foreground/15 text-muted-foreground"
                    >
                      <Lock className="mr-1 h-3 w-3" aria-hidden="true" /> Gate at{" "}
                      {threshold} readiness
                    </Badge>
                    <h2 className="text-2xl font-bold text-foreground">
                      <span data-testid="match-path-points-to-match">
                        {pointsToMatch}
                      </span>{" "}
                      {pointsToMatch === 1 ? "point" : "points"} to your first match
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      Matching opens once your readiness reaches {threshold}. This
                      is not a paywall. It is the point where the machine knows you
                      well enough to introduce you to the right people instead of
                      random ones. Every tool below moves this number.
                    </p>
                    <Button asChild className="mt-4">
                      <Link
                        href={nextActions[0]?.href ?? "/me"}
                        data-testid="match-path-start-action"
                      >
                        {nextActions[0]
                          ? nextActions[0].label
                          : "Feed your first signal"}
                        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Why readiness moved */}
        {!isDemo && data!.readinessDelta && (
          <motion.div {...fadeUp(0.08)} className="mt-6">
            <ReadinessDeltaCard delta={data!.readinessDelta} />
          </motion.div>
        )}

        {/* How you compare to your goal cohort */}
        {!isDemo && benchmarks && (
          <motion.div {...fadeUp(0.09)} className="mt-6">
            <MatchBenchmarkCard benchmarks={benchmarks} />
          </motion.div>
        )}

        {/* Shortest path */}
        {!eligible && nextActions.length > 0 && (
          <motion.section {...fadeUp(0.1)} className="mt-10">
            <h2 className="font-serif text-2xl font-bold text-foreground">
              Your shortest path right now
            </h2>
            <p className="mt-1 text-muted-foreground">
              The highest-leverage moves for you, in order. Each one is real work
              that teaches the machine something a profile never shows.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {nextActions.slice(0, 3).map((action, i) => (
                <Card
                  key={action.key}
                  className="flex flex-col border-foreground/10"
                  data-testid={`match-path-action-${action.key}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5 text-sm font-bold text-foreground">
                        {i + 1}
                      </span>
                      <Badge className="border-0 bg-[hsl(326_100%_60%/0.12)] text-[hsl(326_100%_45%)]">
                        +{action.points}
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-base">{action.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-4">
                    <p className="text-sm text-muted-foreground">{action.detail}</p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={action.href}>
                        Do this
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* The lanes */}
        <motion.section {...fadeUp(0.15)} className="mt-12">
          <h2 className="font-serif text-2xl font-bold text-foreground">
            Everything the machine learns from
          </h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Readiness is not one test. It is how much real signal you have fed
            across every lane below. You do not need all of them. You need enough
            honest coverage for the machine to understand you.{" "}
            {covered.length > 0 && (
              <span className="text-foreground">
                You have started {covered.length} of {lanes.length}.
              </span>
            )}
          </p>

          {covered.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Signal you have fed
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {covered.map((lane) => (
                  <LaneCard key={lane.key} lane={lane} />
                ))}
              </div>
            </>
          )}

          {untouched.length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Lanes still open to you
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {untouched.map((lane) => (
                  <LaneCard key={lane.key} lane={lane} />
                ))}
              </div>
            </>
          )}
        </motion.section>

        {/* Radius / payoff */}
        <motion.section {...fadeUp(0.2)} className="mt-12 grid gap-5 md:grid-cols-2">
          <Card className="border-foreground/10">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(248_62%_52%/0.12)]">
                <MapPin className="h-5 w-5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
              </div>
              <CardTitle className="mt-3">Matches are near you</CardTitle>
              <CardDescription>
                Introductions are radius-based. We only surface people inside the
                distance you set, so a match is someone you could actually meet.
                {!isDemo && (
                  <>
                    {" "}
                    Yours is set to{" "}
                    <span className="font-semibold text-foreground">
                      {radiusLabel}
                    </span>
                    .
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/matching">
                  Set your radius and preferences
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-foreground/10">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(326_100%_60%/0.12)]">
                <Users className="h-5 w-5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
              </div>
              <CardTitle className="mt-3">What you unlock</CardTitle>
              <CardDescription>
                Once you clear the gate, the introductions pool opens. The machine
                proposes people you would never have found on your own, with a
                clear read on why you fit.
                {!isDemo && totalPool > 0 && (
                  <>
                    {" "}
                    There are{" "}
                    <span className="font-semibold text-foreground">
                      {totalPool}
                    </span>{" "}
                    members building toward matches
                    {cityDensity > 0 && <> ({cityDensity} near you)</>}.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4 text-[hsl(326_100%_50%)]" aria-hidden="true" />
              All genders and orientations. Inclusive by default.
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </AppLayout>
  );
}

function LaneCard({
  lane,
}: {
  lane: (typeof BREAKDOWN_ROWS)[number] & { value: number };
}) {
  const Icon = lane.icon;
  const started = lane.value > 0;
  return (
    <Link
      href={lane.href}
      className="group flex gap-3 rounded-xl border border-foreground/10 bg-card p-4 transition-colors hover:border-foreground/25"
      data-testid={`match-path-lane-${lane.key}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5">
        <Icon className="h-4.5 w-4.5 text-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{lane.label}</span>
          {started ? (
            <span className="text-xs font-semibold text-[hsl(142_55%_38%)]">
              {lane.value}%
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              Not started
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {lane.blurb}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
              style={{ width: `${lane.value}%` }}
            />
          </span>
          <span className="shrink-0 text-xs font-medium text-foreground/70 group-hover:text-foreground">
            {lane.cta}
          </span>
        </div>
      </div>
    </Link>
  );
}
