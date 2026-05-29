import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  Compass,
  Download,
  Heart,
  MapPin,
  Sparkles,
  Users,
  X,
} from "lucide-react";
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
import {
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useUpdateMatchingPreferences,
  useUpdateMatchingPoolMembership,
  useCreateMatchingExternalRead,
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

interface BreakdownRow {
  key: "compass" | "journal" | "wellness" | "hingeImport" | "postDate";
  label: string;
  blurb: string;
  href: string;
  cta: string;
  icon: typeof Compass;
}

const BREAKDOWN_ROWS: BreakdownRow[] = [
  {
    key: "compass",
    label: "Compass reads",
    blurb: "Five compass reads sharpens what you actually respond to.",
    href: "/compatibility-compass",
    cta: "Run a compass read",
    icon: Compass,
  },
  {
    key: "wellness",
    label: "Wellness map",
    blurb: "Eighteen dimensions covered. The more, the more honest the match.",
    href: "/wellness",
    cta: "Answer a wellness prompt",
    icon: Brain,
  },
  {
    key: "hingeImport",
    label: "Hinge import",
    blurb: "A Hinge export tells us how you swipe and who swipes back.",
    href: "/imports",
    cta: "Import Hinge data",
    icon: Download,
  },
  {
    key: "journal",
    label: "Journal cadence",
    blurb: "Ten entries shows us your patterns, not just one moment.",
    href: "/me/journal",
    cta: "Add a journal entry",
    icon: BookOpen,
  },
  {
    key: "postDate",
    label: "Post-date notes",
    blurb: "Three notes after dates is enough to spot what you keep choosing.",
    href: "/mirror/dates",
    cta: "Log a post-date note",
    icon: Calendar,
  },
];

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

  // Local form state, hydrated from server when prefs land.
  const [ageMin, setAgeMin] = useState<number>(25);
  const [ageMax, setAgeMax] = useState<number>(45);
  const [distanceKm, setDistanceKm] = useState<string>("");
  const [genderPreference, setGenderPreference] = useState<string>("any");
  const [cityHint, setCityHint] = useState<string>("");
  const [dealBreakers, setDealBreakers] = useState<string[]>([]);
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [dealBreakerDraft, setDealBreakerDraft] = useState("");
  const [mustHaveDraft, setMustHaveDraft] = useState("");

  // External read form.
  const [externalText, setExternalText] = useState("");
  const [externalSource, setExternalSource] = useState<
    "hinge" | "tinder" | "bumble" | "other"
  >("hinge");
  const [externalResult, setExternalResult] = useState<{
    score: number;
    highlights: string[];
    frictions: string[];
    summary: string | null;
  } | null>(null);

  const prefs = state.data?.preferences ?? null;

  useEffect(() => {
    if (!prefs) return;
    if (typeof prefs.ageMin === "number") setAgeMin(prefs.ageMin);
    if (typeof prefs.ageMax === "number") setAgeMax(prefs.ageMax);
    setDistanceKm(prefs.distanceKm == null ? "" : String(prefs.distanceKm));
    setGenderPreference(prefs.genderPreference ?? "any");
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
  };
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

  const cityLabel = useMemo(() => prefs?.cityHint ?? cityHint, [prefs, cityHint]);

  const conciergeUrl =
    (import.meta.env.VITE_CONCIERGE_INTAKE_URL as string | undefined) ?? "";

  async function handleSavePreferences() {
    const distanceNum = distanceKm.trim().length === 0 ? null : Number(distanceKm);
    if (distanceNum != null && (!Number.isFinite(distanceNum) || distanceNum < 0)) {
      toast({ title: "Distance needs to be a positive number." });
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
            Founder-curated intros for Wingman customers, algorithmic for
            everyone else. No swipe.
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
            Two lanes. Wingman customers get founder-curated intros, hand
            picked. Everyone else gets algorithmic matches built from the
            signals you have already given us. No swipe carousel. No infinite
            scroll. Just a small number of well-considered people.
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
                <div className="text-right">
                  <div className="text-4xl md:text-5xl font-bold text-foreground">
                    {readinessScore}
                    <span className="text-2xl text-muted-foreground">%</span>
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
                  <p
                    className="text-sm mt-2 text-[hsl(326_100%_50%)] font-medium"
                    data-testid="text-pool-locked"
                  >
                    The pool opens at a readiness of {readinessThreshold}. You
                    are at {readinessScore} right now. Run a compass read, answer
                    a wellness prompt, or import your Hinge data to close the
                    gap.
                  </p>
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
                Paste their Hinge, Tinder, or Bumble profile. We score it
                against what we know about you and save the read.
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
                    Distance (km)
                  </Label>
                  <Input
                    id="distance"
                    type="number"
                    min={0}
                    max={20000}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    placeholder="No limit"
                    data-testid="input-distance"
                  />
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
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="women">Women</SelectItem>
                      <SelectItem value="men">Men</SelectItem>
                      <SelectItem value="nonbinary">Nonbinary</SelectItem>
                      <SelectItem value="everyone">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
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
