import { Link } from "wouter";
import { ArrowRight, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReadinessNextAction } from "@workspace/api-client-react";

interface NextStepCardProps {
  actions: ReadinessNextAction[];
  eligible?: boolean;
  limit?: number;
  className?: string;
  testId?: string;
}

export function NextStepCard({
  actions,
  eligible = false,
  limit = 3,
  className,
  testId = "card-next-step",
}: NextStepCardProps) {
  const top = actions.slice(0, limit);

  if (top.length === 0) {
    if (!eligible) return null;
    return (
      <Card className={className} data-testid={testId}>
        <CardContent className="p-6 flex items-start gap-4">
          <div className="rounded-full p-3 bg-[hsl(142_60%_45%/0.1)]">
            <Target className="w-5 h-5 text-[hsl(142_60%_40%)]" aria-hidden="true" />
          </div>
          <div>
            <div className="font-semibold text-lg">You are match ready.</div>
            <p className="text-sm text-muted-foreground mt-1">
              Your signals are deep enough to make intros worth your time. Turn
              on the matching list below when you are ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Target className="w-5 h-5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
          Your next best step
        </CardTitle>
        <CardDescription>
          The fastest ways to deepen your signals and move toward a real match.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.map((action) => (
          <div
            key={action.key}
            className="rounded-2xl border border-foreground/8 p-4 flex items-start justify-between gap-4"
            data-testid={`next-step-${action.key}`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{action.label}</span>
                {action.points > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
                    +{action.points} readiness
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{action.detail}</p>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full h-8 text-xs shrink-0"
              data-testid={`next-step-cta-${action.key}`}
            >
              <Link href={action.href}>
                Go
                <ArrowRight className="ml-1 w-3 h-3" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
