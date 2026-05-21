import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Activity, Users, BookOpen, Sparkles, Briefcase, DollarSign, Trees, ArrowRight, Shield } from "lucide-react";
import { LifePulseCard, dimensionScoreFromPulse } from "@/components/wellness/LifePulseCard";
import { useGetRecentLifePulses } from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

type Dimension = {
  key: string;
  name: string;
  icon: typeof Heart;
  color: string;
  blurb: string;
  strengths: string[];
  friction: string[];
  readiness: string;
  experiments: string[];
};

const DIMENSIONS: Dimension[] = [
  {
    key: "emotional",
    name: "Emotional",
    icon: Heart,
    color: "hsl(348 55% 65%)",
    blurb: "How you notice, name, and move through feelings.",
    strengths: ["You name feelings clearly when prompted", "Reflective after conversations end"],
    friction: ["Tend to push past discomfort instead of naming it in the moment"],
    readiness: "Strong baseline. Practising live naming will deepen connection in dates.",
    experiments: ["Once this week, name a feeling out loud during a conversation", "Write 2 lines after every date about what felt true"],
  },
  {
    key: "physical",
    name: "Physical",
    icon: Activity,
    color: "hsl(142 55% 60%)",
    blurb: "Energy, sleep, body awareness — your dating stamina layer.",
    strengths: ["Show up rested when meeting new people"],
    friction: ["Energy dips in the evenings can flatten conversations"],
    readiness: "Notice your peak energy windows and try scheduling first dates inside them.",
    experiments: ["Try a daytime coffee for the first meeting", "Walk before texting — observe tone shift"],
  },
  {
    key: "social",
    name: "Social",
    icon: Users,
    color: "hsl(190 55% 60%)",
    blurb: "The web of people around you — who you reach, who reaches back.",
    strengths: ["Steady inner circle you can debrief with"],
    friction: ["Dating circle is narrow — most introductions come from apps"],
    readiness: "Strong base; widening your offline channels gives more shots on goal.",
    experiments: ["Tell two friends one specific kind of person you'd like to meet", "Join one recurring activity for 4 weeks"],
  },
  {
    key: "intellectual",
    name: "Intellectual",
    icon: BookOpen,
    color: "hsl(268 52% 68%)",
    blurb: "Curiosity, learning rhythms, the questions you carry around.",
    strengths: ["Genuine curiosity about how people think"],
    friction: ["Lead with topics instead of questions in early conversations"],
    readiness: "This is your superpower — let it land on them, not just appear smart.",
    experiments: ["Open dates with a real question, not a topic dump", "Listen for one belief, mirror it back"],
  },
  {
    key: "spiritual",
    name: "Spiritual",
    icon: Sparkles,
    color: "hsl(43 65% 65%)",
    blurb: "Meaning, values, how you feel grounded — religious or not.",
    strengths: ["Clear sense of what matters most to you"],
    friction: ["Reluctant to surface values early — feels too heavy"],
    readiness: "Naming one value naturally early prevents misalignment downstream.",
    experiments: ["Mention one value casually within the first 2 dates", "Notice when their values surface — name what you heard"],
  },
  {
    key: "occupational",
    name: "Occupational",
    icon: Briefcase,
    color: "hsl(220 50% 65%)",
    blurb: "Work rhythm, ambition, how your career affects your dating bandwidth.",
    strengths: ["Steady career grounding"],
    friction: ["Work spillover into evenings cuts into connection time"],
    readiness: "Define your weekly dating bandwidth honestly so plans hold.",
    experiments: ["Pick 2 evenings per week as protected date time", "Don't apologise for being busy — schedule around it"],
  },
  {
    key: "financial",
    name: "Financial",
    icon: DollarSign,
    color: "hsl(142 55% 60%)",
    blurb: "How money shows up in dates without you noticing.",
    strengths: ["Comfortable being clear about cost"],
    friction: ["Avoid talking about money styles until late"],
    readiness: "Financial style mismatch surfaces in date 4–6. Catch it earlier.",
    experiments: ["Try a low-cost date once and notice what changes", "Mention one money habit you're proud of"],
  },
  {
    key: "environmental",
    name: "Environmental",
    icon: Trees,
    color: "hsl(155 50% 60%)",
    blurb: "The spaces you live, work, and date in — how they hold you.",
    strengths: ["Your home is calm and centred"],
    friction: ["Almost all dates happen in the same 3 spots"],
    readiness: "Varying location subtly varies energy. Use it as a tool.",
    experiments: ["Plan one date in nature this month", "Notice which spaces let you be most yourself"],
  },
];

