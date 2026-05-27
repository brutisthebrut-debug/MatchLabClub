import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Zap, Users, DollarSign, Brain, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  useGetRecentLifePulses,
  useRecordLifePulse,
} from "@workspace/api-client-react";
import type { LifePulse } from "@workspace/api-client-react";

type MetricKey = "sleep" | "energy" | "social" | "money" | "headspace";

type Metric = {
  key: MetricKey;
  label: string;
  helper: string;
  icon: typeof Moon;
  color: string;
};

const METRICS: Metric[] = [
  { key: "sleep",     label: "Sleep last night",  helper: "1 wrecked → 5 rested",        icon: Moon,       color: "hsl(220 50% 65%)" },
  { key: "energy",    label: "Energy right now",  helper: "1 depleted → 5 charged",      icon: Zap,        color: "hsl(43 65% 65%)" },
  { key: "social",    label: "Social fuel",       helper: "1 drained → 5 lit up",        icon: Users,      color: "hsl(190 55% 60%)" },
  { key: "money",     label: "Money headspace",   helper: "1 stressed → 5 unbothered",   icon: DollarSign, color: "hsl(142 55% 60%)" },
  { key: "headspace", label: "Mental clarity",    helper: "1 foggy → 5 sharp",           icon: Brain,      color: "hsl(248 62% 52%)" },
];

const SCALE_LABELS = ["—", "Low", "Soft", "OK", "Strong", "Peak"] as const;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) {
    return <div className="h-6 w-16 rounded bg-white/5" />;
  }
  const w = 64;
  const h = 24;
  const step = values.length === 1 ? 0 : w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - 1) / 4) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      {values.length > 0 && (
        <circle
          cx={(values.length - 1) * step}
          cy={h - ((values[values.length - 1] - 1) / 4) * h}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}

export function LifePulseCard() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useGetRecentLifePulses();
  const recordMutation = useRecordLifePulse();

  const latest = data?.latest ?? null;
  const pulses: LifePulse[] = data?.pulses ?? [];

  // Seed sliders from the latest pulse (or sensible neutrals).
  const initial = useMemo<Record<MetricKey, number>>(
    () => ({
      sleep:     latest?.sleep     ?? 3,
      energy:    latest?.energy    ?? 3,
      social:    latest?.social    ?? 3,
      money:     latest?.money     ?? 3,
      headspace: latest?.headspace ?? 3,
    }),
    [latest],
  );

  const [values, setValues] = useState<Record<MetricKey, number>>(initial);
  const [dirty, setDirty] = useState(false);

  // Re-seed when latest changes (e.g. on refetch) and user has not touched anything.
  if (!dirty) {
    const drift = METRICS.some((m) => values[m.key] !== initial[m.key]);
    if (drift) {
      setValues(initial);
    }
  }

  const change = (k: MetricKey) => (vals: number[]) => {
    setDirty(true);
    setValues((prev) => ({ ...prev, [k]: vals[0] ?? prev[k] }));
  };

  const submit = () => {
    recordMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Pulse logged", description: "Your wellness dimensions just got fresher." });
          setDirty(false);
          void refetch();
        },
        onError: () => {
          toast({ title: "Could not save pulse", description: "Try again in a moment.", variant: "destructive" });
        },
      },
    );
  };

  // Build per-metric series (oldest → newest) for sparklines, last 14 entries.
  const series = useMemo(() => {
    const recent = [...pulses].slice(0, 14).reverse();
    const s: Record<MetricKey, number[]> = { sleep: [], energy: [], social: [], money: [], headspace: [] };
    for (const p of recent) {
      s.sleep.push(p.sleep);
      s.energy.push(p.energy);
      s.social.push(p.social);
      s.money.push(p.money);
      s.headspace.push(p.headspace);
    }
    return s;
  }, [pulses]);

  const submitting = recordMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong rounded-2xl p-5 sm:p-7 border border-[hsl(43_65%_65%/0.25)] mb-6"
      data-testid="card-life-pulse"
    >
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(43_65%_65%/0.15)] flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[hsl(43_65%_72%)]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-xl sm:text-2xl font-semibold leading-tight">Today's Life Pulse</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Five fast self-ratings. Takes 10 seconds. Feeds every dimension below — and every coaching call going forward.
            </p>
          </div>
        </div>
        {latest && (
          <div
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground"
            data-testid="text-life-pulse-last-logged"
          >
            Last logged {new Date(latest.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const val = values[m.key];
          return (
            <div key={m.key} className="space-y-2" data-testid={`row-life-pulse-${m.key}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: m.color }} />
                  <span className="text-sm font-medium text-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkline values={series[m.key]} color={m.color} />
                  <span
                    className="text-sm font-semibold tabular-nums w-12 text-right"
                    style={{ color: m.color }}
                    data-testid={`value-life-pulse-${m.key}`}
                  >
                    {val}/5
                  </span>
                </div>
              </div>
              <Slider
                value={[val]}
                onValueChange={change(m.key)}
                min={1}
                max={5}
                step={1}
                aria-label={m.label}
                data-testid={`slider-life-pulse-${m.key}`}
              />
              <p className="text-[11px] text-muted-foreground/70">
                {m.helper} — <span className="text-muted-foreground">{SCALE_LABELS[val]}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <Button
          onClick={submit}
          disabled={submitting || isLoading}
          className="rounded-full"
          data-testid="button-life-pulse-submit"
        >
          {submitting ? "Saving…" : latest ? "Log a new pulse" : "Log my first pulse"}
          <Check className="w-4 h-4 ml-1.5" />
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Private to you. Used to score wellness dimensions and personalise weekly coaching.
        </p>
      </div>
    </motion.div>
  );
}

/** Map the latest pulse onto each Wellness Center dimension so dimension cards can show live signal. */
export function dimensionScoreFromPulse(
  dimensionKey: string,
  latest: LifePulse | null,
): { value: number | null; sourceLabel: string } {
  if (!latest) return { value: null, sourceLabel: "" };
  switch (dimensionKey) {
    case "physical":
      return { value: Math.round((latest.sleep + latest.energy) / 2), sourceLabel: "sleep + energy" };
    case "emotional":
      return { value: latest.headspace, sourceLabel: "headspace" };
    case "social":
      return { value: latest.social, sourceLabel: "social fuel" };
    case "intellectual":
      return { value: latest.headspace, sourceLabel: "headspace" };
    case "financial":
      return { value: latest.money, sourceLabel: "money headspace" };
    case "occupational":
      return { value: Math.round((latest.energy + latest.headspace) / 2), sourceLabel: "energy + clarity" };
    case "spiritual":
    case "environmental":
    default:
      return { value: null, sourceLabel: "" };
  }
}
