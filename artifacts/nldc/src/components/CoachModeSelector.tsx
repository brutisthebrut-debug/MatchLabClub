import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, Target, Leaf, Sparkles, Compass, Shield, type LucideIcon } from "lucide-react";

export type CoachMode = "wingman" | "direct-friend" | "soft-mirror" | "flirt-coach" | "grounded-strategist" | "consent-aware";

export interface CoachModeConfig {
  key: CoachMode;
  label: string;
  icon: LucideIcon;
  tagline: string;
  toneHint: string;
  color: string;
}

export const COACH_MODES: CoachModeConfig[] = [
  {
  key: "wingman",
  label: "Wingman",
  icon: Zap,
  tagline: "Your warm, encouraging partner in this",
  toneHint: "Warm, supportive, action-oriented. Celebrates effort, keeps things moving.",
  color: "hsl(var(--brand-indigo))",
  },
  {
  key: "direct-friend",
  label: "Direct Friend",
  icon: Target,
  tagline: "No BS, honest feedback, says what most won't",
  toneHint: "Straight talk, zero sugarcoating. Respects you enough to tell it like it is.",
  color: "hsl(var(--brand-gold))",
  },
  {
  key: "soft-mirror",
  label: "Soft Mirror",
  icon: Leaf,
  tagline: "Gentle reflection, helps you see your own patterns",
  toneHint: "Curious, non-judgmental. Asks questions, mirrors back what it notices.",
  color: "hsl(var(--brand-green))",
  },
  {
  key: "flirt-coach",
  label: "Flirt Coach",
  icon: Sparkles,
  tagline: "Playful help with tone, attraction, and directness",
  toneHint: "Light, warm, a bit cheeky. Keeps advice fun and not overthought.",
  color: "hsl(var(--brand-rose))",
  },
  {
  key: "grounded-strategist",
  label: "Grounded Strategist",
  icon: Compass,
  tagline: "Practical, data-minded, clear on what actually works",
  toneHint: "Logical, efficient, pattern-aware. Fewer feelings, more frameworks.",
  color: "hsl(190 55% 60%)",
  },
  {
  key: "consent-aware",
  label: "Consent-Aware Coach",
  icon: Shield,
  tagline: "Boundaries, clarity, respect, built into every suggestion",
  toneHint: "Consent-forward, non-coercive, always checks the other person's experience too.",
  color: "hsl(326 100% 65%)",
  },
];

interface CoachModeSelectorProps {
  value: CoachMode;
  onChange: (mode: CoachMode) => void;
  compact?: boolean;
}

export function CoachModeSelector({ value, onChange, compact = false }: CoachModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const active = COACH_MODES.find(m => m.key === value) ?? COACH_MODES[0];

  if (compact) {
  return (
  <div className="relative">
  <button
  onClick={() => setOpen(o => !o)}
  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all text-xs font-medium text-muted-foreground hover:text-foreground"
  >
  <active.icon className="w-3.5 h-3.5" style={{ color: active.color }} />
  <span>{active.label}</span>
  {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
  </button>

  {open && (
  <div className="absolute top-full mt-2 left-0 z-50 w-64 glass border border-white/10 rounded-2xl p-2 shadow-2xl">
  {COACH_MODES.map(mode => (
  <button
  key={mode.key}
  onClick={() => { onChange(mode.key); setOpen(false); }}
  className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
  value === mode.key ? "bg-white/8" : "hover:bg-white/4"
  }`}
  >
  <mode.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: mode.color }} />
  <div>
  <p className="text-xs font-semibold text-foreground leading-tight">{mode.label}</p>
  <p className="text-[10px] text-muted-foreground/55 mt-0.5 leading-snug">{mode.tagline}</p>
  </div>
  {value === mode.key && (
  <div className="ml-auto w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: mode.color }} />
  )}
  </button>
  ))}
  </div>
  )}
  </div>
  );
  }

  return (
  <div className="space-y-2">
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">Coach mode</p>
  <div className="flex flex-wrap gap-2">
  {COACH_MODES.map(mode => (
  <button
  key={mode.key}
  onClick={() => onChange(mode.key)}
  title={mode.toneHint}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
  value === mode.key
  ? "text-foreground"
  : "border-white/8 text-muted-foreground hover:border-white/18 hover:text-foreground"
  }`}
  style={value === mode.key ? {
  borderColor: withAlpha(mode.color, 0.4),
  background: withAlpha(mode.color, 0.12),
  color: undefined,
  } : undefined}
  >
  <mode.icon className="w-3.5 h-3.5" style={{ color: mode.color }} />
  <span>{mode.label}</span>
  </button>
  ))}
  </div>
  {value && (
  <p className="text-[11px] text-muted-foreground/45 leading-relaxed pl-1">
  {active.toneHint}
  </p>
  )}
  </div>
  );
}