import { useState } from "react";
import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Sparkles, Headphones, Eye, Clock, FileText, Compass, MessageCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";
import { TrustBadge } from "@/components/TrustBadge";
import {
  useCreateAudit,
  useGenerateAuditReport,
  useSaveCompassRead,
  useCreateInsight,
  useAnalyzeInsight,
} from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Landing() {
  useMeta(
  "Free Dating Profile Audit & Message Coaching",
  "Find out what your dating profile is really saying, and get it rewritten. Free 3-min Signal Check or the full Profile Signal Audit. No account needed to start.",
  );
  return (
  <AppLayout>
  {/* ── Hero. ONE primary action; Audit positioned as the natural next step ── */}
  <section className="relative mesh-bg overflow-hidden pt-14 md:pt-20 pb-20 md:pb-28">
  <div className="orb orb-violet absolute w-[600px] h-[600px] -top-60 -right-60 opacity-80 pointer-events-none" />
  <div className="orb orb-gold absolute w-[400px] h-[400px] bottom-0 left-1/4 opacity-60 pointer-events-none" />
  <div className="orb orb-plum absolute w-[300px] h-[300px] top-40 left-0 opacity-70 pointer-events-none" />

  <div className="container mx-auto px-4 relative z-10">
  <div className="max-w-3xl mx-auto text-center">
  {/* Trust eyebrow */}
  <motion.div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(248_62%_52%/0.25)] mb-7" {...fadeUp(0.04)}>
  <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)] animate-pulse" />
  <span className="text-xs text-muted-foreground">Private beta · Founder reviews every report</span>
  </motion.div>

  {/* Monumental headline */}
  <motion.h1
  className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[0.98] mb-6"
  {...fadeUp(0.08)}
  >
  <span className="text-foreground">Stop being</span>{" "}
  <span className="gradient-text-violet italic">overlooked.</span>
  <br />
  <span className="text-foreground">Start being</span>{" "}
  <span className="gradient-text">chosen.</span>
  </motion.h1>

  <motion.p
  className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-9"
  {...fadeUp(0.15)}
  >
  Your <span className="text-foreground/80 font-medium">dating second brain.</span>
  </motion.p>

  {/* PRIMARY CTA, single, oversized, unmissable. Everything else lives below the proof. */}
  <motion.div className="flex flex-col items-center gap-4" {...fadeUp(0.22)}>
  <Button
  asChild
  size="lg"
  className="rounded-full font-semibold h-14 px-9 text-base bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_32px_hsl(248_62%_52%/0.45)] hover:scale-[1.02] transition-transform"
  data-testid="button-hero-signal-check"
  >
  <Link href="/signal-check">Get my free Signal Check <ArrowRight className="ml-2 h-5 w-5" /></Link>
  </Button>

  {/* Trust micro-row */}
  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
  <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 3 minutes</span>
  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
  <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> No account needed</span>
  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
  <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Instant result</span>
  </div>
  <p className="text-[11px] text-muted-foreground/70 mt-1">
  Built for every dating context: straight, gay, queer, bi, trans, non-binary, mono &amp; poly.
  </p>
  </motion.div>
  </div>

  {/* "What you'll get", supports the single CTA without competing for the click */}
  <motion.div
  className="max-w-2xl mx-auto mt-14 grid sm:grid-cols-2 gap-3 text-left"
  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 }}
  >
  {[
  { icon: Sparkles, text: "Your Signal Strength score (0–100)" },
  { icon: FileText, text: "The category your profile actually reads as" },
  { icon: CheckCircle, text: "Your #1 specific fix, not generic advice" },
  { icon: Headphones, text: "One rewritten line that shows what's possible" },
  ].map((item, i) => {
  const Icon = item.icon;
  return (
  <div key={i} className="flex items-start gap-3 p-3 rounded-xl glass-elevated">
  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.25)]">
  <Icon className="w-3.5 h-3.5 text-[hsl(248_62%_52%)]" />
  </div>
  <p className="text-sm text-foreground/85 leading-snug pt-0.5">{item.text}</p>
  </div>
  );
  })}
  </motion.div>
  </div>
  </section>

  {/* ── Interactive 3-tab preview ── */}
  <PreviewSection />

  {/* ── Cost anchor, what bad signal actually costs you ── */}
  <section className="py-16 md:py-20 border-t border-foreground/5 relative overflow-hidden">
  <div className="orb orb-plum absolute w-72 h-72 -right-32 top-10 opacity-40 pointer-events-none" />
  <div className="container mx-auto px-4 relative z-10">
  <motion.div className="text-center mb-10 max-w-2xl mx-auto" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(0_60%_60%)] mb-3">The math you're avoiding</p>
  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
  A bad profile isn't free. <span className="gradient-text italic">It's the most expensive thing on the apps.</span>
  </h2>
  <p className="text-sm text-muted-foreground/80 leading-relaxed">
  Most people pay for it in months, not dollars, and don't notice until they look back.
  </p>
  </motion.div>
  <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
  {[
  { stat: "300+", unit: "hours/year", desc: "Average time singles spend swiping, messaging, and going on dates that don't go anywhere.", color: "hsl(0 60% 55%)" },
  { stat: "~$420", unit: "spent on apps", desc: "What the average dater spends per year on premium tiers, boosts, and super-likes, all routed through a bio that isn't working.", color: "hsl(var(--brand-gold))" },
  { stat: "14–18", unit: "months lost", desc: "Typical gap between when something is broken in how you're presenting and when someone actually tells you about it.", color: "hsl(var(--brand-indigo))" },
  ].map((item, i) => (
  <motion.div
  key={i}
  className="glass rounded-2xl p-6 card-hover"
  style={{ border: `1px solid ${withAlpha(item.color, 0.22)}`, background: `${withAlpha(item.color, 0.04)}` }}
  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
  data-testid={`card-cost-${i}`}
  >
  <p className="text-4xl font-bold mb-1" style={{ color: item.color }}>{item.stat}</p>
  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-3">{item.unit}</p>
  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
  </motion.div>
  ))}
  </div>
  <motion.p
  className="text-center text-sm text-foreground/80 mt-8 max-w-xl mx-auto leading-relaxed"
  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
  >
  For the cost of one bad first date you can fix the thing that keeps producing them.{" "}
  <Link href="/pricing" className="font-semibold text-[hsl(248_62%_62%)] hover:underline">See plans →</Link>
  </motion.p>
  </div>
  </section>

  {/* ── Take another path, recovery row (sample report · skip-to-audit · risk-reversal) ── */}
  <section className="py-12 md:py-16 border-t border-foreground/5">
  <div className="container mx-auto px-4">
  <div className="max-w-3xl mx-auto">
  <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">Not ready to paste your bio yet?</p>
  <div className="grid sm:grid-cols-2 gap-3 mb-5">
  <Link
  href="/sample-report"
  className="glass border border-foreground/10 rounded-2xl p-4 flex items-center gap-3 hover:border-[hsl(248_62%_52%/0.4)] hover:bg-[hsl(248_62%_52%/0.04)] transition-all"
  data-testid="link-hero-sample-report"
  >
  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.25)]">
  <Eye className="w-4 h-4 text-[hsl(248_62%_52%)]" />
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-semibold text-foreground mb-0.5">See an example report first</p>
  <p className="text-[11px] text-muted-foreground leading-snug">Full sample audit. No paste required.</p>
  </div>
  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
  </Link>
  <Link
  href="/start"
  className="rounded-2xl p-4 flex items-center gap-3 hover:opacity-95 transition-all"
  style={{ background: "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.16), hsl(326 100% 59% / 0.10))", border: "1px solid hsl(var(--brand-indigo) / 0.35)" }}
  data-testid="button-hero-full-audit"
  >
  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] shadow-[0_4px_16px_hsl(248_62%_52%/0.4)]">
  <FileText className="w-4 h-4 text-white" />
  </div>
  <div className="flex-1 min-w-0">
  <p className="text-sm font-semibold text-foreground mb-0.5">Skip to the full Audit</p>
  <p className="text-[11px] text-muted-foreground leading-snug">8-dimension breakdown · full rewrites · 7-day plan</p>
  </div>
  <ArrowRight className="w-4 h-4 text-[hsl(248_62%_62%)] flex-shrink-0" />
  </Link>
  </div>
  <div
  className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-5 py-2.5 rounded-full glass border border-[hsl(142_55%_60%/0.3)] mx-auto w-fit"
  data-testid="strip-risk-reversal"
  >
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(142_55%_72%)]">
  <CheckCircle className="w-3.5 h-3.5" /> 30-day money-back guarantee
  </span>
  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(142_55%_72%)]">
  <Shield className="w-3.5 h-3.5" /> Delete everything anytime
  </span>
  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(142_55%_72%)]">
  <Eye className="w-3.5 h-3.5" /> Founder-reviewed in beta
  </span>
  </div>
  </div>
  </div>
  </section>

  {/* ── How It Works, the 3-step narrative (demoted below proof + cost) ── */}
  <section id="how-it-works" className="py-20 md:py-24 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
  <div className="container mx-auto px-4">
  <div className="text-center mb-12">
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3">How it works</p>
  <h2 className="text-3xl md:text-5xl font-bold text-foreground">
  Three steps. <span className="gradient-text italic">No guesswork.</span>
  </h2>
  <p className="text-muted-foreground max-w-xl mx-auto mt-4 leading-relaxed text-sm">
  From an honest read of your profile to a plan you can actually act on this week.
  </p>
  </div>
  <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
  {[
  {
  step: "01",
  title: "Check your signal",
  desc: "Paste your bio (and optionally your prompts or a recent message). Takes 3 minutes. No account needed to start.",
  color: "hsl(var(--brand-indigo))",
  cta: { label: "Start the check", href: "/signal-check" },
  },
  {
  step: "02",
  title: "Get your honest report",
  desc: "Receive a Signal Score, the category your profile reads as, specific critiques, and rewritten bio + prompt lines.",
  color: "hsl(var(--brand-gold))",
  cta: { label: "See a sample", href: "/sample-report" },
  },
  {
  step: "03",
  title: "Follow your 7-day plan",
  desc: "A prioritised plan built around your specific audit, not generic advice. Track your score as you implement.",
  color: "hsl(142 55% 50%)",
  cta: { label: "Track your progress", href: "/pricing" },
  },
  ].map((item, i) => (
  <motion.div
  key={i}
  className="glass rounded-3xl p-7 card-hover flex flex-col"
  style={{ border: `1px solid ${withAlpha(item.color, 0.18)}` }}
  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
  >
  <div className="text-4xl font-bold mb-4 font-mono" style={{ color: item.color }}>{item.step}</div>
  <h3 className="text-lg font-semibold text-foreground mb-2.5">{item.title}</h3>
  <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{item.desc}</p>
  <Link
  href={item.cta.href}
  className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
  style={{ color: item.color }}
  >
  {item.cta.label} <ArrowRight className="w-3 h-3" />
  </Link>
  </motion.div>
  ))}
  </div>
  </div>
  </section>

  {/* ── What we fix, 4 pillars ── */}
  <section className="py-16 md:py-20 border-t border-foreground/5">
  <div className="container mx-auto px-4">
  <div className="max-w-5xl mx-auto">
  <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3">What we fix</p>
  <h2 className="text-3xl md:text-4xl font-bold text-foreground">
  Most dating problems come from <span className="gradient-text italic">the same four places.</span>
  </h2>
  </motion.div>
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {[
  { num: "01", title: "What you're projecting", desc: "We show you what your profile is actually communicating, and how it reads to someone swiping.", color: "hsl(var(--brand-indigo))" },
  { num: "02", title: "Your profile text", desc: "Your bio and prompts, rewritten to sound genuinely like you. Specific, memorable, worth responding to.", color: "hsl(var(--brand-gold))" },
  { num: "03", title: "Your conversations", desc: "Tone analysis and 5 tailored reply options, from warm to direct to date invitation, for every situation.", color: "hsl(190 55% 50%)" },
  { num: "04", title: "Your action plan", desc: "A concrete, prioritised 7-day plan built around your specific audit, not generic advice.", color: "hsl(142 55% 50%)" },
  ].map((item, i) => (
  <motion.div key={i} className="rounded-2xl p-6 card-hover" style={{ background: `${withAlpha(item.color, 0.05)}`, border: `1px solid ${withAlpha(item.color, 0.2)}` }}
  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
  <p className="text-2xl font-bold font-mono mb-3" style={{ color: item.color }}>{item.num}</p>
  <h3 className="font-bold text-foreground text-sm mb-2">{item.title}</h3>
  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
  </motion.div>
  ))}
  </div>
  </div>
  </div>
  </section>

  {/* ── Trust. Early access / founder reviewed ── */}
  <section className="py-20 md:py-24 border-t border-foreground/5 relative overflow-hidden">
  <div className="orb orb-gold absolute w-96 h-96 right-0 top-20 opacity-40 pointer-events-none" />
  <div className="container mx-auto px-4 relative z-10">
  <div className="text-center mb-12">
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(43_65%_50%)] mb-3">Why this isn't another dating app</p>
  <h2 className="text-3xl md:text-4xl font-bold text-foreground">
  Built for people doing the work, <span className="gradient-text italic">not chasing tricks.</span>
  </h2>
  <p className="text-muted-foreground max-w-2xl mx-auto mt-4 leading-relaxed text-sm">
  We're in private beta and reviewing every report ourselves. You get founder-level attention on your audit.
  </p>
  </div>
  <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
  {[
  { icon: "🔬", title: "Founder-reviewed", desc: "Every audit during private beta is reviewed by the founders personally. You're not getting a generic output. You're getting our full attention on your specific situation.", color: "hsl(var(--brand-indigo))" },
  { icon: "🤝", title: "You shape the product", desc: "Beta members get direct access to give feedback, request features, and influence what we build next. Help us build the tool you actually wish existed.", color: "hsl(var(--brand-gold))" },
  { icon: "🔒", title: "Launch pricing, locked in", desc: "Beta members lock in today's pricing for life. As we add more features and move out of beta, the price goes up. Yours doesn't.", color: "hsl(142 55% 50%)" },
  ].map((card, i) => (
  <motion.div
  key={i}
  className="glass rounded-3xl p-7 flex flex-col card-hover"
  style={{ border: `1px solid ${withAlpha(card.color, 0.18)}` }}
  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
  >
  <p className="text-3xl mb-3">{card.icon}</p>
  <h3 className="font-bold text-foreground mb-2">{card.title}</h3>
  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{card.desc}</p>
  </motion.div>
  ))}
  </div>
  <motion.div
  className="text-center mt-10"
  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
  >
  <Link href="/waitlist" className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-[hsl(248_62%_52%/0.3)] text-sm font-semibold text-[hsl(248_62%_52%)] hover:border-[hsl(248_62%_52%/0.55)] transition-all">
  Join the early cohort <ArrowRight className="w-4 h-4" />
  </Link>
  </motion.div>
  </div>
  </section>

  {/* ── Privacy Promise ── */}
  <section className="py-16 md:py-20 border-t border-foreground/5">
  <div className="container mx-auto px-4">
  <div className="max-w-3xl mx-auto text-center mb-10">
  <Shield className="w-9 h-9 text-[hsl(248_62%_52%)] mx-auto mb-4" />
  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
  Your private sanctuary.
  </h2>
  <p className="text-muted-foreground leading-relaxed text-sm">
  Dating is vulnerable. We treat it that way. Two layers, and you decide how deep. The deterministic engine runs on every account by default. No keys, no external calls, no rate limits. Anthropic Claude is layered on for a handful of tools (bio rewrites, message coaching, Compatibility Compass, import summaries) and stays off until you turn it on. When Claude is in the loop, Anthropic processes the prompt under their zero-retention API policy. We never sell your content. We never train on it. One toggle in Settings controls all of it.
  </p>
  </div>
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
  {[
  { icon: "🔒", title: "Never sold", desc: "Your data is yours. We never sell it or share it with advertisers." },
  { icon: "🗑", title: "Delete anytime", desc: "One click permanently removes your account and all history." },
  { icon: "✋", title: "Consent first", desc: "You control exactly what we analyze. Nothing is assumed." },
  { icon: "🚫", title: "Zero judgment", desc: "An entirely private space to process your dating life honestly." },
  ].map((item, i) => (
  <motion.div
  key={i}
  className="glass border border-foreground/8 rounded-2xl p-5 text-center card-hover"
  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
  >
  <p className="text-2xl mb-2">{item.icon}</p>
  <h3 className="font-semibold text-foreground text-sm mb-1.5">{item.title}</h3>
  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
  </motion.div>
  ))}
  </div>
  </div>
  </section>

  {/* ── Final CTA ── */}
  <section className="py-20 md:py-28 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(248_62%_52%/0.1)] via-[hsl(326_100%_59%/0.06)] to-[hsl(43_65%_62%/0.05)]" />
  <div className="orb orb-violet absolute w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70" />
  <div className="container mx-auto px-4 text-center relative z-10">
  <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
  <Sparkles className="w-9 h-9 text-[hsl(248_62%_52%)] mx-auto mb-5" />
  <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
  Ready to be seen<br />
  <span className="gradient-text italic">for who you actually are?</span>
  </h2>
  <p className="text-muted-foreground text-base max-w-xl mx-auto mb-9 leading-relaxed">
  Free to start. No credit card. Pick the entry point that fits your time.
  </p>
  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
  <Button
  asChild
  size="lg"
  className="h-12 px-8 text-sm font-semibold rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse shadow-[0_4px_30px_hsl(248_62%_52%/0.4)]"
  data-testid="button-final-cta"
  >
  <Link href="/start">
  Get my full Audit <ArrowRight className="ml-2 h-4 w-4" />
  </Link>
  </Button>
  <Button asChild size="lg" variant="ghost" className="h-12 px-7 rounded-full border border-foreground/12 text-muted-foreground hover:text-foreground hover:bg-foreground/5">
  <Link href="/signal-check"><Headphones className="mr-2 h-4 w-4" /> Free 3-min Check</Link>
  </Button>
  </div>
  <p className="text-xs text-muted-foreground/60 mt-5">Free · No credit card · Instant Signal Check result</p>
  <TrustBadge className="mt-3 justify-center" />
  </motion.div>
  </div>
  </section>
  </AppLayout>
  );
}

