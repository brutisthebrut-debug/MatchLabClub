import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BREAKDOWN_ROWS } from "@/lib/readinessLanes";
import type { MatchingBenchmarks } from "@workspace/api-client-react";

const LANE_LABELS: Record<string, string> = Object.fromEntries(
  BREAKDOWN_ROWS.map((row) => [row.key, row.label]),
);

function laneLabel(key: string): string {
  return LANE_LABELS[key] ?? key;
}

const GOAL_LABELS: Record<string, string> = {
  "long-term": "looking for something long-term",
  casual: "keeping it casual",
  "friends-first": "starting friends-first",
  exploring: "still figuring it out",
};

function percentilePhrase(p: number): string {
  if (p >= 90) return "top 10%";
  if (p >= 75) return "top 25%";
  if (p >= 50) return "above the middle";
  if (p >= 25) return "below the middle";
  return "bottom 25%";
}

/**
 * "How you compare" card. Reads the anonymized goal-cohort benchmark and shows,
 * per lane, where the user stands against people chasing the same kind of
 * connection. Renders an honest "not enough people yet" note when the cohort is
 * below the privacy floor, and nothing at all until data exists. Aggregate only:
 * the API never sends identities or content, just coverage percentiles.
 */
export function MatchBenchmarkCard({
  benchmarks,
}: {
  benchmarks: MatchingBenchmarks | null | undefined;
}) {
  if (!benchmarks) return null;

  const goalLabel = GOAL_LABELS[benchmarks.goal] ?? benchmarks.goal;

  if (!benchmarks.available) {
    // Below the privacy floor: be honest rather than fabricate a percentile.
    return (
      <Card className="border-foreground/10" data-testid="benchmark-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
              <Users className="h-4.5 w-4.5 text-foreground" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">How you compare</CardTitle>
              <CardDescription>Among people {goalLabel}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not enough people in your goal group yet to show a fair comparison.
            As more members join who want the same kind of connection, your
            standing unlocks here. Nothing personal is ever shared, only
            anonymized coverage.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Lead with the lanes where the user is furthest ahead, then the rest, so the
  // card opens on a strength but stays honest about the full picture.
  const ordered = [...benchmarks.lanes].sort(
    (a, b) => b.percentile - a.percentile,
  );

  return (
    <Card className="border-foreground/10" data-testid="benchmark-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
            <Users className="h-4.5 w-4.5 text-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">How you compare</CardTitle>
            <CardDescription>
              Among {benchmarks.cohortSize} people {goalLabel}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {ordered.map((lane) => (
            <li
              key={lane.key}
              data-testid={`benchmark-lane-${lane.key}`}
              className="rounded-lg border border-foreground/8 bg-card px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {laneLabel(lane.key)}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {percentilePhrase(lane.percentile)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/8">
                <div
                  className="h-full rounded-full bg-[hsl(248_62%_58%)]"
                  style={{ width: `${Math.max(2, lane.percentile)}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>You: {lane.coverage}</span>
                <span>Group median: {lane.cohortMedian}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
