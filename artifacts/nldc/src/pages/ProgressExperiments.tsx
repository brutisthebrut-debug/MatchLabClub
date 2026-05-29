import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, Plus, X, CheckCircle2, XCircle, Clock, Sparkles, Info } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type ExperimentStatus = "planned" | "tried" | "helped" | "did-not-help";

interface Experiment {
  id: string;
  title: string;
  description: string;
  week: string;
  status: ExperimentStatus;
  custom?: boolean;
}

const STATUS_CONFIG: Record<ExperimentStatus, { label: string; color: string; bg: string; border: string }> = {
  "planned": { label: "Planned", color: "hsl(228 18% 65%)", bg: "hsl(228 18% 65% / 0.1)", border: "hsl(228 18% 65% / 0.25)" },
  "tried": { label: "Tried", color: "hsl(var(--brand-gold))", bg: "hsl(var(--brand-gold) / 0.1)", border: "hsl(var(--brand-gold) / 0.25)" },
  "helped": { label: "Helped", color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.1)", border: "hsl(var(--brand-green) / 0.25)" },
  "did-not-help": { label: "Didn't help", color: "hsl(var(--brand-rose))", bg: "hsl(var(--brand-rose) / 0.1)", border: "hsl(var(--brand-rose) / 0.25)" },
};

const ALL_STATUSES: ExperimentStatus[] = ["planned", "tried", "helped", "did-not-help"];

const DEMO_EXPERIMENTS: Experiment[] = [
  { id: "1", title: "Say less, let them come toward you", description: "In your next three conversations, stop at 80% of what you'd normally say. See if the other person fills the space, and if the conversation changes quality.", week: "Week of May 19", status: "tried" },
  { id: "2", title: "Reply after 20 minutes, not immediately", description: "When you feel the urge to reply instantly, wait 20 minutes first. This isn't game-playing, it's regulating your own nervous system and signaling ease.", week: "Week of May 19", status: "helped" },
  { id: "3", title: "Log one thing after each good interaction", description: "After an interaction that felt good, write down one specific thing that made it good. Build a real dataset of what works for you.", week: "Week of May 12", status: "helped" },
  { id: "4", title: "Give one 'not sure' match two more exchanges", description: "Before swiping away a match you're not sure about, give them two more exchanges. Some people need warmth to show it.", week: "Week of May 12", status: "did-not-help" },
  { id: "5", title: "Name anxiety as anxiety, not as evidence", description: "When silence makes you anxious, say internally: 'This is anxiety. It doesn't mean anything has changed.' Track how often you were right vs. the feeling.", week: "Week of May 5", status: "helped" },
  { id: "6", title: "Rewrite one prompt using your Glow-Up results", description: "Take the 'less generic' or 'direct' version from your Glow-Up Studio and put it live. Track match quality for 7 days.", week: "Week of May 26", status: "planned" },
];

let nextId = 100;

function StatusChip({ status, onClick }: { status: ExperimentStatus; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status];
  return (
  <button onClick={onClick}
  className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold px-3 py-1 border transition-all hover:opacity-80"
  style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}>
  {status === "helped" && <CheckCircle2 className="w-3 h-3" />}
  {status === "did-not-help" && <XCircle className="w-3 h-3" />}
  {status === "tried" && <Clock className="w-3 h-3" />}
  {status === "planned" && <Sparkles className="w-3 h-3" />}
  {cfg.label}
  </button>
  );
}

