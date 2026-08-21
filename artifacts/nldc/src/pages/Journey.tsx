import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarHeart,
  Compass,
  HeartHandshake,
  Gamepad2,
  MessageCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";
import { playJourneyMomentsFromRecords } from "@/lib/playJourneyHistory";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetConnectionsQueryKey,
  getGetDailySparkAnswersQueryKey,
  getGetDatingWinsQueryKey,
  getGetScenarioResponsesQueryKey,
  getGetTimeCapsulesQueryKey,
  getGetWouldYouRatherAnswersQueryKey,
  getListCompassReadsQueryKey,
  getListImportsQueryKey,
  getListInsightsQueryKey,
  getListJournalEntriesQueryKey,
  getListPostDateNotesQueryKey,
  useGetConnections,
  useGetDailySparkAnswers,
  useGetDatingWins,
  useGetScenarioResponses,
  useGetTimeCapsules,
  useGetWouldYouRatherAnswers,
  useListCompassReads,
  useListImports,
  useListInsights,
  useListJournalEntries,
  useListPostDateNotes,
} from "@workspace/api-client-react";

type JourneyKind =
  | "insight"
  | "reflection"
  | "compatibility"
  | "introduction"
  | "date"
  | "play"
  | "win";

type JourneyEvent = {
  id: string;
  kind: JourneyKind;
  title: string;
  detail: string;
  occurredAt: string;
  href: string;
};

const KIND_META: Record<
  JourneyKind,
  { label: string; icon: LucideIcon; color: string; background: string }
