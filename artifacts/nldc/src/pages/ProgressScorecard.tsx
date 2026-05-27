import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { BarChart2, TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type Trend = "up" | "flat" | "down";

interface Dimension {
  key: string;
  label: string;
  score: number;
  prev: number;
  color: string;
  note: string;
  detail: string;
}

const DIMENSIONS: Dimension[] = [
  {
    key: "clarity", label: "Clarity", score: 72, prev: 61, color: "hsl(var(--brand-indigo))",
    note: "You've sharpened your sense of what you want. Earlier entries were exploratory; recent ones are more specific.",
    detail: "Clarity means knowing what you want and why — not just what you'll tolerate. You've moved from 'something real' to naming the specific dynamics, pacing, and qualities that matter. That precision matters in how you filter, communicate, and choose.",
  },
  {
    key: "confidence", label: "Confidence", score: 65, prev: 60, color: "hsl(var(--brand-gold))",
    note: "Stable upward movement. You're second-guessing yourself less in early interactions.",
    detail: "Confidence here means ease, not performance. A high score isn't swagger — it's being able to show up without constantly running a background check on how you're landing. You're calmer in early interactions than you were four weeks ago.",
  },
  {
    key: "follow-through", label: "Follow-Through", score: 78, prev: 70, color: "hsl(var(--brand-green))",
    note: "Your strongest dimension. You do what you say you'll try.",
    detail: "Most coaching stops at insight. Follow-through is what makes insight useful. Your timeline shows a pattern of deciding to try something and then actually trying it — which is rarer than it sounds and the single most predictive indicator of progress.",
  },
  {
    key: "filtering", label: "Filtering", score: 55, prev: 58, color: "hsl(190 55% 60%)",
    note: "Slight dip — you've noted some tendency to self-select out early. Worth watching.",
    detail: "Filtering means choosing based on what's real — not reflexive self-protection or anxious over-attachment. A slight dip here often appears when someone is becoming more self-aware of their patterns. The awareness itself is a sign of progress, even if the score reflects the friction.",
  },
  {
    key: "readiness", label: "Readiness", score: 68, prev: 65, color: "hsl(var(--brand-rose))",
    note: "You're more open than you were. Some protective habits still active — which is fine.",
    detail: "Readiness isn't about urgency — it's about being available enough to let something real develop. The protective habits you've noted (over-explaining, anxiety during quiet periods) are still present but you're naming them faster, which is exactly what shifts them.",
  },
  {
    key: "awareness", label: "Awareness", score: 82, prev: 74, color: "hsl(326 100% 65%)",
    note: "Your fastest-growing dimension. You're seeing your own patterns in real time.",
    detail: "You've logged more self-observations in the last 30 days than most people develop across years. Awareness precedes change — you can't shift a pattern you can't see. At this rate, you're building a genuinely useful internal map of how you work.",
  },
  {
    key: "self-trust", label: "Self-Trust", score: 60, prev: 57, color: "hsl(var(--brand-gold))",
    note: "Growing slowly. You're making decisions you're more comfortable with in retrospect.",
    detail: "Self-trust in dating means making a call — pursue, pause, pass — and not immediately second-guessing it. Your logs show you making decisions you're more comfortable with three days later, which is a meaningful indicator. Trust usually lags awareness by a few weeks.",
  },
];

function getTrend(score: number, prev: number): Trend {
  const diff = score - prev;
  if (diff >= 3) return "up";
  if (diff <= -3) return "down";
  return "flat";
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up")   return <TrendingUp   className="w-4 h-4 text-[hsl(142_55%_60%)]" />;
  if (trend === "down") return <TrendingDown  className="w-4 h-4 text-[hsl(348_55%_65%)]" />;
  return <Minus className="w-4 h-4 text-muted-foreground/50" />;
}

function ScoreMeter({ score, color }: { score: number; color: string }) {
  return (
    <div className="relative h-2 w-full bg-white/8 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${score}%` }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-0 top-0 h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

function DimensionCard({ dim, i }: { dim: Dimension; i: number }) {
  const [expanded, setExpanded] = useState(false);
  const trend = getTrend(dim.score, dim.prev);
  const diff  = dim.score - dim.prev;

  return (
    <motion.div {...fadeUp(0.04 + i * 0.05)} className="glass border border-white/8 rounded-2xl p-5 hover:border-white/12 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-foreground">{dim.label}</p>
          <TrendIcon trend={trend} />
          <span className={`text-xs font-medium ${trend === "up" ? "text-[hsl(142_55%_65%)]" : trend === "down" ? "text-[hsl(348_55%_65%)]" : "text-muted-foreground/50"}`}>
            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "—"}
          </span>
        </div>
        <span className="text-2xl font-bold" style={{ color: dim.color }}>{dim.score}</span>
      </div>
      <ScoreMeter score={dim.score} color={dim.color} />
      <p className="text-xs text-muted-foreground leading-relaxed mt-3">{dim.note}</p>
      <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />What this means</>}
      </button>
      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 pl-3 border-l-2 border-white/10">
          <p className="text-xs text-muted-foreground/80 leading-relaxed">{dim.detail}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function ProgressScorecard() {
  useMeta("Progress Scorecard · MatchLab Club", "Seven dimension meters tracking your growth across clarity, confidence, awareness, and more.");
  const overall = Math.round(DIMENSIONS.reduce((s, d) => s + d.score, 0) / DIMENSIONS.length);
  const topDim  = [...DIMENSIONS].sort((a, b) => b.score - a.score)[0];
  const growingDim = [...DIMENSIONS].sort((a, b) => (b.score - b.prev) - (a.score - a.prev))[0];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-16 right-0 opacity-20 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Progress Scorecard</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Seven dimensions of your dating growth — with trend arrows and coaching notes on what each one means.</p>
          </motion.div>

          {/* Overall */}
          <motion.div {...fadeUp(0.04)} className="glass border border-[hsl(248_62%_52%/0.2)] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground/60 font-semibold uppercase tracking-wider mb-1">Overall Score</p>
                <p className="text-5xl font-bold text-foreground">{overall}<span className="text-xl text-muted-foreground/40">/100</span></p>
                <p className="text-sm text-muted-foreground mt-1">Based on {DIMENSIONS.length} tracked dimensions</p>
              </div>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">Strongest</p>
                  <p className="text-sm font-semibold" style={{ color: topDim.color }}>{topDim.label}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">Growing fastest</p>
                  <p className="text-sm font-semibold text-[hsl(142_55%_65%)]">{growingDim.label}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.06)} className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl border border-white/8 bg-white/3">
            <Info className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/60 leading-relaxed">Scores are based on your logged entries, tool usage, and observed patterns. They update as you engage. Expand any dimension to understand what the number means in practice.</p>
          </motion.div>

          <div className="space-y-3">
            {DIMENSIONS.map((dim, i) => <DimensionCard key={dim.key} dim={dim} i={i} />)}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