function ExperimentCard({ exp, onCycle, onDelete }: {
  exp: Experiment;
  onCycle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
  <motion.div layout className="glass border border-white/8 rounded-2xl p-5 hover:border-white/12 transition-all group">
  <div className="flex items-start justify-between gap-3 mb-2">
  <div>
  <p className="font-semibold text-sm text-foreground leading-snug">{exp.title}</p>
  <p className="text-[11px] text-muted-foreground/50 mt-0.5">{exp.week}</p>
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">
  <StatusChip status={exp.status} onClick={() => onCycle(exp.id)} />
  {exp.custom && (
  <button onClick={() => onDelete(exp.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-muted-foreground/70 transition-all">
  <X className="w-3.5 h-3.5" />
  </button>
  )}
  </div>
  </div>
  <p className="text-sm text-muted-foreground leading-relaxed">{exp.description}</p>
  </motion.div>
  );
}

export default function ProgressExperiments() {
  useMeta("Weekly Experiments · MatchLab Club", "Practical weekly experiments with status tracking, what you tried, what helped, what didn't.");
  const [experiments, setExperiments] = useState<Experiment[]>(DEMO_EXPERIMENTS);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [filterStatus, setFilterStatus] = useState<ExperimentStatus | null>(null);

  function cycleStatus(id: string) {
  setExperiments(prev => prev.map(e => {
  if (e.id !== id) return e;
  const idx = ALL_STATUSES.indexOf(e.status);
  return {...e, status: ALL_STATUSES[(idx + 1) % ALL_STATUSES.length] };
  }));
  }

  function deleteExperiment(id: string) {
  setExperiments(prev => prev.filter(e => e.id !== id));
  }

  function addExperiment() {
  if (!newTitle.trim()) return;
  const exp: Experiment = {
  id: String(nextId++),
  title: newTitle.trim(),
  description: newDesc.trim() || "Your custom experiment.",
  week: "Week of May 26",
  status: "planned",
  custom: true,
  };
  setExperiments(prev => [exp,...prev]);
  setNewTitle(""); setNewDesc(""); setAdding(false);
  }

  const filtered = filterStatus ? experiments.filter(e => e.status === filterStatus) : experiments;
  const helpedCount = experiments.filter(e => e.status === "helped").length;
  const triedCount = experiments.filter(e => e.status === "tried").length;

  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-teal fixed w-[300px] h-[300px] top-20 right-0 opacity-15 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">

  <motion.div {...fadeUp()} className="mb-8">
  <div className="flex items-center gap-2 mb-2">
  <FlaskConical className="w-4 h-4 text-[hsl(190_55%_60%)]" />
  <p className="text-sm font-medium text-[hsl(190_55%_70%)]">Progress Workspace</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">Weekly Experiments</h1>
  <p className="text-muted-foreground mt-2 leading-relaxed">Practical actions worth trying this week. Tap the status chip to move an experiment through your experience of it.</p>
  </motion.div>

  {/* Stats */}
  <motion.div {...fadeUp(0.04)} className="grid grid-cols-4 gap-3 mb-6">
  {ALL_STATUSES.map(s => {
  const cfg = STATUS_CONFIG[s];
  const count = experiments.filter(e => e.status === s).length;
  return (
  <div key={s} className="glass border border-white/8 rounded-xl p-3 text-center cursor-pointer hover:border-white/15 transition-all" onClick={() => setFilterStatus(filterStatus === s ? null : s)}>
  <p className="text-xl font-bold" style={{ color: cfg.color }}>{count}</p>
  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cfg.label}</p>
  </div>
  );
  })}
  </motion.div>

  {helpedCount > 0 && (
  <motion.div {...fadeUp(0.06)} className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_60%/0.07)]">
  <CheckCircle2 className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0" />
  <p className="text-xs text-muted-foreground"><span className="text-[hsl(142_55%_70%)] font-semibold">{helpedCount} experiment{helpedCount !== 1 ? "s" : ""} helped.</span> Each one gives you more data about what actually works for you.</p>
  </motion.div>
  )}

  {/* Info */}
  <motion.div {...fadeUp(0.07)} className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl border border-white/8 bg-white/3">
  <Info className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground/60 leading-relaxed">Tap any status chip to cycle: Planned → Tried → Helped → Didn't help → Planned</p>
  </motion.div>

  {/* Add */}
  <motion.div {...fadeUp(0.08)} className="flex items-center justify-between mb-5">
  <div className="flex gap-2">
  <button onClick={() => setFilterStatus(null)} className={`text-xs px-3 py-1 rounded-full border transition-all ${filterStatus === null ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>All</button>
  {ALL_STATUSES.map(s => (
  <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}
  className={`text-xs px-3 py-1 rounded-full border transition-all ${filterStatus === s ? "border-white/25 bg-white/8 text-foreground" : "border-white/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>
  {STATUS_CONFIG[s].label}
  </button>
  ))}
  </div>
  <Button onClick={() => setAdding(a => !a)} size="sm" className="rounded-full px-4 h-8 text-xs font-semibold bg-gradient-to-r from-[hsl(190_55%_50%)] to-[hsl(248_62%_60%)] border-0">
  <Plus className="w-3.5 h-3.5 mr-1" />Add
  </Button>
  </motion.div>

  <AnimatePresence>
  {adding && (
  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
  className="glass border border-[hsl(190_55%_60%/0.25)] rounded-2xl p-5 mb-5 space-y-3">
  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Experiment title…"
  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(190_55%_60%/0.4)]" />
  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What you'll try and why (optional)…"
  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[hsl(190_55%_60%/0.4)] h-20 resize-none" />
  <div className="flex gap-2">
  <Button onClick={addExperiment} disabled={!newTitle.trim()} size="sm"
  className="rounded-full px-5 font-semibold bg-gradient-to-r from-[hsl(190_55%_50%)] to-[hsl(248_62%_60%)] border-0 disabled:opacity-40">
  Add experiment
  </Button>
  <Button onClick={() => setAdding(false)} size="sm" variant="ghost" className="rounded-full text-muted-foreground">Cancel</Button>
  </div>
  </motion.div>
  )}
  </AnimatePresence>

  <div className="space-y-3">
  {filtered.map((exp, i) => (
  <motion.div key={exp.id} {...fadeUp(0.04 * i)}>
  <ExperimentCard exp={exp} onCycle={cycleStatus} onDelete={deleteExperiment} />
  </motion.div>
  ))}
  {filtered.length === 0 && (
  <div className="text-center py-12 text-muted-foreground/50 text-sm">No experiments match this filter.</div>
  )}
  </div>
  </div>
  </div>
  </AppLayout>
  );
}
