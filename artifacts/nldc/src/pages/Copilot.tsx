import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { AgentTasksPanel } from "@/components/AgentTasksPanel";
import { motion } from "framer-motion";
import {
  Sparkles, Zap, Star, MessageSquare, Heart,
  BarChart2, Calendar, Compass, Shield,
  MessageCircle, Wind, Palette, RefreshCw,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const QUICK_MOMENTS = [
  { icon: MessageCircle, color: "hsl(190 55% 60%)", label: "They Didn't Reply", hint: "Re-engage after quiet", href: "/next-message" },
  { icon: Sparkles, color: "hsl(var(--brand-gold))", label: "I Got a Match!", hint: "Write your first opener", href: "/copilot/reply" },
  { icon: Wind, color: "hsl(var(--brand-rose))", label: "I'm Spiraling", hint: "Ground yourself fast", href: "/blueprint" },
  { icon: Palette, color: "hsl(var(--brand-indigo))", label: "Sound More Like Me", hint: "Tone-match your rewrite", href: "/copilot/profile" },
  { icon: RefreshCw, color: "hsl(var(--brand-green))", label: "What Changed?", hint: "Check in on your progress", href: "/copilot/what-changed" },
];

const WORKFLOWS = [
  {
  icon: Zap,
  title: "Start My Reset",
  tagline: "Guided onboarding through your 5 core tools",
  steps: 5,
  color: "hsl(var(--brand-indigo))",
  href: "/copilot/reset",
  desc: "Signal Check → Blueprint → Profile → Messaging → Your Plan",
  },
  {
  icon: Star,
  title: "Improve My Profile",
  tagline: "Prioritized rewrite plan + copy-ready versions",
  steps: 2,
  color: "hsl(var(--brand-gold))",
  href: "/copilot/profile",
  desc: "Paste your profile, pick your platform and tone, get a rewrite",
  },
  {
  icon: MessageSquare,
  title: "Help Me Reply",
  tagline: "Context in, copy-ready options out",
  steps: 2,
  color: "hsl(190 55% 60%)",
  href: "/copilot/reply",
  desc: "Paste the thread, choose your goal, get 5 styled replies with rationale",
  },
  {
  icon: Heart,
  title: "Debrief What Happened",
  tagline: "Reflect, identify patterns, choose a next step",
  steps: 2,
  color: "hsl(var(--brand-rose))",
  href: "/copilot/debrief",
  desc: "After any interaction, capture what felt good or confusing while it's fresh",
  },
  {
  icon: BarChart2,
  title: "Weekly Growth Plan",
  tagline: "5 specific actions for the next 7 days",
  steps: 2,
  color: "hsl(var(--brand-green))",
  href: "/copilot/weekly-plan",
  desc: "Your goals + recent notes → a small, actionable checklist",
  },
  {
  icon: Calendar,
  title: "Prepare for a Date",
  tagline: "Practical prep card for any meetup",
  steps: 2,
  color: "hsl(326 100% 65%)",
  href: "/copilot/prep",
  desc: "Mindset, questions to ask, boundaries to know, follow-up plan",
  },
  {
  icon: Heart,
  title: "Flirt Coach",
  tagline: "Draft messages for any moment, flirting, consent, boundaries, exits",
  steps: 2,
  color: "hsl(var(--brand-rose))",
  href: "/copilot/flirt",
  desc: "Sex-positive, non-manipulative options for flirting, date asks, setting limits, or exiting clean",
  },
  {
  icon: Compass,
  title: "Founder Demo Journey",
  tagline: "Show the product to collaborators or early users",
  steps: 4,
  color: "hsl(228 18% 62%)",
  href: "/copilot/demo",
  desc: "A guided walkthrough with talking points for demos and partner previews",
  },
];

export default function Copilot() {
  useMeta("Wingman Studio", "Guided AI workflows for every situation, profile rewrites, reply coaching, date prep, weekly planning, and more.");
  return (
  <AppLayout>
  <div className="min-h-screen mesh-bg py-10 px-4">
  <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 right-0 opacity-25 pointer-events-none" />
  <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-20 pointer-events-none" />

  <div className="max-w-5xl mx-auto relative z-10">
  {/* Hero */}
  <motion.div {...fadeUp(0)} className="mb-8">
  <div className="flex items-center gap-2.5 mb-3">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] flex items-center justify-center shadow-[0_0_18px_hsl(248_62%_52%/0.4)]">
  <Sparkles className="w-4.5 h-4.5 text-white" />
  </div>
  <p className="text-sm font-semibold text-[hsl(248_62%_62%)]">Wingman Studio</p>
  </div>
  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Your AI Copilot</h1>
  <p className="text-muted-foreground max-w-xl leading-relaxed text-sm sm:text-base">
  Guided workflows for every situation, profile rewrites, reply coaching, date prep, and weekly planning.
  You choose what to use, save, or act on. Nothing happens without your say-so.
  </p>
  </motion.div>

  {/* Two-column layout: workflows + tasks panel */}
  <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">

  {/* Workflows grid */}
  <div>
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Choose a workflow</p>
  <div className="grid sm:grid-cols-2 gap-3">
  {WORKFLOWS.map((wf, i) => {
  const Icon = wf.icon;
  return (
  <motion.div key={wf.href} {...fadeUp(0.04 + i * 0.04)}>
  <Link href={wf.href}
  className="glass border border-white/8 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/15 hover:shadow-[0_8px_30px_rgb(0_0_0/0.35)] transition-all card-hover block h-full group">
  <div className="flex items-start justify-between gap-2">
  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
  style={{ background: `${withAlpha(wf.color, 0.15)}` }}>
  <Icon className="w-4 h-4" style={{ color: wf.color }} />
  </div>
  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-white/10 text-muted-foreground/40">
  {wf.steps} step{wf.steps !== 1 ? "s" : ""}
  </span>
  </div>
  <div className="flex-1">
  <p className="font-semibold text-foreground text-sm mb-1 group-hover:text-white transition-colors">{wf.title}</p>
  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{wf.desc}</p>
  </div>
  <p className="text-xs font-semibold transition-colors" style={{ color: wf.color }}>
  Start →
  </p>
  </Link>
  </motion.div>
  );
  })}
  </div>

  {/* Quick Moments */}
  <motion.div {...fadeUp(0.38)} className="mt-4">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2.5">Quick moments</p>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
  {QUICK_MOMENTS.map((qm) => (
  <Link key={qm.href} href={qm.href}>
  <div className="glass border border-white/8 rounded-xl p-3 hover:border-white/18 transition-all cursor-pointer text-center group">
  <div className="mb-1.5 flex justify-center"><qm.icon className="w-5 h-5" style={{ color: qm.color }} /></div>
  <p className="text-[11px] font-semibold text-foreground leading-tight group-hover:text-white transition-colors">{qm.label}</p>
  <p className="text-[10px] text-muted-foreground/55 mt-0.5 leading-tight">{qm.hint}</p>
  </div>
  </Link>
  ))}
  </div>
  </motion.div>

  {/* Safety copy */}
  <motion.div {...fadeUp(0.42)} className="mt-5 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
  <Shield className="w-4 h-4 text-muted-foreground/35 flex-shrink-0 mt-0.5" />
  <p className="text-xs text-muted-foreground/45 leading-relaxed">
  <strong className="text-muted-foreground/60">Coaching guidance, not clinical advice.</strong>{" "}
  Your Copilot works only from what you choose to share. Nothing is sent, saved externally, or acted on without your approval. You control every step.
  </p>
  </motion.div>
  </div>

  {/* Agent Tasks panel */}
  <motion.div {...fadeUp(0.08)} className="lg:sticky lg:top-24 order-first lg:order-last">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">Suggested starting points</p>
  <AgentTasksPanel />
  </motion.div>
  </div>
  </div>
  </div>
  </AppLayout>
  );
}