export default function WellnessCenter() {
  useMeta(
    "Wellness Center",
    "Eight dimensions of wellness mapped to your dating readiness — strengths, friction points, and small experiments you can try this week.",
  );

  const { data: pulseData } = useGetRecentLifePulses();
  const latestPulse = pulseData?.latest ?? null;

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(43_65%_65%/0.2)] text-xs font-medium text-[hsl(43_65%_72%)] mb-3">
              <Sparkles className="w-3 h-3" />
              Wellness Center
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              The 8 dimensions of <span className="gradient-text-violet">your readiness</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Dating doesn't happen in a vacuum — eight life dimensions shape how you show up. We surface
              strengths, friction points, and small experiments that fit the week you're actually in.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(232_38%_15%)] border border-white/5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
              Based only on what you choose to share and approve.
            </div>
          </motion.div>

          {/* ── Package Hub Strip — Context + Trust ── */}
          <div className="glass border rounded-xl px-4 py-3 mb-7 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{ borderColor: "hsl(228 30% 62% / 0.2)" }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(228_30%_62%)]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(228_30%_72%)]">Context + Trust</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground/55">— what you share is yours</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
              {[
                { name: "Data Vault",       href: "/vault"        },
                { name: "Connection Center",href: "/connections"  },
                { name: "User Control",     href: "/user-control" },
                { name: "Privacy",          href: "/privacy"      },
                { name: "Integrations",     href: "/integrations" },
              ].map(t => (
                <Link key={t.href} href={t.href}
                  className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors whitespace-nowrap">
                  {t.name}
                </Link>
              ))}
            </div>
          </div>

          <LifePulseCard />

          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {DIMENSIONS.map((d, i) => {
              const Icon = d.icon;
              const signal = dimensionScoreFromPulse(d.key, latestPulse);
              return (
                <motion.div
                  key={d.key}
                  {...fadeUp(0.04 + i * 0.03)}
                  className="glass-strong rounded-2xl p-5 sm:p-6 border border-white/5 hover:border-white/10 transition-colors"
                  data-testid={`card-wellness-${d.key}`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: d.color.replace(")", " / 0.15)") }}>
                      <Icon className="w-5 h-5" style={{ color: d.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-xl font-semibold leading-tight">{d.name}</h3>
                        {signal.value !== null && (
                          <div
                            className="flex flex-col items-end flex-shrink-0"
                            data-testid={`signal-wellness-${d.key}`}
                            title={`Today's pulse · ${signal.sourceLabel}`}
                          >
                            <span className="text-base font-bold tabular-nums leading-none" style={{ color: d.color }}>{signal.value}/5</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">Today</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.blurb}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55%_60%)] mb-1.5">Strengths</p>
                      <ul className="space-y-1">
                        {d.strengths.map((s, idx) => (
                          <li key={idx} className="text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-[hsl(142_55%_60%)]">{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(43_65%_72%)] mb-1.5">Friction Points</p>
                      <ul className="space-y-1">
                        {d.friction.map((f, idx) => (
                          <li key={idx} className="text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-[hsl(43_65%_72%)]">{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-3 border-t border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-1.5">Relationship Readiness</p>
                      <p className="text-sm text-foreground leading-relaxed">{d.readiness}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(190_55%_72%)] mb-1.5">Try This Week</p>
                      <ul className="space-y-1.5">
                        {d.experiments.map((e, idx) => (
                          <li key={idx} className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                            <span className="text-[hsl(190_55%_72%)] mt-0.5 flex-shrink-0">→</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div {...fadeUp(0.4)} className="mt-8 glass-strong rounded-2xl p-6 sm:p-7 border border-[hsl(268_52%_68%/0.2)]">
            <h3 className="font-serif text-xl font-semibold mb-2">Want this tied to your real entries?</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Approve items in the Life Context Profile to make these cards reflect what you've actually shared — not generic guidance.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="rounded-full"><Link href="/life-context">Life Context Profile <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
              <Button asChild variant="outline" className="rounded-full"><Link href="/user-control">User Control <ArrowRight className="w-4 h-4 ml-1.5" /></Link></Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
