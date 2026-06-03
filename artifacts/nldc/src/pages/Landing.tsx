import { useState } from "react";
import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ArrowRight, Shield, Clock, Brain, User, CheckSquare, Sparkles,
  LineChart, Database, History, HelpCircle, Target, FileText,
  MessageCircle, Compass, Camera, BookOpen, Download, CalendarDays, 
  Instagram, Mail, Wallet, Music2, Palette, Film, Footprints, HeartPulse, 
  Flame, Lock, LayoutGrid, Zap, Eye, MessageSquare, Trophy, Activity,
  LockKeyhole
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { staggerChildren: 0.15 }
};

const staggerItem = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
};

export default function Landing() {
  useMeta(
    "MatchLab Club: A second brain for your dating life",
    "Feed your real signals into one engine. Build your match readiness score. Earn introductions to people you would never find on your own.",
  );

  const { scrollYProgress } = useScroll();
  const heroParallax = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const abstractParallax = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <AppLayout>
      {/* 1. HERO SECTION */}
      <section className="relative mesh-bg overflow-hidden pt-20 md:pt-32 pb-32 md:pb-48 min-h-[100dvh] flex flex-col justify-center">
        <motion.div style={{ y: abstractParallax }} className="absolute inset-0 pointer-events-none">
          <div className="orb orb-violet absolute w-[800px] h-[800px] -top-60 -right-60 opacity-60" />
          <div className="orb orb-gold absolute w-[600px] h-[600px] top-[40%] -left-40 opacity-40" />
          <div className="orb orb-plum absolute w-[500px] h-[500px] bottom-0 left-1/4 opacity-50" />
        </motion.div>

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
          <motion.div style={{ y: heroParallax }} className="max-w-4xl mx-auto text-center w-full">
            <motion.div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-elevated border border-[hsl(248_62%_52%/0.3)] mb-12 shadow-sm" {...fadeUp(0.1)}>
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse shadow-[0_0_8px_hsl(142_55%_60%)]" />
              <span className="text-sm font-semibold tracking-wider text-foreground/80 uppercase">Private beta underway</span>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[7rem] font-serif font-bold tracking-tight leading-[1.05] mb-8"
              {...fadeUp(0.2)}
            >
              <span className="text-foreground">One machine.</span>{" "}
              <br className="hidden md:block" />
              <span className="gradient-text italic pr-2">Better introductions.</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-12 font-medium"
              {...fadeUp(0.3)}
            >
              A second brain for your dating life. Everything you do here feeds a single engine that learns who you are, tracks your readiness, and works toward introducing you to people you actually want to meet.
            </motion.p>

            <motion.div className="flex flex-col items-center gap-6" {...fadeUp(0.4)}>
              <Button
                asChild
                size="lg"
                className="rounded-full font-bold h-16 md:h-20 px-10 md:px-14 text-lg md:text-xl bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_40px_hsl(248_62%_52%/0.5)] hover:scale-[1.02] transition-transform"
              >
                <Link href="/signal-check">Get your free Signal Check <ArrowRight className="ml-3 h-6 w-6" /></Link>
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold text-muted-foreground mt-2">
                <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-[hsl(248_62%_52%)]" /> 3 minutes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 hidden md:block" />
                <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4 text-[hsl(142_55%_50%)]" /> No account required</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 hidden md:block" />
                <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4 text-[hsl(326_100%_59%)]" /> Private by design</span>
              </div>

              <motion.div {...fadeUp(0.5)} className="mt-8">
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-[hsl(248_62%_52%/0.25)] hover:border-[hsl(248_62%_52%/0.6)] hover:bg-[hsl(248_62%_52%/0.08)] transition-all group text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Brain className="w-4 h-4 text-[hsl(248_62%_52%)]" />
                  See how the machine works, end to end
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 2. THE READINESS CLIMB */}
      <section className="py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-4">The Readiness Loop</p>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-foreground leading-tight">
              Feed signals in. <br />
              <span className="gradient-text italic pr-1">Get introductions out.</span>
            </h2>
            <p className="text-muted-foreground text-xl mt-6 leading-relaxed font-medium">
              We ship dozens of working tools. Each one gives you immediate value today, and every action feeds the machine to build your readiness for tomorrow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: "01",
                title: "Feed your signals",
                desc: "Audit a profile, analyze a conversation, paste a calendar, or take a quiz. Every tool is a data source.",
                color: "hsl(var(--brand-indigo))",
              },
              {
                step: "02",
                title: "Build your readiness",
                desc: "Every signal moves one central number. Your Match Readiness meter grows as the machine learns your patterns.",
                color: "hsl(var(--brand-gold))",
              },
              {
                step: "03",
                title: "Earn the payoff",
                desc: "When your readiness is high enough, the engine works toward introducing you to people near you. No swipe carousel.",
                color: "hsl(142 55% 50%)",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="glass-strong rounded-[2.5rem] p-12 card-hover flex flex-col relative overflow-hidden group"
                style={{ border: `1px solid ${withAlpha(item.color, 0.2)}` }}
                initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.7 }}
              >
                <div className="absolute -top-4 -right-4 p-8 text-9xl font-serif font-bold opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none" style={{ color: item.color }}>
                  {item.step}
                </div>
                <div className="w-16 h-16 rounded-2xl mb-8 flex items-center justify-center" style={{ background: withAlpha(item.color, 0.1) }}>
                  <span className="text-2xl font-bold" style={{ color: item.color }}>{item.step}</span>
                </div>
                <h3 className="text-3xl font-bold text-foreground mb-4 relative z-10">{item.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed mb-4 flex-1 relative z-10 font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. THE MACHINE (Tools) */}
      <section className="py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="orb orb-violet absolute w-[800px] h-[800px] -top-40 -left-40 opacity-20 pointer-events-none" />
        <div className="orb orb-rose absolute w-[600px] h-[600px] bottom-0 right-0 opacity-10 pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-24 max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-serif font-bold text-foreground mb-8 leading-tight">
              An entire suite of tools, <br className="hidden md:block" />
              <span className="gradient-text italic pr-1">working together.</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed font-medium">
              We built the exact tools you need to optimize what you are doing right now. The difference is they all talk to each other, feeding a single understanding of who you are.
            </p>
          </div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
          >
            {[
              { icon: FileText, title: "Signal Check", desc: "A fast read of your profile with bio and prompt rewrites, plus a Signal Score.", href: "/signal-check", color: "hsl(var(--brand-indigo))" },
              { icon: Camera, title: "Photo Critique", desc: "Always-on deterministic checklist, plus opt-in vision to read how your photos actually land.", href: "/signal-check", color: "hsl(326 100% 59%)" },
              { icon: MessageCircle, title: "Message Coach", desc: "Paste a conversation and get replies with the reasoning behind each.", href: "/coach", color: "hsl(190 55% 55%)" },
              { icon: History, title: "Insights & History", desc: "Paste your message history to see communication patterns and your attachment style.", href: "/insights", color: "hsl(var(--brand-gold))" },
              { icon: Compass, title: "Compatibility Compass", desc: "A deeper read on who you actually work well with and what you respond to.", href: "/compatibility-compass", color: "hsl(var(--brand-indigo))" },
              { icon: LayoutGrid, title: "Wingman Studio", desc: "Your copilot hub for pre-date prep, flirt coaching, post-date debriefs, and growth plans.", href: "/copilot", color: "hsl(326 100% 59%)" },
              { icon: LineChart, title: "Progress Suite", desc: "Track your scorecard, dating timeline, patterns, experiments, and a dating wins log.", href: "/progress/scorecard", color: "hsl(285 55% 56%)" },
              { icon: BookOpen, title: "Your Mirror", desc: "A private journal and structured post-date notes to spot your own patterns.", href: "/your-mirror", color: "hsl(248 62% 52%)" },
              { icon: HeartPulse, title: "Wellness Center", desc: "Track the life dimensions that feed your readiness, from sleep to social energy.", href: "/wellness", color: "hsl(142 55% 50%)" },
            ].map((tool, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Link
                  href={tool.href}
                  className="group flex flex-col p-8 rounded-[2rem] glass-strong border border-foreground/10 hover:-translate-y-2 hover:shadow-xl hover:border-[hsl(248_62%_52%/0.4)] transition-all h-full relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: tool.color }} />
                  <div className="flex items-center gap-5 mb-6 relative z-10">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-black/40 shadow-sm"
                      style={{ border: `1px solid ${withAlpha(tool.color, 0.3)}` }}
                    >
                      <tool.icon className="w-7 h-7" style={{ color: tool.color }} />
                    </div>
                    <h3 className="text-xl font-bold text-foreground leading-tight group-hover:text-[hsl(248_62%_52%)] transition-colors">{tool.title}</h3>
                  </div>
                  <p className="text-base text-muted-foreground leading-relaxed relative z-10">{tool.desc}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 4. THE VAULT / CONNECTIONS */}
      <section className="py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="orb orb-gold absolute w-[600px] h-[600px] top-0 right-0 opacity-20 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-20 max-w-7xl mx-auto items-center">
            <motion.div {...fadeUp(0.1)} className="order-2 lg:order-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { icon: Database, label: "Your Vault", status: "Live", color: "hsl(var(--brand-indigo))" },
                  { icon: Download, label: "Hinge export", status: "Import", color: "hsl(348 75% 60%)" },
                  { icon: CalendarDays, label: "Calendar rhythm", status: "Paste", color: "hsl(248 62% 60%)" },
                  { icon: Instagram, label: "Instagram tone", status: "Upload", color: "hsl(326 70% 60%)" },
                  { icon: Sparkles, label: "Taste paste", status: "Paste", color: "hsl(326 70% 60%)" },
                  { icon: Footprints, label: "Lifestyle paste", status: "Paste", color: "hsl(248 62% 60%)" },
                  { icon: Mail, label: "Forwarding inbox", status: "Building", color: "hsl(326 100% 62%)" },
                  { icon: Wallet, label: "Plaid spending", status: "Building", color: "hsl(142 55% 55%)" },
                  { icon: Music2, label: "Music taste", status: "Paste", color: "hsl(141 73% 42%)" },
                ].map((s, i) => {
                  const isActive = s.status === "Live" || s.status === "Import" || s.status === "Paste" || s.status === "Upload";
                  const statusColor = isActive ? "hsl(142 55% 60%)" : s.status === "Building" ? "hsl(var(--brand-indigo))" : "hsl(43 65% 65%)";
                  return (
                    <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                      <Link
                        href={s.label === "Your Vault" ? "/vault" : "/connections"}
                        className="glass border border-foreground/10 rounded-2xl p-5 flex flex-col gap-4 h-full hover:-translate-y-1 hover:shadow-lg transition-all"
                      >
                        <div className="flex justify-between items-start w-full">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-black/40" style={{ border: `1px solid ${withAlpha(s.color, 0.3)}` }}>
                            <s.icon className="w-6 h-6" style={{ color: s.color }} />
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-background/50 px-2 py-1 rounded-full border border-foreground/5" style={{ color: statusColor }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
                            {s.status}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-foreground leading-tight">{s.label}</p>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="order-1 lg:order-2">
              <p className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--brand-gold))] mb-4">Connection Center</p>
              <h2 className="text-5xl font-serif font-bold text-foreground mb-8 leading-tight">
                Plug in your <span className="gradient-text italic pr-1">real world.</span>
              </h2>
              <div className="space-y-6 text-xl text-muted-foreground leading-relaxed font-medium">
                <p>
                  You generate signals everywhere. We let you pull them together in one private vault.
                </p>
                <p>
                  Every connection is opt-in, consent-first, and clearly states what we see and what we never touch. We do not pretend calendar imports or Instagram pastes are live background syncs. You paste or upload what you want us to read.
                </p>
              </div>
              <div className="mt-12">
                <Link href="/connections" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-foreground text-background font-bold hover:opacity-90 transition-opacity">
                  Explore Connections <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. THE STANDARD */}
      <section className="py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">The MatchLab Standard</h2>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">We hold ourselves to a standard that exists nowhere else.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <motion.div className="glass-strong rounded-[2rem] p-10 border border-[hsl(142_55%_50%/0.3)] shadow-lg" {...fadeUp(0.1)}>
              <Shield className="w-12 h-12 text-[hsl(142_55%_50%)] mb-6" />
              <h3 className="font-bold text-foreground text-2xl mb-4">Clear privacy boundaries</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">Our deterministic engine runs with no external calls. Deep AI via Anthropic is strictly opt-in, zero-retention, never sold, and never used for training. Export or delete everything anytime.</p>
            </motion.div>
            
            <motion.div className="glass-strong rounded-[2rem] p-10 border border-[hsl(248_62%_52%/0.3)] shadow-lg" {...fadeUp(0.2)}>
              <User className="w-12 h-12 text-[hsl(248_62%_52%)] mb-6" />
              <h3 className="font-bold text-foreground text-2xl mb-4">Built for everyone</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">Inclusive by default. All genders, all orientations. The work of being seen clearly applies to every kind of connection. We are never a niche app.</p>
            </motion.div>
            
            <motion.div className="glass-strong rounded-[2rem] p-10 border border-[hsl(326_100%_59%/0.3)] shadow-lg" {...fadeUp(0.3)}>
              <LockKeyhole className="w-12 h-12 text-[hsl(326_100%_59%)] mb-6" />
              <h3 className="font-bold text-foreground text-2xl mb-4">Honest capabilities</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">We do not sell magic. We provide tools that require your input. Readiness is earned through interaction, not bought with a premium tier.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. PRICING & FINAL CTA */}
      <section className="py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="orb orb-violet absolute w-[800px] h-[800px] bottom-0 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-serif font-bold text-foreground mb-8 leading-tight">
              Simple pricing. <br />
              <span className="gradient-text italic pr-1">No tricks.</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed font-medium">
              Start for free. Upgrade when you want the whole engine.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-24">
            <motion.div className="glass-strong rounded-[2.5rem] p-12 border border-foreground/10 flex flex-col" {...fadeUp(0.1)}>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground mb-2">Free</p>
                <p className="text-5xl font-serif font-bold mb-6">$0</p>
                <p className="text-lg text-muted-foreground mb-10 font-medium">The Signal Check, basic audits, and the deterministic photo checklist.</p>
                <ul className="space-y-4 mb-10">
                  <li className="flex items-center gap-3 font-medium text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(142_55%_50%)]" /> 1 Signal Check per month</li>
                  <li className="flex items-center gap-3 font-medium text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(142_55%_50%)]" /> Deterministic Insights</li>
                  <li className="flex items-center gap-3 font-medium text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(142_55%_50%)]" /> Private Vault</li>
                </ul>
              </div>
              <Button asChild variant="outline" size="lg" className="w-full rounded-full border-foreground/20 font-bold h-14 text-lg">
                <Link href="/signal-check">Start free</Link>
              </Button>
            </motion.div>

            <motion.div className="glass-strong rounded-[2.5rem] p-12 border border-[hsl(248_62%_52%/0.5)] shadow-2xl relative flex flex-col glow-violet" {...fadeUp(0.2)}>
              <div className="absolute top-0 right-10 -translate-y-1/2 px-4 py-1.5 bg-[hsl(248_62%_52%)] text-white text-sm font-bold uppercase tracking-wider rounded-full shadow-lg">
                Lifetime Access
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-foreground mb-2">The Club</p>
                <p className="text-5xl font-serif font-bold mb-6">$97 <span className="text-xl text-muted-foreground font-sans font-medium">one-time</span></p>
                <p className="text-lg text-muted-foreground mb-10 font-medium">Full access to the current suite of tools, forever. Watch your readiness score grow over time.</p>
                <ul className="space-y-4 mb-10">
                  <li className="flex items-center gap-3 font-bold text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(248_62%_52%)]" /> Unlimited Signal Checks</li>
                  <li className="flex items-center gap-3 font-bold text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(248_62%_52%)]" /> Full Copilot Suite</li>
                  <li className="flex items-center gap-3 font-bold text-foreground"><CheckSquare className="w-5 h-5 text-[hsl(248_62%_52%)]" /> Deep AI Vision & Analysis</li>
                </ul>
              </div>
              <Button asChild size="lg" className="w-full rounded-full bg-[hsl(248_62%_52%)] hover:bg-[hsl(248_62%_52%/0.9)] text-white font-bold h-14 text-lg shadow-lg hover:shadow-xl transition-all">
                <Link href="/pricing">View details</Link>
              </Button>
            </motion.div>
          </div>
          
          <motion.div className="text-center max-w-2xl mx-auto" {...fadeUp(0.4)}>
            <h3 className="text-3xl font-serif font-bold mb-8">Ready to feed the machine?</h3>
            <Button
              asChild
              size="lg"
              className="rounded-full font-bold h-20 px-14 text-xl bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_40px_hsl(248_62%_52%/0.5)] hover:scale-[1.02] transition-transform"
            >
              <Link href="/signal-check">Begin the climb <ArrowRight className="ml-3 h-6 w-6" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
