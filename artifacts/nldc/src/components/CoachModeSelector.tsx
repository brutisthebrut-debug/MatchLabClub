import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type CoachMode = "wingman" | "direct-friend" | "soft-mirror" | "flirt-coach" | "grounded-strategist" | "consent-aware";

export interface CoachModeConfig {
  key: CoachMode;
  label: string;
  emoji: string;
  tagline: string;
  toneHint: string;
  color: string;
}

export const COACH_MODES: CoachModeConfig[] = [
  {
    key: "wingman",
    label: "Wingman",
    emoji: "⚡",
    tagline: "Your warm, encouraging partner in this",
    toneHint: "Warm, supportive, action-oriented. Celebrates effort, keeps things moving.",
    color: "hsl(268 52% 68%)",
  },
  {
    key: "direct-friend",
    label: "Direct Friend",
    emoji: "🎯",
    tagline: "No BS, honest feedback, says what most won't",
    toneHint: "Straight talk, zero sugarcoating. Respects you enough to tell it like it is.",
    color: "hsl(43 65% 65%)",
  },
  {
    key: "soft-mirror",
    label: "Soft Mirror",
    emoji: "🌿",
    tagline: "Gentle reflection — helps you see your own patterns",
    toneHint: "Curious, non-judgmental. Asks questions, mirrors back what it notices.",
    color: "hsl(142 55% 60%)",
  },
  {
    key: "flirt-coach",
    label: "Flirt Coach",
    emoji: "✨",
    tagline: "Playful help with tone, attraction, and directness",
    toneHint: "Light, warm, a bit cheeky. Keeps advice fun and not overthought.",
    color: "hsl(348 55% 65%)",
  },
  {
    key: "grounded-strategist",
    label: "Grounded Strategist",
    emoji: "🧭",
    tagline: "Practical, data-minded, clear on what actually works",
    toneHint: "Logical, efficient, pattern-aware. Fewer feelings, more frameworks.",
    color: "hsl(190 55% 60%)",
  },
  {
    key: "consent-aware",
    label: "Consent-Aware Coach",
    emoji: "🛡️",
    tagline: "Boundaries, clarity, respect — built into every suggestion",
    toneHint: "Consent-forward, non-coercive, always checks the other person's experience too.",
    color: "hsl(285 45% 65%)",
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
          <span>{active.emoji}</span>
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
                <span className="text-base flex-shrink-0 mt-0.5">{mode.emoji}</span>
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
              borderColor: mode.color.replace(")", " / 0.4)"),
              background: mode.color.replace(")", " / 0.12)"),
              color: undefined,
            } : undefined}
          >
            <span>{mode.emoji}</span>
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
