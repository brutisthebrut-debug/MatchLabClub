import { useMemo } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  Activity,
  HeartHandshake,
  Target,
  Check,
  ArrowRight,
  Mountain,
} from "lucide-react";
import type { ActivityStreak } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { computeClimb } from "@/lib/climb";
import type { MilestoneIconKey } from "@/lib/milestones";
import { StreakBadge } from "./StreakBadge";

const ICONS: Record<MilestoneIconKey, typeof Sparkles> = {
  first: Sparkles,
  patterns: Activity,
  ready: HeartHandshake,
  dialed: Target,
};

// The climb card is the gamified face of Match Readiness. It reframes the one
// readiness number as a journey (level, current stage, the next unlock) and
// pairs it with the activity streak. It does not recompute readiness; it reads
// the score and threshold straight from the matching state. Used on Home and
// Mirror so every surface tells the same story.
export function ClimbCard({
  score,
  threshold,
  streak,
  className,
}: {
  score: number;
  threshold: number;
  streak?: ActivityStreak;
  className?: string;
}) {
  const climb = useMemo(
    () => computeClimb(score, threshold),
    [score, threshold],
  );
  const NextIcon = climb.next ? ICONS[climb.next.iconKey] : Check;

  return (
    <Card className={className} data-testid="climb-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mountain className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">
              The climb
            </span>
          </div>
          <StreakBadge streak={streak} />
        </div>
        <CardTitle className="mt-2 flex items-baseline gap-2 text-2xl">
          Level {climb.level}
          <span className="text-sm font-normal text-muted-foreground">
            of {climb.totalLevels}
          </span>
        </CardTitle>
        <CardDescription>
          {climb.stageTitle}. {climb.stageBlurb}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold">{climb.score}% ready</span>
            {climb.next ? (
              <span className="text-muted-foreground">
                {climb.pointsToNext} to {climb.next.title}
              </span>
            ) : (
              <span className="text-muted-foreground">Top of the climb</span>
            )}
          </div>
          <Progress
            value={climb.next ? climb.progressToNextPct : 100}
            className="h-2.5"
          />
        </div>

        {climb.next ? (
          <div className="rounded-xl border bg-muted/40 p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background border">
                <NextIcon
                  className="h-4 w-4 text-[hsl(326_100%_50%)]"
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Next up: {climb.next.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {climb.next.unlocks}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
            Every level cleared. The machine knows you well enough to reach for
            matches you would never have found on your own.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link href="/matching">
              Feed the machine
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="rounded-full"
          >
            <Link href="/milestones">See the full climb</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
