import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import {
  Orbit,
  Sparkles,
  Sun,
  Moon,
  Star,
  Check,
  Lock,
  ArrowRight,
  Wand2,
  Globe,
  MapPin,
  Plane,
  CloudSun,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetCosmicChart,
  useSaveCosmicChart,
  useSaveCosmicReaction,
  useGetCosmicReading,
  useGetCosmicLines,
  useGetCosmicWeather,
  useSetCosmicRelocation,
  getGetCosmicChartQueryKey,
  getGetCosmicLinesQueryKey,
  getGetCosmicWeatherQueryKey,
  getGetMatchingStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CURATED_CITIES,
  DEMO_PLACEMENTS,
  DEMO_READING,
  DEMO_LINES,
  DEMO_WEATHER,
  COSMIC_REACTION_LABEL,
  TRAIT_LABEL,
  buildCosmicShareText,
  type CosmicReaction,
} from "@/lib/cosmic";
import { CosmicMap } from "@/components/cosmic/CosmicMap";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.5,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

type Placements = typeof DEMO_PLACEMENTS;
type Reading = { headline: string; lines: string[]; topTrait: string };

function PlacementCard({
  icon: Icon,
  label,
  sign,
}: {
  icon: typeof Sun;
  label: string;
  sign: string | null;
}) {
  return (
    <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          {label}
        </p>
        <p className="font-serif text-lg font-bold text-foreground truncate">
          {sign ?? "Unknown"}
        </p>
      </div>
    </div>
  );
}

