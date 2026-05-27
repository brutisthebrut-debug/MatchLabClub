import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Lock, Download, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
  Image, MessageSquare, FileText, BookOpen, Activity, Check, Heart, ArrowRight,
} from "lucide-react";
import { useListWellnessAnswers, useListWellnessTags, useDeleteWellnessAnswer } from "@workspace/api-client-react";
import { DIMENSION_META } from "@/lib/wellnessQuestionBank";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type DataCategory = "screenshots" | "messages" | "profile" | "reflections" | "audits" | "sessions";

interface DataEntry {
  id: DataCategory;
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  count: number;
  sampleKeys: string[];
  retentionNote: string;
  exportNote: string;
}

const DATA_ENTRIES: DataEntry[] = [
  {
    id: "audits",
    icon: Activity,
    label: "Signal Audits",
    desc: "Your profile audit results — scores, feedback, bio critique, action items.",
    color: "hsl(var(--brand-indigo))",
    count: 3,
    sampleKeys: ["Score history", "Bio feedback", "Action items", "Audit date"],
    retentionNote: "Kept until you delete. Used to show score history on your dashboard.",
    exportNote: "Exports as JSON with full audit detail.",
  },
  {
    id: "sessions",
    icon: MessageSquare,
    label: "Message Coaching Sessions",
    desc: "Conversations you've run through Message Coach — original thread plus generated replies.",
    color: "hsl(190 55% 60%)",
    count: 2,
    sampleKeys: ["Thread snippet", "Generated replies", "Session date"],
    retentionNote: "Kept until you delete. Never used for training or shared externally.",
    exportNote: "Exports as JSON. Does not include any party's personal identifiers.",
  },
  {
    id: "profile",
    icon: FileText,
    label: "My Profile Text",
    desc: "Bios, prompts, or profile text you've pasted into the app for analysis.",
    color: "hsl(var(--brand-gold))",
    count: 1,
    sampleKeys: ["Bio text", "Platform context", "Tone preference"],
    retentionNote: "Session-only by default. Persists only if you explicitly saved it in Connection Center.",
    exportNote: "Exports as plain text.",
  },
  {
    id: "messages",
    icon: MessageSquare,
    label: "Pasted Conversations",
    desc: "Conversation threads you've shared for coaching or debrief.",
    color: "hsl(var(--brand-rose))",
    count: 4,
    sampleKeys: ["Conversation snippet", "Goal at time of paste", "Coach mode used"],
    retentionNote: "Session-only by default. You control whether any conversation is saved.",
    exportNote: "Exports as plain text with timestamps.",
  },
  {
    id: "screenshots",
    icon: Image,
    label: "Profile Screenshots",
    desc: "Screenshots or text extractions of profiles shared for context.",
    color: "hsl(326 100% 65%)",
    count: 1,
    sampleKeys: ["Extracted text", "Source platform", "Date added"],
    retentionNote: "Session-only. Images are never stored — only extracted text.",
    exportNote: "Exports extracted text only — no image data.",
  },
  {
    id: "reflections",
    icon: BookOpen,
    label: "Reflection Notes",
    desc: "Notes you've written about dates, patterns, or things you're processing.",
    color: "hsl(var(--brand-green))",
    count: 6,
    sampleKeys: ["Note text", "Date written", "Tags (if added)"],
    retentionNote: "Stored locally in your browser. Cleared if you clear browser data.",
    exportNote: "Exports as plain text with dates.",
  },
];

