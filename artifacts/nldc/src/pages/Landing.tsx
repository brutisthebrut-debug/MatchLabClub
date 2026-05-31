import { useState } from "react";
import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Sparkles, Headphones, Eye, Clock, FileText, Compass, MessageCircle, Loader2, Camera, BookOpen, Brain, Download, TrendingUp, Users, Heart, Flame, HeartPulse, CalendarDays, Instagram, Mail, Wallet, Music2, Palette, Clapperboard, Film, Footprints } from "lucide-react";
import { motion } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";
import {
  useCreateAudit,
  useGenerateAuditReport,
  useSaveCompassRead,
  useCreateInsight,
  useAnalyzeInsight,
} from "@workspace/api-client-react";
import { rememberAnonymousId } from "@/lib/anonymousIds";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Landing() {
  useMeta(
    "Turn your real dating signals into real matches",
    "MatchLab Club is a second brain for your dating life. It reads the real signals you already generate, your profile, your messages, your dates, builds a readiness score you can watch grow, and uses it to introduce you to real people. Start free with the Signal Check, no account needed.",
  );
  return (
    <AppLayout>
      {/* ── Hero. Monumental typography, deep branding, single CTA ── */}
      <section className="relative mesh-bg overflow-hidden pt-16 md:pt-28 pb-24 md:pb-32 min-h-[90vh] flex flex-col justify-center">
        <div className="orb orb-violet absolute w-[800px] h-[800px] -top-60 -right-60 opacity-60 pointer-events-none" />
        <div className="orb orb-gold absolute w-[500px] h-[500px] bottom-0 left-1/4 opacity-40 pointer-events-none" />
        <div className="orb orb-plum absolute w-[400px] h-[400px] top-40 -left-20 opacity-50 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
          <div className="max-w-4xl mx-auto text-center w-full">
            {/* Trust eyebrow */}
            <motion.div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-elevated border border-[hsl(248_62%_52%/0.3)] mb-10 shadow-sm" {...fadeUp(0.1)}>
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse shadow-[0_0_8px_hsl(142_55%_60%)]" />
              <span className="text-xs md:text-sm font-semibold tracking-wide text-foreground/80 uppercase">Private beta · Founder reviews every report</span>
            </motion.div>

            {/* Monumental headline */}
            <motion.h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] font-serif font-bold tracking-tight leading-[1.05] mb-8"
              {...fadeUp(0.2)}
            >
              <span className="text-foreground">Turn real signals</span>{" "}
              <br className="hidden md:block" />
              <span className="gradient-text italic pr-2">into real matches.</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-12 font-medium"
              {...fadeUp(0.3)}
            >
              A second brain for your dating life. It turns the real signals you already generate (your profile, your messages, your dates) into a <span className="text-foreground font-bold">readiness score that grows toward real introductions.</span> The free Signal Check is where it starts.
            </motion.p>

            {/* PRIMARY CTA */}
            <motion.div className="flex flex-col items-center gap-6" {...fadeUp(0.4)}>
              <Button
                asChild
                size="lg"
                className="rounded-full font-bold h-16 md:h-20 px-10 md:px-12 text-lg md:text-xl bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_40px_hsl(248_62%_52%/0.5)] hover:scale-[1.02] transition-transform"
              >
                <Link href="/signal-check">Get my free Signal Check <ArrowRight className="ml-3 h-6 w-6" /></Link>
              </Button>

              {/* Trust micro-row */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground mt-2">
                <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-[hsl(248_62%_52%)]" /> 3 minutes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4 text-[hsl(142_55%_50%)]" /> No account needed</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-[hsl(326_100%_59%)]" /> Instant result</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span className="text-xs uppercase tracking-widest font-semibold">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-muted-foreground/50 to-transparent" />
        </motion.div>
      </section>

      {/* ── Cost anchor ── */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-background relative">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div className="text-center mb-16 max-w-3xl mx-auto" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(0_60%_60%)] mb-4">The math you're avoiding</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              A bad profile isn't free. <span className="gradient-text italic pr-1">It's the most expensive thing on the apps.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Most people pay for it in months, not dollars, and don't notice until they look back.
            </p>
          </motion.div>
          
          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { stat: "300+", unit: "hours/year", desc: "Average time singles spend swiping, messaging, and going on dates that don't go anywhere.", color: "hsl(0 60% 55%)" },
              { stat: "~$420", unit: "spent on apps", desc: "What the average dater spends per year on premium tiers, boosts, and super-likes, all routed through a bio that isn't working.", color: "hsl(var(--brand-gold))" },
              { stat: "14–18", unit: "months lost", desc: "Typical gap between when something is broken in how you're presenting and when someone actually tells you about it.", color: "hsl(var(--brand-indigo))" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="glass-strong rounded-[2rem] p-8 card-hover"
                style={{ border: `1px solid ${withAlpha(item.color, 0.2)}`, background: `linear-gradient(135deg, ${withAlpha(item.color, 0.05)}, ${withAlpha(item.color, 0.01)})` }}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <p className="text-5xl font-serif font-bold mb-2" style={{ color: item.color }}>{item.stat}</p>
                <p className="text-sm font-bold uppercase tracking-wider text-foreground/80 mb-4">{item.unit}</p>
                <p className="text-base text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive 3-tab preview ── */}
      <PreviewSection />

      {/* ── How It Works ── */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-4">How the engine works</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
              Signals in. <span className="gradient-text italic pr-1">Matches out.</span>
            </h2>
            <p className="text-muted-foreground text-lg mt-6 leading-relaxed">
              Everything you do here feeds one engine. The more real signal it has, the better it knows who to put in front of you.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                step: "01",
                title: "Feed it real signals",
                desc: "Your bio, your messages, your dates, your wins, your reflections. Start with the free Signal Check. No account needed.",
                color: "hsl(var(--brand-indigo))",
                cta: { label: "Start the check", href: "/signal-check" },
              },
              {
                step: "02",
                title: "Watch readiness grow",
                desc: "Every signal moves one real number, your readiness score. The app always shows the next step worth taking, not generic advice.",
                color: "hsl(var(--brand-gold))",
                cta: { label: "See a sample", href: "/sample-report" },
              },
              {
                step: "03",
                title: "Get introduced",
                desc: "When you are ready, your profile becomes introductions to a small number of well considered people. No swipe carousel.",
                color: "hsl(142 55% 50%)",
                cta: { label: "See how matching works", href: "/matching" },
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="glass rounded-[2rem] p-10 card-hover flex flex-col relative overflow-hidden"
                style={{ border: `1px solid ${withAlpha(item.color, 0.2)}` }}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
              >
                <div className="absolute top-0 right-0 p-8 text-8xl font-serif font-bold opacity-5 pointer-events-none" style={{ color: item.color }}>
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4 relative z-10">{item.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-8 flex-1 relative z-10 font-medium">{item.desc}</p>
                <Link
                  href={item.cta.href}
                  className="inline-flex items-center gap-2 text-sm font-bold transition-opacity hover:opacity-80 relative z-10 uppercase tracking-wider"
                  style={{ color: item.color }}
                >
                  {item.cta.label} <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── One brain, the live loop ── */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="orb orb-violet absolute w-[500px] h-[500px] -top-40 -left-40 opacity-30 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(326_100%_58%)] mb-4">One brain, not ten tabs</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Every real tool feeds <span className="gradient-text italic pr-1">one rising readiness meter.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              These are not separate gimmicks. Each one is a real working tool, and each one teaches the same engine a little more about you. The more it knows, the higher your readiness climbs, and the better the people it can introduce.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-6 items-center max-w-6xl mx-auto">
            {/* Left: the real tools feeding the brain */}
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: FileText, label: "Signal Check", desc: "A quick read of your profile", href: "/signal-check", color: "hsl(var(--brand-indigo))" },
                { icon: Camera, label: "Photo Scan", desc: "How your photos actually land", href: "/scan", color: "hsl(326 100% 59%)" },
                { icon: MessageCircle, label: "Message Coach", desc: "How you talk to people", href: "/coach", color: "hsl(190 55% 55%)" },
                { icon: Compass, label: "Compatibility Compass", desc: "What you respond to", href: "/compatibility-compass", color: "hsl(var(--brand-gold))" },
                { icon: BookOpen, label: "Journal & post-date notes", desc: "Patterns over time", href: "/mirror", color: "hsl(248 62% 52%)" },
                { icon: Download, label: "Hinge import", desc: "How you swipe and who replies", href: "/imports", color: "hsl(142 55% 50%)" },
              ].map((tool, i) => (
                <motion.div
                  key={tool.label}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={tool.href}
                    className="group flex items-start gap-3 p-4 rounded-2xl glass border border-foreground/10 hover:-translate-y-0.5 hover:shadow-lg transition-all h-full"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: withAlpha(tool.color, 0.12), border: `1px solid ${withAlpha(tool.color, 0.25)}` }}
                    >
                      <tool.icon className="w-5 h-5" style={{ color: tool.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight">{tool.label}</p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{tool.desc}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Middle: the meter */}
            <motion.div
              className="flex lg:flex-col items-center justify-center gap-4 px-2"
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            >
              <ArrowRight className="w-8 h-8 text-muted-foreground/40 lg:rotate-0 rotate-90 hidden sm:block" />
              <div className="rounded-[2rem] p-8 text-center glass-strong border border-[hsl(248_62%_52%/0.3)] shadow-xl w-44">
                <Brain className="w-8 h-8 mx-auto text-[hsl(326_100%_58%)] mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Match readiness</p>
                <p className="text-5xl font-serif font-bold gradient-text leading-none mb-1">68</p>
                <div className="h-2 rounded-full bg-foreground/10 overflow-hidden mt-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]" style={{ width: "68%" }} />
                </div>
                <p className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(142_55%_50%)] mt-3">
                  <TrendingUp className="w-3.5 h-3.5" /> rising
                </p>
              </div>
              <ArrowRight className="w-8 h-8 text-muted-foreground/40 lg:rotate-0 rotate-90 hidden sm:block" />
            </motion.div>

            {/* Right: the payoff */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
              className="rounded-[2rem] p-8 h-full flex flex-col justify-center"
              style={{ background: "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.1), hsl(326 100% 59% / 0.08))", border: "1px solid hsl(var(--brand-indigo) / 0.25)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] shadow-lg mb-5">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">AI introductions, when you are ready</h3>
              <p className="text-base text-muted-foreground leading-relaxed font-medium mb-6">
                Once your readiness clears the bar, the engine introduces you to a small number of well considered people near you. No swipe carousel, no infinite scroll. The readiness meter is the gate, and the work you put in is the key.
              </p>
              <Link
                href="/matching"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] hover:opacity-80 transition-opacity"
              >
                See how matching works <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          <p className="text-center text-sm text-muted-foreground/80 mt-10 inline-flex items-center gap-2 mx-auto w-full justify-center">
            <Heart className="w-4 h-4 text-[hsl(326_100%_58%)]" /> Built for every gender and orientation, inclusive by default.
          </p>
        </div>
      </section>

      {/* ── Connect your real world ── */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="orb orb-gold absolute w-[400px] h-[400px] -bottom-32 -right-24 opacity-25 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--brand-gold))] mb-4">Connect your real world</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Every source you plug in <span className="gradient-text italic pr-1">paints more of the picture.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              Your taste in music, the films you rewatch, the places you book, the rhythm of your week. Each one is opt-in, read only, and removable in one click. The fuller the picture, the better the people the engine can introduce.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {[
              { icon: Flame, label: "Hinge export", color: "hsl(348 75% 60%)", status: "Live" },
              { icon: HeartPulse, label: "Wellness", color: "hsl(var(--brand-green))", status: "Live" },
              { icon: CalendarDays, label: "Calendar", color: "hsl(248 62% 60%)", status: "Live" },
              { icon: Instagram, label: "Instagram", color: "hsl(326 70% 60%)", status: "Live" },
              { icon: Camera, label: "Photos", color: "hsl(212 70% 55%)", status: "Live" },
              { icon: Mail, label: "Forwarding inbox", color: "hsl(326 100% 62%)", status: "Building" },
              { icon: Wallet, label: "Spending", color: "hsl(142 55% 55%)", status: "Building" },
              { icon: Music2, label: "Spotify", color: "hsl(141 73% 42%)", status: "Building" },
              { icon: Palette, label: "Pinterest", color: "hsl(348 80% 55%)", status: "Exploring" },
              { icon: Clapperboard, label: "Netflix", color: "hsl(0 72% 50%)", status: "Exploring" },
              { icon: Film, label: "Letterboxd", color: "hsl(28 80% 55%)", status: "Exploring" },
              { icon: Footprints, label: "Strava", color: "hsl(18 90% 55%)", status: "Exploring" },
            ].map((s, i) => {
              const statusColor =
                s.status === "Live"
                  ? "hsl(142 55% 60%)"
                  : s.status === "Building"
                    ? "hsl(var(--brand-indigo))"
                    : "hsl(43 65% 65%)";
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href="/connections"
                    className="glass border border-foreground/10 rounded-2xl p-4 flex items-center gap-3 h-full hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/20 transition-all"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: withAlpha(s.color, 0.12), border: `1px solid ${withAlpha(s.color, 0.25)}` }}
                    >
                      <s.icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight truncate">{s.label}</p>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: statusColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                        {s.status}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/connections"
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] hover:opacity-80 transition-opacity"
            >
              See everything you can connect <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-muted-foreground/70 mt-3 max-w-md mx-auto leading-relaxed">
              Read only on every source. We show you exactly what we will see and what we will never touch before you plug anything in.
            </p>
          </div>
        </div>
      </section>

      {/* ── Real people band ── */}
      <section className="py-24 md:py-32 border-t border-foreground/5 relative overflow-hidden bg-background">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(326_100%_58%)] mb-4">Who this is for</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Real people, <span className="gradient-text italic pr-1">every kind of connection.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              Straight, gay, queer, bi, trans, non-binary, mono and poly. The work of being seen clearly is the same. The tools meet you wherever you date.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
            {[
              { src: "/couples/couple-women.png", alt: "Two women laughing together on a city street at golden hour" },
              { src: "/couples/couple-gaymen.png", alt: "A gay couple laughing together over coffee" },
              { src: "/couples/couple-dinner.png", alt: "A couple sharing a laugh across a candlelit dinner table" },
              { src: "/couples/couple-embrace.png", alt: "A couple smiling warmly in a close embrace at home" },
            ].map((img, i) => (
              <motion.div
                key={img.src}
                className="relative aspect-[3/4] overflow-hidden rounded-[2rem] border border-foreground/10 shadow-lg"
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Take another path, recovery row ── */}
      <section className="py-24 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">Ready to start?</p>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Link
                href="/sample-report"
                className="glass-strong border border-foreground/10 rounded-[2rem] p-8 flex items-start gap-6 hover:border-[hsl(248_62%_52%/0.4)] hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)]">
                  <Eye className="w-6 h-6 text-[hsl(248_62%_52%)]" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-xl font-bold text-foreground mb-2">See an example report</p>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">Full sample audit. See exactly what you get before pasting your bio.</p>
                </div>
              </Link>
              <Link
                href="/signal-check"
                className="rounded-[2rem] p-8 flex items-start gap-6 hover:shadow-xl transition-all hover:-translate-y-1"
                style={{ background: "linear-gradient(135deg, hsl(var(--brand-indigo) / 0.15), hsl(326 100% 59% / 0.15))", border: "1px solid hsl(var(--brand-indigo) / 0.4)" }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] shadow-lg shadow-[hsl(248_62%_52%/0.3)]">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-xl font-bold text-foreground mb-2">Start my free Signal Check</p>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">Three minutes, no account. Your readiness trail starts here.</p>
                </div>
              </Link>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-8 py-4 rounded-full glass border border-[hsl(142_55%_60%/0.3)] mx-auto w-fit shadow-sm">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(142_55%_60%)] dark:text-[hsl(142_55%_72%)]">
                <CheckCircle className="w-4 h-4" /> 30-day money-back guarantee
              </span>
              <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%/0.3)]" />
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[hsl(142_55%_60%)] dark:text-[hsl(142_55%_72%)]">
                <Shield className="w-4 h-4" /> Delete everything anytime
              </span>
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

// ── Interactive preview helpers ─────────
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
  <section className="py-24 md:py-32 relative overflow-hidden bg-background">
  <div className="container mx-auto px-4 relative z-10">
  <motion.div className="text-center mb-16 max-w-3xl mx-auto" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
  <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-4">Try it out</p>
  <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground">
  Experience it before you{" "}
  <span className="gradient-text-violet italic pr-1">sign up.</span>
  </h2>
  <p className="text-lg text-muted-foreground mt-6 font-medium">
  Pick a tool. We'll show you what it sees.
  </p>
  </motion.div>

  <div className="max-w-4xl mx-auto">
  <Tabs defaultValue="bio" className="w-full">
  <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto p-2 rounded-2xl glass-strong border border-foreground/10 bg-[hsl(248_40%_96%/0.8)] dark:bg-[hsl(248_50%_10%/0.8)] gap-2 shadow-sm mb-8">
  <TabsTrigger
  value="bio"
  className="rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-[hsl(248_62%_52%)] data-[state=active]:shadow-md transition-all"
  >
  <FileText className="w-4 h-4" /> Audit my bio
  </TabsTrigger>
  <TabsTrigger
  value="compass"
  className="rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-[hsl(248_62%_52%)] data-[state=active]:shadow-md transition-all"
  >
  <Compass className="w-4 h-4" /> Compass read
  </TabsTrigger>
  <TabsTrigger
  value="messages"
  className="rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-[hsl(248_62%_52%)] data-[state=active]:shadow-md transition-all"
  >
  <MessageCircle className="w-4 h-4" /> Message analysis
  </TabsTrigger>
  </TabsList>

  {/* Bio tab */}
  <TabsContent value="bio" className="mt-0">
  <div className="glass-elevated border border-foreground/10 rounded-[2rem] p-8 md:p-10 shadow-lg">
  <p className="text-base text-muted-foreground mb-6 font-medium">
  Paste your bio. We'll tell you what it actually reads as, what's working, and the one fix worth making first.
  </p>
  <Textarea
  value={bio}
  onChange={(e) => setBio(e.target.value)}
  rows={5}
  className="resize-none text-base p-4 rounded-xl border-foreground/15 focus:border-[hsl(248_62%_52%)] focus:ring-[hsl(248_62%_52%/0.2)] bg-background/50"
  />
  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
  <Button
  onClick={runBioAudit}
  disabled={bioLoading || bio.trim().length === 0}
  size="lg"
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold px-8 shadow-md"
  >
  {bioLoading ? (
  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reading your bio</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-5 w-5" /></>
  )}
  </Button>
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hybrid AI. No account needed.</span>
  </div>

  {bioResult && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 grid gap-6">
  <div className="flex flex-wrap items-baseline gap-4 pb-6 border-b border-foreground/10">
  <p className="text-5xl font-serif font-bold" style={{ color: "hsl(var(--brand-indigo))" }}>{bioResult.score}<span className="text-2xl text-muted-foreground">/100</span></p>
  <p className="text-lg font-bold text-foreground">{bioResult.category}</p>
  </div>
  {bioResult.strengths.length > 0 && (
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(142_55%_50%)] mb-3">What's working</p>
  <ul className="space-y-2">
  {bioResult.strengths.map((s, i) => (
  <li key={i} className="text-base text-foreground/80 leading-relaxed font-medium">{s}</li>
  ))}
  </ul>
  </div>
  )}
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(326_100%_59%)] mb-3">Fix this first</p>
  <ul className="space-y-2">
  {bioResult.fixes.map((f, i) => (
  <li key={i} className="text-base text-foreground/80 leading-relaxed font-medium">{f}</li>
  ))}
  </ul>
  </div>
  <div className="rounded-2xl p-6 bg-[hsl(248_62%_52%/0.05)] border border-[hsl(248_62%_52%/0.2)]">
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-2">One rewrite move</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{bioResult.rewriteHook}</p>
  </div>
  <PreviewFooterCta
  label="See the full audit"
  href={bioResult.auditId ? `/report/${bioResult.auditId}` : "/start"}
  />
  </motion.div>
  )}
  </div>
  </TabsContent>

  {/* Compass tab */}
  <TabsContent value="compass" className="mt-0">
  <div className="glass-elevated border border-foreground/10 rounded-[2rem] p-8 md:p-10 shadow-lg">
  <p className="text-base text-muted-foreground mb-6 font-medium">
  Pick your connection style and up to two patterns you keep seeing. We'll show your best-fit dynamic and the false spark to watch.
  </p>
  <div className="space-y-8">
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-foreground/70 mb-4">Your connection style</p>
  <div className="flex flex-wrap gap-2">
  {PREVIEW_STYLES.map((s) => (
  <button
  key={s}
  type="button"
  onClick={() => setStyle(s)}
  className={`px-4 py-2.5 rounded-full border text-sm font-bold transition-all ${
  style === s
  ? "bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_52%)] border-[hsl(248_62%_52%/0.4)] shadow-sm"
  : "border-foreground/15 text-muted-foreground hover:border-[hsl(248_62%_52%/0.3)] hover:text-foreground hover:bg-foreground/5"
  }`}
  >
  {s}
  </button>
  ))}
  </div>
  </div>
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-foreground/70 mb-4">Patterns you keep seeing (pick up to 2)</p>
  <div className="flex flex-wrap gap-2">
  {PREVIEW_PATTERNS.map((p) => (
  <button
  key={p}
  type="button"
  onClick={() => togglePattern(p)}
  className={`px-4 py-2.5 rounded-full border text-sm font-bold transition-all ${
  patterns.includes(p)
  ? "bg-[hsl(326_100%_59%/0.1)] text-[hsl(326_100%_59%)] border-[hsl(326_100%_59%/0.4)] shadow-sm"
  : "border-foreground/15 text-muted-foreground hover:border-[hsl(326_100%_59%/0.3)] hover:text-foreground hover:bg-foreground/5"
  }`}
  >
  {p}
  </button>
  ))}
  </div>
  </div>
  </div>
  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-8">
  <Button
  onClick={runCompassRead}
  disabled={compassLoading || !style}
  size="lg"
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold px-8 shadow-md"
  >
  {compassLoading ? (
  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Running your read</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-5 w-5" /></>
  )}
  </Button>
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">A short read. The full Compass goes deeper.</span>
  </div>

  {compassResult && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 grid gap-6">
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-2">Best-fit dynamic</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{compassResult.bestDynamic}</p>
  </div>
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(43_65%_50%)] mb-2">Watch for</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{compassResult.watchFor}</p>
  </div>
  <div className="rounded-2xl p-6 bg-[hsl(326_100%_59%/0.05)] border border-[hsl(326_100%_59%/0.2)]">
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(326_100%_59%)] mb-2">Your false spark</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{compassResult.falseSpark}</p>
  </div>
  <PreviewFooterCta
  label="See the full read"
  href={compassResult.savedId ? `/compass/${compassResult.savedId}` : "/compass"}
  />
  </motion.div>
  )}
  </div>
  </TabsContent>

  {/* Messages tab */}
  <TabsContent value="messages" className="mt-0">
  <div className="glass-elevated border border-foreground/10 rounded-[2rem] p-8 md:p-10 shadow-lg">
  <p className="text-base text-muted-foreground mb-6 font-medium">
  Paste a recent chat. We'll read the tone, name the pattern, and tell you the one move that fits.
  </p>
  <Textarea
  value={messages}
  onChange={(e) => setMessages(e.target.value)}
  rows={7}
  className="resize-none text-sm font-mono p-4 rounded-xl border-foreground/15 focus:border-[hsl(248_62%_52%)] focus:ring-[hsl(248_62%_52%/0.2)] bg-background/50"
  />
  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
  <Button
  onClick={runMessageRead}
  disabled={msgLoading || messages.trim().length === 0}
  size="lg"
  className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold px-8 shadow-md"
  >
  {msgLoading ? (
  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reading your style</>
  ) : (
  <>Show me <ArrowRight className="ml-2 h-5 w-5" /></>
  )}
  </Button>
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hybrid AI. No account needed.</span>
  </div>

  {msgResult && (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 grid gap-6">
  {msgResult.attachmentStyle && (
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-2">Attachment style</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{msgResult.attachmentStyle}</p>
  </div>
  )}
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(190_55%_50%)] mb-2">Tone</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{msgResult.tone}</p>
  </div>
  <div>
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(43_65%_50%)] mb-3">What we noticed</p>
  <ul className="space-y-2">
  {msgResult.patterns.map((p, i) => (
  <li key={i} className="text-base text-foreground/80 leading-relaxed font-medium">{p}</li>
  ))}
  </ul>
  </div>
  <div className="rounded-2xl p-6 bg-[hsl(248_62%_52%/0.05)] border border-[hsl(248_62%_52%/0.2)]">
  <p className="text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] mb-2">The Move</p>
  <p className="text-base text-foreground/80 leading-relaxed font-medium">{msgResult.oneLine}</p>
  </div>
  <PreviewFooterCta
  label="See the full analysis"
  href="/insights"
  />
  </motion.div>
  )}
  </div>
  </TabsContent>
  </Tabs>
  </div>
  </div>
  </section>
  );
}

function PreviewFooterCta({ label, href }: { label: string; href: string }) {
  return (
  <div className="mt-6 pt-6 border-t border-foreground/10">
  <Button asChild variant="outline" className="w-full rounded-xl border-foreground/20 hover:bg-foreground/5 hover:text-foreground font-bold py-6 text-base">
  <Link href={href}>{label}</Link>
  </Button>
  </div>
  );
}