// ── Interactive preview helpers (client-side deterministic so the page
// always renders, even when the API server is unreachable) ─────────

type BioPreviewResult = {
  score: number;
  category: string;
  strengths: string[];
  fixes: string[];
  rewriteHook: string;
};

function previewBio(bio: string): BioPreviewResult {
  const text = bio.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const cliches = [
  "love to laugh", "looking for my partner in crime", "fluent in sarcasm",
  "foodie", "adventurous", "easy to talk to", "good sense of humor",
  "love to travel", "live life to the fullest", "just ask",
  ];
  const lower = text.toLowerCase();
  const clicheHits = cliches.filter((c) => lower.includes(c));
  const hasNumbers = /\d/.test(text);
  const hasProperNouns = /\b[A-Z][a-z]{2,}\b/.test(text.replace(/^[A-Z]/, ""));
  const hasQuestion = /\?/.test(text);
  const hasSpecific = hasNumbers || hasProperNouns;

  let score = 50;
  if (wordCount > 30) score += 8;
  if (wordCount > 60) score += 6;
  if (hasSpecific) score += 14;
  if (hasQuestion) score += 6;
  score -= clicheHits.length * 9;
  score = Math.max(18, Math.min(92, score));

  const category =
  score >= 75
  ? "Specific and inviting"
  : score >= 55
  ? "Pleasant but forgettable"
  : "Generic. Reads as background noise.";

  const strengths: string[] = [];
  if (hasSpecific) strengths.push("You name actual things. Specific details give people something to reply to.");
  if (hasQuestion) strengths.push("You leave an opening. Questions and prompts pull a response.");
  if (wordCount >= 40 && wordCount <= 90) strengths.push("Length is in the sweet spot. Long enough to mean something, short enough to read.");
  if (strengths.length === 0) strengths.push("There's a person in here. The raw material is fine. The signal is just not turned up yet.");

  const fixes: string[] = [];
  if (clicheHits.length > 0) {
  fixes.push(`Cut the clichés. "${clicheHits[0]}" appears in roughly 1 in 4 profiles. It tells no one anything about you.`);
  }
  if (!hasSpecific) {
  fixes.push("Add one specific detail. A neighborhood, a band, a recurring habit. Specifics are what people screenshot.");
  }
  if (wordCount < 25) {
  fixes.push("You're under-writing. People can't decide on three lines. Give them 60 to 90 words.");
  }
  if (wordCount > 140) {
  fixes.push("Trim it. Long bios get skimmed, not read. Aim for 60 to 90 words of the strongest stuff.");
  }
  if (fixes.length === 0) {
  fixes.push("Tighten the opener. The first line is the only line most people actually read.");
  }

  const rewriteHook =
  "Try opening with a specific weeknight. A Tuesday. A Wednesday. The thing you actually do on that day. That single move tends to lift reply quality more than any other edit.";

  return { score, category, strengths: strengths.slice(0, 2), fixes: fixes.slice(0, 3), rewriteHook };
}

