import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Settings, Shield, Database, UserX, ChevronRight, Check, AlertTriangle } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface Toggle {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
}

interface ControlSection {
  id: string;
  icon: typeof Settings;
  title: string;
  color: string;
  toggles: Toggle[];
  footer?: string;
}

const INITIAL_SECTIONS: ControlSection[] = [
  {
    id: "saving",
    icon: Database,
    title: "Saving Entries",
    color: "hsl(190 55% 60%)",
    footer: "Your entries are stored locally in your browser and never sent to any server unless you explicitly enable sync.",
    toggles: [
      { id: "save-timeline",     label: "Save Timeline notes",          desc: "Store your dated entries between sessions",                    enabled: true },
      { id: "save-experiments",  label: "Save Experiment status",       desc: "Remember which experiments you've tried and how they went",    enabled: true },
      { id: "save-followups",    label: "Save Follow-Up answers",       desc: "Keep your answers to follow-up check questions",               enabled: true },
      { id: "save-scorecard",    label: "Save Scorecard progress",      desc: "Preserve your dimension scores across sessions",               enabled: false },
    ],
  },
  {
    id: "personalization",
    icon: Settings,
    title: "Personalization",
    color: "hsl(268 52% 68%)",
    footer: "Personalization uses only what you've entered in this session. No profile is built without your logged data.",
    toggles: [
      { id: "suggest-experiments", label: "Suggest experiments from my entries", desc: "Generate relevant experiment ideas based on your Timeline patterns", enabled: true },
      { id: "adapt-feed",          label: "Adapt my Learning Feed",              desc: "Prioritize feed cards based on your most recent patterns",           enabled: true },
      { id: "followup-auto",       label: "Auto-generate follow-ups",            desc: "Create follow-up questions from new Timeline entries",               enabled: false },
    ],
  },
  {
    id: "anonymous",
    icon: Shield,
    title: "Anonymous Learning",
    color: "hsl(142 55% 60%)",
    footer: "If you opt in, only aggregated statistical patterns — never your text or identity — contribute to improving coaching quality across all users. You can opt out at any time.",
    toggles: [
      { id: "anon-patterns",   label: "Contribute to pattern research",      desc: "Share anonymized patterns (never your text) to improve coaching accuracy", enabled: false },
      { id: "anon-benchmarks", label: "Include me in score benchmarking",    desc: "Your scores help set benchmarks for what's typical — no identifying data", enabled: false },
    ],
  },
];

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-[hsl(268_52%_58%)]" : "bg-white/15"}`}
      style={{ width: "40px", height: "22px" }}>
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-0"}`} />
    </button>
  );
}

export default function ProgressControl() {
  useMeta("Control Center · MatchLab Club", "Settings for saving entries, personalization, anonymous learning, and data deletion.");
  const [sections, setSections] = useState<ControlSection[]>(INITIAL_SECTIONS);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  function setToggle(sectionId: string, toggleId: string, value: boolean) {
    setSections(prev => prev.map(s =>
      s.id !== sectionId ? s : {
        ...s,
        toggles: s.toggles.map(t => t.id !== toggleId ? t : { ...t, enabled: value })
      }
    ));
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[300px] h-[300px] top-16 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative z-10">

          <motion.div {...fadeUp()} className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-medium text-[hsl(268_52%_78%)]">Progress Workspace</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Control Center</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">You decide what's saved, what's used for personalization, and what (if anything) contributes to broader learning. Every toggle defaults to what protects you.</p>
          </motion.div>

          {sections.map((section, si) => {
            const Icon = section.icon;
            return (
              <motion.div key={section.id} {...fadeUp(0.05 + si * 0.06)} className="glass border border-white/8 rounded-2xl overflow-hidden mb-4">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${section.color}20` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: section.color }} />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{section.title}</p>
                </div>
                <div className="divide-y divide-white/5">
                  {section.toggles.map(toggle => (
                    <div key={toggle.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground/90 leading-snug">{toggle.label}</p>
                        <p className="text-xs text-muted-foreground/60 leading-relaxed mt-0.5">{toggle.desc}</p>
                      </div>
                      <ToggleSwitch enabled={toggle.enabled} onChange={v => setToggle(section.id, toggle.id, v)} />
                    </div>
                  ))}
                </div>
                {section.footer && (
                  <div className="px-5 py-3 bg-white/2 border-t border-white/5">
                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed">{section.footer}</p>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Deletion */}
          <motion.div {...fadeUp(0.25)} className="glass border border-[hsl(348_55%_65%/0.2)] rounded-2xl overflow-hidden mb-4">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[hsl(348_55%_65%/0.1)]">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(348_55%_65%/0.12)]">
                <UserX className="w-3.5 h-3.5 text-[hsl(348_55%_65%)]" />
              </div>
              <p className="font-semibold text-sm text-foreground">Data Deletion</p>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Request deletion of all your stored entries and preferences. This cannot be undone. Deletion is processed within 30 days.
              </p>
              {!deleteRequested ? (
                <Button onClick={() => setDeleteRequested(true)} variant="outline"
                  className="rounded-full border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_70%)] hover:bg-[hsl(348_55%_65%/0.1)] hover:border-[hsl(348_55%_65%/0.6)] transition-all">
                  Request deletion
                </Button>
              ) : !deleteConfirmed ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-[hsl(43_65%_65%/0.3)] bg-[hsl(43_65%_65%/0.08)]">
                    <AlertTriangle className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">This will delete your Timeline, Experiments, Follow-Ups, and Scorecard data permanently. Are you sure?</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setDeleteConfirmed(true)} size="sm"
                      className="rounded-full bg-[hsl(348_55%_50%)] hover:bg-[hsl(348_55%_45%)] text-white border-0">
                      Yes, delete everything
                    </Button>
                    <Button onClick={() => setDeleteRequested(false)} size="sm" variant="ghost" className="rounded-full text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[hsl(142_55%_60%/0.2)] bg-[hsl(142_55%_60%/0.07)]">
                  <Check className="w-4 h-4 text-[hsl(142_55%_60%)]" />
                  <p className="text-xs text-muted-foreground">Deletion request submitted. Your data will be removed within 30 days.</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.3)} className="text-center">
            <p className="text-xs text-muted-foreground/40 leading-relaxed">
              Questions? <span className="underline underline-offset-2 cursor-pointer hover:text-muted-foreground/60 transition-colors">Contact support</span>
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
