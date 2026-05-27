import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, Layers, MessageSquare, BookOpen, TrendingUp, Sparkles, Plus } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const SECTIONS = [
  {
    key: "wellness",
    title: "From Wellness Center",
    icon: Sparkles,
    color: "hsl(43 65% 65%)",
    href: "/wellness",
    insights: [
      { text: "Stronger in the emotional and intellectual dimensions; lighter on social breadth.", tag: "Pattern" },
      { text: "Evenings are a low-energy window — daytime dates fit better.", tag: "Rhythm" },
    ],
  },
  {
    key: "blueprint",
    title: "From Dating Blueprint",
    icon: BookOpen,
    color: "hsl(248 62% 52%)",
    href: "/blueprint",
    insights: [
      { text: "Reflective–curious archetype; warm and slow to open up.", tag: "Identity" },
      { text: "Looking for steady connection without losing your routine.", tag: "Goal" },
    ],
  },
  {
    key: "progress",
    title: "From Growth Tracker",
    icon: TrendingUp,
    color: "hsl(142 55% 60%)",
    href: "/progress/timeline",
    insights: [
      { text: "You reflect best within 24 hours of a date.", tag: "Habit" },
      { text: "Re-engagement attempts after 48h convert more than 24h.", tag: "Timing" },
    ],
  },
  {
    key: "messages",
    title: "From Messaging Tools",
    icon: MessageSquare,
    color: "hsl(190 55% 60%)",
    href: "/coach",
    insights: [
      { text: "Direct tone feels safer to you than playful, especially when re-engaging.", tag: "Style" },
      { text: "Your messages over-index on questions vs. statements — keep balanced.", tag: "Style" },
    ],
  },
];

export default function LifeContext() {
  useMeta(
    "Life Context Profile",
    "Approved insights from across your activity, in one place. Based only on what you choose to share and approve.",
  );

  const total = SECTIONS.reduce((n, s) => n + s.insights.length, 0);

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(248_62%_52%/0.2)] text-xs font-medium text-[hsl(248_62%_62%)] mb-3">
              <Layers className="w-3 h-3" /> Life Context Profile
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">The picture of you — <span className="gradient-text-violet">as you've shared it.</span></h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed mb-4">
              One place to see every insight you've approved across the app. Nothing here appears until you say yes.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(248_45%_157%)] border border-white/5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
              Based only on what you choose to share and approve.
            </div>
          </motion.div>

          {total === 0 ? (
            <motion.div {...fadeUp(0.1)} className="glass-strong rounded-2xl p-8 sm:p-12 border border-white/5 text-center">
              <div className="w-14 h-14 rounded-full bg-[hsl(248_62%_52%/0.15)] mx-auto mb-4 flex items-center justify-center">
                <Plus className="w-6 h-6 text-[hsl(248_62%_62%)]" />
              </div>
              <h2 className="font-serif text-2xl font-semibold mb-2">Nothing here yet</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                Start by entering a few things manually — your blueprint, a progress note, or a wellness reflection. Anything you approve will appear here.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild className="rounded-full"><Link href="/blueprint">Build my Blueprint</Link></Button>
                <Button asChild variant="outline" className="rounded-full"><Link href="/wellness">Open Wellness Center</Link></Button>
                <Button asChild variant="outline" className="rounded-full"><Link href="/progress/timeline">Add a note</Link></Button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div key={s.key} {...fadeUp(0.05 + i * 0.04)} className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5" data-testid={`section-${s.key}`}>
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color.replace(")", " / 0.15)") }}>
                          <Icon className="w-4 h-4" style={{ color: s.color }} />
                        </div>
                        <h3 className="font-serif text-lg font-semibold">{s.title}</h3>
                      </div>
                      <Button asChild size="sm" variant="ghost" className="rounded-full text-xs flex-shrink-0">
                        <Link href={s.href}>Open <ArrowRight className="w-3 h-3 ml-1" /></Link>
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {s.insights.map((it, idx) => (
                        <li key={idx} className="rounded-xl bg-[hsl(248_45%_157%)] border border-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                          <p className="text-sm text-foreground flex-1 leading-relaxed">{it.text}</p>
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 text-muted-foreground flex-shrink-0 self-start sm:self-auto">{it.tag}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          )}

          <motion.div {...fadeUp(0.3)} className="mt-6 glass-strong rounded-2xl p-5 sm:p-6 border border-[hsl(142_55%_60%/0.2)]">
            <h3 className="font-serif text-lg font-semibold mb-1">Want to add or remove anything?</h3>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">User Control lets you approve, edit, ignore, or export everything on this page.</p>
            <Button asChild className="rounded-full"><Link href="/user-control">Open User Control <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
