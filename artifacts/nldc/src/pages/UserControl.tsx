import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Check, X, Edit2, Trash2, Download, EyeOff, Eye, AlertTriangle, Lock } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

type InsightStatus = "approved" | "proposed" | "ignored";
type Insight = {
  id: string;
  text: string;
  source: string;
  updated: string;
  category: string;
  status: InsightStatus;
};

const SEED: Insight[] = [
  { id: "i1", text: "You reflect best on dates when you've journaled the same day.", source: "Progress Timeline", updated: "2 days ago", category: "Pattern", status: "approved" },
  { id: "i2", text: "Direct messages feel safer to you than playful ones.", source: "Message Coach", updated: "5 days ago", category: "Style", status: "approved" },
  { id: "i3", text: "Your bio over-indexes on humour vs. depth.", source: "Glow-Up", updated: "1 week ago", category: "Profile", status: "approved" },
  { id: "i4", text: "Sunday evenings feel low-energy — you may want to avoid date plans then.", source: "Pattern Board", updated: "Just now", category: "Rhythm", status: "proposed" },
  { id: "i5", text: "You re-engage best 48 hours after first contact, not 24.", source: "Pattern Board", updated: "Just now", category: "Rhythm", status: "proposed" },
  { id: "i6", text: "Past messages suggest you avoid asking direct questions.", source: "Insights Import", updated: "3 weeks ago", category: "Style", status: "ignored" },
];

const OPT_INS = [
  { id: "wellness", label: "Use my Wellness Center entries", desc: "Let the 8 dimensions inform tool outputs across the app." },
  { id: "progress", label: "Use my progress notes & patterns", desc: "Tools may reference recurring themes from your timeline." },
  { id: "messaging", label: "Use saved messaging style data", desc: "Coach uses your past tone preferences in suggestions." },
  { id: "blueprint", label: "Use approved Blueprint insights", desc: "Other tools may pull from your dating blueprint." },
];

