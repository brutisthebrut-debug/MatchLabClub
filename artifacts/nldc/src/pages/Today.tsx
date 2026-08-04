import { Link } from "wouter";
import {
  ArrowRight,
  HeartHandshake,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetCompanionQueryKey,
  getGetMatchingStateQueryKey,
  useGetCompanion,
  useGetMatchingState,
} from "@workspace/api-client-react";

function StatePill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartHandshake;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function Today() {
  useMeta(
    "Today with Echo",
    "Your current MatchLab read, search state, and one useful next step.",
  );

  const { isAuthenticated, login } = useAuth();
  const companion = useGetCompanion({
    query: {
      queryKey: getGetCompanionQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const matching = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const state = matching.data;
  const echo = companion.data;
  const searchActive = ["building", "ready", "concierge_only"].includes(
    state?.poolStatus ?? "off",
  );
  const searchLabel = searchActive
    ? "Active"
    : state?.poolStatus === "paused"
      ? "Paused"
      : "Not started";
  const nearbyMembers = Math.max(0, state?.cityDensity ?? 0);
  const nextAction = state?.nextActions?.[0] ?? null;
  const nextHref =
    nextAction?.href ?? (state?.eligible ? "/matching" : "/echo");
  const nextLabel =
    nextAction?.label ??
    (state?.eligible
      ? searchActive
        ? "Review your search"
        : "Choose search settings"
      : "Tell Echo what is happening");

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen overflow-hidden px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-7">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5 text-xs font-bold text-foreground backdrop-blur-sm">
              <Sparkles
                className="h-3.5 w-3.5 text-[hsl(326_100%_50%)]"
                aria-hidden="true"
              />
              Today with Echo
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              One honest read. One useful move.
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Echo keeps the whole journey in view and brings forward only what
              matters today.
            </p>
          </div>

          {!isAuthenticated ? (
            <section className="glass-strong rounded-[2rem] p-7 sm:p-10">
              <p className="text-sm font-bold uppercase tracking-wider text-[hsl(326_100%_45%)]">
                Echo is ready when you are
              </p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-foreground">
                Sign in to continue your MatchLab journey.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Your read is grounded in the signals you choose to share. Echo
                will say what it knows, what it does not, and what would help
                next.
              </p>
              <button
                type="button"
                onClick={() => login()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 py-3 text-sm font-semibold text-white"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </section>
          ) : companion.isLoading || matching.isLoading ? (
            <section className="glass-strong animate-pulse rounded-[2rem] p-8">
              <div className="h-4 w-32 rounded bg-foreground/10" />
              <div className="mt-5 h-8 w-3/4 rounded bg-foreground/10" />
              <div className="mt-3 h-4 w-full rounded bg-foreground/10" />
              <div className="mt-2 h-4 w-5/6 rounded bg-foreground/10" />
            </section>
          ) : companion.isError || matching.isError || !echo || !state ? (
            <section className="glass-strong rounded-[2rem] p-8 text-center">
              <p className="font-semibold text-foreground">
                Echo could not load today's read.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Refresh in a moment. No sample data is standing in for your real
                account.
              </p>
            </section>
          ) : (
            <>
              <section
                className="glass-strong relative overflow-hidden rounded-[2rem] p-7 sm:p-10"
                data-testid="today-echo-read"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-gradient-to-br from-[#3D35CC]/15 to-[#FF2D9B]/15 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white shadow-lg">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {echo.personaLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Readiness {echo.readinessScore} of {echo.threshold}
                      </p>
                    </div>
                  </div>

                  <p className="mt-7 text-sm font-semibold text-[hsl(326_100%_45%)]">
                    {echo.greeting}
                  </p>
                  <h2 className="mt-3 max-w-3xl font-serif text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                    {echo.read}
                  </h2>
                  {echo.challenge && (
                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                      {echo.challenge}
                    </p>
                  )}

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/echo"
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
                      data-testid="today-talk-to-echo"
                    >
                      Tell Echo what is happening
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/me"
                      className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/60 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur-sm"
                    >
                      See what MatchLab knows
                    </Link>
                  </div>
                </div>
              </section>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatePill
                  icon={HeartHandshake}
                  label="Profile"
                  value={state.eligible ? "Ready" : "Still building"}
                />
                <StatePill icon={Search} label="Search" value={searchLabel} />
                <StatePill
                  icon={MapPin}
                  label="Nearby market"
                  value={
                    nearbyMembers > 0
                      ? `${nearbyMembers} ${nearbyMembers === 1 ? "member" : "members"}`
                      : "Still building"
                  }
                />
              </div>

              <section className="glass mt-5 rounded-[2rem] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  One useful move
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-foreground">
                      {nextLabel}
                    </h2>
                    {nextAction?.detail && (
                      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                        {nextAction.detail}
                      </p>
                    )}
                  </div>
                  <Link
                    href={nextHref}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
                    data-testid="today-next-action"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
