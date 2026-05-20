import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { FileText, Image, MessageCircle, Calendar, Activity, Globe, NotebookPen, Wrench, Shield } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

type Status = "Available" | "Needs setup" | "Coming soon" | "Disabled";

const STATUS_STYLES: Record<Status, { bg: string; text: string; dot: string }> = {
  "Available":    { bg: "hsl(142 55% 60% / 0.15)", text: "hsl(142 55% 72%)", dot: "hsl(142 55% 60%)" },
  "Needs setup":  { bg: "hsl(43 65% 65% / 0.15)",  text: "hsl(43 65% 72%)",  dot: "hsl(43 65% 65%)" },
  "Coming soon":  { bg: "hsl(190 55% 60% / 0.15)", text: "hsl(190 55% 72%)", dot: "hsl(190 55% 60%)" },
  "Disabled":     { bg: "hsl(232 18% 28% / 0.4)",  text: "hsl(220 10% 70%)", dot: "hsl(220 10% 55%)" },
};

const SOURCES = [
  { key: "profile",    label: "Profile Content",       icon: FileText,     sensitivity: "Low",      status: "Available" as Status,
    could: "Audit your bio and prompts, surface stylistic patterns, and suggest rewrites that sound like you.",
    optIn: "Your bio text stays in your account. You approve every saved insight." },
  { key: "screenshots",label: "Uploaded Screenshots",  icon: Image,        sensitivity: "Medium",   status: "Coming soon" as Status,
    could: "Read your dating-app screenshots to spot recurring conversation gaps without you typing anything.",
    optIn: "Off by default. You'd upload one at a time. Images are processed in-session and discarded unless you approve." },
  { key: "convos",     label: "Selected Conversations",icon: MessageCircle,sensitivity: "Medium",   status: "Needs setup" as Status,
    could: "Coach across longer threads, find tone drift, and suggest reset messages with full context.",
    optIn: "You'd paste in only the threads you want analysed. Nothing is fetched automatically." },
  { key: "schedule",   label: "Schedule Rhythm",       icon: Calendar,     sensitivity: "Medium",   status: "Coming soon" as Status,
    could: "Detect your high-energy windows and suggest date timing that fits your real week.",
    optIn: "Calendar access stays read-only and event titles are never read or stored." },
  { key: "lifestyle",  label: "Lifestyle Signals",     icon: Activity,     sensitivity: "High",     status: "Disabled" as Status,
    could: "Use sleep, movement, or focus patterns to ground readiness check-ins.",
    optIn: "Off by default and disabled in this build. No live integrations." },
  { key: "public",     label: "Public Presence",       icon: Globe,        sensitivity: "Medium",   status: "Coming soon" as Status,
    could: "Show how your visible presence reads at a glance — and one or two small adjustments.",
    optIn: "Only links you choose to share. No scraping, no third-party data brokers." },
  { key: "manual",     label: "Manual Reflections",    icon: NotebookPen,  sensitivity: "Low",      status: "Available" as Status,
    could: "Capture your own observations and feed them into the rest of the app.",
    optIn: "Always under your control — edit, delete, export at any time." },
  { key: "future",     label: "Future Tools",          icon: Wrench,       sensitivity: "Varies",   status: "Coming soon" as Status,
    could: "Voice notes, image-based mood check-ins, or other ways to add context with less typing.",
    optIn: "Every new tool will ship off-by-default and require explicit opt-in." },
];

export default function FutureConnections() {
  useMeta(
    "Future Connections",
    "What the app could connect to next — what each source helps with, how sensitive it is, and the controls we'd ship with it.",
  );

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(190_55%_60%/0.2)] text-xs font-medium text-[hsl(190_55%_72%)] mb-3">
              <Wrench className="w-3 h-3" /> Future Connections
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">What we'd <span className="gradient-text-violet">consider next.</span></h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed mb-4">
              A clear look at the data sources and product capabilities we're thinking about. None are connected to live services in this build. Every future source ships off by default and requires explicit opt-in.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(232_38%_15%)] border border-white/5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
              Demo-only status panel. No active integrations.
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {SOURCES.map((s, i) => {
              const Icon = s.icon;
              const sty = STATUS_STYLES[s.status];
              return (
                <motion.div
                  key={s.key}
                  {...fadeUp(0.04 + i * 0.03)}
                  className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5"
                  data-testid={`source-${s.key}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-foreground/80" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif text-lg font-semibold leading-tight">{s.label}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Sensitivity: {s.sensitivity}</p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: sty.bg, color: sty.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sty.dot }} />
                      {s.status}
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Could help with</p>
                      <p className="text-sm text-foreground leading-relaxed">{s.could}</p>
                    </div>
                    <div className="pt-3 border-t border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55%_72%)] mb-1 flex items-center gap-1"><Shield className="w-2.5 h-2.5" />Your control</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.optIn}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div {...fadeUp(0.4)} className="mt-8 glass-strong rounded-2xl p-5 sm:p-7 border border-white/5">
            <h3 className="font-serif text-xl font-semibold mb-1">Founder readiness panel</h3>
            <p className="text-xs text-muted-foreground mb-4">Status labels only — no live services are connected in this build.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {[
                ["Auth", "Coming soon"],
                ["Payments", "Needs setup"],
                ["AI Provider", "Available"],
                ["Vector Storage", "Coming soon"],
                ["File Uploads", "Coming soon"],
                ["Scheduling", "Disabled"],
                ["Email Sending", "Needs setup"],
                ["Analytics", "Available"],
              ].map(([n, st], i) => {
                const sty = STATUS_STYLES[st as Status];
                return (
                  <div key={i} className="rounded-xl bg-[hsl(232_38%_15%)] border border-white/5 p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{n}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: sty.bg, color: sty.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sty.dot }} />{st}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