export default function UserControl() {
  useMeta(
    "User Control",
    "You control what is saved. Preview proposed insights, approve or ignore them, edit, export, or delete anything at any time.",
  );
  const { toast } = useToast();
  const [items, setItems] = useState<Insight[]>(SEED);
  const [opts, setOpts] = useState<Record<string, boolean>>({ wellness: true, progress: true, messaging: false, blueprint: true });

  const approved = items.filter(i => i.status === "approved");
  const proposed = items.filter(i => i.status === "proposed");
  const ignored = items.filter(i => i.status === "ignored");

  const setStatus = (id: string, status: InsightStatus, msg: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status, updated: "Just now" } : i));
    toast({ title: msg });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(approved, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "nldc-insights.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export started", description: "Your approved insights downloaded as JSON." });
  };

  const handleDeleteAll = () => {
    setItems([]);
    toast({ title: "All cleared", description: "Every insight on this page has been removed." });
  };

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(142_55%_60%/0.2)] text-xs font-medium text-[hsl(142_55%_72%)] mb-3">
              <Shield className="w-3 h-3" /> User Control
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">Your data, your call.</h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Nothing becomes part of your profile until you approve it. Edit, delete, export, or opt out — any time.
            </p>
          </motion.div>

          {/* Trust copy */}
          <motion.div {...fadeUp(0.05)} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: Lock, c: "hsl(142 55% 60%)", t: "You control what's saved", d: "Approve before anything is kept." },
              { icon: Shield, c: "hsl(190 55% 60%)", t: "Private content is not sold", d: "Your inputs never leave your account." },
              { icon: Eye, c: "hsl(43 65% 65%)", t: "Future additions are opt-in", d: "New data sources stay off by default." },
              { icon: EyeOff, c: "hsl(248 62% 52%)", t: "De-identification on request", d: "Strip your name and metadata anytime." },
            ].map((it, i) => {
              const Icon = it.icon;
              return (
                <div key={i} className="glass-strong rounded-xl p-4 border border-white/5">
                  <Icon className="w-4 h-4 mb-2" style={{ color: it.c }} />
                  <p className="text-sm font-semibold text-foreground leading-tight">{it.t}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{it.d}</p>
                </div>
              );
            })}
          </motion.div>

          {/* Proposed (preview-before-save) */}
          <motion.div {...fadeUp(0.1)} className="glass-strong rounded-2xl p-5 sm:p-6 border border-[hsl(43_65%_65%/0.25)]">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-[hsl(43_65%_72%)]" />
              <h2 className="font-serif text-xl font-semibold">Proposed insights</h2>
              <span className="status-pill status-warning">Preview before saving</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">These were generated from your activity. Nothing here is saved to your profile until you approve it.</p>
            {proposed.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No proposed insights right now.</p>
            ) : (
              <div className="space-y-2">
                {proposed.map(i => (
                  <div key={i.id} className="rounded-xl p-4 bg-[hsl(248_45%_157%)] border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`proposed-${i.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{i.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">From {i.source} · {i.updated} · {i.category}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" onClick={() => setStatus(i.id, "approved", "Insight approved and saved.")} className="tap-target rounded-full bg-[hsl(142_55%_60%/0.15)] text-[hsl(142_55%_72%)] hover:bg-[hsl(142_55%_60%/0.25)] border border-[hsl(142_55%_60%/0.3)]"><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(i.id, "ignored", "Insight ignored — won't be used.")} className="tap-target rounded-full"><X className="w-3.5 h-3.5 mr-1" />Ignore</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Saved insights */}
          <motion.div {...fadeUp(0.15)} className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold">Saved insights ({approved.length})</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExport} className="rounded-full"><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
                <Button size="sm" variant="outline" onClick={handleDeleteAll} className="rounded-full text-[hsl(348_55%_72%)] hover:text-[hsl(348_55%_72%)]"><Trash2 className="w-3.5 h-3.5 mr-1" />Clear all</Button>
              </div>
            </div>
            {approved.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nothing approved yet — proposed insights will appear above when your activity generates them.</p>
            ) : (
              <div className="space-y-2">
                {approved.map(i => (
                  <div key={i.id} className="rounded-xl p-4 bg-[hsl(248_45%_157%)] border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`saved-${i.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{i.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="text-[hsl(142_55%_72%)]">●</span> {i.source} · last updated {i.updated} · {i.category}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => toast({ title: "Edit coming soon", description: "Inline editing arrives in the next update." })} aria-label="Edit"><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setStatus(i.id, "ignored", "Insight removed from your profile.")} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Ignored */}
          {ignored.length > 0 && (
            <motion.div {...fadeUp(0.2)} className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5 opacity-80">
              <h2 className="font-serif text-lg font-semibold mb-1">Ignored ({ignored.length})</h2>
              <p className="text-xs text-muted-foreground mb-3">These won't be referenced by any tool. You can restore them anytime.</p>
              <div className="space-y-2">
                {ignored.map(i => (
                  <div key={i.id} className="rounded-xl p-3 bg-[hsl(248_45%_160%)] border border-white/5 flex items-center gap-3">
                    <p className="text-xs text-muted-foreground flex-1 leading-relaxed line-through">{i.text}</p>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, "approved", "Insight restored.")} className="rounded-full text-xs">Restore</Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Opt-in toggles */}
          <motion.div {...fadeUp(0.25)} className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5">
            <h2 className="font-serif text-xl font-semibold mb-1">Source controls</h2>
            <p className="text-xs text-muted-foreground mb-4">Choose which sources tools may reference. Off = the tool ignores it completely.</p>
            <div className="space-y-3">
              {OPT_INS.map(o => (
                <div key={o.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[hsl(248_45%_157%)] border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{o.desc}</p>
                  </div>
                  <Switch
                    checked={opts[o.id] ?? false}
                    onCheckedChange={(v) => { setOpts(prev => ({ ...prev, [o.id]: v })); toast({ title: v ? `${o.label} enabled.` : `${o.label} turned off.` }); }}
                    data-testid={`switch-${o.id}`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