function TraitBars({ traits }: { traits: Placements["traits"] }) {
  const rows = Object.entries(traits) as [string, number][];
  return (
    <div className="space-y-3">
      {rows.map(([key, value]) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-foreground">
              {TRAIT_LABEL[key] ?? key}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(value * 100)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartReveal({
  placements,
  reading,
}: {
  placements: Placements;
  reading: Reading;
}) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <PlacementCard icon={Sun} label="Sun" sign={placements.sun.sign} />
        <PlacementCard
          icon={Moon}
          label="Moon"
          sign={placements.moon?.sign ?? null}
        />
        <PlacementCard
          icon={Star}
          label="Rising"
          sign={placements.rising?.sign ?? null}
        />
      </div>

      {placements.mode === "sunOnly" && (
        <p className="text-xs text-muted-foreground">
          No birth time on file, so rising and midheaven stay blank. Sun, moon,
          and planet signs are still a real read. Add a time later for the full
          picture.
        </p>
      )}

      <div className="glass border border-white/8 rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
          How your chart leans
        </p>
        <TraitBars traits={placements.traits} />
      </div>

      <div className="glass border border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-serif text-xl font-bold text-foreground">
            {reading.headline}
          </h3>
        </div>
        <div className="space-y-2.5">
          {reading.lines.map((line, i) => (
            <p key={i} className="text-sm text-foreground/85 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  birthDate: "",
  hasTime: false,
  birthTime: "",
  cityIndex: -1,
  manualPlace: "",
  manualLat: "",
  manualLng: "",
};

function BirthForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: {
    birthDate: string;
    birthTime: string | null;
    birthPlace: string;
    birthLat: number;
    birthLng: number;
  }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const usingManual = form.cityIndex === -1;

  const resolved = useMemo(() => {
    if (!usingManual) {
      const city = CURATED_CITIES[form.cityIndex];
      if (!city) return null;
      return { place: city.label, lat: city.lat, lng: city.lng };
    }
    const lat = Number(form.manualLat);
    const lng = Number(form.manualLng);
    if (
      !form.manualPlace.trim() ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }
    return { place: form.manualPlace.trim(), lat, lng };
  }, [usingManual, form]);

  const canSubmit = Boolean(form.birthDate) && Boolean(resolved) && !isPending;

  const inputCls =
    "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40";

  return (
    <div className="glass border border-white/8 rounded-2xl p-6 space-y-5 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Birth date
        </label>
        <input
          type="date"
          className={inputCls}
          value={form.birthDate}
          onChange={(e) =>
            setForm((f) => ({ ...f, birthDate: e.target.value }))
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-foreground">
            Birth time
          </label>
          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, hasTime: !f.hasTime, birthTime: "" }))
            }
            className="text-xs text-primary hover:underline"
          >
            {form.hasTime ? "I don't know it" : "I know my birth time"}
          </button>
        </div>
        {form.hasTime ? (
          <input
            type="time"
            className={inputCls}
            value={form.birthTime}
            onChange={(e) =>
              setForm((f) => ({ ...f, birthTime: e.target.value }))
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No problem. We compute a sun-led read without it. Rising needs a
            time, so it stays blank until you add one.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Birth place
        </label>
        <select
          className={inputCls}
          value={form.cityIndex}
          onChange={(e) =>
            setForm((f) => ({ ...f, cityIndex: Number(e.target.value) }))
          }
        >
          {CURATED_CITIES.map((c, i) => (
            <option key={c.label} value={i}>
              {c.label}
            </option>
          ))}
          <option value={-1}>Somewhere else (enter coordinates)</option>
        </select>
      </div>

      {usingManual && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Place name"
            className={inputCls}
            value={form.manualPlace}
            onChange={(e) =>
              setForm((f) => ({ ...f, manualPlace: e.target.value }))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Latitude"
              className={inputCls}
              value={form.manualLat}
              onChange={(e) =>
                setForm((f) => ({ ...f, manualLat: e.target.value }))
              }
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Longitude"
              className={inputCls}
              value={form.manualLng}
              onChange={(e) =>
                setForm((f) => ({ ...f, manualLng: e.target.value }))
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Place search lands with the next beat. For now a rough latitude and
            longitude is enough.
          </p>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!canSubmit}
        onClick={() => {
          if (!resolved || !form.birthDate) return;
          onSubmit({
            birthDate: form.birthDate,
            birthTime: form.hasTime && form.birthTime ? form.birthTime : null,
            birthPlace: resolved.place,
            birthLat: resolved.lat,
            birthLng: resolved.lng,
          });
        }}
      >
        {isPending ? "Reading the sky..." : "Build my chart"}
      </Button>
    </div>
  );
}

export default function Cosmic() {
  useMeta(
    "Cosmic Compass",
    "A birth chart read as a mirror, not a verdict. A playful wrapper over an honest engine, and a soft, low-weight signal in how the machine learns you.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isDemo = !isAuthenticated;

  const { data: chartData } = useGetCosmicChart({
    query: {
      queryKey: getGetCosmicChartQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const saveChart = useSaveCosmicChart();
  const saveReaction = useSaveCosmicReaction();
  const getReading = useGetCosmicReading();
  const setRelocation = useSetCosmicRelocation();
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  const [deepReading, setDeepReading] = useState<Reading | null>(null);
  const [deepWasFallback, setDeepWasFallback] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetCosmicChartQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const placements: Placements | null = isDemo
    ? DEMO_PLACEMENTS
    : (chartData?.placements as Placements | undefined) ?? null;

  const reading: Reading = isDemo
    ? DEMO_READING
    : chartData?.reading
      ? {
          headline: chartData.reading.headline,
          lines: chartData.reading.lines,
          topTrait: chartData.reading.topTrait,
        }
      : DEMO_READING;

  const reaction: CosmicReaction | null = isDemo
    ? null
    : ((chartData?.reaction as CosmicReaction | null) ?? null);

  const hasChart = Boolean(placements);

  const { data: linesData } = useGetCosmicLines({
    query: {
      queryKey: getGetCosmicLinesQueryKey(),
      enabled: isAuthenticated && hasChart,
      retry: false,
    },
  });

  const lines = isDemo ? DEMO_LINES : linesData ?? null;
  const relocationOpen = lines?.relocationOpen ?? false;

  const { data: weatherData } = useGetCosmicWeather({
    query: {
      queryKey: getGetCosmicWeatherQueryKey(),
      enabled: isAuthenticated && hasChart,
      retry: false,
    },
  });

  const weather = isDemo ? DEMO_WEATHER : weatherData ?? null;

  const toggleRelocation = () => {
    if (isDemo || setRelocation.isPending || !lines) return;
    setRelocation.mutate(
      { data: { open: !relocationOpen } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetCosmicLinesQueryKey(),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetMatchingStateQueryKey(),
          });
        },
      },
    );
  };

  const submitChart = (data: {
    birthDate: string;
    birthTime: string | null;
    birthPlace: string;
    birthLat: number;
    birthLng: number;
  }) => {
    if (saveChart.isPending) return;
    climb.snapshot();
    saveChart.mutate({ data }, { onSuccess: invalidate });
  };

  const pickReaction = (value: CosmicReaction) => {
    if (isDemo || saveReaction.isPending) return;
    climb.snapshot();
    saveReaction.mutate(
      { data: { reaction: value } },
      { onSuccess: invalidate },
    );
  };

  const runDeepReading = () => {
    if (isDemo || getReading.isPending) return;
    getReading.mutate(undefined, {
      onSuccess: (res) => {
        setDeepReading({
          headline: res.headline,
          lines: res.lines,
          topTrait: res.topTrait,
        });
        setDeepWasFallback(res.source !== "claude");
      },
    });
  };

  const buildShareText = () => {
    if (!placements) return "";
    return buildCosmicShareText(
      {
        sun: placements.sun?.sign ?? null,
        moon: placements.moon?.sign ?? null,
        rising: placements.rising?.sign ?? null,
      },
      (lines?.loveLineCities ?? []).map((c) => c.label),
    );
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      // A cancelled share or a blocked clipboard is not an error worth surfacing.
    }
  };

  return (
    <AppLayout>
      <HubTabs hub="games" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div {...fadeUp(0)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Orbit className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Cosmic Compass
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
            A mirror, not a verdict
          </h1>
          <p className="text-muted-foreground max-w-xl leading-relaxed">
            We compute a real birth chart, then read it as a prompt for
            reflection. Nothing here decides anything for you. What you
            recognise and reject in it is a soft, gently weighted signal that
            helps the machine learn how you see yourself.
          </p>
        </motion.div>

        {isDemo && (
          <motion.div
            {...fadeUp(0.05)}
            className="glass border border-primary/20 rounded-2xl p-5 mb-6 flex items-start gap-3"
          >
            <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">
                Sample view
              </p>
              <p className="text-sm text-muted-foreground">
                This is an example chart. Sign in to build your own from your
                birth moment and feed it into your readiness.
              </p>
              <Link href="/login">
                <Button size="sm" className="mt-3">
                  Sign in to start
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        {!isDemo && !hasChart && (
          <motion.div {...fadeUp(0.05)}>
            <BirthForm onSubmit={submitChart} isPending={saveChart.isPending} />
          </motion.div>
        )}

        {hasChart && placements && (
          <motion.div {...fadeUp(0.05)} className="space-y-6">
            <ChartReveal placements={placements} reading={reading} />

            {weather && (
              <div
                className="glass border border-white/8 rounded-2xl p-6"
                data-testid="cosmic-weather"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CloudSun className="w-4 h-4 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Today's cosmic weather
                  </p>
                </div>
                <p className="font-serif text-xl font-bold text-foreground mb-2">
                  {weather.headline}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {weather.reframe}
                </p>
                {weather.action && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={weather.action.href}>
                      {weather.action.label}
                      <ArrowRight className="ml-1 w-4 h-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            )}

            {isAuthenticated && climb.before !== null && (
              <ReadinessClimbReveal
                from={climb.before}
                to={climb.current}
                className="glass border border-white/8 rounded-2xl p-5"
              />
            )}

            {/* Reaction capture: the honest calibration signal */}
            <div className="glass border border-white/8 rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
                Does this land?
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Your honest reaction is the real signal here, not the chart. It
                tells us how you actually see yourself.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {(
                  Object.keys(COSMIC_REACTION_LABEL) as CosmicReaction[]
                ).map((value) => {
                  const active = reaction === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={isDemo || saveReaction.isPending}
                      onClick={() => pickReaction(value)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      } ${isDemo ? "opacity-60" : ""}`}
                    >
                      {active && <Check className="w-4 h-4 text-primary" />}
                      {COSMIC_REACTION_LABEL[value]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Astrocartography: where your love lines fall */}
            {lines && (
              <div className="glass border border-white/8 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      Your love lines on the map
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    data-testid="button-cosmic-share"
                  >
                    <Share2 className="mr-1 w-4 h-4" aria-hidden="true" />
                    {shareCopied ? "Copied" : "Share"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  These are the meridians where your relationship-flavoured
                  placements run strongest. It is a playful lens for daydreaming
                  about places, not a relocation plan. The honest part: if you
                  tell us you are open to meeting someone further afield, we let
                  matches near these cities reach you too.
                </p>

                {lines.mode === "sunOnly" ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-muted-foreground">
                    Love lines need a birth time to place the angles. Add yours
                    when you rebuild your chart and the map fills in.
                  </div>
                ) : (
                  <>
                    <CosmicMap lines={lines.lines} cities={lines.loveLineCities} />

                    {lines.loveLineCities.length > 0 && (
                      <div className="mt-4 grid sm:grid-cols-2 gap-3">
                        {lines.loveLineCities.map((city) => (
                          <div
                            key={city.key}
                            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-2.5"
                          >
                            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {city.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Near your {city.bodyLabel} {city.angle} line,
                                about {Math.round(city.distanceMiles)} mi off
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <Plane className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Open to meeting further afield
                            </p>
                            <p className="text-xs text-muted-foreground">
                              When this is on, matching can gently widen toward
                              people near your love-line cities, on top of your
                              usual radius. It never narrows your matches, only
                              adds.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={relocationOpen}
                          disabled={isDemo || setRelocation.isPending}
                          onClick={toggleRelocation}
                          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                            relocationOpen ? "bg-primary" : "bg-white/15"
                          } ${
                            isDemo || setRelocation.isPending
                              ? "opacity-60"
                              : ""
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                              relocationOpen ? "translate-x-5" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Deeper, opt-in reading */}
            <div className="glass border border-white/8 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <Wand2 className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  A deeper reading
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                The reading above is always-on and built in-house. Turn on the
                deep AI lane in your account to layer a richer, written
                reflection on top. It only ever sees your chart leanings, never
                your raw birth details.
              </p>

              {!isDemo && (
                <Button
                  variant="secondary"
                  disabled={getReading.isPending}
                  onClick={runDeepReading}
                >
                  {getReading.isPending
                    ? "Reading..."
                    : "Write my deeper reading"}
                </Button>
              )}

              <AnimatePresence>
                {deepReading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4"
                  >
                    <div className="glass border border-primary/20 rounded-2xl p-5">
                      <h4 className="font-serif text-lg font-bold text-foreground mb-2">
                        {deepReading.headline}
                      </h4>
                      <div className="space-y-2">
                        {deepReading.lines.map((line, i) => (
                          <p
                            key={i}
                            className="text-sm text-foreground/85 leading-relaxed"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                      {deepWasFallback && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          This is the always-on read. Turn on the deep AI lane in
                          your{" "}
                          <Link
                            href="/account"
                            className="text-primary hover:underline"
                          >
                            account
                          </Link>{" "}
                          for the richer written version.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!isDemo && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setDeepReading(null);
                    queryClient.removeQueries({
                      queryKey: getGetCosmicChartQueryKey(),
                    });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Rebuild my chart
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
