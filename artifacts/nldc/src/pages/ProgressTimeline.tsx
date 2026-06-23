import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { WelcomePanel } from "@/components/WelcomePanel";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Clock, Tag, CheckCircle2, Circle, Minus, X, ChevronDown, ChevronUp } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type EntryTag = "insight" | "win" | "pattern" | "growth" | "setback" | "question";
type EntryStatus = "noted" | "working-on" | "resolved";

interface TimelineEntry {
  id: string;
  date: string;
  note: string;
  tags: EntryTag[];
  status: EntryStatus;
}

const TAG_CONFIG: Record<EntryTag, { label: string; color: string; bg: string }> = {
  insight: { label: "Insight", color: "hsl(var(--brand-indigo))", bg: "hsl(var(--brand-indigo) / 0.12)" },
  win: { label: "Win", color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.12)" },
  pattern: { label: "Pattern", color: "hsl(var(--brand-gold))", bg: "hsl(var(--brand-gold) / 0.12)" },
  growth: { label: "Growth", color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.12)" },
  setback: { label: "Setback", color: "hsl(var(--brand-rose))", bg: "hsl(var(--brand-rose) / 0.12)" },
  question: { label: "Question", color: "hsl(326 100% 65%)", bg: "hsl(326 100% 65% / 0.12)" },
};

const STATUS_CONFIG: Record<EntryStatus, { label: string; icon: typeof Circle; color: string }> = {
  "noted": { label: "Noted", icon: Circle, color: "hsl(228 18% 60%)" },
  "working-on": { label: "Working on", icon: Minus, color: "hsl(var(--brand-gold))" },
  "resolved": { label: "Resolved", icon: CheckCircle2, color: "hsl(var(--brand-green))" },
};

const DEMO_ENTRIES: TimelineEntry[] = [
  { id: "1", date: "2026-05-18", note: "Noticed I tend to over-explain myself in early conversations, probably a form of managing anxiety. Going to try saying less and letting them come toward me.", tags: ["pattern", "insight"], status: "working-on" },
  { id: "2", date: "2026-05-15", note: "Had a really good first date, felt like myself the whole time, didn't perform. She reached out the next morning. This is what it's supposed to feel like.", tags: ["win", "growth"], status: "resolved" },
  { id: "3", date: "2026-05-12", note: "Matched with three promising people this week but only replied to one. Need to look at whether I'm self-selecting out before giving things a chance.", tags: ["pattern", "question"], status: "working-on" },
  { id: "4", date: "2026-05-08", note: "Rewrote my Hinge bio using the Glow-Up Studio, the 'less generic' version felt the most true. Sent it live. Curious to see how it changes match quality.", tags: ["growth", "insight"], status: "noted" },
  { id: "5", date: "2026-05-03", note: "Got anxious when he didn't reply for two days. Noticed the urge to check in early, waited it out. He replied and the conversation was better for it.", tags: ["growth", "win"], status: "resolved" },
];

const ALL_TAGS: EntryTag[] = ["insight", "win", "pattern", "growth", "setback", "question"];
const ALL_STATUSES: EntryStatus[] = ["noted", "working-on", "resolved"];

