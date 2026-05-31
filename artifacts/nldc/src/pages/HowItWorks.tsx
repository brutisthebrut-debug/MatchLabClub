import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMirrorPortrait,
  getGetMirrorPortraitQueryKey,
  type MirrorPortrait,
} from "@workspace/api-client-react";
import { DEMO_PORTRAIT } from "@/lib/mirrorDemo";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  MessageCircle,
  Camera,
  CalendarDays,
  Wallet,
  Instagram,
  HelpCircle,
  Eye,
  EyeOff,
  Brain,
  Gauge,
  MapPin,
  Users,
  Shield,
  Lock,
  Compass,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: {
    duration: 0.65,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

const INDIGO = "hsl(var(--brand-indigo))";
const GOLD = "hsl(var(--brand-gold))";
const GREEN = "hsl(142 55% 50%)";
const PINK = "hsl(326 100% 59%)";

// Stage 1: the kinds of signal a person feeds in. Honest status labels, mirrors
// the Connection Center / tool surface. Nothing here pretends to be live.
const SIGNAL_SOURCES = [
  {
    icon: FileText,
    label: "Profile audits",
    detail: "Your bio, prompts, and Signal Score across eight dimensions.",
    color: INDIGO,
  },
  {
    icon: MessageCircle,
    label: "Message samples",
    detail: "How you actually open, reply, and carry a conversation.",
    color: "hsl(190 55% 55%)",
  },
  {
    icon: Camera,
    label: "Photo reads",
    detail: "A deterministic checklist, plus opt-in vision on how shots land.",
    color: PINK,
  },
  {
    icon: HelpCircle,
    label: "Quizzes",
    detail: "Quick answers that teach the engine what you respond to.",
    color: GREEN,
  },
  {
    icon: CalendarDays,
    label: "Calendar rhythm",
    detail: "Paste an .ics. We read the event count, never the events.",
    color: GOLD,
  },
  {
    icon: Wallet,
    label: "Spending signals",
    detail: "Category-level only. Never balances, never line items.",
    color: "hsl(285 55% 56%)",
  },
  {
    icon: Instagram,
    label: "Social tone",
    detail: "Optional import of how you sound in your own words.",
    color: PINK,
  },
  {
    icon: Compass,
    label: "Date debriefs",
    detail: "One honest outcome teaches the machine more than ten audits.",
    color: INDIGO,
  },
];

const LOOP = [
  {
    icon: FileText,
    step: "01",
    title: "You feed real signals",
    desc: "Every tool you use and every source you connect is a data point. Use what helps you today, and the machine quietly learns from it.",
    color: INDIGO,
  },
  {
    icon: Brain,
    step: "02",
    title: "Your Mirror understands you",
    desc: "The signals fold into one evolving model of who you are: what comes through clearly, where the picture is still blank, and what to feed next.",
    color: PINK,
  },
  {
    icon: Gauge,
    step: "03",
    title: "Match Readiness rises",
    desc: "The more the machine knows you, the higher one central meter climbs. Readiness is the work, and it gates the payoff.",
    color: GOLD,
  },
  {
    icon: MapPin,
    step: "04",
    title: "You get matched, near you",
    desc: "When readiness is high enough, the engine works toward introducing you to people close by that you would not find on your own.",
    color: GREEN,
  },
];

function MiniGauge({ score }: { score: number }) {
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const tone =
    score >= 75
      ? "hsl(var(--brand-green))"
      : score >= 50
        ? "hsl(var(--brand-gold))"
        : "hsl(var(--brand-rose))";
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth="9"
          fill="none"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          stroke={tone}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-2xl font-bold">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// The honest "what the machine sees" snapshot. Real portrait when signed in,
// otherwise the same deterministic demo portrait Your Mirror falls back to,
// clearly labelled as a sample. Never faked live data.
function MachineSnapshot({
  portrait,
  isDemo,
}: {
  portrait: MirrorPortrait;
  isDemo: boolean;
}) {
  return (
    <div
      className="glass rounded-[2rem] p-6 sm:p-8"
      style={{ border: `1px solid ${withAlpha(INDIGO, 0.25)}` }}
      data-testid="card-machine-snapshot"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: withAlpha(INDIGO, 0.1),
            color: INDIGO,
            border: `1px solid ${withAlpha(INDIGO, 0.25)}`,
          }}
        >
          <Eye className="h-3 w-3" />
          {portrait.stageLabel}
        </span>
        <span className="rounded-full border border-foreground/10 px-3 py-1 text-xs text-muted-foreground">
          {portrait.coveragePercent}% of you mapped
        </span>
        {isDemo && (
          <span className="rounded-full border border-foreground/10 px-3 py-1 text-xs text-muted-foreground">
            Sample view, sign in for your own
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <MiniGauge score={portrait.readinessScore} />
        <p className="font-serif text-lg leading-relaxed sm:text-xl">
          {portrait.headline}
        </p>
      </div>

      <div className="mt-7 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4" style={{ color: INDIGO }} />
            What it can see so far
          </p>
          <ul className="space-y-4">
            {portrait.known.map((k) => (
              <li key={k.key} data-testid={`snapshot-known-${k.key}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{k.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {k.coverage}% covered, {k.confidence}% sure
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: INDIGO }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${k.coverage}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {k.insight}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <EyeOff className="h-4 w-4" style={{ color: GOLD }} />
            What it cannot see yet
          </p>
          <ul className="space-y-3">
            {portrait.blindSpots.map((b) => (
              <li
                key={b.key}
                data-testid={`snapshot-blind-${b.key}`}
                className="rounded-xl border border-foreground/8 bg-card/40 p-3"
              >
                <p className="text-sm font-medium">{b.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {portrait.nextSignal && (
        <div
          className="mt-6 flex flex-col items-start gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: withAlpha(PINK, 0.06),
            border: `1px solid ${withAlpha(PINK, 0.2)}`,
          }}
        >
          <div className="flex items-start gap-3">
            <Compass className="mt-0.5 h-5 w-5 shrink-0" style={{ color: PINK }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                The one move that sharpens it most
              </p>
              <p className="mt-0.5 font-serif text-base font-semibold">
                {portrait.nextSignal.label}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HowItWorks() {
  useMeta(
    "How It Works: From your signals to real matches",
    "See the whole machine end to end. Feed your real signals, watch Your Mirror understand you, climb your Match Readiness, and earn introductions to people near you.",
  );

  const { isAuthenticated } = useAuth();
  const { data: portrait } = useGetMirrorPortrait({
    query: { queryKey: getGetMirrorPortraitQueryKey(), retry: false },
  });
  const isDemo = !portrait;
  const shownPortrait = portrait ?? DEMO_PORTRAIT;

  return (
    <AppLayout>
      {/* HERO */}
      <section className="relative mesh-bg overflow-hidden pt-16 md:pt-28 pb-20 md:pb-28">
        <div className="orb orb-violet absolute w-[700px] h-[700px] -top-56 -right-48 opacity-50 pointer-events-none" />
        <div className="orb orb-gold absolute w-[420px] h-[420px] bottom-0 left-1/4 opacity-30 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              {...fadeUp(0.05)}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass-elevated border border-[hsl(248_62%_52%/0.3)] mb-8"
            >
              <Brain className="h-4 w-4 text-[hsl(248_62%_52%)]" />
              <span className="text-xs md:text-sm font-semibold tracking-wide text-foreground/80 uppercase">
                The whole machine, end to end
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.12)}
              className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold tracking-tight leading-[1.08] mb-6"
            >
              You become genuinely ready.{" "}
              <span className="gradient-text italic pr-1">
                Then you get matched.
              </span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.2)}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-9"
            >
              MatchLab is a second brain for your dating life. You feed it real
              signals, it builds an honest model of who you are, your Match
              Readiness climbs, and the payoff is introductions to people near
              you that you would never find on your own.
            </motion.p>

            <motion.div
              {...fadeUp(0.28)}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                asChild
                className="rounded-full px-8 h-14 text-base font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse hover:opacity-90 transition-opacity text-white"
                data-testid="button-hiw-start"
              >
                <Link href="/signal-check">
                  Start free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full px-8 h-14 text-base font-semibold"
                data-testid="button-hiw-pricing"
              >
                <Link href="/pricing">See pricing</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* THE LOOP */}
      <section className="py-20 md:py-28 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <motion.div {...fadeUp(0)} className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3">
              The readiness loop
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
              Four steps, one rising number.
            </h2>
            <p className="text-muted-foreground text-lg mt-5 leading-relaxed">
              Each step gives you something useful on its own. Together they form
              a loop that keeps learning you and keeps moving you closer to a real
              introduction.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {LOOP.map((item, i) => (
              <motion.div
                key={item.step}
                {...fadeUp(i * 0.1)}
                className="glass rounded-[1.75rem] p-7 flex flex-col relative overflow-hidden"
                style={{ border: `1px solid ${withAlpha(item.color, 0.2)}` }}
                data-testid={`loop-step-${item.step}`}
              >
                <div
                  className="absolute top-0 right-0 p-6 text-6xl font-serif font-bold opacity-5 pointer-events-none"
                  style={{ color: item.color }}
                >
                  {item.step}
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 relative z-10"
                  style={{
                    background: withAlpha(item.color, 0.12),
                    border: `1px solid ${withAlpha(item.color, 0.22)}`,
                  }}
                >
                  <item.icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <h3 className="text-lg font-bold mb-3 relative z-10">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed relative z-10">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STAGE 1: FEED SIGNALS */}
      <section className="py-20 md:py-28 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="orb orb-violet absolute w-[500px] h-[500px] -top-20 -left-24 opacity-15 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center max-w-6xl mx-auto">
            <motion.div {...fadeUp(0)}>
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: INDIGO }}
              >
                Step one
              </p>
              <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-5">
                Feed it real signals.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-5">
                There is no long onboarding to sit through. You use the tools that
                help you right now, a profile audit, a message read, a quiz, and
                each one becomes a signal. Connect a source when you are ready,
                never before.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Sensitive sources stay constrained on purpose. Calendar means the
                event count, not the events. Spending means categories, not
                balances. One toggle removes any source and purges its data.
              </p>
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="grid sm:grid-cols-2 gap-4">
              {SIGNAL_SOURCES.map((s) => (
                <div
                  key={s.label}
                  className="glass rounded-2xl p-4 border border-foreground/8"
                  data-testid={`signal-source-${s.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                    style={{
                      background: withAlpha(s.color, 0.12),
                      border: `1px solid ${withAlpha(s.color, 0.2)}`,
                    }}
                  >
                    <s.icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <p className="text-sm font-semibold mb-1">{s.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* STAGE 2: THE MIRROR UNDERSTANDS */}
      <section className="py-20 md:py-28 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <motion.div {...fadeUp(0)} className="text-center mb-12 max-w-2xl mx-auto">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: PINK }}
            >
              Step two
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-5">
              Your Mirror starts to understand you.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Every signal folds into one evolving model. It is honest about what
              it can see and just as honest about what it cannot. This is a real
              read from the deterministic engine, no guessing, no filler.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.12)} className="max-w-3xl mx-auto">
            <MachineSnapshot portrait={shownPortrait} isDemo={isDemo} />
            <div className="mt-5 text-center">
              <Link
                href="/your-mirror"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-hiw-your-mirror"
              >
                Visit Your Mirror
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STAGE 3: READINESS RISES */}
      <section className="py-20 md:py-28 border-t border-foreground/5 bg-background relative overflow-hidden">
        <div className="orb orb-gold absolute w-[480px] h-[480px] -bottom-24 -right-20 opacity-20 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center max-w-6xl mx-auto">
            <motion.div {...fadeUp(0)} className="order-2 lg:order-1 grid grid-cols-1 gap-4">
              {[
                {
                  icon: Gauge,
                  title: "One number to climb",
                  desc: "Every contributing signal moves a single Match Readiness meter. Progress is visible, not just felt.",
                  color: GOLD,
                },
                {
                  icon: Sparkles,
                  title: "Built to feel like a climb",
                  desc: "The meter, the milestones, and the next-signal nudges turn the work into something you actually want to keep doing.",
                  color: PINK,
                },
                {
                  icon: CheckCircle2,
                  title: "Readiness gates the payoff",
                  desc: "Matching opens once readiness is high enough. The work comes first, on purpose, so the introductions are worth it.",
                  color: GREEN,
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="glass rounded-2xl p-5 flex items-start gap-4 border border-foreground/8"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: withAlpha(c.color, 0.12),
                      border: `1px solid ${withAlpha(c.color, 0.2)}`,
                    }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: c.color }} />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{c.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {c.desc}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div {...fadeUp(0.12)} className="order-1 lg:order-2">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: GOLD }}
              >
                Step three
              </p>
              <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-5">
                Your readiness rises.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-5">
                The more the machine knows you, the better it can match you. That
                idea lives in one rising meter. Every tool used, every source
                connected, every quiz answered moves it.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Readiness leads and matching is the reward. The optimize-your-apps
                tools are genuinely useful day one, and they are also how the
                machine comes to understand you well enough to make a real
                introduction.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STAGE 4: MATCHED NEAR YOU */}
      <section className="py-20 md:py-28 border-t border-foreground/5 bg-[hsl(248_40%_98%/0.5)] dark:bg-[hsl(248_50%_8%/0.5)]">
        <div className="container mx-auto px-4">
          <motion.div {...fadeUp(0)} className="text-center max-w-2xl mx-auto mb-12">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: GREEN }}
            >
              Step four
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight mb-5">
              You get matched, near you.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              This is the payoff the readiness work earns. The engine looks for
              people close to you that fit the model it has built, and works
              toward an introduction. No swipe carousel, no endless feed.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                icon: MapPin,
                title: "Radius based",
                desc: "Matching works within a distance you set, so an introduction is someone you could actually meet.",
                color: GREEN,
              },
              {
                icon: Brain,
                title: "Model driven",
                desc: "Fit comes from the full picture the machine has built, not a one-line bio or a single photo.",
                color: INDIGO,
              },
              {
                icon: Users,
                title: "Inclusive by default",
                desc: "All genders and orientations, by design. This is not a niche app and never has been.",
                color: PINK,
              },
            ].map((c) => (
              <motion.div
                key={c.title}
                {...fadeUp(0.1)}
                className="glass rounded-[1.75rem] p-7 border border-foreground/8"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: withAlpha(c.color, 0.12),
                    border: `1px solid ${withAlpha(c.color, 0.2)}`,
                  }}
                >
                  <c.icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
                <h3 className="text-lg font-bold mb-3">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {c.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRIVACY BAND */}
      <section className="py-20 md:py-24 border-t border-foreground/5 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            {...fadeUp(0)}
            className="max-w-4xl mx-auto glass rounded-[2rem] p-8 sm:p-10"
            style={{ border: `1px solid ${withAlpha(INDIGO, 0.18)}` }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-6 w-6" style={{ color: INDIGO }} />
              <h2 className="text-2xl font-serif font-bold">
                Honest by construction
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: Brain,
                  title: "Deterministic first",
                  desc: "A structural engine runs on every account by default. No keys, no external calls, never rate limited.",
                },
                {
                  icon: Sparkles,
                  title: "Deep AI is opt in",
                  desc: "Anthropic Claude layers on only when you turn it on, under a zero-retention policy. Off by default, off whenever you want.",
                },
                {
                  icon: Lock,
                  title: "Yours to remove",
                  desc: "We never sell or train on your content. Export or delete everything from your account at any time.",
                },
              ].map((c) => (
                <div key={c.title}>
                  <c.icon className="h-5 w-5 mb-3" style={{ color: INDIGO }} />
                  <p className="font-semibold mb-1.5">{c.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {c.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 md:py-28 border-t border-foreground/5 mesh-bg relative overflow-hidden">
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-40 left-1/3 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div {...fadeUp(0)} className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-serif font-bold leading-tight mb-6">
              Start the engine. <span className="gradient-text italic pr-1">It is free.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-9">
              Run your first Signal Check in about three minutes. No account
              needed, and your results are saved for when you come back.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                className="rounded-full px-8 h-14 text-base font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse hover:opacity-90 transition-opacity text-white"
                data-testid="button-hiw-cta-start"
              >
                <Link href="/signal-check">
                  Get my free Signal Check{" "}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full px-8 h-14 text-base font-semibold"
                data-testid="button-hiw-cta-pricing"
              >
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </div>
            {!isAuthenticated && (
              <p className="mt-6 text-sm text-muted-foreground">
                Already started?{" "}
                <Link
                  href="/dashboard"
                  className="font-semibold text-foreground underline decoration-[hsl(248_62%_52%/0.5)] underline-offset-4 hover:decoration-[hsl(248_62%_52%)] transition-colors"
                >
                  Go to your dashboard
                </Link>
              </p>
            )}
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
