import { RefreshCw } from "lucide-react";
import type { ConfidenceLevel } from "@/lib/toneUtils";

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; color: string }> = {
  strong:   { label: "Strong read",           color: "hsl(142 55% 60%)" },
  moderate: { label: "Needs more context",     color: "hsl(43 65% 65%)"  },
  limited:  { label: "Based on limited input", color: "hsl(348 55% 65%)" },
};

export function ConfidenceLabel({ level }: { level: ConfidenceLevel }) {
  const c = CONFIDENCE_CONFIG[level];
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
      style={{
        color: c.color,
        borderColor: c.color.replace(")", " / 0.3)"),
        background: c.color.replace(")", " / 0.1)"),
      }}
    >
      {c.label}
    </span>
  );
}

const TONES = [
  { label: "Shorter",      hint: "Make the output more concise — cut to the core insight, fewer words." },
  { label: "Warmer",       hint: "Make the tone warmer and more encouraging. Less clinical, more human." },
  { label: "More Direct",  hint: "Be more direct. Remove hedging language. Get to the point faster." },
  { label: "More Playful", hint: "Add a lighter, more playful energy while keeping the practical insight." },
];

export function ToneBar({ onApply, loading }: { onApply: (hint: string) => void; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-foreground/8">
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mr-1">
        Adjust tone:
      </span>
      {TONES.map(t => (
        <button
          key={t.label}
          onClick={() => onApply(t.hint)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-foreground/12 text-muted-foreground hover:text-foreground hover:border-[hsl(248_62%_55%/0.45)] hover:bg-[hsl(248_62%_55%/0.07)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
