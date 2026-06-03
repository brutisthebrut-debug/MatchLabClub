import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Calendar,
  Compass,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { NextStepCard } from "@/components/NextStepCard";
import { BREAKDOWN_ROWS } from "@/lib/readinessLanes";
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useUpdateMatchingPreferences,
  useUpdateMatchingPoolMembership,
  useCreateMatchingExternalRead,
  useCreateMatchingEchoRead,
  useGetMatchingProposals,
  getGetMatchingProposalsQueryKey,
  useRespondToMatchProposal,
  useDiscoverMatches,
  type EchoMatchRead,
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

// Matching is radius-based in miles. We store kilometers on the server, so the
// presets map miles to their rounded km equivalent.
const RADIUS_PRESETS: { value: string; label: string }[] = [
  { value: "any", label: "Any distance" },
  { value: "40", label: "Within 25 miles" },
  { value: "56", label: "Within 35 miles" },
  { value: "72", label: "Within 45 miles" },
];

// Human labels for each proposal status, plus a note for resolved states so a
// non-open proposal is never a dead end on the page.
const PROPOSAL_STATUS_META: Record<
  string,
  { label: string; tone: "good" | "muted"; note: string }
> = {
  proposed: { label: "Awaiting you", tone: "good", note: "" },
  user_yes: {
    label: "You said yes",
    tone: "good",
    note: "The founder routes interested intros to the front of the queue. We will be in touch.",
  },
  user_no: {
    label: "You passed",
    tone: "muted",
    note: "We won't bring this one back.",
  },
  mutual_yes: {
    label: "Mutual yes",
    tone: "good",
    note: "Both of you are in. The founder sets up the intro from here.",
  },
  completed: {
    label: "Intro made",
    tone: "good",
    note: "This intro has been made. How it goes is up to the two of you.",
  },
  expired: {
    label: "Expired",
    tone: "muted",
    note: "This one timed out before it moved forward.",
  },
};

// Human label for where a proposal came from, so an internal member match never
// shows the raw "internal" source string and an external read reads cleanly.
function proposalSourceLabel(source: string): string {
  if (source === "internal") return "Member match";
  if (source === "external_paste") return "Profile read";
  if (source === "concierge") return "Founder pick";
  return "Intro";
}

// Snap any stored distance to the nearest preset so the selector always has a
// matching option, even for historical values saved before presets existed.
// Returns the "any" sentinel when no distance is set.
function snapRadiusKm(km: number | null | undefined): string {
  if (km == null) return "any";
  let nearest = RADIUS_PRESETS[1];
  let best = Infinity;
  for (const preset of RADIUS_PRESETS) {
    if (preset.value === "any") continue;
    const diff = Math.abs(Number(preset.value) - km);
    if (diff < best) {
      best = diff;
      nearest = preset;
    }
  }
  return nearest.value;
}

// Map any stored gender preference (including legacy values like "everyone")
// onto the current option set, defaulting to "any" so the Select never lands in
// an invalid state for existing accounts.
const GENDER_PREFERENCE_OPTIONS = [
  "any",
  "women",
  "men",
  "nonbinary",
  "trans-women",
  "trans-men",
] as const;
function normalizeGenderPreference(value: string | null | undefined): string {
  if (!value) return "any";
  return (GENDER_PREFERENCE_OPTIONS as readonly string[]).includes(value)
    ? value
    : "any";
}