type CompassPreviewResult = {
  bestDynamic: string;
  watchFor: string;
  falseSpark: string;
};

function previewCompass(style: string, patterns: string[]): CompassPreviewResult {
  const styleMap: Record<string, string> = {
  "Spark Chaser": "Someone consistent enough to keep you grounded and interesting enough to keep you engaged. The spark needs to deepen into substance, not stay the whole thing.",
  "Slow Burn": "Someone patient enough to let you arrive, ideally someone investing slowly too. Mutual slow-burn dynamics produce the most durable connections.",
  "Anxious Confirmer": "Someone who communicates proactively and consistently, who can hold your care without reading it as too much. Secure attachment on their end is the most stabilizing fit.",
  "Avoidant Editor": "Someone secure enough not to need frequent reassurance, who can give you space without reading it as rejection.",
  "Secure Builder": "Someone doing their own work, building alongside you rather than anchoring to your steadiness.",
  };
  const bestDynamic =
  styleMap[style] ??
  "A dynamic with genuine reciprocity. Both people investing, both people honest about what they want, both willing to do the slower work of actually knowing each other.";

  let watchFor = "Dynamics where the exciting early stage never develops into real substance.";
  if (patterns.includes("Attracted to unavailable people")) {
  watchFor = "Emotionally unavailable people, where the distance creates the pull. Unavailability is not depth. It is just distance.";
  } else if (patterns.includes("Great starts that slowly fizzle")) {
  watchFor = "People who are great at the beginning and unclear about the middle. The ones who can generate connection but not sustain it.";
  } else if (patterns.includes("Moving too fast")) {
  watchFor = "Connections that move very fast at the start, where early intensity substitutes for the slower work of actually knowing someone.";
  } else if (patterns.includes("They pull back once I'm invested")) {
  watchFor = "Asymmetric dynamics where you consistently pursue more than you are pursued. Consistent asymmetry is data, not a phase.";
  }

  const falseSparkMap: Record<string, string> = {
  "Spark Chaser": "Unavailability mistaken for depth. When someone is just out of reach, the feeling reads like intensity but is mostly anxiety.",
  "Slow Burn": "Intrigue mistaken for compatibility. Mystery that never resolves is not depth, it is withholding.",
  "Anxious Confirmer": "Relief mistaken for love. When the person who usually produces anxiety suddenly reassures you, the relief feels profound. It is not. It is the absence of pain.",
  "Avoidant Editor": "Distance mistaken for self-respect. When someone does not need you, it can feel like they have something worth wanting.",
  "Secure Builder": "Neediness mistaken for passion. Heavy early investment can read as chemistry. Sometimes it is urgency unrelated to you.",
  };
  const falseSpark =
  falseSparkMap[style] ??
  "Intensity mistaken for compatibility. Strong early feeling overshadows the slower signals that actually predict whether something will last.";

  return { bestDynamic, watchFor, falseSpark };
}

