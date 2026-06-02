import { useState } from "react";
import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  ArrowRight, Shield, Clock, Brain, TrendingUp, Users, FileText, 
  MessageCircle, Compass, Camera, BookOpen, Download, CalendarDays, 
  Instagram, Mail, Wallet, Music2, Palette, Clapperboard, Film, 
  Footprints, HeartPulse, Flame, Lock, LayoutGrid, Sparkles,
  LineChart, Database, History, HelpCircle, User, CheckSquare, Target,
  Zap, Eye, MessageSquare, PenTool, Trophy, BarChart2, Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const staggerContainer = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { staggerChildren: 0.1 }
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }
};

export default function Landing() {
  useMeta(
    "MatchLab Club: A second brain for your dating life",
    "Feed your real signals into one engine. Build your match readiness score. Earn introductions to people you would never find on your own.",
  );

  return (
    <AppLayout>
      {/* 1. HERO SECTION */}
      <section className="relative mesh-bg overflow-hidden pt-16 md:pt-28 pb-24 md:pb-32 min-h-[90vh] flex flex-col justify-center">
        <div className="orb orb-violet absolute w-[800px] h-[800px] -top-60 -right-60 opacity-60 pointer-events-none" />
        <div className="orb orb-gold absolute w-[500px] h-[500px] bottom-0 left-1/4 opacity-40 pointer-events-none" />
        <div className="orb orb-plum absolute w-[400px] h-[400px] top-40 -left-20 opacity-50 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center">
          <div className="max-w-4xl mx-auto text-center w-full">
            <motion.div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-elevated border border-[hsl(248_62%_52%/0.3)] mb-10 shadow-sm" {...fadeUp(0.1)}>
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse shadow-[0_0_8px_hsl(142_55%_60%)]" />
              <span className="text-xs md:text-sm font-semibold tracking-wide text-foreground/80 uppercase">Private beta underway</span>
            </motion.div>

            <motion.h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] font-serif font-bold tracking-tight leading-[1.05] mb-8"
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
                className="rounded-full font-bold h-16 md:h-20 px-10 md:px-12 text-lg md:text-xl bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_40px_hsl(248_62%_52%/0.5)] hover:scale-[1.02] transition-transform"
              >
                <Link href="/signal-check">Get your free Signal Check <ArrowRight className="ml-3 h-6 w-6" /></Link>
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground mt-2">
                <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-[hsl(248_62%_52%)]" /> 3 minutes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4 text-[hsl(142_55%_50%)]" /> No account required</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4 text-[hsl(326_100%_59%)]" /> Private by design</span>
              </div>

              <motion.div {...fadeUp(0.5)} className="mt-7">
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-[hsl(248_62%_52%/0.25)] hover:border-[hsl(248_62%_52%/0.5)] hover:bg-[hsl(248_62%_52%/0.06)] transition-all group text-sm font-semibold text-muted-foreground hover:text-foreground"
                  data-testid="link-landing-how-it-works"
                >
                  <Brain className="w-4 h-4 text-[hsl(248_62%_52%)]" />
                  See how the machine works, end to end
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. THE LOOP */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-4">The Readiness Loop</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
              Feed signals in. <span className="gradient-text italic pr-1">Get introductions out.</span>
            </h2>
            <p className="text-muted-foreground text-lg mt-6 leading-relaxed">
              We ship dozens of working tools. Each one gives you immediate value today, and every action feeds the machine to build your readiness for tomorrow.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
                className="glass rounded-[2rem] p-10 card-hover flex flex-col relative overflow-hidden"
                style={{ border: `1px solid ${withAlpha(item.color, 0.2)}` }}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
              >
                <div className="absolute top-0 right-0 p-8 text-8xl font-serif font-bold opacity-5 pointer-events-none" style={{ color: item.color }}>
                  {item.step}
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4 relative z-10">{item.title}</h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-8 flex-1 relative z-10 font-medium">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FORTY TOOLS, ONE BRAIN */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-20 -left-20 opacity-20 pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              An entire suite of tools, <span className="gradient-text italic pr-1">working together.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              We built the exact tools you need to optimize what you are doing right now. The difference is they all talk to each other, feeding a single understanding of who you are.
            </p>
          </div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {[
              { icon: FileText, title: "Signal Check", desc: "A fast read of your profile with bio and prompt rewrites, plus a Signal Score.", href: "/signal-check", color: "hsl(var(--brand-indigo))" },
              { icon: Camera, title: "Photo Critique", desc: "Always-on deterministic checklist, plus opt-in Deep AI vision to read how your photos actually land.", href: "/signal-check", color: "hsl(326 100% 59%)" },
              { icon: MessageCircle, title: "Message Coach", desc: "Paste a conversation and get Playful, Direct, or Warm replies with the reasoning behind each.", href: "/coach", color: "hsl(190 55% 55%)" },
              { icon: History, title: "Insights & History", desc: "Paste your message history to see communication patterns and your attachment style.", href: "/insights", color: "hsl(var(--brand-gold))" },
              { icon: Compass, title: "Compatibility Compass", desc: "A deeper read on who you actually work well with and what you respond to.", href: "/compatibility-compass", color: "hsl(var(--brand-indigo))" },
              { icon: HelpCircle, title: "Interactive Quizzes", desc: "Dating quizzes that give you personal answers and teach the engine about your preferences.", href: "/quizzes", color: "hsl(142 55% 50%)" },
              { icon: LayoutGrid, title: "Wingman Studio", desc: "Your copilot hub for pre-date prep, flirt coaching, post-date debriefs, and weekly growth plans.", href: "/copilot", color: "hsl(326 100% 59%)" },
              { icon: LineChart, title: "Progress Suite", desc: "Track your scorecard, dating timeline, patterns, experiments, and a dating wins log.", href: "/progress/scorecard", color: "hsl(285 55% 56%)" },
              { icon: BookOpen, title: "Your Mirror", desc: "A private journal and structured post-date notes to spot your own patterns.", href: "/your-mirror", color: "hsl(248 62% 52%)" },
              { icon: HeartPulse, title: "Wellness Center", desc: "Track the life dimensions that feed your readiness, from sleep to social energy.", href: "/wellness", color: "hsl(142 55% 50%)" },
              { icon: MessageSquare, title: "Companion Workspace", desc: "A library of copy-ready messages for real scenarios, ready when you are.", href: "/progress/companion", color: "hsl(38 90% 50%)" },
              { icon: Trophy, title: "Dating Wins Log", desc: "Keep track of the small victories, not just the matches.", href: "/progress/wins", color: "hsl(var(--brand-gold))" },
            ].map((tool, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Link
                  href={tool.href}
                  className="group flex flex-col p-6 rounded-2xl glass-strong border border-foreground/10 hover:-translate-y-1 hover:shadow-lg hover:border-[hsl(248_62%_52%/0.3)] transition-all h-full"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: withAlpha(tool.color, 0.12), border: `1px solid ${withAlpha(tool.color, 0.25)}` }}
                    >
                      <tool.icon className="w-6 h-6" style={{ color: tool.color }} />
                    </div>
                    <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-[hsl(248_62%_52%)] transition-colors">{tool.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 4. CONNECTION CENTER & ROADMAP */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="orb orb-gold absolute w-[400px] h-[400px] -bottom-32 -right-24 opacity-25 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--brand-gold))] mb-4">Connection Center</p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Plug in your <span className="gradient-text italic pr-1">real world.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              You generate signals everywhere. We let you pull them together in one private vault. Every connection is opt-in, consent-first, and clearly states what we see and what we never touch.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-12">
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
              { icon: Film, label: "Film taste", status: "Paste", color: "hsl(28 80% 55%)" },
              { icon: BookOpen, label: "Reading taste", status: "Paste", color: "hsl(38 90% 50%)" },
              { icon: History, label: "Curiosity trail", status: "Paste", color: "hsl(207 70% 45%)" },
              { icon: Activity, label: "Vitality rhythm", status: "Paste", color: "hsl(348 70% 60%)" },
              { icon: Footprints, label: "Strava rhythm", status: "Researching", color: "hsl(18 90% 55%)" },
              { icon: Palette, label: "Photo library vibe", status: "Researching", color: "hsl(348 80% 55%)" },
            ].map((s, i) => {
              const isActive = s.status === "Live" || s.status === "Import" || s.status === "Paste" || s.status === "Upload";
              const statusColor = isActive ? "hsl(142 55% 60%)" : s.status === "Building" ? "hsl(var(--brand-indigo))" : "hsl(43 65% 65%)";
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                  <Link
                    href={s.label === "Your Vault" ? "/vault" : "/connections"}
                    className="glass border border-foreground/10 rounded-2xl p-4 flex flex-col gap-3 h-full hover:-translate-y-0.5 hover:shadow-lg transition-all"
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: withAlpha(s.color, 0.12), border: `1px solid ${withAlpha(s.color, 0.25)}` }}>
                        <s.icon className="w-5 h-5" style={{ color: s.color }} />
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-tight">{s.label}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center">
            <Link href="/connections" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[hsl(248_62%_52%)] hover:opacity-80 transition-opacity">
              Explore the Connection Center <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. THE PAYOFF & THE STANDARD */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 max-w-6xl mx-auto items-center">
            <motion.div {...fadeUp(0.1)}>
              <p className="text-sm font-bold uppercase tracking-widest text-[hsl(326_100%_58%)] mb-4">The Payoff</p>
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
                Introductions you <span className="gradient-text italic pr-1">actually want.</span>
              </h2>
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed font-medium">
                <p>
                  We are building toward real, radius-based AI introductions. It is not a live user-to-user pool today. It is the reward you earn when your readiness score hits the mark.
                </p>
                <p>
                  No swiping. No infinite scroll. Just a small number of well-considered people near you, presented only when both of you are ready for a real connection.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/matching" className="inline-flex items-center gap-2 font-bold text-foreground hover:text-[hsl(248_62%_52%)] transition-colors">
                  See how matching will work <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <motion.div className="glass-strong rounded-[2rem] p-8 lg:p-10 border border-[hsl(248_62%_52%/0.2)] shadow-xl" {...fadeUp(0.3)}>
              <h3 className="text-2xl font-serif font-bold text-foreground mb-6">The MatchLab Standard</h3>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <Shield className="w-6 h-6 text-[hsl(142_55%_50%)] shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-foreground text-lg">Clear privacy boundaries</p>
                    <p className="text-sm text-muted-foreground mt-1">Our deterministic engine runs with no external calls. Deep AI via Anthropic Claude is strictly opt-in per account, zero-retention, never sold, and never used for training. You can export and delete everything anytime.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <User className="w-6 h-6 text-[hsl(248_62%_52%)] shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-foreground text-lg">Built for everyone</p>
                    <p className="text-sm text-muted-foreground mt-1">Inclusive by default. All genders, all orientations. The work of being seen clearly applies to every kind of connection. We are never a niche app.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <Flame className="w-6 h-6 text-[hsl(326_100%_59%)] shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-foreground text-lg">Honest capabilities</p>
                    <p className="text-sm text-muted-foreground mt-1">We do not pretend calendar imports or Instagram pastes are live background syncs. You paste or upload what you want us to read. One toggle removes any source and purges its data.</p>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. PRICING */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6 leading-tight">
              Simple pricing. <span className="gradient-text italic pr-1">No tricks.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Start for free. Upgrade when you want the whole engine.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <motion.div className="glass rounded-[2rem] p-8 border border-foreground/10 flex flex-col" {...fadeUp(0.1)}>
              <div className="flex-1">
                <p className="text-xl font-bold text-foreground mb-2">Free</p>
                <p className="text-4xl font-serif font-bold mb-4">$0</p>
                <p className="text-sm text-muted-foreground mb-8">The Signal Check, basic audits, and the deterministic photo checklist.</p>
              </div>
              <Button asChild variant="outline" className="w-full rounded-full border-foreground/20 font-bold">
                <Link href="/signal-check">Start free</Link>
              </Button>
            </motion.div>

            <motion.div className="glass-strong rounded-[2rem] p-8 border border-[hsl(248_62%_52%/0.4)] shadow-lg relative flex flex-col" {...fadeUp(0.2)}>
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-[hsl(248_62%_52%)] text-white text-xs font-bold uppercase tracking-wider rounded-full">
                Most popular
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold text-foreground mb-2">Lifetime</p>
                <p className="text-4xl font-serif font-bold mb-4">$97 <span className="text-lg text-muted-foreground font-sans font-medium">one-time</span></p>
                <p className="text-sm text-muted-foreground mb-8">Full access to the current suite of tools, forever. Watch your readiness score grow over time.</p>
              </div>
              <Button asChild className="w-full rounded-full bg-[hsl(248_62%_52%)] hover:bg-[hsl(248_62%_52%/0.9)] text-white font-bold">
                <Link href="/pricing">View details</Link>
              </Button>
            </motion.div>

            <motion.div className="glass rounded-[2rem] p-8 border border-foreground/10 flex flex-col" {...fadeUp(0.3)}>
              <div className="flex-1">
                <p className="text-xl font-bold text-foreground mb-2">Monthly</p>
                <p className="text-4xl font-serif font-bold mb-4">$197 <span className="text-lg text-muted-foreground font-sans font-medium">/mo</span></p>
                <p className="text-sm text-muted-foreground mb-8">For those who want intense, ongoing coaching access and priority features.</p>
              </div>
              <Button asChild variant="outline" className="w-full rounded-full border-foreground/20 font-bold">
                <Link href="/pricing">View details</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER CTA */}
      <section className="py-24 md:py-32 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <motion.div {...fadeUp(0.1)} className="max-w-3xl">
            <h2 className="text-5xl md:text-6xl font-serif font-bold text-foreground mb-8 leading-tight">
              Ready to feed <span className="gradient-text italic pr-1">the machine?</span>
            </h2>
            <Button
              asChild
              size="lg"
              className="rounded-full font-bold h-16 px-10 text-lg bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white hover:scale-[1.02] transition-transform"
            >
              <Link href="/signal-check">Get your free Signal Check <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}