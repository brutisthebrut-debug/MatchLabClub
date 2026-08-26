import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { resolveMatchListReadState } from "@/lib/matchLifecycleReadState";
import {
  isValidMatchAgeRange,
  MATCH_GENDER_OPTIONS,
  MATCH_RADIUS_PRESETS,
  normalizeMatchGenderPreference,
  parseMatchPreferenceLines,
  snapMatchRadiusKm,
} from "@/lib/matchPreferences";
import {
  useGetConnections,
  getGetConnectionsQueryKey,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useGetMatchingProposals,
  getGetMatchingProposalsQueryKey,
  useRespondToMatchProposal,
  useUpdateMatchingPoolMembership,
  useUpdateMatchingPreferences,
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

// A signed-out visitor sees a real, filled-in list instead of an empty one. The
// demo never touches the server and is clearly labelled as a sample.
const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "demo-1",
    counterpartUserId: "demo-a",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 2,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 3_600_000).toISOString(),
    lastMessagePreview: "That hiking spot looks unreal, when are you free?",
  },
  {
    id: "demo-2",
    counterpartUserId: "demo-b",
    status: "active",
    closedReason: null,
    closedByYou: false,
    unreadCount: 0,
    createdAt: new Date(Date.now() - 172_800_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 7_200_000).toISOString(),
    lastMessagePreview: "Same, I could talk about that for hours.",
  },
];

const PROPOSAL_STATUS: Record<string, { label: string; note: string }> = {
  proposed: {
    label: "Your response",
    note: "This introduction was deliberately sent to you. Take your time.",
  },
  user_yes: {
    label: "You said yes",
    note: "Your response is saved. We are waiting for the other person and the pilot team.",
  },
  user_no: {
    label: "You passed",
    note: "This introduction is closed and will not be shown to you again.",
  },
  mutual_yes: {
    label: "Mutual yes",
    note: "Both people said yes. Your conversation opens in the connection list below.",
  },
  completed: {
    label: "Introduction made",
    note: "The introduction was completed.",
  },
  expired: {
    label: "Closed",
    note: "This introduction closed before both people opted in.",
  },
};

function proposalSourceLabel(source: string): string {
  if (source === "concierge") return "A considered introduction";
  if (source === "internal") return "A controlled-pilot introduction";
  return "A profile you asked MatchLab to read";
}

function pilotStateCopy(
  status: string | null | undefined,
  eligible: boolean,
): { title: string; body: string } {
  if (status === "paused") {
    return {
      title: "Consideration is paused",
      body: "Your existing records stay private. You will not enter a new introduction while paused.",
    };
  }
  if (status === "building" || status === "ready") {
    return {
      title: "You are in the controlled consideration pool",
      body: "This is not a promise of an introduction. We will show one here only when the pilot can send it honestly.",
    };
  }
  if (status === "concierge_only") {
    return {
      title: "You are in concierge consideration",
      body: "The pilot team can consider a deliberate introduction. Nothing is shown to another member until the send step.",
    };
  }
  if (eligible) {
    return {
      title: "You can opt into consideration",
      body: "Your record has enough confirmed context to enter the controlled pool when you choose.",
    };
  }
  return {
    title: "We are still building the context for consideration",
    body: "There is no score to chase. Keep confirming what feels true in My MatchLab, and choose whether matching may use it.",
  };
}

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

