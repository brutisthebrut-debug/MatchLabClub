import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, CheckCircle2, SkipForward, Circle, Info, ChevronDown, ChevronUp } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type CheckStatus = "pending" | "answered" | "skipped";

interface FollowUp {
  id: string;
  linkedNote: string;
  linkedDate: string;
  question: string;
  status: CheckStatus;
  answer?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: "Pending",  color: "hsl(var(--brand-gold))",  bg: "hsl(var(--brand-gold) / 0.1)",  border: "hsl(var(--brand-gold) / 0.25)"  },
  answered: { label: "Answered", color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.1)", border: "hsl(var(--brand-green) / 0.25)" },
  skipped:  { label: "Skipped",  color: "hsl(228 18% 55%)", bg: "hsl(228 18% 55% / 0.1)", border: "hsl(228 18% 55% / 0.2)"  },
};

const DEMO_FOLLOW_UPS: FollowUp[] = [
  {
    id: "1", linkedDate: "May 18", linkedNote: "Noticed I over-explain in early conversations",
    question: "Did you try saying less this week? What actually happened when you stopped at 80%?",
    status: "answered",
    answer: "Tried it twice. First time felt weirdly uncomfortable — like I hadn't finished. But they asked a follow-up question which wouldn't have happened if I'd kept going. Second time felt more natural.",
  },
  {
    id: "2", linkedDate: "May 15", linkedNote: "Great first date — felt like myself the whole time",
    question: "What was one specific thing that helped you feel like yourself? Can you recreate that condition?",
    status: "pending",
  },
  {
    id: "3", linkedDate: "May 13", linkedNote: "Matched with three people but only replied to one",
    question: "What was the story you told yourself about the other two? Were those stories based on evidence or assumption?",
    status: "pending",
  },
  {
    id: "4", linkedDate: "May 8", linkedNote: "Rewrote bio using Glow-Up Studio",
    question: "After 10 days with the new bio live — has match quality changed? Are different people starting conversations?",
    status: "answered",
    answer: "Honestly yes — fewer matches but the ones I get seem to actually read the bio. Had two conversations that referenced something specific, which has never happened before.",
  },
  {
    id: "5", linkedDate: "May 3", linkedNote: "Anxious when he didn't reply for two days — waited it out",
    question: "The next time silence shows up, what will you tell yourself in the first hour?",
    status: "skipped",
  },
];

function FollowUpCard({ fu, onAnswer, onSkip }: {
  fu: FollowUp;
  onAnswer: (id: string, text: string) => void;
  onSkip: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(fu.answer ?? "");
  const cfg = STATUS_CONFIG[fu.status];

  return (
    <motion.div layout className="glass border border-white/8 rounded-2xl overflow-hidden hover:border-white/12 transition-all">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[11px] text-muted-foreground/50 mb-1">{fu.linkedDate} · <span className="italic">{fu.linkedNote}</span></p>
            <p className="text-sm font-medium text-foreground leading-snug">{fu.question}</p>
          </div>
          <span className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
            style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}>
            {cfg.label}
          </span>
        </div>

        {fu.status === "answered" && fu.answer && (
          <div className="mt-3 pl-3 border-l-2 border-[hsl(142_55%_60%/0.3)]">
            <p className="text-xs text-muted-foreground leading-relaxed">{fu.answer}</p>
          </div>
        )}

        {fu.status === "pending" && (
          <div className="mt-3">
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-xs text-[hsl(248_62%_52%)] hover:text-[hsl(248_62%_80%)] transition-colors font-medium">
              {open ? <><ChevronUp className="w-3 h-3" />Hide</>  : <><ChevronDown className="w-3 h-3" />Answer this</>}
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write your answer here — even a few words…"
                    className="mt-3 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(248_62%_52%/0.4)] resize-none h-24" />
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => { onAnswer(fu.id, draft); setOpen(false); }} disabled={!draft.trim()} size="sm"
                      className="rounded-full px-4 h-7 text-xs font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 disabled:opacity-40">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Save answer
                    </Button>
                    <Button onClick={() => { onSkip(fu.id); setOpen(false); }} size="sm" variant="ghost" className="rounded-full h-7 text-xs text-muted-foreground">
                      <SkipForward className="w-3 h-3 mr-1" />Skip
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ProgressFollowUp() {
  useMeta("Follow-Up Check · MatchLab Club", "Short follow-up questions tied to your notes and suggestions, with status tracking.");
  const [items, setItems] = useState<FollowUp[]>(DEMO_FOLLOW_UPS);
  const [filter, setFilter] = useState<CheckStatus | null>(null);

  function handleAnswer(id: string, text: string) {
    setItems(prev => prev.map(f => f.id === id ? { ...f, status: "answered" as CheckStatus, answer: text } : f));
  }
  function handleSkip(id: string) {
    setItems(prev => prev.map(f => f.id === id ? { ...f, status: "skipped" as CheckStatus } : f));
  }

  const pending  = items.filter(f => f.status === "pending").length;
  const answered = items.filter(f => f.status === "answered").length;
  const skipped  = items.filter(f => f.status === "skipped").length;
  const filtered = filter ? items.filter(f => f.status === filter) : items;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-20 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Follow-Up Check</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">Short questions tied to your notes and suggestions. Answering them builds a record of what's actually changing.</p>
          </motion.div>

          {/* Stats */}
          <motion.div {...fadeUp(0.04)} className="grid grid-cols-3 gap-3 mb-6">
            {([["pending", pending, "hsl(var(--brand-gold))"], ["answered", answered, "hsl(var(--brand-green))"], ["skipped", skipped, "hsl(228 18% 55%)"]] as const).map(([s, count, color]) => (
              <div key={s} className="glass border border-white/8 rounded-xl p-3 text-center cursor-pointer hover:border-white/15 transition-all" onClick={() => setFilter(filter === s ? null : s)}>
                <p className="text-2xl font-bold" style={{ color }}>{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{s}</p>
              </div>
            ))}
          </motion.div>

          <motion.div {...fadeUp(0.06)} className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl border border-white/8 bg-white/3">
            <Info className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/60 leading-relaxed">Follow-ups are generated from your Timeline entries and coaching results. Answers stay private to you — they're for your reflection, not our analysis.</p>
          </motion.div>

          {/* Filter */}
          <motion.div {...fadeUp(0.07)} className="flex gap-2 mb-5">
            <button onClick={() => setFilter(null)} className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === null ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>All</button>
            {(["pending", "answered", "skipped"] as CheckStatus[]).map(s => (
              <button key={s} onClick={() => setFilter(filter === s ? null : s)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === s ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </motion.div>

          <div className="space-y-3">
            {filtered.map((fu, i) => (
              <motion.div key={fu.id} {...fadeUp(0.04 * i)}>
                <FollowUpCard fu={fu} onAnswer={handleAnswer} onSkip={handleSkip} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground/50 text-sm">No items match this filter.</div>
            )}
          </div>

          {pending === 0 && answered > 0 && (
            <motion.div {...fadeUp(0.2)} className="mt-6 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_60%/0.07)]">
              <CheckCircle2 className="w-4 h-4 text-[hsl(142_55%_60%)]" />
              <p className="text-xs text-muted-foreground">All caught up. New follow-ups appear as you add timeline entries.</p>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
