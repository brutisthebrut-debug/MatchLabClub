import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Eye,
  Heart,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReportBlockMenu } from "@/components/safety/ReportBlockMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMeta } from "@/hooks/useMeta";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@workspace/replit-auth-web";
import {
  getGetConnectionsQueryKey,
  getGetMatchingProposalsQueryKey,
  getGetMatchingStateQueryKey,
  useGetConnections,
  useGetMatchingProposals,
  useGetMatchingState,
  useRespondToMatchProposal,
  type Connection,
  type MatchProposal,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const LIFECYCLE = [
  {
    label: "Waiting",
    icon: Search,
    copy: "Search can be active while the nearby pilot pool is still building.",
  },
  {
    label: "Proposal",
    icon: Sparkles,
    copy: "Echo explains the fit. You decide whether anything moves forward.",
  },
  {
    label: "Mutual reveal",
    icon: Eye,
    copy: "Names, photos, and conversation open only after both people say yes.",
  },
  {
    label: "Date",
    icon: CalendarCheck,
    copy: "Plan at your pace with safety tools close by.",
  },
  {
    label: "Debrief",
    icon: HeartHandshake,
    copy: "What you choose to save helps Echo learn what real fit feels like.",
  },
] as const;

const PROPOSAL_STATUS: Record<
  string,
  { label: string; note: string; active: boolean }
> = {
  proposed: {
    label: "Your decision",
    note: "This moves only if you choose interested.",
    active: true,
  },
  user_yes: {
    label: "You said yes",
    note: "Nothing reveals unless the other person also says yes.",
    active: true,
  },
  user_no: {
    label: "Passed",
    note: "This proposal is closed and will not be brought back.",
    active: false,
  },
  mutual_yes: {
    label: "Mutual yes",
    note: "The introduction can now open. Look for it in your conversations.",
    active: true,
  },
  completed: {
    label: "Introduction made",
    note: "The introduction has moved into your conversation history.",
    active: false,
  },
  expired: {
    label: "Expired",
    note: "This proposal closed before both people decided.",
    active: false,
  },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function proposalSourceLabel(source: string): string {
  if (source === "internal") return "Member proposal";
  if (source === "external_paste") return "Profile read";
  if (source === "concierge") return "Founder-curated proposal";
  return "Considered proposal";
}

function LifecycleRail({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-5" data-testid="matches-lifecycle">
      {LIFECYCLE.map((stage, index) => {
        const Icon = stage.icon;
        const current = index === currentIndex;
        const reached = index <= currentIndex;
        return (
          <div
            key={stage.label}
            className={`rounded-2xl border p-4 transition-colors ${
              current
                ? "border-[hsl(326_100%_50%/0.45)] bg-[hsl(326_100%_50%/0.08)]"
                : reached
                  ? "border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.05)]"
                  : "border-foreground/10 bg-background/35"
            }`}
            data-testid={`matches-stage-${stage.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-center justify-between gap-2">
              <Icon
                className={`h-4 w-4 ${
                  current ? "text-[hsl(326_100%_50%)]" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {index + 1} of {LIFECYCLE.length}
              </span>
            </div>
            <p className="mt-3 text-sm font-bold text-foreground">
              {stage.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {stage.copy}
            </p>
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="rounded-2xl border border-foreground/10 bg-background/50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const closed = connection.status === "closed";
  return (
    <Link
      href={`/matches/${connection.id}`}
      className="block rounded-2xl border border-foreground/10 bg-background/45 p-4 transition-colors hover:border-foreground/25"
      data-testid={`connection-row-${connection.id}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(326_100%_62%)]">
          <Heart className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              Mutual introduction
            </p>
            {closed && (
              <Badge variant="secondary" className="text-[10px]">
                Closed
              </Badge>
            )}
            {connection.unreadCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(326_100%_62%)] px-1.5 text-[10px] font-bold text-white">
                {connection.unreadCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {connection.lastMessagePreview ??
              "Your mutual reveal is open. Start when you are ready."}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {relativeTime(connection.lastMessageAt ?? connection.createdAt)}
        </span>
      </div>
    </Link>
  );
}

function ProcessPreview({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      <section
        className="mb-5 rounded-2xl border border-[hsl(326_100%_50%/0.25)] bg-[hsl(326_100%_50%/0.06)] p-5"
        data-testid="matches-process-preview"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
              Product preview
            </p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              These are lifecycle examples, not available people or active
              introductions. Sign in to see only your real account state.
            </p>
          </div>
          <Button onClick={onSignIn} className="shrink-0 rounded-full">
            Sign in
          </Button>
        </div>
      </section>
      <LifecycleRail currentIndex={0} />
      <section className="glass-strong mt-5 rounded-[2rem] p-7 sm:p-9">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              What Echo would say while you wait
            </p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-foreground">
              Your profile can be ready before your market is.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              That is not failure and it is not a hidden match. MatchLab keeps
              readiness, active search, and nearby availability separate so you
              always know what is actually happening.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function Matches() {
  useMeta(
    "Matches",
    "Your honest path from waiting to a considered introduction, date, and debrief.",
  );

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const matching = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const proposals = useGetMatchingProposals({
    query: {
      queryKey: getGetMatchingProposalsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const connections = useGetConnections({
    query: {
      queryKey: getGetConnectionsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const respond = useRespondToMatchProposal();

  const state = matching.data;
  const proposalList = proposals.data ?? [];
  const connectionList = connections.data ?? [];
  const searchActive = ["building", "ready", "concierge_only"].includes(
    state?.poolStatus ?? "off",
  );
  const searchLabel = searchActive
    ? "Active"
    : state?.poolStatus === "paused"
      ? "Paused"
      : "Not started";
  const nearbyMembers = Math.max(0, state?.cityDensity ?? 0);
  const hasMutualReveal =
    connectionList.length > 0 ||
    proposalList.some((proposal) =>
      ["mutual_yes", "completed"].includes(proposal.status),
    );
  const hasOpenProposal = proposalList.some((proposal) =>
    ["proposed", "user_yes"].includes(proposal.status),
  );
  const hasSavedDebrief = connectionList.some(
    (connection) => connection.dateStage === "debrief_saved",
  );
  const hasDate = connectionList.some((connection) =>
    ["date_planned", "date_completed", "debrief_saved"].includes(
      connection.dateStage,
    ),
  );
  const lifecycleIndex = hasSavedDebrief
    ? 4
    : hasDate
      ? 3
      : hasMutualReveal
        ? 2
        : hasOpenProposal
          ? 1
          : 0;
  const loading =
    matching.isLoading || proposals.isLoading || connections.isLoading;
  const failed = matching.isError || proposals.isError || connections.isError;

  async function handleProposalResponse(id: string, interested: boolean) {
    try {
      await respond.mutateAsync({ id, data: { interested } });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetMatchingProposalsQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMatchingStateQueryKey(),
        }),
      ]);
      toast({
        title: interested
          ? "Your yes is saved. Nothing reveals unless they say yes too."
          : "Passed. This proposal is now closed.",
      });
    } catch {
      toast({ title: "That decision did not save. Try again." });
    }
  }

  return (
    <AppLayout>
      <div className="mesh-bg min-h-screen px-4 py-10 sm:px-6">
        <div className="pointer-events-none fixed -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(326_100%_60%/0.12)] blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -left-24 h-96 w-96 rounded-full bg-[hsl(248_62%_52%/0.12)] blur-3xl" />

        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] text-white shadow-lg">
                <HeartHandshake className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[hsl(326_100%_50%)]">
                One considered introduction at a time
              </p>
            </div>
            <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Matches, without the guessing game.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              See exactly where you are: waiting, considering a proposal,
              mutually revealed, planning a date, or learning afterward.
            </p>
          </motion.div>

          {!isAuthenticated ? (
            <ProcessPreview onSignIn={() => login()} />
          ) : loading ? (
            <section className="glass-strong animate-pulse rounded-[2rem] p-8">
              <div className="h-5 w-36 rounded bg-foreground/10" />
              <div className="mt-5 h-24 rounded-2xl bg-foreground/10" />
              <div className="mt-3 h-24 rounded-2xl bg-foreground/10" />
            </section>
          ) : failed || !state ? (
            <section className="glass-strong rounded-[2rem] p-8 text-center">
              <p className="font-semibold text-foreground">
                Your match path could not load.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Refresh in a moment. No sample people are standing in for your
                real account.
              </p>
            </section>
          ) : (
            <>
              <motion.div {...fadeUp(0.03)}>
                <LifecycleRail currentIndex={lifecycleIndex} />
              </motion.div>

              <motion.section
                {...fadeUp(0.05)}
                className="glass-strong mt-5 rounded-[2rem] p-6 sm:p-8"
                data-testid="matches-current-state"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(326_100%_50%)]">
                      Right now
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-bold text-foreground">
                      {hasMutualReveal
                        ? "You have a mutual introduction."
                        : hasOpenProposal
                          ? "You have a proposal to consider."
                          : searchActive
                            ? "Search is active. Your nearby pool is still the truth."
                            : "Your search is not active yet."}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Profile readiness says MatchLab knows enough to consider
                      you. It does not prove that a fitting person is available
                      nearby today.
                    </p>
                  </div>
                  <Link
                    href="/matching"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/15 bg-background/60 px-5 py-3 text-sm font-semibold text-foreground"
                  >
                    Search settings
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
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
              </motion.section>

              {proposalList.length > 0 && (
                <motion.section {...fadeUp(0.07)} className="mt-5">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Proposals
                      </p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-foreground">
                        Consider the fit, not a feed.
                      </h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Real account data
                    </span>
                  </div>
                  <div className="space-y-3">
                    {proposalList.map((proposal: MatchProposal) => {
                      const meta = PROPOSAL_STATUS[proposal.status] ?? {
                        label: proposal.status,
                        note: "This proposal is no longer awaiting a decision.",
                        active: false,
                      };
                      const awaitingDecision = proposal.status === "proposed";
                      return (
                        <article
                          key={proposal.id}
                          className="glass rounded-2xl border border-foreground/10 p-5"
                          data-testid={`proposal-${proposal.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-foreground">
                                  {proposalSourceLabel(proposal.source)}
                                </p>
                                <Badge
                                  variant={
                                    meta.active ? "default" : "secondary"
                                  }
                                  className="text-[10px] uppercase"
                                >
                                  {meta.label}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {proposal.summary ??
                                  "Echo has a compatibility read ready for your review."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-foreground">
                                {proposal.compatibilityScore}%
                              </span>
                              {proposal.proposedToUserId && (
                                <ReportBlockMenu
                                  targetUserId={proposal.proposedToUserId}
                                  context="match"
                                  onBlocked={() =>
                                    queryClient.invalidateQueries({
                                      queryKey:
                                        getGetMatchingProposalsQueryKey(),
                                    })
                                  }
                                />
                              )}
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-foreground/10 bg-background/45 px-4 py-3">
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Eye
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              {meta.note}
                            </p>
                          </div>

                          {awaitingDecision && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="rounded-full"
                                disabled={respond.isPending}
                                onClick={() =>
                                  handleProposalResponse(proposal.id, true)
                                }
                                data-testid={`button-proposal-interested-${proposal.id}`}
                              >
                                <Check
                                  className="mr-1 h-4 w-4"
                                  aria-hidden="true"
                                />
                                Interested
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={respond.isPending}
                                onClick={() =>
                                  handleProposalResponse(proposal.id, false)
                                }
                                data-testid={`button-proposal-pass-${proposal.id}`}
                              >
                                <X
                                  className="mr-1 h-4 w-4"
                                  aria-hidden="true"
                                />
                                Pass
                              </Button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </motion.section>
              )}

              <motion.section {...fadeUp(0.09)} className="mt-5">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Mutual introductions
                    </p>
                    <h2 className="mt-1 font-serif text-2xl font-bold text-foreground">
                      Conversation opens after mutual yes.
                    </h2>
                  </div>
                  {connectionList.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {connectionList.length}{" "}
                      {connectionList.length === 1
                        ? "conversation"
                        : "conversations"}
                    </span>
                  )}
                </div>

                {connectionList.length > 0 ? (
                  <div className="space-y-3">
                    {connectionList.map((connection) => (
                      <ConnectionRow
                        key={connection.id}
                        connection={connection}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className="glass rounded-2xl border border-foreground/10 p-7 text-center"
                    data-testid="matches-empty"
                  >
                    <MessageCircle
                      className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-foreground">
                      No mutual introductions are open right now.
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                      {searchActive
                        ? "Your search is active. MatchLab will not invent activity while the nearby pool is still building."
                        : state.eligible
                          ? "Your profile is ready, but search is off. Choose your settings when you want to be considered."
                          : "Keep building the profile with Echo. Readiness and nearby availability will remain separate."}
                    </p>
                  </div>
                )}
              </motion.section>

              <motion.section
                {...fadeUp(0.11)}
                className="mt-5 grid gap-4 md:grid-cols-2"
              >
                <div className="glass rounded-2xl border border-foreground/10 p-6">
                  <ShieldAlert
                    className="h-5 w-5 text-[hsl(248_62%_62%)]"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 font-serif text-xl font-bold text-foreground">
                    Date at your pace.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Safety planning, blocking, and reporting stay available.
                    Mutual yes opens a door; it never creates an obligation.
                  </p>
                  <Link
                    href="/date-safety"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(248_62%_62%)]"
                  >
                    Open date safety
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="glass rounded-2xl border border-foreground/10 p-6">
                  <HeartHandshake
                    className="h-5 w-5 text-[hsl(326_100%_50%)]"
                    aria-hidden="true"
                  />
                  <h2 className="mt-3 font-serif text-xl font-bold text-foreground">
                    Learn afterward.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Debrief what felt good, off, or unclear. You choose what is
                    saved before it becomes part of your MatchLab journey.
                  </p>
                  <Link
                    href="/copilot/debrief"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(326_100%_50%)]"
                  >
                    Debrief with Echo
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </motion.section>

              <motion.div
                {...fadeUp(0.13)}
                className="mt-5 flex items-start gap-3 rounded-2xl border border-foreground/10 bg-background/45 p-5"
              >
                <Shield
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Consent stays visible through the whole path.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Pass closes a proposal. Mutual reveal requires two yeses.
                    Block and report controls stay available on proposals and in
                    conversations. You can leave at any point.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
