import { useState, useEffect } from "react";
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
import { motion, useScroll, useTransform, animate } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

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

function Counter({ to, duration = 2.2 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      delay: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, duration]);
  return <>{val}</>;
}

const SAMPLE_LANES: { label: string; value: number; color: string }[] = [
  { label: "Profile signal", value: 82, color: "hsl(var(--brand-indigo))" },
  { label: "Conversation", value: 74, color: "hsl(var(--brand-pink))" },
  { label: "Lifestyle rhythm", value: 63, color: "hsl(var(--brand-teal))" },
  { label: "Wellness base", value: 55, color: "hsl(var(--brand-green))" },
];

function LiveReadCard() {
  return (
    <div className="glass-elevated rounded-[2rem] border border-[hsl(248_62%_52%/0.3)] p-7 md:p-8 shadow-2xl relative overflow-hidden glow-violet">
      <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[hsl(326_100%_59%/0.18)] blur-3xl pointer-events-none" />
      <div className="flex items-center justify-between mb-7 relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse shadow-[0_0_8px_hsl(142_55%_60%)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70">Echo's read</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 px-2.5 py-1 rounded-full border border-foreground/10">live demo</span>
      </div>

      <div className="flex items-end gap-3 mb-2 relative z-10">
        <span className="font-serif font-bold leading-none gradient-text tabular-nums text-7xl md:text-8xl">
          <Counter to={78} />
        </span>
        <span className="text-2xl font-bold text-muted-foreground mb-2 tabular-nums">/100</span>
      </div>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[hsl(248_62%_52%)] mb-6 relative z-10">Match readiness</p>

      <div className="h-2.5 rounded-full bg-foreground/10 overflow-hidden mb-8 relative z-10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]"
          initial={{ width: 0 }}
          animate={{ width: "78%" }}
          transition={{ duration: 2.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="space-y-4 relative z-10">
        {SAMPLE_LANES.map((lane, i) => (
          <div key={lane.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-semibold text-foreground/80">{lane.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: lane.color }}>{lane.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: lane.color }}
                initial={{ width: 0 }}
                animate={{ width: `${lane.value}%` }}
                transition={{ duration: 1.4, delay: 0.8 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-foreground/10 relative z-10">
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
          <span className="text-foreground font-bold">This is a demo read.</span> Yours starts climbing the moment Echo gets its first look at you.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  useMeta(
    "MatchLab Club: the friend who helps you find your person",
    "Meet Echo, the friend who gets to know you, helps you get genuinely ready, and walks you toward people you would never have found on your own.",
    absoluteUrl(DEFAULT_OG_IMAGE),
    { canonicalUrl: absoluteUrl("/") },
  );

  const { scrollYProgress } = useScroll();
  const heroParallax = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const abstractParallax = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <AppLayout>
      {/* 1. HERO SECTION */}
      <section className="relative mesh-bg overflow-hidden pt-28 md:pt-32 pb-24 md:pb-36 min-h-[100dvh] flex flex-col justify-center">
        <motion.div style={{ y: abstractParallax }} className="absolute inset-0 pointer-events-none">
          <div className="orb orb-violet absolute w-[900px] h-[900px] -top-72 -right-72 opacity-70" />
          <div className="orb orb-gold absolute w-[700px] h-[700px] top-[35%] -left-52 opacity-50" />
          <div className="orb orb-plum absolute w-[600px] h-[600px] bottom-0 left-1/4 opacity-50" />
        </motion.div>

        {/* ghost wordmark behind everything */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden" aria-hidden="true">
          <span
            className="font-serif font-bold italic text-foreground/[0.025] dark:text-foreground/[0.045] leading-none whitespace-nowrap select-none"
            style={{ fontSize: "clamp(8rem, 28vw, 26rem)" }}
          >
            Echo
          </span>
        </div>

        {/* machine grid overlay, masked to fade at edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(hsl(248 62% 52% / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(248 62% 52% / 0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 85% 60% at 50% 42%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 60% at 50% 42%, black, transparent 78%)",
          }}
        />

        <div className="container mx-auto px-4 relative z-10">
          {/* giant logo crown */}
          <motion.div className="flex justify-center mb-8 md:mb-10" {...fadeUp(0)}>
            <motion.img
              src="/matchlab-logo.png"
              alt="MatchLab Club"
              className="h-28 sm:h-36 md:h-44 w-auto"
              style={{
                filter:
                  "drop-shadow(0 8px 40px hsl(326 100% 60% / 0.45)) drop-shadow(0 0 60px hsl(248 75% 60% / 0.4))",
              }}
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center max-w-7xl mx-auto">
            {/* LEFT: the human pitch */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <motion.div
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-elevated border border-[hsl(326_100%_59%/0.4)] mb-8 shadow-sm"
                {...fadeUp(0.1)}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(326_100%_59%)] animate-pulse shadow-[0_0_10px_hsl(326_100%_59%)]" />
                <span className="text-xs sm:text-sm font-bold tracking-[0.18em] text-foreground/80 uppercase">
                  Private beta · meet Echo
                </span>
              </motion.div>

              <motion.h1
                className="font-serif font-bold tracking-tight leading-[0.95] mb-6 text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem]"
                {...fadeUp(0.2)}
              >
                <span className="text-foreground">A friend who actually</span>{" "}
                <span className="gradient-text italic pr-1">knows you.</span>
                <br className="hidden sm:block" />
                <span className="text-foreground">And helps you find your person.</span>
              </motion.h1>

              <motion.p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-[hsl(248_62%_52%)] mb-7 tabular-nums"
                {...fadeUp(0.28)}
              >
                in your corner, from first hello to the right person
              </motion.p>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed mb-10 font-medium"
                {...fadeUp(0.34)}
              >
                Every app reduces you to a few photos and a half-second swipe. Echo is the friend underneath all of it. It gets to know the real you, helps you get genuinely ready, and walks you toward people you would never have found on your own.
              </motion.p>

              <motion.div className="flex flex-col sm:flex-row items-center lg:items-start gap-5" {...fadeUp(0.42)}>
                <Button
                  asChild
                  size="lg"
                  className="rounded-full font-bold h-16 md:h-[4.5rem] px-10 md:px-12 text-lg md:text-xl bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse text-white shadow-[0_8px_40px_hsl(248_62%_52%/0.5)] hover:scale-[1.03] transition-transform w-full sm:w-auto"
                >
                  <Link href="/signal-check">Meet Echo <ArrowRight className="ml-3 h-6 w-6" /></Link>
                </Button>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-[hsl(248_62%_52%/0.25)] hover:border-[hsl(248_62%_52%/0.6)] hover:bg-[hsl(248_62%_52%/0.08)] transition-all group text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  <Brain className="w-4 h-4 text-[hsl(248_62%_52%)]" />
                  How Echo works
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              <motion.div
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm font-semibold text-muted-foreground mt-8"
                {...fadeUp(0.5)}
              >
                <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-[hsl(248_62%_52%)]" /> 3 minutes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4 text-[hsl(142_55%_50%)]" /> No account required</span>
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4 text-[hsl(326_100%_59%)]" /> Private by design</span>
              </motion.div>
            </div>

            {/* RIGHT: Echo's read on you */}
            <motion.div
              className="lg:col-span-5 w-full max-w-md mx-auto lg:max-w-none"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <LiveReadCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* 1.5 THE INTERRUPT */}
      <section
        className="relative overflow-hidden py-28 md:py-40"
        style={{ background: "linear-gradient(160deg, #131234 0%, #1d1147 55%, #2a0f3d 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="orb orb-violet absolute w-[700px] h-[700px] -top-40 -left-40 opacity-40" />
          <div className="orb orb-rose absolute w-[600px] h-[600px] -bottom-52 -right-24 opacity-40" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <motion.p
              className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-[hsl(326_100%_72%)] mb-8"
              {...fadeUp(0.05)}
            >
              The uncomfortable truth
            </motion.p>
            <motion.h2
              className="font-serif font-bold leading-[1.02] tracking-tight text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-10"
              {...fadeUp(0.12)}
            >
              The apps were never built <br className="hidden md:block" />
              to get you <span className="italic" style={{ color: "#FF6FC4" }}>chosen.</span>
            </motion.h2>
            <motion.p
              className="text-lg md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed font-medium mb-16"
              {...fadeUp(0.2)}
            >
              They are built to keep you swiping. Every day you stay average is a day they keep you scrolling. Echo flips it: it gets to know the real you, then quietly helps you become the person other people stop on.
            </motion.p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
              <motion.div
                className="rounded-[2rem] p-8 border border-white/10 bg-white/[0.03]"
                {...fadeUp(0.26)}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/55 mb-5">What the apps see</p>
                <ul className="space-y-3">
                  {["Six photos", "A one-line bio", "A half-second swipe"].map((x) => (
                    <li key={x} className="flex items-center gap-3 text-white/65 font-medium text-lg line-through decoration-white/40">
                      <Eye className="w-5 h-5 flex-shrink-0 text-white/45" /> {x}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div
                className="rounded-[2rem] p-8 border border-[hsl(326_100%_72%/0.4)]"
                style={{ background: "linear-gradient(160deg, hsl(248 62% 52% / 0.25), hsl(326 100% 59% / 0.15))" }}
                {...fadeUp(0.32)}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(326_100%_80%)] mb-5">What Echo pays attention to</p>
                <ul className="space-y-3">
                  {["Your real conversation patterns", "Your lifestyle and rhythm", "Your readiness, climbing over time"].map((x) => (
                    <li key={x} className="flex items-center gap-3 text-white font-semibold text-lg">
                      <Zap className="w-5 h-5 flex-shrink-0 text-[hsl(326_100%_75%)]" /> {x}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            <motion.div className="mt-16" {...fadeUp(0.4)}>
              <Button
                asChild
                size="lg"
                className="rounded-full font-bold h-16 px-12 text-lg bg-white text-[#131234] hover:bg-white/90 hover:scale-[1.03] transition-all shadow-2xl"
              >
                <Link href="/signal-check">Become the one they stop on <ArrowRight className="ml-3 h-5 w-5" /></Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. THE READINESS CLIMB */}
      <section className="py-32 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)] relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-24 max-w-3xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-4">How Echo gets to know you</p>
            <h2 className="text-4xl md:text-6xl font-serif font-bold text-foreground leading-tight">
              The more Echo knows you, <br />
              <span className="gradient-text italic pr-1">the better it matches you.</span>
            </h2>
            <p className="text-muted-foreground text-xl mt-6 leading-relaxed font-medium">
              Dozens of real tools, and each one does two things at once. It helps you today, and it lets Echo understand you a little better, so the matches it works toward actually fit.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                step: "01",
                title: "Let Echo get to know you",
                desc: "Check a profile, talk through a conversation, paste a calendar, or take a quiz. Every move tells Echo something true about you.",
                color: "hsl(var(--brand-indigo))",
              },
              {
                step: "02",
                title: "Watch your readiness climb",
                desc: "Every move nudges one central number. Your Match Readiness grows as Echo learns your patterns.",
                color: "hsl(var(--brand-gold))",
              },
              {
                step: "03",
                title: "Earn the introduction",
                desc: "When you are genuinely ready, Echo works toward introducing you to people near you. No swipe carousel.",
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
              The tools Echo brings <br className="hidden md:block" />
              <span className="gradient-text italic pr-1">to the table.</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed font-medium">
              These are the tools Echo uses to help you right now. Each one is useful today on its own, and each one also helps Echo know you better, which is what earns you introductions to people you would never have found on your own.
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
              Start for free. Upgrade when you want everything Echo can do with you.
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
              <Link
                href="/match-path"
                className="mt-4 inline-flex items-center justify-center gap-1 text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                data-testid="link-match-path"
              >
                See what it takes to get matched
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
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
            <h3 className="text-3xl font-serif font-bold mb-8">Ready to let Echo get to know you?</h3>
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