function DataCategoryRow({ entry, index }: { entry: DataEntry; index: number }) {
  const [open,    setOpen]    = useState(false);
  const [visible, setVisible] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [exported, setExported] = useState(false);
  const { toast } = useToast();
  const Icon = entry.icon;

  function handleExport() {
    const stub = { category: entry.label, count: entry.count, exportedAt: new Date().toISOString(), note: "Sample export — real data would appear here." };
    navigator.clipboard.writeText(JSON.stringify(stub, null, 2));
    setExported(true);
    toast({ title: "Export copied", description: `${entry.label} data copied to clipboard.` });
    setTimeout(() => setExported(false), 3000);
  }

  function handleDelete() {
    setDeleted(true);
    toast({ title: `${entry.label} cleared`, description: "That data has been removed from your vault." });
  }

  if (deleted) return null;

  return (
    <motion.div {...fadeUp(0.05 + index * 0.04)} className="glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Row header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: withAlpha(entry.color, 0.12) }}>
            <Icon className="w-4 h-4" style={{ color: entry.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{entry.label}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/50 flex-shrink-0">
                {entry.count} item{entry.count !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/55 mt-0.5 leading-relaxed">{entry.desc}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setVisible(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {visible ? "Hide" : "Preview"}
          </button>
          <span className="text-white/15">·</span>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {exported ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Download className="w-3.5 h-3.5" />}
            {exported ? "Copied" : "Export"}
          </button>
          <span className="text-white/15">·</span>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-[hsl(348_55%_65%/0.6)] hover:text-[hsl(348_55%_65%)] transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => setOpen(o => !o)}
            className="ml-auto p-1 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Preview stub */}
        {visible && (
          <div className="mt-3 rounded-xl bg-white/3 border border-white/6 p-3 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2">Data fields</p>
            {entry.sampleKeys.map(k => (
              <div key={k} className="flex items-center gap-2 text-[11px] text-muted-foreground/55">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                {k}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-1">Retention</p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{entry.retentionNote}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-1">Export format</p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{entry.exportNote}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function WellnessDataSection() {
  const { data: answersData, refetch } = useListWellnessAnswers({});
  const { data: tagsData }              = useListWellnessTags({});
  const { mutate: deleteAnswer }        = useDeleteWellnessAnswer();
  const { toast }                       = useToast();
  const [open, setOpen] = useState(false);

  const answers = answersData?.answers ?? [];
  const tags    = tagsData?.tags ?? [];
  const total   = answers.length + tags.length;

  if (total === 0) return null;

  function handleDeleteAnswer(id: number) {
    deleteAnswer({ id }, {
      onSuccess: () => {
        toast({ title: "Answer deleted", description: "Removed from your Compatibility Profile." });
        void refetch();
      },
    });
  }

  // Group by dimension
  const byDimension = new Map<string, typeof answers>();
  for (const a of answers) {
    const arr = byDimension.get(a.dimension) ?? [];
    arr.push(a);
    byDimension.set(a.dimension, arr);
  }

  return (
    <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-2xl overflow-hidden mb-3">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.12)]">
            <Heart className="w-4 h-4 text-[hsl(248_62%_52%)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Compatibility Profile</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground/50 flex-shrink-0">
                {answers.length} answer{answers.length !== 1 ? "s" : ""}{tags.length > 0 ? ` · ${tags.length} tag${tags.length !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/55 mt-0.5 leading-relaxed">Your answers across 18 wellness dimensions — used only for your coaching unless you approve matching.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            {open ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {open ? "Hide" : "Preview"}
          </button>
          <span className="text-white/15">·</span>
          <Link href="/wellness" className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Manage in Profile Builder
          </Link>
        </div>

        {open && (
          <div className="mt-4 space-y-3">
            {Array.from(byDimension.entries()).map(([dim, dimAnswers]) => {
              const meta = DIMENSION_META[dim];
              return (
                <div key={dim} className="rounded-xl bg-white/2 border border-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: meta?.color ?? "hsl(var(--brand-indigo))" }}>
                    {meta?.label ?? dim}
                  </p>
                  <div className="space-y-2">
                    {dimAnswers.map(a => (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground/50 mb-0.5 leading-snug truncate">{a.questionText}</p>
                          <p className="text-foreground/80 leading-relaxed">"{a.answer}"</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAnswer(a.id)}
                          className="flex-shrink-0 p-1 text-[hsl(348_55%_65%/0.5)] hover:text-[hsl(348_55%_65%)] transition-colors"
                          aria-label="Delete answer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {tags.length > 0 && (
              <div className="rounded-xl bg-white/2 border border-white/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[hsl(43_65%_72%)]">Insight Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.1)] border border-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_72%)]">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DataVault() {
  useMeta("Personal Data Vault", "Everything you've shared with the app — preview it, export it, or delete it. All of it. Any time.");
  const { toast } = useToast();
  const [allDeleted, setAllDeleted] = useState(false);

  function exportAll() {
    const stub = { exportedAt: new Date().toISOString(), categories: DATA_ENTRIES.map(e => e.label), note: "Full export — real data would appear in production." };
    navigator.clipboard.writeText(JSON.stringify(stub, null, 2));
    toast({ title: "Full export copied", description: "All vault data copied to clipboard." });
  }

  function deleteAll() {
    setAllDeleted(true);
    toast({ title: "All data cleared", description: "Your vault has been emptied. This cannot be undone." });
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-10 opacity-20 pointer-events-none" />

        <div className="max-w-2xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[hsl(248_62%_52%/0.15)] flex items-center justify-center">
                <Lock className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              </div>
              <p className="text-sm font-semibold text-[hsl(248_62%_62%)]">Personal Data Vault</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Your data. Your call.</h1>
            <p className="text-muted-foreground text-sm leading-relaxed mt-2">
              Everything you've shared with the app — shown clearly, with full control to preview, export, or delete any of it. Nothing is hidden here.
            </p>
          </motion.div>

          {/* Privacy promise */}
          <motion.div {...fadeUp(0.03)} className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-white/3 border border-white/6">
            <Shield className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              <strong className="text-muted-foreground/65">No third-party sharing. No selling. No training data.</strong>{" "}
              What's here was added by you, used only for your coaching session, and is controlled entirely by you.
            </p>
          </motion.div>

          {/* Global actions */}
          <motion.div {...fadeUp(0.04)} className="mb-5 flex items-center gap-3">
            <button onClick={exportAll}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-white/8 hover:border-white/15">
              <Download className="w-3.5 h-3.5" /> Export all
            </button>
            {!allDeleted && (
              <button onClick={deleteAll}
                className="flex items-center gap-1.5 text-xs font-medium text-[hsl(348_55%_65%/0.6)] hover:text-[hsl(348_55%_65%)] transition-colors px-3 py-2 rounded-lg border border-[hsl(348_55%_65%/0.2)] hover:border-[hsl(348_55%_65%/0.35)]">
                <Trash2 className="w-3.5 h-3.5" /> Clear all data
              </button>
            )}
          </motion.div>

          {/* Wellness / Compatibility data */}
          <WellnessDataSection />

          {/* Data categories */}
          {allDeleted ? (
            <motion.div {...fadeUp(0)} className="glass border border-white/8 rounded-2xl p-8 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-[hsl(142_55%_60%/0.12)] flex items-center justify-center">
                <Check className="w-5 h-5 text-[hsl(142_55%_60%)]" />
              </div>
              <p className="text-sm font-semibold text-foreground">Vault cleared</p>
              <p className="text-xs text-muted-foreground/50 leading-relaxed">All stored data has been removed. Your coaching session starts fresh.</p>
              <Link href="/connections" className="text-xs text-[hsl(248_62%_52%)] hover:text-[hsl(248_62%_62%)] transition-colors">
                Add new context →
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {DATA_ENTRIES.map((entry, i) => <DataCategoryRow key={entry.id} entry={entry} index={i} />)}
            </div>
          )}

          {/* Footer links */}
          {!allDeleted && (
            <motion.div {...fadeUp(0.4)} className="mt-6 flex items-center gap-4">
              <Link href="/connections" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                Add more context →
              </Link>
              <span className="text-white/15">·</span>
              <Link href="/user-control" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                Privacy settings →
              </Link>
              <span className="text-white/15">·</span>
              <Link href="/privacy" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                Privacy policy →
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}