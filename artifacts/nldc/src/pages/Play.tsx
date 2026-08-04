import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Clock3,
  Clapperboard,
  Flame,
  Gamepad2,
  Hourglass,
  Scale,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";

type PlayActivity = {
  title: string;
  href: string;
  icon: LucideIcon;
  duration: string;
  frequency: string;
  teaches: string;
  outcome: string;
  accent: string;
  featured?: boolean;
};

const ACTIVITIES: PlayActivity[] = [
  {
    title: "Daily Spark",
    href: "/games/daily-spark",
    icon: Flame,
    duration: "Under 1 min",
    frequency: "One honest pick today",
    teaches: "How you move through everyday dating choices.",
    outcome: "Adds one dated preference signal when saved to your account.",
    accent: "hsl(326 100% 50%)",
    featured: true,
  },
  {
    title: "This or That",
    href: "/this-or-that",
    icon: Shuffle,
    duration: "3 min",
    frequency: "14 quick choices",
    teaches: "Lifestyle rhythm and the small preferences that shape daily fit.",
    outcome: "Builds the rapid-fire preferences lane in your profile model.",
    accent: "hsl(248 62% 52%)",
  },
  {
    title: "Scenario Reels",
    href: "/games/scenarios",
    icon: Clapperboard,
    duration: "2 min",
    frequency: "One relationship moment",
    teaches: "How you communicate, repair, and handle friction under pressure.",
    outcome: "Adds a scenario response with its communication dimension.",
    accent: "hsl(190 60% 42%)",
  },
  {
    title: "Would You Rather",
    href: "/games/would-you-rather",
    icon: Scale,
    duration: "1 min",
    frequency: "One forced tradeoff",
    teaches: "Which values win when two appealing options compete.",
    outcome: "Adds one explicit tradeoff to your preference evidence.",
    accent: "hsl(36 80% 45%)",
  },
  {
    title: "Quiz Lab",
    href: "/quizzes",
    icon: Brain,
    duration: "1 to 5 min",
    frequency: "Choose a bounded read",
    teaches: "Attachment, conflict, pace, boundaries, and future vision.",
    outcome: "Names a pattern and points to one useful next step.",
    accent: "hsl(348 70% 55%)",
  },
  {
    title: "Time Capsule",
    href: "/games/time-capsule",
    icon: Hourglass,
    duration: "5 min",
    frequency: "A deeper reflection",
    teaches:
      "What you hope your future relationship and life actually feel like.",
    outcome: "Creates a durable future-facing signal you can revisit later.",
    accent: "hsl(142 55% 40%)",
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

function ActivityCard({
  activity,
  index,
}: {
  activity: PlayActivity;
  index: number;
}) {
  const Icon = activity.icon;
  return (
    <motion.article
      {...fadeUp(0.05 + index * 0.025)}
      className={`glass group relative flex h-full flex-col overflow-hidden rounded-[2rem] border p-6 transition-transform hover:-translate-y-1 sm:p-7 ${
        activity.featured
          ? "border-[hsl(326_100%_50%/0.4)] md:col-span-2"
          : "border-foreground/10"
      }`}
      data-testid={`play-activity-${activity.title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {activity.featured && (
        <span className="absolute right-5 top-5 rounded-full bg-[hsl(326_100%_50%/0.1)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
          Play today
        </span>
      )}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: `color-mix(in srgb, ${activity.accent} 12%, transparent)`,
        }}
      >
        <Icon
          className="h-6 w-6"
          style={{ color: activity.accent }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          {activity.duration}
        </span>
        <span aria-hidden="true">·</span>
        <span>{activity.frequency}</span>
      </div>
      <h2 className="mt-2 font-serif text-2xl font-bold text-foreground">
        {activity.title}
      </h2>
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-foreground/10 bg-background/45 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            What it teaches Echo
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {activity.teaches}
          </p>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background/45 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Clear outcome
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {activity.outcome}
          </p>
        </div>
      </div>
      <Link
        href={activity.href}
        className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold"
        style={{ color: activity.accent }}
      >
        Start {activity.title}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </Link>
    </motion.article>
  );
}

export default function Play() {
  useMeta(
    "Play",
    "Bounded activities with a clear purpose, a clear outcome, and no endless feed.",
  );

  const { isAuthenticated, login } = useAuth();

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.div {...fadeUp(0)} className="mb-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground">
              <Gamepad2
                className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
                aria-hidden="true"
              />
              Play
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Play with a point.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              No endless feed and no mystery scoring. Every activity is bounded,
              tells you what it explores, and ends with a specific result.
            </p>
          </motion.div>

          {!isAuthenticated && (
            <motion.section
              {...fadeUp(0.03)}
              className="mb-5 flex flex-col gap-4 rounded-2xl border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.06)] p-5 sm:flex-row sm:items-center sm:justify-between"
              data-testid="play-signed-out-note"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#3D35CC]"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Preview freely. Sign in when you want it to count.
                  </p>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    Some activities allow local play before sign-in. Only saved
                    account responses become durable MatchLab evidence.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => login()}
                size="sm"
                className="shrink-0 rounded-full"
              >
                Sign in
              </Button>
            </motion.section>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {ACTIVITIES.map((activity, index) => (
              <ActivityCard
                key={activity.href}
                activity={activity}
                index={index}
              />
            ))}
          </div>

          <motion.section
            {...fadeUp(0.22)}
            className="glass-strong mt-5 rounded-[2rem] p-7 text-center sm:p-9"
          >
            <Sparkles
              className="mx-auto h-7 w-7 text-[hsl(326_100%_50%)]"
              aria-hidden="true"
            />
            <h2 className="mt-3 font-serif text-2xl font-bold text-foreground">
              Play informs the profile. It does not decide who you are.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Echo combines repeated signals, says when confidence is low, and
              leaves room for you to correct the read.
            </p>
            <Link
              href="/your-mirror"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3D35CC]"
            >
              See your current Mirror
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.section>
        </div>
      </div>
    </AppLayout>
  );
}
