import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BREAKDOWN_ROWS } from "@/lib/readinessLanes";
import type { ReadinessDelta } from "@workspace/api-client-react";

const LANE_LABELS: Record<string, string> = Object.fromEntries(
  BREAKDOWN_ROWS.map((row) => [row.key, row.label]),
);

function laneLabel(key: string): string {
  return LANE_LABELS[key] ?? key;
}

/**
 * "Why your readiness moved" card. Reads the derived ReadinessDelta from the
 * matching state (the change between the two most recent daily snapshots) and
 * narrates it honestly: the headline score move plus the lanes whose coverage
 * actually changed, rises and dips alike. Renders nothing when there is no
 * delta to show (fewer than two snapshots, or nothing changed), so it never
 * leaves an empty card on the page.
 */
export function ReadinessDeltaCard({
  delta,
}: {
  delta: ReadinessDelta | null | undefined;
}) {
  if (!delta) return null;
  const { scoreDelta, lanes } = delta;
  if (scoreDelta === 0 && lanes.length === 0) return null;

  const rose = scoreDelta > 0;
  const dipped = scoreDelta < 0;

  return (
    <Card className="border-foreground/10" data-testid="readiness-delta-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
            <TrendingUp className="h-4.5 w-4.5 text-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">Why your readiness moved</CardTitle>
            <CardDescription>Since your last recorded day</CardDescription>
          </div>
          <Badge
            className={
              rose
                ? "ml-auto border-0 bg-[hsl(142_55%_45%/0.15)] text-[hsl(142_55%_32%)]"
                : dipped
                  ? "ml-auto border-0 bg-[hsl(0_72%_51%/0.12)] text-[hsl(0_72%_42%)]"
                  : "ml-auto border-0 bg-foreground/8 text-muted-foreground"
            }
            data-testid="readiness-delta-headline"
          >
            {rose && <ArrowUpRight className="mr-1 h-3 w-3" aria-hidden="true" />}
            {dipped && (
              <ArrowDownRight className="mr-1 h-3 w-3" aria-hidden="true" />
            )}
            {!rose && !dipped && <Minus className="mr-1 h-3 w-3" aria-hidden="true" />}
            {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} readiness
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {rose &&
            "Your readiness climbed. Here is the signal that moved the number."}
          {dipped &&
            "Your readiness dipped, usually because fresh signal decays over time. Feeding any lane below brings it back."}
          {!rose &&
            !dipped &&
            "Your score held steady, but your coverage shifted underneath it."}
        </p>
        {lanes.length > 0 && (
          <ul className="mt-4 space-y-2">
            {lanes.map((lane) => {
              const up = lane.delta > 0;
              return (
                <li
                  key={lane.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-foreground/8 bg-card px-3 py-2"
                  data-testid={`readiness-delta-lane-${lane.key}`}
                >
                  <span className="text-sm font-medium text-foreground">
                    {laneLabel(lane.key)}
                  </span>
                  <span
                    className={
                      up
                        ? "flex items-center gap-1 text-sm font-semibold text-[hsl(142_55%_38%)]"
                        : "flex items-center gap-1 text-sm font-semibold text-[hsl(0_72%_45%)]"
                    }
                  >
                    {up ? (
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {up ? `+${lane.delta}` : lane.delta} coverage
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