function ConnectionRow({
  connection,
  isDemo,
}: {
  connection: Connection;
  isDemo: boolean;
}) {
  const closed = connection.status === "closed";
  const body = (
    <div
      className="glass border border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-colors hover:border-white/25"
      data-testid={`connection-row-${connection.id}`}
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(326_100%_62%)] flex items-center justify-center flex-shrink-0">
        <Heart className="w-5 h-5 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            A mutual match
          </p>
          {closed && (
            <Badge variant="secondary" className="text-[10px]">
              Closed
            </Badge>
          )}
          {connection.unreadCount > 0 && (
            <span
              className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[hsl(326_100%_62%)] text-[10px] font-bold text-white"
              data-testid={`connection-unread-${connection.id}`}
            >
              {connection.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {connection.lastMessagePreview ??
            "You matched. Say hello to start the conversation."}
        </p>
      </div>
      <div className="text-[10px] text-muted-foreground/50 flex-shrink-0">
        {relativeTime(connection.lastMessageAt ?? connection.createdAt)}
      </div>
    </div>
  );

  if (isDemo) return body;
  return (
    <Link href={`/matches/${connection.id}`} className="block">
      {body}
    </Link>
  );
}

export default function Matches() {
  useMeta(
    "Your matches",
    "Every mutual match lives here. Open one to start a real, safe conversation.",
  );

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDemo = !isAuthenticated;

  const { data: serverData, isLoading, isError, refetch } = useGetConnections({
    query: {
      queryKey: getGetConnectionsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const matchingStateQuery = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const proposalsQuery = useGetMatchingProposals({
    query: {
      queryKey: getGetMatchingProposalsQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });
  const respondProposal = useRespondToMatchProposal();
  const updatePool = useUpdateMatchingPoolMembership();
  const updatePreferences = useUpdateMatchingPreferences();

  const [showPreferences, setShowPreferences] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preferences") === "1",
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(45);
  const [distanceKm, setDistanceKm] = useState("any");
  const [genderPreference, setGenderPreference] = useState("any");
  const [cityHint, setCityHint] = useState("");
  const [dealBreakersText, setDealBreakersText] = useState("");
  const [mustHavesText, setMustHavesText] = useState("");

  const connections = isDemo ? DEMO_CONNECTIONS : (serverData ?? []);
  const readState = resolveMatchListReadState({
    isAuthenticated,
    isLoading,
    isError,
    connectionCount: connections.length,
  });
  const proposalList = proposalsQuery.data ?? [];
  const poolStatus = matchingStateQuery.data?.poolStatus ?? null;
  const eligibleForConsideration = matchingStateQuery.data?.eligible ?? false;
  const pilotState = pilotStateCopy(poolStatus, eligibleForConsideration);
  const inConsideration =
    poolStatus === "building" ||
    poolStatus === "ready" ||
    poolStatus === "concierge_only";
  const preferences = matchingStateQuery.data?.preferences ?? null;

  useEffect(() => {
    if (!preferences || preferencesHydrated) return;
    setAgeMin(typeof preferences.ageMin === "number" ? preferences.ageMin : 25);
    setAgeMax(typeof preferences.ageMax === "number" ? preferences.ageMax : 45);
    setDistanceKm(snapMatchRadiusKm(preferences.distanceKm));
    setGenderPreference(
      normalizeMatchGenderPreference(preferences.genderPreference),
    );
    setCityHint(preferences.cityHint ?? "");
    setDealBreakersText((preferences.dealBreakers ?? []).join("\n"));
    setMustHavesText((preferences.mustHaves ?? []).join("\n"));
    setPreferencesHydrated(true);
  }, [preferences, preferencesHydrated]);

  async function handleConsiderationChange(join: boolean) {
    try {
      await updatePool.mutateAsync({
        data: { status: join ? "building" : "off" },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
      toast({
        title: join
          ? "You joined controlled consideration."
          : "You left controlled consideration.",
        description: join
          ? "This does not promise an introduction or reveal you to another member."
          : "No new introduction will be sent while you are out.",
      });
    } catch {
      toast({
        title: "We couldn't change your consideration state.",
        description: "Your current setting is unchanged. Try again.",
        variant: "destructive",
      });
    }
  }

  async function handleSavePreferences() {
    if (!isValidMatchAgeRange(ageMin, ageMax)) {
      toast({
        title: "Check the age range.",
        description:
          "Use whole-number ages from 18 to 120, with the minimum no higher than the maximum.",
        variant: "destructive",
      });
      return;
    }

    const distance = distanceKm === "any" ? null : Number(distanceKm);
    const city = cityHint.trim();
    if (city.length > 120) {
      toast({
        title: "The city or area is too long.",
        description: "Keep it to 120 characters or fewer.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updatePreferences.mutateAsync({
        data: {
          ageMin,
          ageMax,
          distanceKm: distance,
          genderPreference:
            genderPreference === "any" ? null : genderPreference,
          cityHint: city.length === 0 ? null : city,
          dealBreakers: parseMatchPreferenceLines(dealBreakersText),
          mustHaves: parseMatchPreferenceLines(mustHavesText),
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
      setPreferencesDirty(false);
      toast({
        title: "Matching preferences saved.",
        description:
          "They guide controlled consideration; they do not generate a score or promise an introduction.",
      });
    } catch {
      toast({
        title: "We couldn't save your preferences.",
        description: "Your current saved preferences are unchanged. Try again.",
        variant: "destructive",
      });
    }
  }

  async function handleProposalResponse(id: string, interested: boolean) {
    try {
      await respondProposal.mutateAsync({ id, data: { interested } });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetMatchingProposalsQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMatchingStateQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetConnectionsQueryKey(),
        }),
      ]);
      toast({
        title: interested ? "Your yes is saved." : "You passed.",
        description: interested
          ? "Nothing opens unless the other person also says yes."
          : "This introduction is now closed.",
      });
    } catch {
      toast({
        title: "We couldn't save your response.",
        description: "The introduction is unchanged. Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-indigo fixed w-[400px] h-[400px] -top-20 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(245_58%_62%)] to-[hsl(280_50%_62%)] flex items-center justify-center shadow-[0_0_16px_hsl(245_58%_62%/0.4)]">
                <Users className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[hsl(245_70%_78%)]">
                Mutual matches
              </p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Your matches
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
              When you and someone both say yes, the conversation opens here.
              A conversation opens here only after a deliberately sent proposal
              and both members' consent.
            </p>
          </motion.div>

          {isDemo && (
            <motion.div
              {...fadeUp(0.03)}
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              data-testid="banner-matches-sample"
            >
              <p className="text-sm text-muted-foreground">
                This is a sample. Sign in to see your actual introduction state.
              </p>
              <Button
                onClick={() => login()}
                size="sm"
                className="rounded-full"
                data-testid="button-matches-signin"
              >
                Sign in
              </Button>
            </motion.div>
          )}


          {!isDemo && (
            <motion.section {...fadeUp(0.04)} className="mb-6 space-y-4">
              <div
                className="glass border border-white/10 rounded-2xl p-5"
                data-testid="matches-pilot-state"
              >
                {matchingStateQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading your consideration state...
                  </p>
                ) : matchingStateQuery.isError ? (
                  <div role="alert">
                    <p className="text-sm font-semibold text-foreground">
                      We couldn't load your consideration state.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nothing has changed. We will not guess whether you are in the pilot.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 rounded-full"
                      onClick={() => void matchingStateQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      {pilotState.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {pilotState.body}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {inConsideration ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={updatePool.isPending}
                          onClick={() => void handleConsiderationChange(false)}
                        >
                          Leave consideration
                        </Button>
                      ) : eligibleForConsideration ? (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          disabled={updatePool.isPending}
                          onClick={() => void handleConsiderationChange(true)}
                        >
                          Join controlled consideration
                        </Button>
                      ) : (
                        <Link href="/my-matchlab">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                          >
                            Review My MatchLab
                          </Button>
                        </Link>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        aria-expanded={showPreferences}
                        aria-controls="matching-preferences-panel"
                        onClick={() => setShowPreferences((visible) => !visible)}
                        data-testid="button-toggle-matching-preferences"
                      >
                        {showPreferences ? "Close preferences" : "Review matching preferences"}
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {showPreferences &&
                !matchingStateQuery.isLoading &&
                !matchingStateQuery.isError && (
                  <div
                    id="matching-preferences-panel"
                    className="glass border border-white/10 rounded-2xl p-5"
                    data-testid="matches-preferences"
                  >
                    <div className="mb-5">
                      <p className="text-sm font-semibold text-foreground">
                        Matching preferences
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        These boundaries guide deliberate consideration. They
                        are not a readiness score and do not promise an
                        introduction.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="match-age-min">Minimum age</Label>
                        <Input
                          id="match-age-min"
                          type="number"
                          min={18}
                          max={120}
                          value={ageMin}
                          onChange={(event) => {
                            setAgeMin(Number(event.target.value));
                            setPreferencesDirty(true);
                          }}
                          data-testid="input-match-age-min"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="match-age-max">Maximum age</Label>
                        <Input
                          id="match-age-max"
                          type="number"
                          min={18}
                          max={120}
                          value={ageMax}
                          onChange={(event) => {
                            setAgeMax(Number(event.target.value));
                            setPreferencesDirty(true);
                          }}
                          data-testid="input-match-age-max"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="match-distance">Distance</Label>
                        <Select
                          value={distanceKm}
                          onValueChange={(value) => {
                            setDistanceKm(value);
                            setPreferencesDirty(true);
                          }}
                        >
                          <SelectTrigger
                            id="match-distance"
                            data-testid="select-match-distance"
                          >
                            <SelectValue placeholder="Choose a distance" />
                          </SelectTrigger>
                          <SelectContent>
                            {MATCH_RADIUS_PRESETS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="match-gender">People to consider</Label>
                        <Select
                          value={genderPreference}
                          onValueChange={(value) => {
                            setGenderPreference(value);
                            setPreferencesDirty(true);
                          }}
                        >
                          <SelectTrigger
                            id="match-gender"
                            data-testid="select-match-gender"
                          >
                            <SelectValue placeholder="Choose a preference" />
                          </SelectTrigger>
                          <SelectContent>
                            {MATCH_GENDER_OPTIONS.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value === "any"
                                  ? "Any gender"
                                  : value
                                      .replace("-", " ")
                                      .replace(/\b\w/g, (letter) =>
                                        letter.toUpperCase(),
                                      )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="match-city">City or area</Label>
                      <Input
                        id="match-city"
                        value={cityHint}
                        maxLength={120}
                        placeholder="Optional"
                        onChange={(event) => {
                          setCityHint(event.target.value);
                          setPreferencesDirty(true);
                        }}
                        data-testid="input-match-city"
                      />
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="match-must-haves">Must-haves</Label>
                        <Textarea
                          id="match-must-haves"
                          rows={4}
                          value={mustHavesText}
                          placeholder="One per line or separated by commas"
                          onChange={(event) => {
                            setMustHavesText(event.target.value);
                            setPreferencesDirty(true);
                          }}
                          data-testid="textarea-match-must-haves"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="match-deal-breakers">
                          Deal-breakers
                        </Label>
                        <Textarea
                          id="match-deal-breakers"
                          rows={4}
                          value={dealBreakersText}
                          placeholder="One per line or separated by commas"
                          onChange={(event) => {
                            setDealBreakersText(event.target.value);
                            setPreferencesDirty(true);
                          }}
                          data-testid="textarea-match-deal-breakers"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full"
                        disabled={
                          updatePreferences.isPending || !preferencesDirty
                        }
                        onClick={() => void handleSavePreferences()}
                        data-testid="button-save-matching-preferences"
                      >
                        {updatePreferences.isPending
                          ? "Saving..."
                          : "Save preferences"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Up to 50 entries are saved in each list.
                      </p>
                    </div>
                  </div>
                )}

              <div
                className="glass border border-white/10 rounded-2xl p-5"
                data-testid="matches-introductions"
              >
                <div className="mb-4">
                  <p className="text-sm font-semibold text-foreground">
                    Considered introductions
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only introductions deliberately sent to your account appear here.
                  </p>
                </div>
                {proposalsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading introductions...
                  </p>
                ) : proposalsQuery.isError ? (
                  <div role="alert">
                    <p className="text-sm font-semibold text-foreground">
                      We couldn't load your introductions.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No empty or sample state is being substituted.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 rounded-full"
                      onClick={() => void proposalsQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : proposalList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No introduction has been sent to you. That is an honest waiting state, not a hidden queue of people.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {proposalList.map((proposal: MatchProposal) => {
                      const meta = PROPOSAL_STATUS[proposal.status] ?? {
                        label: "Introduction update",
                        note: "This introduction has an updated state.",
                      };
                      return (
                        <div
                          key={proposal.id}
                          className="rounded-xl border border-white/10 p-4"
                          data-testid={`canonical-proposal-${proposal.id}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {proposalSourceLabel(proposal.source)}
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {meta.label}
                            </Badge>
                          </div>
                          {proposal.summary && (
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                              {proposal.summary}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground/70">
                            {meta.note}
                          </p>
                          {proposal.status === "proposed" && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="rounded-full"
                                disabled={respondProposal.isPending}
                                onClick={() =>
                                  void handleProposalResponse(proposal.id, true)
                                }
                              >
                                I'm interested
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={respondProposal.isPending}
                                onClick={() =>
                                  void handleProposalResponse(proposal.id, false)
                                }
                              >
                                Pass
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {readState === "loading" && (
            <p className="text-sm text-muted-foreground/60">
              Loading your matches...
            </p>
          )}

          {readState === "error" && (
            <div
              className="glass mb-6 rounded-2xl border border-destructive/25 p-5"
              role="alert"
              data-testid="matches-error"
            >
              <p className="text-sm font-semibold text-foreground">
                We couldn't load your matches.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your account state is unchanged. Try the read again when you're ready.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 rounded-full"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          )}

          {readState === "empty" && (
            <motion.div
              {...fadeUp(0.05)}
              className="glass border border-white/10 rounded-2xl p-8 text-center"
              data-testid="matches-empty"
            >
              <MessageCircle
                className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-foreground mb-1">
                No conversation is open
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto">
                A conversation appears here only after a deliberately sent
                introduction and both members independently say yes.
              </p>
            </motion.div>
          )}

          <div className="space-y-3">
            {connections.map((c, i) => (
              <motion.div key={c.id} {...fadeUp(0.05 + i * 0.03)}>
                <ConnectionRow connection={c} isDemo={isDemo} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
