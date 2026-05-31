import { Flame } from "lucide-react";
import type { ActivityStreak } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// A compact, reusable read on the user's activity streak. Lit when the run is
// alive (active today or still recoverable), muted once it has lapsed. The
// streak is a consistency lens only and never affects the readiness score.
export function StreakBadge({
  streak,
  className,
}: {
  streak?: ActivityStreak;
  className?: string;
}) {
  const current = streak?.current ?? 0;
  const active = current > 0;
  const label =
    current === 0
      ? "Start a streak"
      : `${current} day${current === 1 ? "" : "s"} streak`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        active
          ? "bg-[hsl(20_90%_55%/0.12)] text-[hsl(20_90%_45%)]"
          : "bg-muted text-muted-foreground",
        className,
      )}
      title={
        streak
          ? `${streak.daysActiveLast14} of the last 14 days active. Longest run ${streak.longest}.`
          : undefined
      }
      data-testid="streak-badge"
    >
      <Flame
        className={cn("h-3.5 w-3.5", active ? "" : "opacity-60")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
