import { CheckCircle2, Sparkles, TrendingUp } from "lucide-react";
import type { UserJourneySummary } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// The cheapest retention loop we have: a returning user sees what they did this
// week and how far they climbed, built only from their own journey events. It
// reads counts, it never computes readiness. For a brand-new account with no
// history it shows a warm first-week state instead of a wall of zeros, so the
// card always feels alive. The three tiles mirror the summary contract exactly;
// the daily streak lives in ClimbCard directly above this, so we do not repeat
// it here.
export function MomentumRecap({
  summary,
  isDemo,
  className,
}: {
  summary: UserJourneySummary;
  isDemo?: boolean;
  className?: string;
}) {
  const freshStart = !isDemo && !summary.hasHistory;

  const stats = [
    {
      key: "signals",
      icon: Sparkles,
      value: summary.signalsFedThisWeek,
      label: `signal${summary.signalsFedThisWeek === 1 ? "" : "s"} fed`,
    },
    {
      key: "readiness",
      icon: TrendingUp,
      value: summary.readinessGainedThisWeek,
      label: "readiness gained",
    },
    {
      key: "tools",
      icon: CheckCircle2,
      value: summary.toolsCompletedThisWeek,
      label: `tool${summary.toolsCompletedThisWeek === 1 ? "" : "s"} completed`,
    },
  ];

  return (
    <Card className={className} data-testid="momentum-recap">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.16em]">
            This week
          </span>
        </div>
        <CardTitle className="mt-2 text-lg">Your momentum</CardTitle>
        <CardDescription>
          {isDemo
            ? "A sample of the weekly recap. Sign in to track your own climb."
            : freshStart
              ? "Your first week starts now. Feed a signal and watch this fill in."
              : "What you fed the machine over the last seven days."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="rounded-xl border bg-muted/40 p-3 text-center"
                data-testid={`momentum-stat-${s.key}`}
              >
                <Icon
                  className="mx-auto h-4 w-4 text-[hsl(326_100%_50%)]"
                  aria-hidden="true"
                />
                <div className="mt-1.5 font-serif text-2xl font-bold">
                  {s.value}
                </div>
                <div className="text-xs leading-tight text-muted-foreground">
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
