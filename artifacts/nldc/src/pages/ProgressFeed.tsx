import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Rss, ThumbsUp, ThumbsDown, Copy, Check, Info, Sparkles } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type FeedCategory = "communication" | "emotion" | "progress" | "pattern" | "recommendation";

interface FeedCard {
  id: string;
  category: FeedCategory;
  headline: string;
  body: string;
  timeAgo: string;
  helpful?: boolean | null;
  copied?: boolean;
}

const CAT_CONFIG: Record<FeedCategory, { label: string; color: string; bg: string }> = {
  communication:  { label: "Communication",     color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.1)"  },
  emotion:        { label: "Emotional Pattern", color: "hsl(285 45% 65%)", bg: "hsl(285 45% 65% / 0.1)"  },
  progress:       { label: "Progress Signal",   color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.1)"  },
  pattern:        { label: "Repeated Theme",    color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.1)"   },
  recommendation: { label: "Suggestion",        color: "hsl(268 52% 68%)", bg: "hsl(268 52% 68% / 0.1)"  },
};

const DEMO_FEED: FeedCard[] = [
  {
    id: "1", category: "progress", timeAgo: "Today",
    headline: "You've logged 5 entries in the last 17 days",
    body: "Based on what you've logged, you're showing consistent self-observation — which is the foundation for actual change. Most people think about this stuff without writing it down. You're writing it down.",
    helpful: null,
  },
  {
    id: "2", category: "pattern", timeAgo: "2 days ago",
    headline: "Over-explaining appears in 3 of your last 5 notes",
    body: "This is based on what you've logged. When the same behavior appears across multiple entries and multiple situations, it's a signal worth naming — not as a flaw, but as a strategy that made sense at some point and may not be serving you now.",
    helpful: null,
  },
  {
    id: "3", category: "emotion", timeAgo: "3 days ago",
    headline: "Your anxiety loop is well-documented — that's useful",
    body: "You've described the quiet → assume-worst → urge-to-reach-out pattern twice now. Having a name for it is the first step to catching it in real time. What you're building is a gap between the trigger and the action.",
    helpful: true,
  },
  {
    id: "4", category: "communication", timeAgo: "5 days ago",
    headline: "Your win logs consistently mention 'ease' and 'felt like myself'",
    body: "From what you've logged, good interactions have a consistent texture. This is data — not a vague goal. Use it to filter: if ease isn't present, it's worth noticing early rather than explaining it away.",
    helpful: null,
  },
  {
    id: "5", category: "recommendation", timeAgo: "6 days ago",
    headline: "Your profile hasn't caught up with your self-awareness",
    body: "Based on the self-description entries you've added and the tools you've used, your bio may still reflect where you were when you wrote it — not who you are now. The Mirror Profile or Glow-Up Studio could help close that gap.",
    helpful: null,
  },
  {
    id: "6", category: "progress", timeAgo: "1 week ago",
    headline: "You're making decisions you feel better about in retrospect",
    body: "This is a subtle but important signal from your entries. When you log a decision and come back to it days later still feeling okay about it, you're building self-trust. That's slow and easy to miss — but it's exactly what's happening.",
    helpful: true,
  },
];

function FeedCardComp({ card, onRate }: { card: FeedCard; onRate: (id: string, h: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const cfg = CAT_CONFIG[card.category];

  async function copy() {
    const text = `${card.headline}\n\n${card.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this observation:", text);
    }
  }

  return (
    <motion.div layout className="glass border border-white/8 rounded-2xl overflow-hidden hover:border-white/12 transition-all">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5" style={{ background: cfg.bg }}>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="text-[11px] text-muted-foreground/50">{card.timeAgo}</span>
      </div>
      <div className="px-5 py-4">
        <p className="font-semibold text-sm text-foreground mb-2 leading-snug">{card.headline}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => onRate(card.id, true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${card.helpful === true ? "border-[hsl(142_55%_60%/0.4)] bg-[hsl(142_55%_60%/0.12)] text-[hsl(142_55%_70%)]" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground hover:border-white/20"}`}>
            <ThumbsUp className="w-3 h-3" />Useful
          </button>
          <button onClick={() => onRate(card.id, false)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${card.helpful === false ? "border-[hsl(348_55%_65%/0.4)] bg-[hsl(348_55%_65%/0.12)] text-[hsl(348_55%_75%)]" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground hover:border-white/20"}`}>
            <ThumbsDown className="w-3 h-3" />Not really
          </button>
          <button onClick={copy} className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            {copied ? <><Check className="w-3 h-3 text-[hsl(142_55%_60%)]" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProgressFeed() {
  useMeta("Learning Feed · NLDC", "Observation cards generated from your logged entries — what we're noticing, based only on what you share.");
  const [feed, setFeed] = useState<FeedCard[]>(DEMO_FEED);
  const [filter, setFilter] = useState<FeedCategory | null>(null);

  function handleRate(id: string, helpful: boolean) {
    setFeed(prev => prev.map(f => f.id === id ? { ...f, helpful } : f));
  }

  const filtered = filter ? feed.filter(f => f.category === filter) : feed;
  const categories = [...new Set(feed.map(f => f.category))];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-16 right-0 opacity-18 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Rss className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Learning Feed</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Observations based on what you log. Not analysis of you — reflections of the data you share.</p>
          </motion.div>

          <motion.div {...fadeUp(0.04)} className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-[hsl(268_52%_68%/0.2)] bg-[hsl(268_52%_68%/0.06)]">
            <Info className="w-4 h-4 text-[hsl(268_52%_68%)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground/80 font-semibold">All observations here are based on what you log.</span>{" "}
              We're not reading between the lines or drawing conclusions beyond your entries. Mark cards useful or not — it helps surface what's relevant.
            </p>
          </motion.div>

          {/* Category filter */}
          <motion.div {...fadeUp(0.06)} className="flex flex-wrap gap-2 mb-5">
            <button onClick={() => setFilter(null)} className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === null ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>All</button>
            {categories.map(cat => {
              const cfg = CAT_CONFIG[cat];
              return (
                <button key={cat} onClick={() => setFilter(filter === cat ? null : cat)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === cat ? "text-foreground border-white/25 bg-white/8" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>
                  {cfg.label}
                </button>
              );
            })}
          </motion.div>

          <div className="space-y-3">
            {filtered.map((card, i) => (
              <motion.div key={card.id} {...fadeUp(0.04 * i)}>
                <FeedCardComp card={card} onRate={handleRate} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground/50 text-sm">No cards match this filter.</div>
            )}
          </div>

          <motion.div {...fadeUp(0.3)} className="mt-8 flex items-center gap-2 px-4 py-3 rounded-xl border border-white/6 bg-white/2">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(268_52%_68%)]" />
            <p className="text-xs text-muted-foreground/50">Feed updates as you log more entries in your Timeline.</p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