type MessagesPreviewResult = {
  tone: string;
  patterns: string[];
  oneLine: string;
};

function previewMessages(text: string): MessagesPreviewResult {
  const lower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const questionCount = (text.match(/\?/g) ?? []).length;
  const exclaimCount = (text.match(/!/g) ?? []).length;
  const hahaCount = (lower.match(/\b(haha|lol|lmao)\b/g) ?? []).length;
  const avgLen = lines.length > 0 ? text.length / lines.length : text.length;

  let tone = "Even and measured.";
  if (hahaCount >= 3 || exclaimCount >= 4) tone = "Light and warm. Both sides are engaged.";
  else if (questionCount === 0) tone = "Flat. Lots of statements, no questions, low pull.";
  else if (avgLen > 140) tone = "Long-winded. You are doing more of the talking than they are.";

  const patterns: string[] = [];
  if (questionCount === 0) patterns.push("No questions in your last few messages. That tends to stall a thread within a day or two.");
  if (lower.includes("been meaning to") || lower.includes("we should")) {
  patterns.push("Soft date-floating. Phrases like 'we should' read as interest but give nothing concrete to say yes to.");
  }
  if (lines.length >= 8 && !/\b(when|free|tonight|weekend|tomorrow|thursday|friday|saturday|sunday|monday|tuesday|wednesday)\b/.test(lower)) {
  patterns.push("Eight-plus messages in and no time anchor. Real rapport is usually ready by message 5 to 7.");
  }
  if (patterns.length === 0) patterns.push("Balanced back-and-forth. The thread has momentum.");

  const oneLine =
  questionCount === 0
  ? "Pick the most interesting thing they said and ask one specific follow-up. Direction over volume."
  : "You have enough rapport to move. Propose a specific day, the cost of asking is almost always lower than people think.";

  return { tone, patterns: patterns.slice(0, 3), oneLine };
}

