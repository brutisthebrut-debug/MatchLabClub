import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Map, Lock, Clock, CheckCircle2, Lightbulb, Shield, TrendingUp, Users, Compass, Info } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type RoadmapStatus = "live" | "coming-soon" | "planned" | "concept";

interface RoadmapItem {
  id: string;
  icon: typeof Map;
  title: string;
  description: string;
  userControl: string;
  status: RoadmapStatus;
  category: string;
}

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  "live":        { label: "Live",         color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.12)", border: "hsl(142 55% 60% / 0.3)", icon: CheckCircle2 },
  "coming-soon": { label: "Coming soon",  color: "hsl(248 62% 52%)", bg: "hsl(248 62% 52% / 0.12)", border: "hsl(248 62% 52% / 0.3)", icon: Clock        },
  "planned":     { label: "Planned",      color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.12)",  border: "hsl(43 65% 65% / 0.3)",  icon: TrendingUp   },
  "concept":     { label: "Concept",      color: "hsl(228 18% 60%)", bg: "hsl(228 18% 60% / 0.1)",  border: "hsl(228 18% 60% / 0.25)", icon: Lightbulb   },
};

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: "anon-trends", icon: TrendingUp, category: "Anonymous Learning",
    title: "Anonymous Trend Learning",
    description: "Aggregated (never individual) patterns from opted-in users help improve coaching accuracy over time. For example: if a common language pattern predicts a certain communication style, that improves how we coach it — without your data being identifiable.",
    userControl: "Fully opt-in. You choose whether to contribute. You can withdraw at any time and request deletion of your contribution.",
    status: "coming-soon",
  },
  {
    id: "benchmarks", icon: Users, category: "Anonymous Learning",
    title: "Score Benchmarking",
    description: "Anonymous score distributions let you understand what's typical — not to compare yourself to others, but to calibrate. 'Is a 68 in self-trust unusual?' becomes answerable with aggregate data.",
    userControl: "Opt-in per dimension. You can benchmark some dimensions and not others.",
    status: "planned",
  },
  {
    id: "recs", icon: Lightbulb, category: "Improved Recommendations",
    title: "Smarter Experiment Suggestions",
    description: "As your profile of preferences, patterns, and experiment outcomes builds, suggested experiments become more specific to you — not generic coaching advice.",
    userControl: "Powered entirely by your own logged data. No external data involved.",
    status: "coming-soon",
  },
  {
    id: "followup-smart", icon: CheckCircle2, category: "Improved Recommendations",
    title: "Adaptive Follow-Up Questions",
    description: "Follow-ups that adapt based on what you've already answered — avoiding repetition and going deeper on the threads that seem most active for you.",
    userControl: "Based on your responses only. You can disable this and receive generic follow-ups instead.",
    status: "planned",
  },
  {
    id: "compat-tools", icon: Compass, category: "Compatibility Tools",
    title: "Compatibility Pattern Engine",
    description: "Beyond the current Compatibility Compass, a fuller pattern-matching tool that learns from what you've described as working and not working — and gets more accurate as your log grows.",
    userControl: "Learns only from your entries. Nothing is inferred from external data or other users.",
    status: "planned",
  },
  {
    id: "communication-deep", icon: TrendingUp, category: "Compatibility Tools",
    title: "Communication Fit Predictor",
    description: "Based on your Communication Style Map results and your logged interaction outcomes, predict which communication styles are likely to complement yours vs. create friction.",
    userControl: "You can review and delete the interaction data this uses at any time.",
    status: "concept",
  },
  {
    id: "ai-brain", icon: Map, category: "Living AI Brain",
    title: "Full Living AI Brain Layer",
    description: "All workspace components — Timeline, Pattern Board, Scorecard, Feed, Experiments — connected and learning from each other. Your patterns inform your scorecard. Your scorecard informs your feed. Your feed informs your experiments. A complete coaching loop.",
    userControl: "Each component has its own controls. You can participate in parts of the system without enabling others.",
    status: "coming-soon",
  },
  {
    id: "privacy-audit", icon: Shield, category: "Privacy & Control",
    title: "Full Privacy Audit Log",
    description: "A readable log of exactly what data MatchLab Club has stored for you, when it was created, and what (if anything) has been shared. Complete transparency at any time.",
    userControl: "Available on demand. You can request a full export or deletion from within the audit log.",
    status: "planned",
  },
];

const CATEGORIES = [...new Set(ROADMAP_ITEMS.map(r => r.category))];

function RoadmapCard({ item, i }: { item: RoadmapItem; i: number }) {
  const Icon = item.icon;
  const scfg = STATUS_CONFIG[item.status];
  const SIcon = scfg.icon;

  return (
    <motion.div {...fadeUp(0.04 + i * 0.04)} className="glass border border-white/8 rounded-2xl overflow-hidden hover:border-white/12 transition-all">
      <div className="flex items-start gap-4 p-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.12)]">
          <Icon className="w-4 h-4 text-[hsl(248_62%_52%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="font-semibold text-sm text-foreground leading-snug">{item.title}</p>
            <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
              style={{ color: scfg.color, borderColor: scfg.border, background: scfg.bg }}>
              <SIcon className="w-3 h-3" />{scfg.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{item.description}</p>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[hsl(142_55%_60%/0.15)] bg-[hsl(142_55%_60%/0.06)]">
            <Lock className="w-3 h-3 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed"><span className="text-[hsl(142_55%_70%)] font-medium">Your control: </span>{item.userControl}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProgressInsightsRoadmap() {
  useMeta("Insights Roadmap · MatchLab Club", "What's coming to the MatchLab Club Living AI Brain — with explicit user control language for every feature.");

  const statuses: RoadmapStatus[] = ["live", "coming-soon", "planned", "concept"];
  const counts = statuses.reduce((acc, s) => ({ ...acc, [s]: ROADMAP_ITEMS.filter(r => r.status === s).length }), {} as Record<RoadmapStatus, number>);

  let gi = 0;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-16 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Map className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Insights Roadmap</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">What's being built into the Living AI Brain — with full transparency about what each feature learns, uses, and who controls it.</p>
          </motion.div>

          {/* Promise */}
          <motion.div {...fadeUp(0.04)} className="mb-6 flex items-start gap-3 px-4 py-4 rounded-xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_60%/0.06)]">
            <Shield className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Our commitment on every feature</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Every capability on this roadmap defaults to off, uses your data only, and explains exactly what it needs and why. No dark patterns. No silent data use. If it involves anyone else's data, it says so and requires explicit opt-in.</p>
            </div>
          </motion.div>

          {/* Status counts */}
          <motion.div {...fadeUp(0.06)} className="grid grid-cols-4 gap-3 mb-7">
            {statuses.map(s => {
              const scfg = STATUS_CONFIG[s];
              return (
                <div key={s} className="glass border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold" style={{ color: scfg.color }}>{counts[s]}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{scfg.label}</p>
                </div>
              );
            })}
          </motion.div>

          <motion.div {...fadeUp(0.08)} className="mb-6 flex items-start gap-2 px-3 py-3 rounded-lg border border-white/6 bg-white/2">
            <Info className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">Each card includes a "Your control" line explaining exactly what opt-in is required and what you can withdraw.</p>
          </motion.div>

          {/* By category */}
          <div className="space-y-8">
            {CATEGORIES.map(cat => {
              const items = ROADMAP_ITEMS.filter(r => r.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(248_62%_52%)]" />
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(248_62%_62%)]">{cat}</p>
                  </div>
                  <div className="space-y-3">
                    {items.map(item => <RoadmapCard key={item.id} item={item} i={gi++} />)}
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
