import { Link } from "wouter";
import { ArrowRight, Heart, Sparkles, Target } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";

/**
 * The persistent "path to a match" spine. It rides at the top of every signed-in
 * app page (rendered by AppLayout for the authed, non-marketing shell) so the one
 * promise of the product, become ready then get matched, is always in view.
 *
 * It is purely derived from the shared matching-state query: distance to the
 * readiness gate plus the single highest-leverage next action, or the match-ready
 * payoff once the gate is cleared. Because every signal-feeding tool invalidates
 * getGetMatchingStateQueryKey, this bar updates itself the moment readiness moves.
 * It renders nothing for anonymous or still-loading users, so it never shows an
 * empty shell.
 */
export function MatchPathBar() {
  const { isAuthenticated } = useAuth();
  const { data } = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });

  if (!isAuthenticated || !data) return null;

  const score = Math.round(data.readiness?.score ?? 0);
  const threshold = data.readinessThreshold ?? 50;
  const eligible = data.eligible ?? false;
  const searchActive = ["building", "ready", "concierge_only"].includes(
    data.poolStatus,
  );
  const searchLabel = searchActive
    ? "Search active"
    : data.poolStatus === "paused"
      ? "Search paused"
      : "Search not started";
  const nearbyMembers = Math.max(0, data.cityDensity ?? 0);
  const topAction = data.nextActions?.[0] ?? null;
  const pointsToReady = Math.max(0, threshold - score);
  const pct = Math.min(100, Math.round((score / Math.max(1, threshold)) * 100));

  if (eligible) {
    return (
      <div
        className="sticky top-0 z-20 border-b border-[hsl(142_55%_45%/0.25)] bg-[hsl(142_55%_45%/0.08)] backdrop-blur-xl"
        data-testid="match-path-bar"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(142_55%_45%/0.18)]">
              <Heart
                className="h-3.5 w-3.5 text-[hsl(142_55%_38%)]"
                aria-hidden="true"
              />
            </span>
            Profile ready
          </span>
          <span className="rounded-full border border-foreground/10 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {searchLabel}
          </span>
          <span className="hidden rounded-full border border-foreground/10 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">
            {nearbyMembers > 0
              ? `${nearbyMembers} nearby ${nearbyMembers === 1 ? "member" : "members"}`
              : "Nearby market still building"}
          </span>
          <Link
            href="/matching"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            data-testid="match-path-bar-cta"
          >
            {searchActive ? "Review search" : "Choose search settings"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sticky top-0 z-20 border-b border-foreground/8 bg-background/95 backdrop-blur-xl"
      data-testid="match-path-bar"
    >
      <div className="mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 max-w-6xl">
        <Link
          href="/match-path"
          className="group flex min-w-0 items-center gap-2.5"
          data-testid="match-path-bar-progress"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(326_100%_60%/0.12)]">
            <Target
              className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-foreground">
              <span data-testid="match-path-bar-points">{pointsToReady}</span>{" "}
              {pointsToReady === 1 ? "point" : "points"} to profile ready
            </span>
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-foreground/10 sm:w-40">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground underline-offset-2 group-hover:underline">
                How readiness works
              </span>
            </span>
          </span>
        </Link>

        {topAction && (
          <Link
            href={topAction.href}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[hsl(326_100%_60%/0.3)] bg-gradient-to-br from-[hsl(248_62%_52%/0.08)] to-[hsl(326_100%_60%/0.08)] px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:from-[hsl(248_62%_52%/0.14)] hover:to-[hsl(326_100%_60%/0.14)]"
            data-testid="match-path-bar-action"
          >
            <Sparkles
              className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
              aria-hidden="true"
            />
            <span className="truncate">{topAction.label}</span>
            <span className="hidden shrink-0 rounded-full bg-[hsl(326_100%_60%/0.15)] px-1.5 py-0.5 text-[11px] font-bold text-[hsl(326_100%_45%)] sm:inline">
              +{topAction.points}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
