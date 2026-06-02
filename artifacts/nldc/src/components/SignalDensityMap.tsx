import { Link } from "wouter";
import { Radar, ArrowUpRight, Lock } from "lucide-react";
import type { SignalMap, SignalMapLane } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// The signal-density map: a lane-by-lane read of how full the picture the
// machine holds of the user is. Active lanes show their coverage and how much
// they count; empty lanes read as blind spots with a direct way to fill them.
// Purely a presentation lens over the readiness breakdown, so the headline
// density equals the readiness score shown everywhere else.

function laneTone(coverage: number): string {
  if (coverage >= 75) return "hsl(var(--brand-green))";
  if (coverage >= 40) return "hsl(var(--brand-gold))";
  if (coverage > 0) return "hsl(var(--brand-rose))";
  return "hsl(var(--muted-foreground) / 0.3)";
}

function LaneTile({ lane }: { lane: SignalMapLane }) {
  return (
    <div
      data-testid={`signal-lane-${lane.id}`}
      className={`rounded-xl border p-4 ${
        lane.hasSignal
          ? "border-border bg-card"
          : "border-dashed border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{lane.label}</span>
        {lane.hasSignal ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {lane.coverage}% full
          </span>
        ) : (
          <Lock
            className="h-3.5 w-3.5 shrink-0 text-amber-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(lane.coverage, lane.hasSignal ? 6 : 0)}%`,
            backgroundColor: laneTone(lane.coverage),
          }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{lane.weightPercent}% of the picture</span>
        <span>{lane.confidence}% sure</span>
      </div>

      {lane.dimensions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lane.dimensions.slice(0, 2).map((d) => (
            <Badge key={d} variant="outline" className="text-[10px] font-normal">
              {d}
            </Badge>
          ))}
        </div>
      )}

      {!lane.hasSignal && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mt-3 h-auto px-0 text-xs text-primary hover:bg-transparent hover:underline"
          data-testid={`signal-lane-cta-${lane.id}`}
        >
          <Link href={lane.action.href}>
            {lane.action.label}
            <ArrowUpRight className="ml-1 h-3 w-3" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function SignalDensityMap({
  map,
  isDemo,
}: {
  map: SignalMap;
  isDemo: boolean;
}) {
  return (
    <Card data-testid="card-signal-density">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
            Signal density, lane by lane
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {map.lanesActive} of {map.totalLanes} lanes feeding
            </Badge>
            <Badge variant="outline" className="text-xs">
              {map.densityPercent}% full
            </Badge>
            {isDemo && (
              <Badge variant="outline" className="text-xs">
                Sample view, sign in for your own
              </Badge>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Every lane is a different way the machine gets to know you. The more
          lanes you fill, the better it matches you. Empty lanes are the fastest
          way to climb.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {map.topBlindSpot && (
          <div
            className="rounded-xl border border-primary/30 bg-primary/5 p-4"
            data-testid="signal-top-blindspot"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Fill this next
            </p>
            <p className="mt-1 text-sm font-medium">{map.topBlindSpot.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {map.topBlindSpot.action.detail}
            </p>
            <Button
              asChild
              size="sm"
              className="mt-3 rounded-full"
              data-testid="signal-top-blindspot-cta"
            >
              <Link href={map.topBlindSpot.action.href}>
                {map.topBlindSpot.action.label}
                <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {map.lanes.map((lane) => (
            <LaneTile key={lane.id} lane={lane} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