function ChipList({
  items,
  onRemove,
  testIdPrefix,
}: {
  items: string[];
  onRemove: (index: number) => void;
  testIdPrefix: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Badge
          key={`${item}-${i}`}
          variant="secondary"
          className="gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs"
          data-testid={`${testIdPrefix}-${i}`}
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
            aria-label={`Remove ${item}`}
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export default function Matching() {
  useMeta(
    "Matching, in beta. Get to the front of the line.",
    "Match readiness, preferences, and a compatibility read for any profile you are already talking to. Hybrid model: founder-curated intros for Wingman, algorithmic everywhere else.",
  );

  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const state = useGetMatchingState({
    query: {
      queryKey: getGetMatchingStateQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const updatePrefs = useUpdateMatchingPreferences();
  const updatePool = useUpdateMatchingPoolMembership();
  const runExternal = useCreateMatchingExternalRead();
  const runEcho = useCreateMatchingEchoRead();
  const respondProposal = useRespondToMatchProposal();
  const discover = useDiscoverMatches();

  const proposals = useGetMatchingProposals({
    query: {
      queryKey: getGetMatchingProposalsQueryKey(),
      enabled: isAuthenticated,
    },
  });

  // Local form state, hydrated from server when prefs land.
  const [ageMin, setAgeMin] = useState<number>(25);
  const [ageMax, setAgeMax] = useState<number>(45);
  const [distanceKm, setDistanceKm] = useState<string>("any");
  const [genderPreference, setGenderPreference] = useState<string>("any");
  const [cityHint, setCityHint] = useState<string>("");
  const [dealBreakers, setDealBreakers] = useState<string[]>([]);
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [dealBreakerDraft, setDealBreakerDraft] = useState("");
  const [mustHaveDraft, setMustHaveDraft] = useState("");

  // External read form.
  const [externalText, setExternalText] = useState("");
  const [externalSource, setExternalSource] = useState<
    "hinge" | "tinder" | "bumble" | "grindr" | "feeld" | "her" | "other"
  >("hinge");
  const [externalResult, setExternalResult] = useState<{
    score: number;
    highlights: string[];
    frictions: string[];
    summary: string | null;
  } | null>(null);

  // Echo's read on YOU for matching, grounded in your own aggregate signals.
  const [echoResult, setEchoResult] = useState<EchoMatchRead | null>(null);

  const prefs = state.data?.preferences ?? null;

  useEffect(() => {
    if (!prefs) return;
    if (typeof prefs.ageMin === "number") setAgeMin(prefs.ageMin);
    if (typeof prefs.ageMax === "number") setAgeMax(prefs.ageMax);
    setDistanceKm(snapRadiusKm(prefs.distanceKm));
    setGenderPreference(normalizeGenderPreference(prefs.genderPreference));
    setCityHint(prefs.cityHint ?? "");
    setDealBreakers(prefs.dealBreakers ?? []);
    setMustHaves(prefs.mustHaves ?? []);
  }, [prefs]);

  const readinessScore = state.data?.readiness.score ?? 0;
  const breakdown = state.data?.readiness.breakdown ?? {
    compass: 0,
    journal: 0,
    wellness: 0,
    hingeImport: 0,
    postDate: 0,
    wins: 0,
    calendar: 0,
    audits: 0,
    coaching: 0,
    instagram: 0,
    lifePulse: 0,
    taste: 0,
    lifestyle: 0,
    quizzes: 0,
    receipts: 0,
    music: 0,
    vitality: 0,
    curiosity: 0,
    film: 0,
    reading: 0,
    podcasts: 0,
    gaming: 0,
    places: 0,
    screenRhythm: 0,
    preferences: 0,
    voice: 0,
  };
  const nextActions = state.data?.nextActions ?? [];
  const history = state.data?.history ?? [];
  const outcomeInsight = state.data?.outcomeInsight ?? null;
  const readinessLearning = state.data?.readinessLearning ?? null;
  const cityDensity = state.data?.cityDensity ?? 0;
  const totalPool = state.data?.totalPoolCount ?? 0;
  const tier = state.data?.tier ?? null;
  const poolStatus = state.data?.poolStatus ?? "off";
  const poolToggleOn = poolStatus !== "off" && poolStatus !== "paused";
  const eligible = state.data?.eligible ?? false;
  const readinessThreshold = state.data?.readinessThreshold ?? 50;
  // Block turning the pool on until readiness clears the bar. Turning it off is
  // always allowed, so users who are already in never get stuck. Only lock once
  // we have confirmed server state, so a load or error never flashes a false
  // ineligible message.
  const poolLocked = Boolean(state.data) && !poolToggleOn && !eligible;

  // Readiness -> match loop. Points still owed to the pool, and the most recent
  // change in readiness so tool completion visibly moves the payoff.
  const pointsToPool = Math.max(0, readinessThreshold - readinessScore);
  const readinessDelta = useMemo(() => {
    if (history.length < 2) return 0;
    const last = history[history.length - 1]?.score ?? 0;
    const prev = history[history.length - 2]?.score ?? 0;
    return last - prev;
  }, [history]);

  const proposalList = proposals.data ?? [];

  const cityLabel = useMemo(() => prefs?.cityHint ?? cityHint, [prefs, cityHint]);

  const conciergeUrl =
    (import.meta.env.VITE_CONCIERGE_INTAKE_URL as string | undefined) ?? "";

  async function handleSavePreferences() {
    const distanceNum = distanceKm === "any" ? null : Number(distanceKm);
    if (distanceNum != null && (!Number.isFinite(distanceNum) || distanceNum < 0)) {
      toast({ title: "Pick a match radius and try again." });
      return;
    }
    try {
      await updatePrefs.mutateAsync({
        data: {
          ageMin,
          ageMax,
          distanceKm: distanceNum,
          genderPreference: genderPreference === "any" ? null : genderPreference,
          cityHint: cityHint.trim().length === 0 ? null : cityHint.trim(),
          dealBreakers: dealBreakers.length === 0 ? null : dealBreakers,
          mustHaves: mustHaves.length === 0 ? null : mustHaves,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
      toast({ title: "Preferences saved." });
    } catch {
      toast({ title: "Couldn't save preferences. Try again." });
    }
  }

  async function handleTogglePool(next: boolean) {
    try {
      await updatePool.mutateAsync({
        data: { status: next ? "building" : "off" },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
      if (next) {
        trackEvent("matching_pool_joined", { readiness: readinessScore });
      }
      toast({
        title: next
          ? "You're on the matching list."
          : "Removed from the matching list.",
      });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 422) {
        toast({
          title: `You need a readiness of ${readinessThreshold} first. You are at ${readinessScore} right now.`,
        });
      } else {
        toast({ title: "Couldn't update your status. Try again." });
      }
    }
  }

  async function handleExternalRead() {
    const text = externalText.trim();
    if (text.length < 20) {
      toast({ title: "Paste a bit more of the profile, at least a sentence." });
      return;
    }
    try {
      const result = await runExternal.mutateAsync({
        data: { profileText: text, source: externalSource },
      });
      setExternalResult({
        score: result.score,
        highlights: result.highlights ?? [],
        frictions: result.frictions ?? [],
        summary: result.summary ?? null,
      });
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
    } catch {
      toast({ title: "Couldn't score that profile. Try again." });
    }
  }

  async function handleEchoRead() {
    try {
      const result = await runEcho.mutateAsync();
      setEchoResult(result);
      await queryClient.invalidateQueries({
        queryKey: getGetMatchingStateQueryKey(),
      });
    } catch {
      toast({ title: "Couldn't read your signals right now. Try again." });
    }
  }

  async function handleProposalResponse(id: string, interested: boolean) {
    try {
      await respondProposal.mutateAsync({ id, data: { interested } });
      trackEvent("match_proposal_response", { interested });
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
          ? "Noted. The founder routes interested intros to the front of the queue."
          : "Passed. We won't bring this one back.",
      });
    } catch {
      toast({ title: "Couldn't record that. Try again." });
    }
  }

  async function handleDiscoverMatches() {
    try {
      await discover.mutateAsync();
      trackEvent("match_discover_run");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetMatchingProposalsQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMatchingStateQueryKey(),
        }),
      ]);
      toast({
        title:
          "We looked across the pool. Any new intros are in your match track below.",
      });
    } catch {
      toast({ title: "Couldn't run a match pass right now. Try again." });
    }
  }

  function addDealBreaker() {
    const v = dealBreakerDraft.trim();
    if (!v) return;
    setDealBreakers((prev) => [...prev, v].slice(0, 20));
    setDealBreakerDraft("");
  }
  function addMustHave() {
    const v = mustHaveDraft.trim();
    if (!v) return;
    setMustHaves((prev) => [...prev, v].slice(0, 20));
    setMustHaveDraft("");
  }

  if (authLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          Loading.
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-widest text-[hsl(326_100%_50%)] font-bold">
              Matching
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase">
              Beta
            </Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight">
            Matching is coming. Sign in to get to the front of the line.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            AI-driven introductions inside your radius (25, 35, or 45 miles), to
            people you would never find on your own. Readiness-gated, so the
            machine matches you only once it truly knows you. Open to all
            genders and orientations. No swipe.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button
              onClick={() => login()}
              className="rounded-full px-6 h-11 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-semibold"
              data-testid="button-matching-signin"
            >
              Sign in
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6 h-11">
              <Link href="/pricing">See the tiers</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-10 md:py-14 max-w-5xl">
        {/* Hero */}
        <motion.div {...fadeUp(0)} className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-widest text-[hsl(326_100%_50%)] font-bold">
              Matching
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase">
              Beta
            </Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold leading-tight">
            Matching is coming. Here is how you get to the front of the line.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
            This is the payoff, not the headline. The more the machine knows
            you, the better it matches you, so matching stays gated behind your
            readiness. When it opens, you get AI-driven introductions inside
            your radius (25, 35, or 45 miles) to people you would never find on
            your own. Wingman customers also get founder-curated intros, hand
            picked. Open to every gender and orientation. No swipe carousel, no
            infinite scroll, just a small number of well-considered people near
            you.
          </p>
        </motion.div>

        {/* Readiness */}
        <motion.div {...fadeUp(0.05)}>
          <Card className="mb-6" data-testid="card-match-readiness">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-2xl">Match readiness</CardTitle>
                  <CardDescription>
                    The deeper your signals, the better the match.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-4xl md:text-5xl font-bold text-foreground">
                      {readinessScore}
                      <span className="text-2xl text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      data-testid="button-open-milestones"
                    >
                      <Link href="/milestones">
                        <Trophy className="mr-1 w-4 h-4" aria-hidden="true" />
                        Milestones
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      data-testid="button-open-share-card"
                    >
                      <Link href="/share-card">
                        <Share2 className="mr-1 w-4 h-4" aria-hidden="true" />
                        Share card
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={readinessScore} className="h-3" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {BREAKDOWN_ROWS.map((row) => {
                  const value = breakdown[row.key] ?? 0;
                  const Icon = row.icon;
                  return (
                    <div
                      key={row.key}
                      className="rounded-2xl border border-foreground/8 p-4"
                      data-testid={`breakdown-${row.key}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                          <span className="font-semibold text-sm">{row.label}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">
                          {value}%
                        </span>
                      </div>
                      <Progress value={value} className="h-2 mb-2" />
                      <p className="text-xs text-muted-foreground mb-3">
                        {row.blurb}
                      </p>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full h-8 text-xs"
                        data-testid={`cta-${row.key}`}
                      >
                        <Link href={row.href}>
                          {row.cta}
                          <ArrowRight className="ml-1 w-3 h-3" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Readiness -> match loop */}
        <motion.div {...fadeUp(0.06)}>
          <Card
            className="mb-6 border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.04)]"
            data-testid="card-readiness-loop"
          >
            <CardContent className="p-6 flex items-start gap-4 flex-wrap">
              <div className="rounded-full p-3 bg-[hsl(248_62%_52%/0.1)]">
                <TrendingUp
                  className="w-5 h-5 text-[hsl(248_62%_52%)]"
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1 min-w-[240px]">
                {eligible ? (
                  <div className="font-semibold text-lg">
                    You have cleared the bar. Matching is open to you.
                  </div>
                ) : (
                  <div className="font-semibold text-lg">
                    {pointsToPool} readiness{" "}
                    {pointsToPool === 1 ? "point" : "points"} to the pool.
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  Every tool you finish feeds the machine and moves this number.
                  {readinessDelta > 0 && (
                    <>
                      {" "}
                      You gained{" "}
                      <span
                        className="font-semibold text-[hsl(248_62%_52%)]"
                        data-testid="text-readiness-delta"
                      >
                        +{readinessDelta}
                      </span>{" "}
                      since your last signal.
                    </>
                  )}
                  {readinessDelta < 0 && (
                    <>
                      {" "}
                      You slipped{" "}
                      <span
                        className="font-semibold"
                        data-testid="text-readiness-delta"
                      >
                        {readinessDelta}
                      </span>{" "}
                      since your last snapshot. Feed a fresh signal to climb
                      back.
                    </>
                  )}
                </p>
                <Link
                  href="/match-path"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(248_62%_52%)] underline-offset-2 hover:underline"
                  data-testid="link-match-path"
                >
                  See exactly what it takes to get matched
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" data-testid="text-points-to-pool">
                  {readinessScore}
                  <span className="text-lg text-muted-foreground">
                    /{readinessThreshold}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  readiness / pool bar
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Echo's read on you */}
        <motion.div {...fadeUp(0.065)}>
          <Card className="mb-6" data-testid="card-echo-read">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Brain
                  className="w-5 h-5 text-[hsl(326_100%_50%)]"
                  aria-hidden="true"
                />
                Echo's read on you
              </CardTitle>
              <CardDescription>
                What the machine can see in the signals you have fed it so far,
                and the kind of person it would put in front of you. Built from
                your aggregate signals, never your raw content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!echoResult && (
                <Button
                  onClick={handleEchoRead}
                  disabled={runEcho.isPending}
                  className="rounded-full"
                  data-testid="button-run-echo-read"
                >
                  {runEcho.isPending ? "Reading your signals." : "Get Echo's read"}
                </Button>
              )}
              {echoResult && (
                <div
                  className="rounded-2xl border border-foreground/10 p-5 bg-background/40 space-y-4"
                  data-testid="echo-result"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Confidence
                      </span>
                      <span
                        className="text-sm font-mono text-muted-foreground"
                        data-testid="text-echo-confidence"
                      >
                        {echoResult.confidence}%
                      </span>
                    </div>
                    <Progress value={echoResult.confidence} className="h-2" />
                  </div>
                  <p className="font-semibold text-lg" data-testid="text-echo-headline">
                    {echoResult.headline}
                  </p>
                  {echoResult.reading.length > 0 && (
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        What Echo can see
                      </span>
                      <ul className="mt-2 space-y-1.5">
                        {echoResult.reading.map((line, i) => (
                          <li
                            key={`reading-${i}`}
                            className="text-sm text-muted-foreground flex gap-2"
                          >
                            <Sparkles
                              className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[hsl(326_100%_50%)]"
                              aria-hidden="true"
                            />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {echoResult.idealMatch.length > 0 && (
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Who it would put in front of you
                      </span>
                      <ul className="mt-2 space-y-1.5">
                        {echoResult.idealMatch.map((line, i) => (
                          <li
                            key={`ideal-${i}`}
                            className="text-sm text-muted-foreground flex gap-2"
                          >
                            <Heart
                              className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[hsl(248_62%_52%)]"
                              aria-hidden="true"
                            />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {echoResult.radiusLabel}
                    {echoResult.gapToPool > 0 && (
                      <>
                        {" "}
                        <span className="text-foreground">
                          {echoResult.gapToPool} points from the pool.
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    {echoResult.nextStep && (
                      <Button
                        asChild
                        size="sm"
                        className="rounded-full"
                        data-testid="button-echo-next-step"
                      >
                        <Link href={echoResult.nextStep.href}>
                          {echoResult.nextStep.label}
                          <ArrowRight
                            className="ml-1 w-4 h-4"
                            aria-hidden="true"
                          />
                        </Link>
                      </Button>
                    )}
                    <Button
                      onClick={handleEchoRead}
                      disabled={runEcho.isPending}
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      data-testid="button-refresh-echo-read"
                    >
                      {runEcho.isPending ? "Reading." : "Read again"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Next best step */}
        {(nextActions.length > 0 || eligible) && (
          <motion.div {...fadeUp(0.07)}>
            <NextStepCard
              actions={nextActions}
              eligible={eligible}
              className="mb-6"
            />
          </motion.div>
        )}

        {/* Readiness trend */}
        {history.length >= 2 && (
          <motion.div {...fadeUp(0.08)}>
            <Card className="mb-6" data-testid="card-readiness-trend">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
                  Your readiness over time
                </CardTitle>
                <CardDescription>
                  Every signal you add moves this line. Here is the last month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-44 w-full" data-testid="chart-readiness-trend">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={history}
                      margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
                    >
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d: string) => d.slice(5)}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`${v}%`, "Readiness"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(326 100% 50%)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Outcome insight: patterns from your dates */}
        {outcomeInsight && outcomeInsight.totalDates > 0 && (
          <motion.div {...fadeUp(0.09)}>
            <Card className="mb-6" data-testid="card-outcome-insight">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
                  Patterns from your dates
                </CardTitle>
                <CardDescription>{outcomeInsight.headline}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Another date", value: outcomeInsight.anotherDate },
                    { label: "No more", value: outcomeInsight.noMore },
                    { label: "Ghosted", value: outcomeInsight.ghosted },
                    { label: "Unsure", value: outcomeInsight.unsure },
                  ].map((cell) => (
                    <div
                      key={cell.label}
                      className="rounded-2xl border border-foreground/8 p-4 text-center"
                      data-testid={`outcome-${cell.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="text-2xl font-bold">{cell.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cell.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  These outcomes feed every compatibility read, so the scores get
                  sharper the more dates you reflect on.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* What your dates are teaching your brain (outcome-driven learning) */}
        {(() => {
          const demo: NonNullable<typeof readinessLearning> = {
            observing: true,
            applied: false,
            headline:
              "Log a few date outcomes and the engine starts learning what actually fits you, then leans your readiness toward the signals that predict it.",
            totalDates: 0,
            baseScore: readinessScore,
            observedScore: readinessScore,
            delta: 0,
            leaningInto: [],
          };
          const learning = readinessLearning ?? demo;
          const hasData = learning.totalDates > 0 && learning.leaningInto.length > 0;
          return (
            <motion.div {...fadeUp(0.095)}>
              <Card className="mb-6" data-testid="card-readiness-learning">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
                    What your dates are teaching your brain
                  </CardTitle>
                  <CardDescription>{learning.headline}</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasData ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-sm text-muted-foreground">
                          Leaning into
                        </span>
                        {learning.leaningInto.map((lane) => (
                          <span
                            key={lane}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.08)] px-3 py-1 text-xs font-semibold text-[hsl(248_62%_62%)]"
                            data-testid={`learning-lane-${lane.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <TrendingUp className="w-3 h-3" aria-hidden="true" />
                            {lane}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-foreground/8 p-4 text-center">
                          <div className="text-2xl font-bold">{learning.baseScore}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Your score today
                          </div>
                        </div>
                        <div className="rounded-2xl border border-foreground/8 p-4 text-center">
                          <div className="text-2xl font-bold">{learning.observedScore}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {learning.applied ? "Now applied" : "If we acted on it"}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-foreground/8 p-4 text-center">
                          <div className="text-2xl font-bold">
                            {learning.delta > 0 ? "+" : ""}
                            {learning.delta}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Difference
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        {learning.applied
                          ? "This is live. Your readiness now reflects what your outcomes are teaching us, and we use it to sharpen who we put in front of you."
                          : "We are watching this in the background. Your score today is unchanged. When the pattern is strong enough, we use it to sharpen who we put in front of you."}
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <p className="text-sm text-muted-foreground max-w-md">
                        Nothing logged yet. Each date outcome you record teaches
                        the engine which signals predict a real connection for
                        you, with no change to your score until the pattern is
                        clear.
                      </p>
                      <Link
                        href="/mirror/dates"
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        data-testid="link-log-date-outcome"
                      >
                        Log a date outcome
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        {/* City density */}
        <motion.div {...fadeUp(0.1)}>
          <Card className="mb-6" data-testid="card-city-density">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="rounded-full p-3 bg-[hsl(248_62%_52%/0.08)]">
                <Users className="w-5 h-5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {cityLabel && cityLabel.trim().length > 0
                    ? `${cityDensity} ${cityDensity === 1 ? "person" : "people"} in ${cityLabel} building a match profile.`
                    : `${totalPool} early-pool signups so far.`}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  We hold launch until each city has enough depth to make
                  intros worth your time.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pool membership */}
        <motion.div {...fadeUp(0.15)}>
          <Card className="mb-6" data-testid="card-pool-membership">
            <CardContent className="p-6 flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="font-semibold text-lg">
                  I want to be considered for introductions when matching ships.
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Off by default. Turn it on and we will hold your spot in the
                  pool. Status today: <strong>{poolStatus}</strong>.
                  {tier === "wingman" && (
                    <> Your Wingman tier routes you to the concierge queue.</>
                  )}
                </p>
                {poolLocked && (
                  <>
                    <p
                      className="text-sm mt-2 text-[hsl(326_100%_50%)] font-medium"
                      data-testid="text-pool-locked"
                    >
                      The pool opens at a readiness of {readinessThreshold}. You
                      are at {readinessScore} right now. Run a compass read,
                      answer a wellness prompt, or import your Hinge data to
                      close the gap.
                    </p>
                    <Link
                      href="/pricing"
                      onClick={() =>
                        trackEvent("matching_locked_to_pricing", {
                          readiness: readinessScore,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-sm mt-2 font-semibold text-[hsl(var(--brand-indigo))] hover:underline"
                      data-testid="link-locked-to-pricing"
                    >
                      The Dating Reset feeds the deepest signals to close it
                      faster
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </>
                )}
              </div>
              <Switch
                checked={poolToggleOn}
                onCheckedChange={handleTogglePool}
                disabled={updatePool.isPending || poolLocked}
                data-testid="switch-pool-membership"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Your match track */}
        <motion.div {...fadeUp(0.17)}>
          <Card className="mb-6" data-testid="card-match-track">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles
                  className="w-5 h-5 text-[hsl(326_100%_50%)]"
                  aria-hidden="true"
                />
                Your match track
              </CardTitle>
              <CardDescription>
                Intros the founder has hand picked or the machine has surfaced
                for you. Say you are interested and it routes to the front of the
                intro queue. This is a real track, not a preview.
              </CardDescription>
              {eligible && (
                <Button
                  className="mt-3 rounded-full self-start"
                  disabled={discover.isPending}
                  onClick={handleDiscoverMatches}
                  data-testid="button-discover-matches"
                >
                  <Sparkles className="mr-1 w-4 h-4" aria-hidden="true" />
                  {discover.isPending
                    ? "Looking across the pool."
                    : "Find matches near you"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {proposalList.length === 0 && (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-no-proposals"
                >
                  No intros yet. Keep feeding signals and turn on the pool above.
                  When you are eligible, run a match pass to pair with other
                  members, or wait for the founder to curate one for you.
                </p>
              )}
              {proposalList.map((p: MatchProposal) => {
                const meta = PROPOSAL_STATUS_META[p.status] ?? {
                  label: p.status,
                  tone: "muted" as const,
                };
                const open = p.status === "proposed";
                const isMatch = p.status === "mutual_yes";
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 ${
                      isMatch
                        ? "border-[hsl(326_100%_50%)]/50 bg-[hsl(326_100%_50%)]/5"
                        : "border-foreground/10"
                    }`}
                    data-testid={`proposal-${p.id}`}
                  >
                    {isMatch && (
                      <div
                        className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(326_100%_50%)] mb-2"
                        data-testid={`proposal-match-${p.id}`}
                      >
                        <Heart className="w-4 h-4" aria-hidden="true" />
                        It's a match
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {proposalSourceLabel(p.source)}
                        </span>
                        <Badge
                          variant={
                            meta.tone === "good" ? "default" : "secondary"
                          }
                          className="text-[10px] uppercase"
                          data-testid={`proposal-status-${p.id}`}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                      <span className="text-lg font-bold">
                        {p.compatibilityScore}%
                      </span>
                    </div>
                    <Progress
                      value={p.compatibilityScore}
                      className="h-2 mb-3"
                    />
                    {p.summary && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {p.summary}
                      </p>
                    )}
                    {open ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="rounded-full"
                          disabled={respondProposal.isPending}
                          onClick={() => handleProposalResponse(p.id, true)}
                          data-testid={`button-proposal-interested-${p.id}`}
                        >
                          <Heart className="mr-1 w-4 h-4" aria-hidden="true" />
                          I'm interested
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={respondProposal.isPending}
                          onClick={() => handleProposalResponse(p.id, false)}
                          data-testid={`button-proposal-pass-${p.id}`}
                        >
                          <X className="mr-1 w-4 h-4" aria-hidden="true" />
                          Pass
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {meta.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Concierge (wingman only) */}
        {tier === "wingman" && (
          <motion.div {...fadeUp(0.2)}>
            <Card
              className="mb-6 border-[hsl(326_100%_60%/0.3)] bg-[hsl(326_100%_60%/0.04)]"
              data-testid="card-concierge"
            >
              <CardContent className="p-6 flex items-start gap-4">
                <div className="rounded-full p-3 bg-[hsl(326_100%_60%/0.12)]">
                  <Sparkles className="w-5 h-5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    Your Wingman tier includes founder-curated intros.
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Book a fifteen minute intake call so the founder can hand
                    pick the first few people for you.
                  </p>
                  <div className="mt-3">
                    {conciergeUrl ? (
                      <Button
                        asChild
                        className="rounded-full"
                        data-testid="button-concierge-intake"
                      >
                        <a
                          href={conciergeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Schedule intake
                          <ArrowRight className="ml-1 w-4 h-4" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Intake link coming soon. The founder will email you.
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* External compat read */}
        <motion.div {...fadeUp(0.25)}>
          <Card className="mb-6" data-testid="card-external-read">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Heart className="w-5 h-5 text-[hsl(326_100%_50%)]" aria-hidden="true" />
                Already talking to someone? Score the match.
              </CardTitle>
              <CardDescription>
                Paste their Hinge, Tinder, Bumble, Grindr, Feeld, HER, or Facebook
                Dating profile. We score it against what we know about you and save
                the read.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr,180px]">
                <Textarea
                  value={externalText}
                  onChange={(e) => setExternalText(e.target.value)}
                  placeholder="Paste the bio, prompts, anything they wrote."
                  rows={6}
                  data-testid="textarea-external-profile"
                />
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="external-source" className="text-xs">
                      Where from
                    </Label>
                    <Select
                      value={externalSource}
                      onValueChange={(v) =>
                        setExternalSource(v as typeof externalSource)
                      }
                    >
                      <SelectTrigger id="external-source" data-testid="select-external-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hinge">Hinge</SelectItem>
                        <SelectItem value="tinder">Tinder</SelectItem>
                        <SelectItem value="bumble">Bumble</SelectItem>
                        <SelectItem value="grindr">Grindr</SelectItem>
                        <SelectItem value="feeld">Feeld</SelectItem>
                        <SelectItem value="her">HER</SelectItem>
                        <SelectItem value="facebookDating">Facebook Dating</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleExternalRead}
                    disabled={runExternal.isPending}
                    className="w-full rounded-full"
                    data-testid="button-run-external-read"
                  >
                    {runExternal.isPending ? "Scoring." : "Score this profile"}
                  </Button>
                </div>
              </div>
              {externalResult && (
                <div
                  className="rounded-2xl border border-foreground/10 p-4 bg-background/40"
                  data-testid="external-result"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Compatibility</span>
                    <span className="text-2xl font-bold">
                      {externalResult.score}%
                    </span>
                  </div>
                  <Progress value={externalResult.score} className="h-2 mb-3" />
                  {externalResult.summary && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {externalResult.summary}
                    </p>
                  )}
                  {externalResult.highlights.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Lean on
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {externalResult.highlights.map((h, i) => (
                          <Badge key={`${h}-${i}`} variant="secondary" className="text-xs">
                            {h}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {externalResult.frictions.length > 0 && (
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Watch for
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {externalResult.frictions.map((f, i) => (
                          <Badge key={`${f}-${i}`} variant="outline" className="text-xs">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Want the full Compatibility Compass with screenshot support?
                <Link
                  href="/compatibility-compass"
                  className="ml-1 underline text-foreground"
                  data-testid="link-compass-new"
                >
                  Open the Compass
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preferences */}
        <motion.div {...fadeUp(0.3)}>
          <Card className="mb-6" data-testid="card-preferences">
            <CardHeader>
              <CardTitle className="text-xl">Your preferences</CardTitle>
              <CardDescription>
                These shape who shows up. You can change them any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Age range</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {ageMin} to {ageMax}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="age-min" className="text-xs">Min</Label>
                    <Slider
                      id="age-min"
                      value={[ageMin]}
                      min={18}
                      max={80}
                      step={1}
                      onValueChange={(v) => {
                        const next = v[0] ?? ageMin;
                        setAgeMin(next);
                        if (next > ageMax) setAgeMax(next);
                      }}
                      data-testid="slider-age-min"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age-max" className="text-xs">Max</Label>
                    <Slider
                      id="age-max"
                      value={[ageMax]}
                      min={18}
                      max={80}
                      step={1}
                      onValueChange={(v) => {
                        const next = v[0] ?? ageMax;
                        setAgeMax(next);
                        if (next < ageMin) setAgeMin(next);
                      }}
                      data-testid="slider-age-max"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="distance" className="text-sm font-semibold">
                    Match radius
                  </Label>
                  <Select value={distanceKm} onValueChange={setDistanceKm}>
                    <SelectTrigger id="distance" data-testid="select-distance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RADIUS_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Introductions stay inside this radius, so the people you meet
                    are genuinely near you.
                  </p>
                </div>
                <div>
                  <Label htmlFor="gender" className="text-sm font-semibold">
                    Looking for
                  </Label>
                  <Select
                    value={genderPreference}
                    onValueChange={setGenderPreference}
                  >
                    <SelectTrigger id="gender" data-testid="select-gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Open to everyone</SelectItem>
                      <SelectItem value="women">Women</SelectItem>
                      <SelectItem value="men">Men</SelectItem>
                      <SelectItem value="nonbinary">Nonbinary people</SelectItem>
                      <SelectItem value="trans-women">Trans women</SelectItem>
                      <SelectItem value="trans-men">Trans men</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Every gender and orientation is welcome here. Pick what fits
                    you.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="city" className="text-sm font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> City hint
                </Label>
                <Input
                  id="city"
                  value={cityHint}
                  onChange={(e) => setCityHint(e.target.value)}
                  placeholder="London, NYC, Berlin"
                  data-testid="input-city"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for the density count. We do not share your city with
                  anyone.
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Deal breakers</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={dealBreakerDraft}
                    onChange={(e) => setDealBreakerDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDealBreaker();
                      }
                    }}
                    placeholder="Smoker, no kids ever, etc."
                    data-testid="input-deal-breaker"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDealBreaker}
                    data-testid="button-add-deal-breaker"
                  >
                    Add
                  </Button>
                </div>
                <div className="mt-2">
                  <ChipList
                    items={dealBreakers}
                    onRemove={(i) =>
                      setDealBreakers((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    testIdPrefix="chip-deal-breaker"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Must haves</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={mustHaveDraft}
                    onChange={(e) => setMustHaveDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMustHave();
                      }
                    }}
                    placeholder="Reader, wants kids, dog person"
                    data-testid="input-must-have"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addMustHave}
                    data-testid="button-add-must-have"
                  >
                    Add
                  </Button>
                </div>
                <div className="mt-2">
                  <ChipList
                    items={mustHaves}
                    onRemove={(i) =>
                      setMustHaves((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    testIdPrefix="chip-must-have"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSavePreferences}
                  disabled={updatePrefs.isPending}
                  className="rounded-full px-6"
                  data-testid="button-save-preferences"
                >
                  {updatePrefs.isPending ? "Saving." : "Save preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