const PREVIEW_PATTERNS = [
  "Attracted to unavailable people",
  "Great starts that slowly fizzle",
  "They pull back once I'm invested",
  "Moving too fast",
] as const;

const PREVIEW_STYLES = [
  "Spark Chaser",
  "Slow Burn",
  "Anxious Confirmer",
  "Avoidant Editor",
  "Secure Builder",
] as const;

const EXAMPLE_BIO =
  "Software engineer who loves hiking and cooking. Big foodie. Looking for someone who is adventurous and loves to have fun. I'm told I'm easy to talk to and have a great sense of humor.";

const EXAMPLE_MESSAGES = `Them: Have you tried that new ramen place on 4th?
Me: Not yet but I've been meaning to
Them: It's so good, the black garlic broth is unreal
Me: Okay now I have to go
Them: You should!
Me: We should both go honestly, I keep saying I will and never do`;

type BioCardResult = BioPreviewResult & { auditId: number | null };
type CompassCardResult = CompassPreviewResult & { savedId: number | null };
type MessagesCardResult = MessagesPreviewResult & {
  attachmentStyle: string | null;
  insightId: number | null;
};

function PreviewSection() {
  const [bio, setBio] = useState(EXAMPLE_BIO);
  const [bioResult, setBioResult] = useState<BioCardResult | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  const [style, setStyle] = useState<string>("Spark Chaser");
  const [patterns, setPatterns] = useState<string[]>(["Great starts that slowly fizzle"]);
  const [compassResult, setCompassResult] = useState<CompassCardResult | null>(null);
  const [compassLoading, setCompassLoading] = useState(false);

  const [messages, setMessages] = useState(EXAMPLE_MESSAGES);
  const [msgResult, setMsgResult] = useState<MessagesCardResult | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);

  const createAudit = useCreateAudit();
  const generateReport = useGenerateAuditReport();
  const saveCompassRead = useSaveCompassRead();
  const createInsight = useCreateInsight();
  const analyzeInsight = useAnalyzeInsight();

  function togglePattern(p: string) {
  setPatterns((prev) => {
  if (prev.includes(p)) return prev.filter((x) => x !== p);
  if (prev.length >= 2) return [prev[1], p];
  return [...prev, p];
  });
  }

  async function runBioAudit() {
  const trimmed = bio.trim();
  if (!trimmed) return;
  setBioLoading(true);
  const local = previewBio(trimmed);
  try {
  const audit = await createAudit.mutateAsync({
  data: {
  firstName: "You",
  age: 0,
  gender: "not specified",
  orientation: "not specified",
  currentApps: [],
  datingGoal: "find a relationship",
  biggestChallenge: "Not sure how I come across",
  bio: trimmed,
  prompts: null,
  recentMessageSample: null,
  photoCount: null,
  relationshipHistory: null,
  },
  });
  rememberAnonymousId("audits", audit.id);
  const report = (await generateReport.mutateAsync({ id: audit.id })) as {
  readinessScore?: number;
  risks?: string[];
  rewrittenBio?: string;
  };
  const score = typeof report.readinessScore === "number" ? report.readinessScore : local.score;
  const firstFix = report.risks?.[0] ?? local.fixes[0];
  const rewriteHook = report.rewrittenBio
  ? report.rewrittenBio.split(".").slice(0, 2).join(".").trim() + "."
  : local.rewriteHook;
  setBioResult({
  score,
  category:
  score >= 75
  ? "Specific and inviting"
  : score >= 55
  ? "Pleasant but forgettable"
  : "Generic. Reads as background noise.",
  strengths: local.strengths,
  fixes: [firstFix,...local.fixes.filter((f) => f !== firstFix)].slice(0, 3),
  rewriteHook,
  auditId: audit.id,
  });
  } catch {
  setBioResult({...local, auditId: null });
  } finally {
  setBioLoading(false);
  }
  }

  async function runCompassRead() {
  if (!style) return;
  setCompassLoading(true);
  const local = previewCompass(style, patterns);
  try {
  const saved = await saveCompassRead.mutateAsync({
  data: {
  connectionStyle: style,
  patterns,
  notes: null,
  deterministicResult: local as unknown as Record<string, unknown>,
  aiResult: null,
  },
  });
  rememberAnonymousId("compass", saved.id);
  setCompassResult({...local, savedId: saved.id });
  } catch {
  setCompassResult({...local, savedId: null });
  } finally {
  setCompassLoading(false);
  }
  }

  async function runMessageRead() {
  const trimmed = messages.trim();
  if (!trimmed) return;
  setMsgLoading(true);
  const local = previewMessages(trimmed);
  try {
  const insight = await createInsight.mutateAsync({
  data: {
  sourceLabel: "Landing preview",
  pastedContent: trimmed,
  consentGiven: false,
  sourceApp: null,
  },
  });
  rememberAnonymousId("insights", insight.id);
  const analysis = (await analyzeInsight.mutateAsync({ id: insight.id })) as {
  attachmentStyle?: string;
  growthAreas?: string[];
  datingProfileTips?: string[];
  };
  const tip =
  analysis.datingProfileTips?.[0] ??
  analysis.growthAreas?.[0] ??
  local.oneLine;
  setMsgResult({
  tone: local.tone,
  patterns: local.patterns,
  oneLine: tip,
  attachmentStyle: analysis.attachmentStyle ?? null,
  insightId: insight.id,
  });
  } catch {
  setMsgResult({
...local,
  attachmentStyle: null,
  insightId: null,
  });
  } finally {
  setMsgLoading(false);
  }
  }

  return (
  <section className="py-20 md:py-24 relative overflow-hidden border-t border-foreground/5">
  <div className="orb orb-plum absolute w-80 h-80 -left-40 top-20 opacity-50 pointer-events-none" />
  <div className="container mx-auto px-4 relative z-10">
  <div className="text-center mb-10 max-w-2xl mx-auto">
  <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3">Try it</p>
  <h2 className="text-3xl md:text-5xl font-bold text-foreground">
  Try it before you{" "}
  <span className="gradient-text-violet italic">sign up.</span>
  </h2>
  <p className="text-sm text-muted-foreground mt-3">
  Pick a tool. We&apos;ll show you what it sees.
  </p>
  </div>

  <div className="max-w-3xl mx-auto">
  <Tabs defaultValue="bio" className="w-full">
  <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto p-1 rounded-2xl glass border border-foreground/8 bg-[hsl(248_40%_96%/0.6)] dark:bg-[hsl(248_50%_10%/0.6)] gap-1">
  <TabsTrigger
  value="bio"
  className="rounded-xl py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 data-[state=active]:bg-background"
  data-testid="tab-preview-bio"
  >
  <FileText className="w-3.5 h-3.5" /> Audit my bio
  </TabsTrigger>
  <TabsTrigger
  value="compass"
  className="rounded-xl py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 data-[state=active]:bg-background"
  data-testid="tab-preview-compass"
  >
  <Compass className="w-3.5 h-3.5" /> Run a compass read
  </TabsTrigger>
  <TabsTrigger
  value="messages"
  className="rounded-xl py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 data-[state=active]:bg-background"
  data-testid="tab-preview-messages"
  >
  <MessageCircle className="w-3.5 h-3.5" /> What your messages say
  </TabsTrigger>
  </TabsList>

  {/* Bio tab */}
  <TabsContent value="bio" className="mt-5">
  <div className="glass border border-foreground/8 rounded-3xl p-6 md:p-7">
  <p className="text-sm text-muted-foreground mb-4">
  Paste your bio. We&apos;ll tell you what it actually reads as, what&apos;s working, and the one fix worth making first.
  </p>
  <Textarea
  value={bio}
  onChange={(e) => setBio(e.target.value)}
  rows={5}
  className="resize-none text-sm"
  data-testid="textarea-preview-bio"
  />
  <div className="flex flex-wrap items-center gap-3 mt-4">
  <Button
  onClick={runBioAudit}
  disabled={bioLoading || bio.trim().length === 0}
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white"
  data-testid="button-preview-bio-show"
  >
  {bioLoading ? (
  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading your bio</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-4 w-4" /></>
  )}
  </Button>
  <span className="text-[11px] text-muted-foreground/70">Hybrid AI. No account needed.</span>
  </div>

  {bioResult ? (
  <div className="mt-6 grid gap-4" data-testid="result-preview-bio">
  <div className="flex flex-wrap items-baseline gap-3 pb-3 border-b border-foreground/8">
  <p className="text-3xl font-bold text-foreground" style={{ color: "hsl(var(--brand-indigo))" }}>{bioResult.score}<span className="text-base text-muted-foreground">/100</span></p>
  <p className="text-sm font-semibold text-foreground">{bioResult.category}</p>
  </div>
  {bioResult.strengths.length > 0 ? (
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(142_55%_50%)] mb-2">What&apos;s working</p>
  <ul className="space-y-1.5">
  {bioResult.strengths.map((s, i) => (
  <li key={i} className="text-sm text-foreground/85 leading-relaxed">{s}</li>
  ))}
  </ul>
  </div>
  ) : null}
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(326_100%_59%)] mb-2">Fix this first</p>
  <ul className="space-y-1.5">
  {bioResult.fixes.map((f, i) => (
  <li key={i} className="text-sm text-foreground/85 leading-relaxed">{f}</li>
  ))}
  </ul>
  </div>
  <div className="rounded-2xl p-4 bg-[hsl(248_62%_52%/0.05)] border border-[hsl(248_62%_52%/0.18)]">
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-1.5">One rewrite move</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{bioResult.rewriteHook}</p>
  </div>
  <PreviewFooterCta
  label="See the full audit"
  href={bioResult.auditId ? `/report/${bioResult.auditId}` : "/start"}
  />
  </div>
  ) : null}
  </div>
  </TabsContent>

  {/* Compass tab */}
  <TabsContent value="compass" className="mt-5">
  <div className="glass border border-foreground/8 rounded-3xl p-6 md:p-7">
  <p className="text-sm text-muted-foreground mb-4">
  Pick your connection style and up to two patterns you keep seeing. We&apos;ll show your best-fit dynamic and the false spark to watch.
  </p>
  <div className="space-y-4">
  <div>
  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70 mb-2">Your connection style</p>
  <div className="flex flex-wrap gap-1.5">
  {PREVIEW_STYLES.map((s) => (
  <button
  key={s}
  type="button"
  onClick={() => setStyle(s)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
  style === s
  ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)] border-[hsl(248_62%_52%/0.4)]"
  : "border-foreground/12 text-muted-foreground hover:border-foreground/25 hover:text-foreground"
  }`}
  data-testid={`button-preview-style-${s.toLowerCase().replace(/ /g, "-")}`}
  >
  {s}
  </button>
  ))}
  </div>
  </div>
  <div>
  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70 mb-2">Patterns you keep seeing (pick up to 2)</p>
  <div className="flex flex-wrap gap-1.5">
  {PREVIEW_PATTERNS.map((p) => (
  <button
  key={p}
  type="button"
  onClick={() => togglePattern(p)}
  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
  patterns.includes(p)
  ? "bg-[hsl(326_100%_59%/0.15)] text-[hsl(326_100%_65%)] border-[hsl(326_100%_59%/0.4)]"
  : "border-foreground/12 text-muted-foreground hover:border-foreground/25 hover:text-foreground"
  }`}
  data-testid={`button-preview-pattern-${p.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
  >
  {p}
  </button>
  ))}
  </div>
  </div>
  </div>
  <div className="flex flex-wrap items-center gap-3 mt-5">
  <Button
  onClick={runCompassRead}
  disabled={compassLoading || !style}
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white"
  data-testid="button-preview-compass-show"
  >
  {compassLoading ? (
  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running your read</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-4 w-4" /></>
  )}
  </Button>
  <span className="text-[11px] text-muted-foreground/70">A short read. The full Compass goes deeper.</span>
  </div>

  {compassResult ? (
  <div className="mt-6 grid gap-4" data-testid="result-preview-compass">
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-1.5">Best-fit dynamic</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{compassResult.bestDynamic}</p>
  </div>
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(43_65%_50%)] mb-1.5">Watch for</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{compassResult.watchFor}</p>
  </div>
  <div className="rounded-2xl p-4 bg-[hsl(326_100%_59%/0.05)] border border-[hsl(326_100%_59%/0.18)]">
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(326_100%_59%)] mb-1.5">Your false spark</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{compassResult.falseSpark}</p>
  </div>
  <PreviewFooterCta
  label="See the full read"
  href={compassResult.savedId ? `/compass/${compassResult.savedId}` : "/compass"}
  />
  </div>
  ) : null}
  </div>
  </TabsContent>

  {/* Messages tab */}
  <TabsContent value="messages" className="mt-5">
  <div className="glass border border-foreground/8 rounded-3xl p-6 md:p-7">
  <p className="text-sm text-muted-foreground mb-4">
  Paste a recent chat. We&apos;ll read the tone, name the pattern, and tell you the one move that fits.
  </p>
  <Textarea
  value={messages}
  onChange={(e) => setMessages(e.target.value)}
  rows={7}
  className="resize-none text-sm font-mono"
  data-testid="textarea-preview-messages"
  />
  <div className="flex flex-wrap items-center gap-3 mt-4">
  <Button
  onClick={runMessageRead}
  disabled={msgLoading || messages.trim().length === 0}
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white"
  data-testid="button-preview-messages-show"
  >
  {msgLoading ? (
  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading your style</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-4 w-4" /></>
  )}
  </Button>
  <span className="text-[11px] text-muted-foreground/70">Hybrid AI. No account needed.</span>
  </div>

  {msgResult ? (
  <div className="mt-6 grid gap-4" data-testid="result-preview-messages">
  {msgResult.attachmentStyle ? (
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-1.5">Attachment style</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{msgResult.attachmentStyle}</p>
  </div>
  ) : null}
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(190_55%_50%)] mb-1.5">Tone</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{msgResult.tone}</p>
  </div>
  <div>
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(43_65%_50%)] mb-2">What we noticed</p>
  <ul className="space-y-1.5">
  {msgResult.patterns.map((p, i) => (
  <li key={i} className="text-sm text-foreground/85 leading-relaxed">{p}</li>
  ))}
  </ul>
  </div>
  <div className="rounded-2xl p-4 bg-[hsl(248_62%_52%/0.05)] border border-[hsl(248_62%_52%/0.18)]">
  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-1.5">One move that fits</p>
  <p className="text-sm text-foreground/85 leading-relaxed">{msgResult.oneLine}</p>
  </div>
  <PreviewFooterCta label="See the full read" href="/insights" />
  </div>
  ) : null}
  </div>
  </TabsContent>
  </Tabs>

  <p className="text-center text-[11px] text-muted-foreground/60 mt-4">
  Each tab runs the real hybrid AI on your input. Anonymous by default. The signed-in tools go deeper and save your history.
  </p>
  </div>
  </div>
  </section>
  );
}

function PreviewFooterCta({ label, href = "/start" }: { label: string; href?: string }) {
  return (
  <div className="pt-2">
  <Link
  href={href}
  className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_52%)] transition-colors"
  data-testid="link-preview-cta"
  >
  {label} <ArrowRight className="w-4 h-4" />
  </Link>
  </div>
  );
}