function TagChip({ tag, small = false }: { tag: EntryTag; small?: boolean }) {
  const cfg = TAG_CONFIG[tag];
  return (
  <span className={`inline-flex items-center rounded-full font-medium ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
  style={{ background: cfg.bg, color: cfg.color }}>
  {cfg.label}
  </span>
  );
}

function StatusChip({ status, onClick }: { status: EntryStatus; onClick?: () => void }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
  <button onClick={onClick}
  className="inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 border transition-all hover:opacity-80"
  style={{ color: cfg.color, borderColor: `${cfg.color}33`, background: `${cfg.color}0d` }}>
  <Icon className="w-3 h-3" />{cfg.label}
  </button>
  );
}

function EntryCard({ entry, onStatusChange, onDelete }: {
  entry: TimelineEntry;
  onStatusChange: (id: string, s: EntryStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const cycleStatus = () => {
  const idx = ALL_STATUSES.indexOf(entry.status);
  onStatusChange(entry.id, ALL_STATUSES[(idx + 1) % ALL_STATUSES.length]);
  };

  return (
  <motion.div layout className="glass border border-white/8 rounded-2xl p-5 hover:border-white/12 transition-all">
  <div className="flex items-start justify-between gap-3 mb-2">
  <div className="flex items-center gap-2 flex-wrap">
  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
  <Clock className="w-3 h-3" />{date}
  </span>
  {entry.tags.map(t => <TagChip key={t} tag={t} small />)}
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">
  <StatusChip status={entry.status} onClick={cycleStatus} />
  <button onClick={() => onDelete(entry.id)} className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
  <X className="w-3.5 h-3.5" />
  </button>
  </div>
  </div>
  <p className={`text-sm text-foreground/80 leading-relaxed ${!expanded && entry.note.length > 160 ? "line-clamp-3" : ""}`}>
  {entry.note}
  </p>
  {entry.note.length > 160 && (
  <button onClick={() => setExpanded(e => !e)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground mt-1.5 flex items-center gap-1">
  {expanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />More</>}
  </button>
  )}
  </motion.div>
  );
}

export default function ProgressTimeline() {
  useMeta("My Timeline", "Your personal log of dated notes, observations, wins, and patterns, sorted chronologically.");
  const [entries, setEntries] = useState<TimelineEntry[]>(DEMO_ENTRIES);
  const [hasAdded, setHasAdded] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTags, setNewTags] = useState<EntryTag[]>([]);
  const [newStatus, setNewStatus] = useState<EntryStatus>("noted");
  const [filterTag, setFilterTag] = useState<EntryTag | null>(null);
  const [filterStatus, setFilterStatus] = useState<EntryStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !hasAdded;

  function handleAdd() {
  if (!newNote.trim()) return;
  const entry: TimelineEntry = {
  id: Date.now().toString(),
  date: new Date().toISOString().split("T")[0],
  note: newNote.trim(),
  tags: newTags,
  status: newStatus,
  };
  setEntries(prev => [entry,...prev]);
  setHasAdded(true);
  setNewNote(""); setNewTags([]); setNewStatus("noted"); setAdding(false);
  }

  function handleStatusChange(id: string, status: EntryStatus) {
  setEntries(prev => prev.map(e => e.id === id ? {...e, status } : e));
  }

  function handleDelete(id: string) {
  setEntries(prev => prev.filter(e => e.id !== id));
  }

  function toggleTag(tag: EntryTag) {
  setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  const filtered = entries.filter(e => {
  if (filterTag && !e.tags.includes(filterTag)) return false;
  if (filterStatus && e.status !== filterStatus) return false;
  return true;
  });

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  return (
  <AppLayout>
  <HubTabs hub="growth" />
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[340px] h-[340px] -top-10 right-0 opacity-20 pointer-events-none" />
  <div className="max-w-2xl mx-auto relative z-10">
  <motion.div {...fadeUp()} className="mb-8">
  <div className="flex items-center gap-2 mb-2">
  <Clock className="w-4 h-4 text-[hsl(248_62%_52%)]" />
  <p className="text-sm font-medium text-[hsl(248_62%_62%)]">Progress Workspace</p>
  </div>
  <h1 className="text-3xl font-bold text-foreground">My Timeline</h1>
  <p className="text-muted-foreground mt-2">A personal log of your observations, wins, patterns, and questions, sorted by date. Tap a status chip to cycle through stages.</p>
  </motion.div>

  {/* ── Package Hub Strip. Growth Tracker ── */}
  <div className="glass border rounded-xl px-4 py-3 mb-7 flex flex-wrap items-center gap-x-4 gap-y-2"
  style={{ borderColor: "hsl(var(--brand-green) / 0.2)" }}>
  <div className="flex items-center gap-2 flex-shrink-0">
  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)]" />
  <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(142_55%_72%)]">Growth Tracker</span>
  <span className="hidden sm:inline text-[11px] text-muted-foreground/55">, track what's actually changing</span>
  </div>
  <div className="flex flex-wrap gap-1.5 items-center">
  <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
  {[
  { name: "Wins Log", href: "/progress/wins" },
  { name: "Pattern Breaker", href: "/progress/pattern-breaker" },
  { name: "Weekly Plan", href: "/copilot/weekly-plan" },
  { name: "Scorecard", href: "/progress/scorecard" },
  { name: "Post-Date Reflect",href: "/reflection" },
  ].map(t => (
  <Link key={t.href} href={t.href}
  className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors whitespace-nowrap">
  {t.name}
  </Link>
  ))}
  </div>
  </div>

  {isBrandNewUser && (
  <WelcomePanel
  icon={<Clock className="w-6 h-6 text-primary" />}
  eyebrow="Welcome to your Timeline"
  title="Start your dating timeline"
  description="Add your first observation, win, or pattern. Over time you'll see the threads connecting, what's shifting, what's stuck, what's working."
  testId="timeline-empty-state"
  />
  )}

  {/* Filters + Add */}
  <motion.div {...fadeUp(0.05)} className="flex flex-wrap items-center gap-2 mb-5">
  <span className="text-xs text-muted-foreground/50 font-semibold uppercase tracking-wider mr-1">Filter:</span>
  {ALL_TAGS.map(t => (
  <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)}
  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${filterTag === t ? "border-[hsl(248_62%_52%/0.4)] bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_65%)]" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
  {TAG_CONFIG[t].label}
  </button>
  ))}
  {ALL_STATUSES.map(s => (
  <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}
  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${filterStatus === s ? "border-[hsl(43_65%_65%/0.4)] bg-[hsl(43_65%_65%/0.12)] text-[hsl(43_65%_80%)]" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
  {STATUS_CONFIG[s].label}
  </button>
  ))}
  <button onClick={() => { setFilterTag(null); setFilterStatus(null); }}
  className="text-xs text-muted-foreground/40 hover:text-muted-foreground ml-1 transition-colors">clear</button>
  <div className="ml-auto">
  <Button onClick={() => setAdding(a => !a)} size="sm"
  className="rounded-full px-4 h-8 text-xs font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0">
  <Plus className="w-3.5 h-3.5 mr-1" />Add entry
  </Button>
  </div>
  </motion.div>

  {/* Add form */}
  <AnimatePresence>
  {adding && (
  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
  className="glass border border-[hsl(248_62%_52%/0.25)] rounded-2xl p-5 mb-5 space-y-4">
  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">What's on your mind?</Label>
  <Textarea placeholder="A pattern you noticed, a win, an observation, a question you're sitting with…"
  value={newNote} onChange={e => setNewNote(e.target.value)}
  className="min-h-[90px] resize-none bg-[hsl(248_40%_95%)] border-white/10 text-foreground placeholder:text-muted-foreground/40" />
  <div className="flex flex-wrap gap-2">
  {ALL_TAGS.map(t => (
  <button key={t} onClick={() => toggleTag(t)}
  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${newTags.includes(t) ? "border-[hsl(248_62%_52%/0.4)] bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_65%)]" : "border-white/10 text-muted-foreground"}`}>
  <Tag className="w-2.5 h-2.5 inline mr-1" />{TAG_CONFIG[t].label}
  </button>
  ))}
  </div>
  <div className="flex items-center gap-3">
  <span className="text-xs text-muted-foreground/60">Status:</span>
  {ALL_STATUSES.map(s => (
  <button key={s} onClick={() => setNewStatus(s)}
  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${newStatus === s ? "border-[hsl(43_65%_65%/0.4)] bg-[hsl(43_65%_65%/0.12)] text-[hsl(43_65%_80%)]" : "border-white/10 text-muted-foreground"}`}>
  {STATUS_CONFIG[s].label}
  </button>
  ))}
  </div>
  <div className="flex gap-2">
  <Button onClick={handleAdd} disabled={!newNote.trim()} size="sm"
  className="rounded-full px-5 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0 disabled:opacity-40">
  Save entry
  </Button>
  <Button onClick={() => setAdding(false)} size="sm" variant="ghost" className="rounded-full text-muted-foreground">
  Cancel
  </Button>
  </div>
  </motion.div>
  )}
  </AnimatePresence>

  {/* Count */}
  <motion.div {...fadeUp(0.08)} className="flex items-center justify-between mb-4">
  <p className="text-xs text-muted-foreground">{sorted.length} {sorted.length === 1 ? "entry" : "entries"}</p>
  </motion.div>

  {/* Timeline */}
  <div className="relative">
  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/6" />
  <div className="space-y-4">
  {sorted.length === 0 ? (
  <div className="text-center py-12 text-muted-foreground text-sm">No entries match your filter.</div>
  ) : sorted.map((entry, i) => (
  <motion.div key={entry.id} {...fadeUp(0.04 * i)} className="flex gap-4">
  <div className="w-5 h-5 rounded-full bg-[hsl(248_62%_52%/0.2)] border border-[hsl(248_62%_52%/0.4)] flex-shrink-0 mt-4 z-10" />
  <div className="flex-1 min-w-0">
  <EntryCard entry={entry} onStatusChange={handleStatusChange} onDelete={handleDelete} />
  </div>
  </motion.div>
  ))}
  </div>
  </div>
  </div>
  </div>
  </AppLayout>
  );
}