> = {
  insight: {
    label: "Insight",
    icon: Sparkles,
    color: "text-[hsl(326_100%_50%)]",
    background: "bg-[hsl(326_100%_50%/0.1)]",
  },
  reflection: {
    label: "Reflection",
    icon: BookOpen,
    color: "text-[hsl(248_62%_62%)]",
    background: "bg-[hsl(248_62%_52%/0.1)]",
  },
  compatibility: {
    label: "Compatibility read",
    icon: Compass,
    color: "text-[hsl(190_60%_42%)]",
    background: "bg-[hsl(190_60%_50%/0.1)]",
  },
  introduction: {
    label: "Introduction",
    icon: HeartHandshake,
    color: "text-[hsl(348_70%_55%)]",
    background: "bg-[hsl(348_70%_55%/0.1)]",
  },
  date: {
    label: "Date reflection",
    icon: CalendarHeart,
    color: "text-[hsl(36_80%_45%)]",
    background: "bg-[hsl(36_80%_50%/0.1)]",
  },
  play: {
    label: "Play",
    icon: Gamepad2,
    color: "text-[hsl(326_70%_58%)]",
    background: "bg-[hsl(326_70%_58%/0.1)]",
  },
  win: {
    label: "Win",
    icon: Trophy,
    color: "text-[hsl(142_55%_40%)]",
    background: "bg-[hsl(142_55%_50%/0.1)]",
  },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

function safeDate(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Saved";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function truncate(value: string, max = 150): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

function EventCard({ event }: { event: JourneyEvent }) {
  const meta = KIND_META[event.kind];
  const Icon = meta.icon;
  return (
    <Link
      href={event.href}
      className="glass group block rounded-2xl border border-foreground/10 p-5 transition-colors hover:border-foreground/25"
      data-testid={`journey-event-${event.id}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.background}`}
        >
          <Icon className={`h-5 w-5 ${meta.color}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}
            >
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {dateLabel(event.occurredAt)}
            </span>
          </div>
          <h2 className="mt-1 text-sm font-bold text-foreground">
            {event.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {event.detail}
          </p>
        </div>
        <ArrowRight
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

export default function Journey() {
  useMeta(
    "Journey",
    "A durable history of the signals, introductions, dates, and learning that changed your MatchLab picture.",
  );

  const { isAuthenticated, login } = useAuth();
  const insights = useListInsights({
    query: {
      queryKey: getListInsightsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const journal = useListJournalEntries(undefined, {
    query: {
      queryKey: getListJournalEntriesQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const dates = useListPostDateNotes(undefined, {
    query: {
      queryKey: getListPostDateNotesQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const compass = useListCompassReads({
    query: {
      queryKey: getListCompassReadsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const wins = useGetDatingWins({
    query: {
      queryKey: getGetDatingWinsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const connections = useGetConnections({
    query: {
      queryKey: getGetConnectionsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const dailySpark = useGetDailySparkAnswers({
    query: {
      queryKey: getGetDailySparkAnswersQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const wouldYouRather = useGetWouldYouRatherAnswers({
    query: {
      queryKey: getGetWouldYouRatherAnswersQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const scenarios = useGetScenarioResponses({
    query: {
      queryKey: getGetScenarioResponsesQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const timeCapsules = useGetTimeCapsules({
    query: {
      queryKey: getGetTimeCapsulesQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const imports = useListImports({
    query: {
      queryKey: getListImportsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const events = useMemo<JourneyEvent[]>(() => {
    const all: JourneyEvent[] = [
      ...(insights.data ?? []).map((item) => ({
        id: `insight-${item.id}`,
        kind: "insight" as const,
        title: item.sourceLabel,
        detail:
          item.status === "complete"
            ? "A pattern read was added to what MatchLab understands."
            : `Insight ${item.status}.`,
        occurredAt: item.createdAt,
        href: "/insights",
      })),
      ...(journal.data?.entries ?? []).map((item) => ({
        id: `journal-${item.id}`,
        kind: "reflection" as const,
        title: item.prompt ? truncate(item.prompt, 80) : "Journal reflection",
        detail: "A reflection was saved and folded into your profile model.",
        occurredAt: item.createdAt,
        href: "/mirror/journal",
      })),
      ...(dates.data?.notes ?? []).map((item) => ({
        id: `date-${item.id}`,
        kind: "date" as const,
        title: item.personLabel
          ? `Reflection on ${truncate(item.personLabel, 60)}`
          : "Post-date reflection",
        detail: "You saved what felt good, off, or unclear after a date.",
        occurredAt: item.createdAt,
        href: "/mirror/dates",
      })),
      ...(compass.data?.reads ?? []).map((item) => ({
        id: `compass-${item.id}`,
        kind: "compatibility" as const,
        title: `Compatibility read: ${truncate(item.connectionStyle, 80)}`,
        detail: "A real preference signal was added to your MatchLab picture.",
        occurredAt: item.createdAt,
        href: "/compatibility-compass",
      })),
      ...(wins.data ?? []).map((item) => ({
        id: `win-${item.id}`,
        kind: "win" as const,
        title: "Dating win saved",
        detail: truncate(item.body),
        occurredAt: item.createdAt,
        href: "/progress/wins",
      })),
      ...playJourneyMomentsFromRecords({
        dailySpark: dailySpark.data ?? [],
        wouldYouRather: wouldYouRather.data ?? [],
        scenarios: scenarios.data ?? [],
        timeCapsules: timeCapsules.data ?? [],
        imports: imports.data?.imports ?? [],
      }).map((item) => ({
        ...item,
        kind: "play" as const,
      })),
      ...(connections.data ?? []).map((item) => ({
        id: `introduction-${item.id}`,
        kind: "introduction" as const,
        title:
          item.status === "closed"
            ? "Introduction closed"
            : "Mutual introduction opened",
        detail:
          item.status === "closed"
            ? "This introduction remains part of your history without reopening the connection."
            : "Both people said yes and the conversation opened.",
        occurredAt: item.createdAt,
        href: `/matches/${item.id}`,
      })),
    ];
    return all.sort(
      (left, right) => safeDate(right.occurredAt) - safeDate(left.occurredAt),
    );
  }, [
    compass.data,
    connections.data,
    dailySpark.data,
    dates.data,
    imports.data,
    insights.data,
    journal.data,
    scenarios.data,
    timeCapsules.data,
    wins.data,
    wouldYouRather.data,
  ]);

  const loading =
    insights.isLoading ||
    journal.isLoading ||
    dates.isLoading ||
    compass.isLoading ||
    wins.isLoading ||
    connections.isLoading ||
    dailySpark.isLoading ||
    wouldYouRather.isLoading ||
    scenarios.isLoading ||
    timeCapsules.isLoading ||
    imports.isLoading;
  const failed =
    insights.isError ||
    journal.isError ||
    dates.isError ||
    compass.isError ||
    wins.isError ||
    connections.isError ||
    dailySpark.isError ||
    wouldYouRather.isError ||
    scenarios.isError ||
    timeCapsules.isError ||
    imports.isError;

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.1)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
                  <BookOpen
                    className="h-3.5 w-3.5 text-[#3D35CC]"
                    aria-hidden="true"
                  />
                  Journey
                </p>
                <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  What changed, and what it taught you.
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              This is durable account history, not a demo feed: meaningful
              signals, introductions, dates, and learning in the order they
              happened.
            </p>
          </motion.div>

          {!isAuthenticated ? (
            <motion.section
              {...fadeUp(0.03)}
              className="glass-strong rounded-[2rem] p-8 text-center sm:p-10"
            >
              <BookOpen
                className="mx-auto h-8 w-8 text-[#3D35CC]"
                aria-hidden="true"
              />
              <h2 className="mt-4 font-serif text-3xl font-bold text-foreground">
                Your journey is built from your saved history.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Sign in to see your real timeline. MatchLab does not fill an
                empty history with sample dates, matches, or breakthroughs.
              </p>
              <Button
                onClick={() => login()}
                className="mt-6 rounded-full px-6"
              >
                Sign in
              </Button>
            </motion.section>
          ) : loading ? (
            <section className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-foreground/10"
                />
              ))}
            </section>
          ) : failed ? (
            <section className="glass-strong rounded-[2rem] p-8 text-center">
              <p className="font-semibold text-foreground">
                Your Journey could not load.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Refresh in a moment. No sample history is standing in for your
                real account.
              </p>
            </section>
          ) : events.length === 0 ? (
            <motion.section
              {...fadeUp(0.03)}
              className="glass-strong rounded-[2rem] p-8 text-center sm:p-10"
              data-testid="journey-empty"
            >
              <MessageCircle
                className="mx-auto h-8 w-8 text-muted-foreground/50"
                aria-hidden="true"
              />
              <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">
                Your real history starts with one honest signal.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Tell Echo what is happening or save a reflection. When it
                changes the picture, it will appear here.
              </p>
              <Link
                href="/echo"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 py-3 text-sm font-semibold text-white"
              >
                Tell Echo what is happening
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </motion.section>
          ) : (
            <>
              <motion.div
                {...fadeUp(0.03)}
                className="mb-5 flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/45 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {events.length} saved{" "}
                    {events.length === 1 ? "moment" : "moments"}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Newest first. Open any moment to see its source.
                  </p>
                </div>
                <Link
                  href="/echo"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
                >
                  Add a reflection
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.div>
              <div className="space-y-3">
                {events.map((event, index) => (
                  <motion.div key={event.id} {...fadeUp(0.04 + index * 0.015)}>
                    <EventCard event={event} />
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
