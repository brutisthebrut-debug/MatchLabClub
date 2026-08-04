import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, HeartHandshake, Route, Sparkles, UserRound } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetCompanionQueryKey,
  getGetMatchingStateQueryKey,
  getGetMySignalMapQueryKey,
  useGetCompanion,
  useGetMatchingState,
  useGetMySignalMap,
  type CompanionState,
  type MatchingState,
  type SignalMap,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SignalOfTheDay } from "@/components/SignalOfTheDay";
import { NextBestActionCoach } from "@/components/coach/NextBestActionCoach";
import { useMeta } from "@/hooks/useMeta";
import {
  hasPendingArrival,
  markArrivalSeen,
} from "@/lib/onboardingState";

type TodayViewProps = {
  firstName?: string | null;
  companion?: CompanionState;
  matching?: MatchingState;
  signalMap?: SignalMap;
  firstArrival?: boolean;
  onOpenFirstRead?: () => void;
};

const QUICK_DESTINATIONS = [
  {
    name: "My MatchLab",
    detail: "See what I know, what I am guessing, and what still needs confirming.",
    href: "/your-mirror",
    icon: UserRound,
    color: "var(--brand-indigo)",
  },
  {
    name: "Play",
    detail: "Add useful signal without turning your dating life into homework.",
    href: "/quiz",
    icon: Sparkles,
    color: "var(--brand-gold)",
  },
  {
    name: "Journey",
    detail: "Look back at what changed, what worked, and what keeps repeating.",
    href: "/progress/timeline",
    icon: Route,
    color: "var(--brand-green)",
  },
] as const;

function greetingFor(firstName?: string | null): string {
  return firstName ? `Hey, ${firstName}.` : "Hey, you.";
}

export function TodayView({
  firstName,
  companion,
  matching,
  signalMap,
  firstArrival = false,
  onOpenFirstRead,
}: TodayViewProps) {
  const score = Math.round(
    matching?.readiness.score ?? companion?.readinessScore ?? 0,
  );
  const threshold = matching?.readinessThreshold ?? companion?.threshold ?? 50;
  const eligible = matching?.eligible ?? companion?.eligible ?? false;
  const understanding = Math.round(signalMap?.densityPercent ?? score);
  const progress = Math.min(
    100,
    Math.round((score / Math.max(1, threshold)) * 100),
  );
  const nextAction =
    matching?.nextActions[0] ??
    (companion?.nextMove
      ? {
          key: "echo-next",
          label: companion.nextMove.label,
          detail: companion.nextMove.detail,
          href: companion.nextMove.href,
          points: companion.nextMove.points,
        }
      : null);

  return (
    <AppLayout>
      <div className="relative isolate min-h-full overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_18%_8%,hsl(var(--brand-pink)/0.2),transparent_34%),radial-gradient(circle_at_82%_4%,hsl(var(--brand-teal)/0.17),transparent_30%),radial-gradient(circle_at_52%_22%,hsl(var(--brand-indigo)/0.3),transparent_48%)]"
        />

        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <section
            className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--brand-indigo)/0.25)] bg-[linear-gradient(135deg,hsl(248_78%_18%/0.98),hsl(263_72%_22%/0.96)_46%,hsl(326_76%_26%/0.94))] p-6 text-white shadow-[0_24px_80px_hsl(248_75%_30%/0.28)] sm:p-8 lg:p-10"
            data-testid="today-hero"
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--brand-pink)/0.24)] blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[hsl(var(--brand-teal)/0.18)] blur-3xl"
            />

            <div className="relative grid gap-8 lg:grid-cols-[1.5fr_0.7fr] lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--brand-pink))]" />
                  {firstArrival
                    ? "Chapter 1 of 8 · Arrive"
                    : "Echo's read for today"}
                </p>
                <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
                  {firstArrival ? "Okay, we’re in." : greetingFor(firstName)}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/88">
                  {firstArrival
                    ? `${greetingFor(firstName)} I have enough for a first impression—not a verdict, not your permanent record, just what I can honestly see so far.`
                    : (companion?.read ??
                      "I am still getting my read on you. Give me one honest signal and I can stop guessing.")}
                </p>
                {companion?.challenge ? (
                  <p className="mt-5 max-w-2xl rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm leading-relaxed text-white/82">
                    <span className="font-semibold text-white">The honest bit: </span>
                    {companion.challenge}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={firstArrival ? "/your-mirror" : "/echo"}
                    onClick={firstArrival ? onOpenFirstRead : undefined}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[hsl(248_66%_18%)] transition-transform hover:-translate-y-0.5"
                    data-testid={
                      firstArrival ? "today-first-read" : "today-talk-echo"
                    }
                  >
                    {firstArrival ? "Show me your first read" : "Talk to Echo"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={firstArrival ? "/echo" : "/matching"}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/8 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/14"
                  >
                    {firstArrival ? (
                      <Sparkles className="h-4 w-4" />
                    ) : (
                      <HeartHandshake className="h-4 w-4" />
                    )}
                    {firstArrival
                      ? "Talk to Echo first"
                      : eligible
                        ? "Open matches"
                        : "See my match path"}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/14 bg-black/12 p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/58">
                    Match readiness
                  </p>
                  <p className="mt-1 font-serif text-4xl font-bold">{score}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/14">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-teal))] via-white to-[hsl(var(--brand-pink))]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/62">
                    {eligible ? "Ready for introductions" : `${Math.max(0, threshold - score)} to matching`}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/14 bg-black/12 p-4 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/58">
                    How well I know you
                  </p>
                  <p className="mt-1 font-serif text-4xl font-bold">
                    {understanding}%
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/62">
                    {signalMap
                      ? `${signalMap.lanesActive} of ${signalMap.totalLanes} signal lanes are active.`
                      : "This sharpens every time you show me something real."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-6">
              <NextBestActionCoach
                action={nextAction}
                eligible={eligible}
                testId="today-next-action"
              />
              <SignalOfTheDay />
            </div>

            <aside className="space-y-3">
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Go somewhere
                </p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-foreground">
                  The rest of your story
                </h2>
              </div>
              {QUICK_DESTINATIONS.map((destination) => {
                const Icon = destination.icon;
                return (
                  <Link
                    key={destination.name}
                    href={destination.href}
                    className="group flex items-start gap-4 rounded-2xl border border-foreground/9 bg-card/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-indigo)/0.28)] hover:shadow-md"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        color: `hsl(${destination.color})`,
                        background: `hsl(${destination.color} / 0.12)`,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-3 font-semibold text-foreground">
                        {destination.name}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {destination.detail}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function Today() {
  useMeta(
    "Today",
    "Your MatchLab home: Echo's current read, one useful next move, and the shortest path back into your dating journey.",
  );
  const { isAuthenticated, user } = useAuth();
  const [firstArrival] = useState(() => hasPendingArrival());
  const companion = useGetCompanion({
    query: {
      queryKey: getGetCompanionQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const matching = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const signalMap = useGetMySignalMap({
    query: {
      queryKey: getGetMySignalMapQueryKey(),
      enabled: isAuthenticated,
    },
  });

  return (
    <TodayView
      firstName={user?.firstName}
      companion={companion.data}
      matching={matching.data}
      signalMap={signalMap.data}
      firstArrival={firstArrival}
      onOpenFirstRead={markArrivalSeen}
    />
  );
}
