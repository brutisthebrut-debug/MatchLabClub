import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Activity,
  HeartHandshake,
  Target,
  Crown,
  Lock,
  Check,
} from "lucide-react";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  buildMilestones,
  nextMilestone,
  type MilestoneIconKey,
} from "@/lib/milestones";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const ICONS: Record<MilestoneIconKey, typeof Sparkles> = {
  first: Sparkles,
  patterns: Activity,
  ready: HeartHandshake,
  dialed: Target,
};

export default function Milestones() {
  useMeta(
    "Your milestones",
    "The readiness journey, what each step unlocks, and how the introductions open.",
  );

  const { isAuthenticated, login } = useAuth();
  const state = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const score = state.data?.readiness.score ?? 0;
  const threshold = state.data?.readinessThreshold ?? 50;

  const milestones = useMemo(() => buildMilestones(threshold), [threshold]);
  const upcoming = useMemo(
    () => nextMilestone(score, milestones),
    [score, milestones],
  );

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-serif text-3xl font-bold">Your milestones</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to see your readiness journey, what each step unlocks, and how
            close you are to the introductions opening.
          </p>
          <Button onClick={() => login()} className="mt-6 rounded-full">
            Sign in to see your path
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <motion.div {...fadeUp(0)} className="mb-8">
          <Button asChild variant="ghost" size="sm" className="rounded-full -ml-2">
            <Link href="/matching">
              <ArrowLeft className="mr-1 w-4 h-4" aria-hidden="true" />
              Back to matching
            </Link>
          </Button>
          <h1 className="mt-3 font-serif text-3xl md:text-4xl font-bold">
            The climb
          </h1>
          <p className="mt-2 text-muted-foreground max-w-xl">
            Every tool you use and every source you connect feeds one rising
            meter. Here is what each step unlocks, and where the real payoff
            begins.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <div className="text-4xl font-bold">
              {score}
              <span className="text-xl text-muted-foreground">%</span>
            </div>
            <div className="flex-1">
              <Progress value={score} className="h-3" />
              {upcoming ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {upcoming.threshold - score} to go until{" "}
                  <span className="font-semibold text-foreground">
                    {upcoming.title}
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Every readiness milestone cleared. You are at the top of the
                  climb.
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <div className="relative pl-4">
          <div
            className="absolute left-[27px] top-2 bottom-2 w-px"
            style={{ background: "hsl(var(--border))" }}
            aria-hidden="true"
          />
          <div className="space-y-4">
            {milestones.map((m, i) => {
              const unlocked = score >= m.threshold;
              const Icon = ICONS[m.iconKey];
              const isNext = upcoming?.title === m.title;
              return (
                <motion.div
                  key={m.title}
                  {...fadeUp(0.05 + i * 0.04)}
                  className="relative flex gap-4"
                  data-testid={`milestone-${m.threshold}`}
                >
                  <span
                    className="relative z-10 grid place-items-center w-12 h-12 rounded-full shrink-0 border"
                    style={{
                      background: unlocked
                        ? "hsl(326 100% 62%)"
                        : "hsl(var(--muted))",
                      borderColor: unlocked
                        ? "hsl(326 100% 62%)"
                        : "hsl(var(--border))",
                      color: unlocked ? "#fff" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {unlocked ? (
                      <Check className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    )}
                  </span>
                  <Card
                    className={`flex-1 ${isNext ? "ring-2 ring-primary/40" : ""}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-semibold">{m.title}</h2>
                        <span className="text-xs font-mono text-muted-foreground">
                          {m.threshold}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {m.blurb}
                      </p>
                      {!unlocked && isNext ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="mt-3 rounded-full h-8 text-xs"
                        >
                          <Link href="/matching">
                            Feed the machine
                            <ArrowRight
                              className="ml-1 w-3 h-3"
                              aria-hidden="true"
                            />
                          </Link>
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {/* The payoff tier: an honest Wingman upsell, not a fake gate. */}
            <motion.div
              {...fadeUp(0.05 + milestones.length * 0.04)}
              className="relative flex gap-4"
              data-testid="milestone-wingman"
            >
              <span
                className="relative z-10 grid place-items-center w-12 h-12 rounded-full shrink-0 border"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, hsl(43 90% 60%), hsl(38 80% 48%))",
                  borderColor: "hsl(43 70% 55%)",
                  color: "#1a1300",
                }}
              >
                <Crown className="w-5 h-5" aria-hidden="true" />
              </span>
              <Card
                className="flex-1 border-0"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(252 60% 16%), hsl(258 55% 11%))",
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-amber-200/90">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs uppercase tracking-[0.16em]">
                      Wingman
                    </span>
                  </div>
                  <CardTitle className="text-white text-xl">
                    Curated introductions
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Everyone who reaches match ready gets algorithmic
                    introductions. Wingman members also get founder-curated
                    intros, hand-picked, for the connections an algorithm would
                    miss.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    asChild
                    className="rounded-full"
                    data-testid="button-see-wingman"
                  >
                    <Link href="/pricing">
                      See Wingman
                      <ArrowRight className="ml-1 w-4 h-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        <motion.p
          {...fadeUp(0.3)}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          Want to show how far you have come?{" "}
          <Link
            href="/share-card"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Make your readiness card
          </Link>
          .
        </motion.p>
      </div>
    </AppLayout>
  );
}
