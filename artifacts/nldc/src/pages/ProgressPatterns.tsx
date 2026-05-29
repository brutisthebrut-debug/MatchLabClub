import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Zap, Target, Repeat, Info } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface PatternCard {
  category: "theme" | "strength" | "friction" | "opportunity";
  title: string;
  description: string;
  frequency: number;
  lastSeen: string;
  suggestedAction?: string;
}

const CATEGORY_CONFIG = {
  theme: { label: "Repeated Theme", icon: Repeat, color: "hsl(var(--brand-indigo))", bg: "hsl(var(--brand-indigo) / 0.08)", border: "hsl(var(--brand-indigo) / 0.2)" },
  strength: { label: "Strength", icon: TrendingUp, color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.08)", border: "hsl(var(--brand-green) / 0.2)" },
  friction: { label: "Friction Point", icon: AlertTriangle, color: "hsl(var(--brand-gold))", bg: "hsl(var(--brand-gold) / 0.08)", border: "hsl(var(--brand-gold) / 0.2)" },
  opportunity: { label: "Improvement Opp.", icon: Target, color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.08)", border: "hsl(190 55% 60% / 0.2)" },
};

const DEMO_PATTERNS: PatternCard[] = [
  {
  category: "theme",
  title: "Over-explaining in early conversations",
  description: "You've noted this pattern three times across different connections. It tends to show up when you feel uncertain about how things are landing, the explaining is managing anxiety, not adding information.",
  frequency: 3,
  lastSeen: "3 days ago",
  suggestedAction: "Try the 'say less, let them come' experiment this week on your next new conversation.",
  },
  {
  category: "strength",
  title: "Feeling like yourself when things go well",
  description: "When you've logged wins, 'felt like myself' is a common phrase. This is more significant than it sounds, a lot of people never relax enough in early dating to show up as themselves. You have this capacity.",
  frequency: 4,
  lastSeen: "5 days ago",
  },
  {
  category: "friction",
  title: "Self-selecting out before giving it a chance",
  description: "You've noted a tendency to match but not engage, or to disengage early before information is available. This may be a protective pattern, deciding pre-emptively so you can't be rejected.",
  frequency: 2,
  lastSeen: "8 days ago",
  suggestedAction: "Give one 'not sure' match one more interaction before closing it off.",
  },
  {
  category: "strength",
  title: "Waiting out the urge to over-reach",
  description: "You've noted this twice, feeling the urge to check in early or over-pursue, and choosing not to. The restraint is working. The connection that came back was more grounded for the wait.",
  frequency: 2,
  lastSeen: "10 days ago",
  },
  {
  category: "opportunity",
  title: "Bio and profile haven't kept up with self-awareness",
  description: "Your understanding of yourself has developed significantly over the last few weeks, but your profile was written earlier. There may be a gap between who you are now and what your profile communicates.",
  frequency: 1,
  lastSeen: "12 days ago",
  suggestedAction: "Run your updated bio through the Mirror Profile or Glow-Up Studio.",
  },
  {
  category: "theme",
  title: "Anxiety loop when things go quiet",
  description: "Multiple entries reference a quiet period triggering a spike in uncertainty. The loop: quiet → assume the worst → urge to reach out → managing the urge → more quiet → repeat.",
  frequency: 3,
  lastSeen: "1 week ago",
  suggestedAction: "Try naming the feeling as anxiety rather than acting on it. Track what actually happens when you wait.",
  },
  {
  category: "opportunity",
  title: "More evidence of what you want when things work",
  description: "Your win entries give you more information than your setback entries. The things you note after a good interaction, ease, feeling seen, shared humor, are the actual data about what works for you.",
  frequency: 4,
  lastSeen: "5 days ago",
  suggestedAction: "Log one thing after your next good interaction about why it felt good specifically.",
  },
];

const ORDER: PatternCard["category"][] = ["strength", "theme", "friction", "opportunity"];

function PatternCardComp({ card, i }: { card: PatternCard; i: number }) {
  const cfg = CATEGORY_CONFIG[card.category];
  const Icon = cfg.icon;
  return (
  <motion.div {...fadeUp(0.04 * i)} className="rounded-2xl border overflow-hidden" style={{ borderColor: cfg.border, background: cfg.bg }}>
  <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: cfg.border }}>
  <div className="flex items-center gap-2">
  <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
  </div>
  <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
  <span>{card.frequency}× noted</span>
  <span>·</span>
  <span>{card.lastSeen}</span>
  </div>
  </div>
  <div className="px-5 py-4">
  <p className="font-semibold text-foreground text-sm mb-2">{card.title}</p>
  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
  {card.suggestedAction && (
  <div className="mt-3 flex items-start gap-2.5">
  <Zap className="w-3.5 h-3.5 text-[hsl(248_62%_52%)] flex-shrink-0 mt-0.5" />
  <p className="text-xs text-[hsl(248_62%_62%)] leading-relaxed">{card.suggestedAction}</p>
  </div>
  )}
  </div>
  </motion.div>
  );
}

export default function ProgressPatterns() {
  useMeta("Pattern Board", "Cards summarizing repeated themes, strengths, friction points, and improvement opportunities from your logged entries.");

  const grouped = ORDER.reduce((acc, cat) => {
  acc[cat] = DEMO_PATTERNS.filter(p => p.category === cat);
  return acc;
  }, {} as Record<PatternCard["category"], PatternCard[]>);

  let globalIdx = 0;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[340px] h-[340px] top-10 right-0 opacity-20 pointer-events-none" />
  <div className="max-w-3xl mx-auto relative z-10">
  <motion.div {...fadeUp()} className="mb-8">
  <div className="flex items-center gap-2 mb-2">
  <Repeat className="w-4 h-4 text-[hsl(248_62%_52%)]" />
  <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Progress Workspace</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">Pattern Board</h1>
  <p className="text-muted-foreground mt-2">A summary of what keeps showing up across your logged entries, strengths worth building on, themes worth naming, friction points worth understanding, and opportunities worth acting on.</p>
  </motion.div>

  {/* Disclaimer */}
  <motion.div {...fadeUp(0.04)} className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-[hsl(43_65%_65%/0.2)] bg-[hsl(43_65%_65%/0.06)]">
  <Info className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground leading-relaxed">Patterns here are based on your <span className="text-foreground/70 font-semibold">Timeline entries</span>. The more you log, the more specific and useful these become. Current view includes sample entries.</p>
  </motion.div>

  {/* Stats strip */}
  <motion.div {...fadeUp(0.06)} className="grid grid-cols-4 gap-3 mb-7">
  {ORDER.map(cat => {
  const cfg = CATEGORY_CONFIG[cat];
  const count = grouped[cat].length;
  return (
  <div key={cat} className="glass border border-white/8 rounded-xl px-3 py-3 text-center">
  <p className="text-xl font-bold" style={{ color: cfg.color }}>{count}</p>
  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cfg.label}{count !== 1 ? "s" : ""}</p>
  </div>
  );
  })}
  </motion.div>

  {/* Cards by category */}
  <div className="space-y-8">
  {ORDER.map(cat => {
  const cards = grouped[cat];
  if (!cards.length) return null;
  const cfg = CATEGORY_CONFIG[cat];
  return (
  <div key={cat}>
  <div className="flex items-center gap-2 mb-3">
  <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
  <p className="text-sm font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}s</p>
  </div>
  <div className="space-y-3">
  {cards.map((card) => <PatternCardComp key={card.title} card={card} i={globalIdx++} />)}
  </div>
  </div>
  );
  })}
  </div>
  </div>
  </div>
  </AppLayout>
  );
}
