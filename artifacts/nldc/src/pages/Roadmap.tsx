import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Shield, Eye, Trash2, Lock, CheckCircle, Sparkles,
  Headphones, BarChart3, Brain, Layers, Zap, Database, Globe,
  Users, FileText, Camera, Mail, Calendar, TrendingUp
} from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

type LevelStatus = "live" | "dev" | "roadmap" | "phase3" | "vision";

const STATUS_CONFIG: Record<LevelStatus, { label: string; color: string; bg: string; border: string; glow: string }> = {
  live:     { label: "Live Today",         color: "hsl(142 55% 62%)", bg: "hsl(142 55% 45% / 0.12)", border: "hsl(142 55% 45% / 0.3)", glow: "0 0 24px hsl(var(--brand-green) / 0.35)" },
  dev:      { label: "In Development",     color: "hsl(var(--brand-indigo))", bg: "hsl(var(--brand-indigo) / 0.12)", border: "hsl(var(--brand-indigo) / 0.3)", glow: "0 0 24px hsl(var(--brand-indigo) / 0.3)" },
  roadmap:  { label: "On the Roadmap",     color: "hsl(var(--brand-gold))",  bg: "hsl(var(--brand-gold) / 0.12)",  border: "hsl(var(--brand-gold) / 0.3)",  glow: "0 0 20px hsl(var(--brand-gold) / 0.25)" },
  phase3:   { label: "Phase 3",            color: "hsl(326 100% 65%)", bg: "hsl(var(--brand-pink) / 0.12)", border: "hsl(var(--brand-pink) / 0.3)", glow: "0 0 20px hsl(var(--brand-pink) / 0.25)" },
  vision:   { label: "The Vision",         color: "hsl(348 55% 67%)", bg: "hsl(var(--brand-rose) / 0.12)", border: "hsl(var(--brand-rose) / 0.3)", glow: "0 0 20px hsl(var(--brand-rose) / 0.2)" },
};

const LEVELS = [
  {
    num: 1,
    status: "live" as LevelStatus,
    title: "User-Entered Dating Audit",
    tagline: "You paste it. We coach it. You keep it.",
    icon: FileText,
    what_you_provide: [
      "Your dating goals and relationship intention",
      "Your bio and profile prompts",
      "Optional: a recent conversation sample",
    ],
    what_you_get: [
      "Dating Readiness Score (0–100)",
      "Profile category and honest diagnosis",
      "Full bio rewrite + all prompts rewritten",
      "Photo guidance checklist",
      "Tone analysis and messaging coaching",
      "Personalised 5-step action plan",
    ],
    modules: ["Dating Diagnosis", "Profile Audit", "Message Lab", "Signal Check"],
    module_links: ["/diagnosis", "/start", "/lab", "/signal-check"],
    insight: "The foundation of everything. All coaching is derived from what you explicitly share — nothing is assumed, nothing is scraped.",
    technical: "Deterministic coaching engine, always on. No keys, no external calls, never rate-limited. Anthropic Claude is layered on top for select tools when Deep AI lane is on in Settings.",
    accentColor: "hsl(142 55% 62%)",
  },
  {
    num: 2,
    status: "live" as LevelStatus,
    title: "User-Uploaded Presence Audit",
    tagline: "Show us how you look online. We'll tell you what it's saying.",
    icon: Camera,
    what_you_provide: [
      "Screenshots from your dating apps (you choose which ones)",
      "Pasted public social bios or profile links",
      "Public-facing content you want reviewed",
    ],
    what_you_get: [
      "Screenshot OCR — text and signals extracted from your app screens",
      "Cross-platform presence consistency analysis",
      "Photo composition and selection coaching",
      "Match-library review — patterns across the people you're matching with",
      "Visual vs verbal alignment score",
    ],
    modules: ["Screenshot Upload", "Profile Reader", "Presence Audit"],
    module_links: ["/start", "/profile-reader", "/start"],
    insight: "Most people present differently across Hinge, LinkedIn, and Instagram without realising it. This level maps the gaps — and reads what's actually in your screenshots — so the right people recognise you everywhere.",
    technical: "On-device-style OCR, structured extraction, and deterministic coaching. No passive screen capture. You upload only what you approve.",
    accentColor: "hsl(var(--brand-indigo))",
  },
  {
    num: 3,
    status: "roadmap" as LevelStatus,
    title: "Opt-In Connected Analysis",
    tagline: "You flip the switch. We do the deep work. You approve every step.",
    icon: Layers,
    what_you_provide: [
      "Optional: email snippet exports (specific labels you approve)",
      "Optional: calendar event tags you mark as date-related",
      "Optional: exported conversation history from dating apps (where allowed)",
      "Optional: public social content you've already shared",
    ],
    what_you_get: [
      "Automatic communication pattern analysis (no pasting required)",
      "Longitudinal conversation trend tracking",
      "Pre-date coaching briefs from calendar context",
      "Multi-platform pattern synthesis",
      "Deepened relationship-readiness signals",
    ],
    modules: ["Gmail Snippets", "Calendar Context", "App Export", "Pattern Engine"],
    module_links: ["/integrations", "/connections", "/vault", "/insights"],
    insight: "The step change from manual to automatic insight. Every connection here will be explicit, previewed before analysis, and revocable instantly. We're shipping the consent-first UI first — the OAuth integrations land once we're confident the trust controls are right.",
    technical: "Planned: OAuth read-only scopes, field-level consent controls, preview-before-process architecture, per-source revocation. The Integrations page today is a consent preview — no live connections yet. Live Gmail/Calendar OAuth is intentionally deferred until we complete Google's restricted-scopes verification and the required CASA security audit; we will only enter that process once paying users are asking for it.",
    accentColor: "hsl(var(--brand-gold))",
  },
  {
    num: 4,
    status: "dev" as LevelStatus,
    title: "Private Personal Intelligence Layer",
    tagline: "A living mirror of who you are in relationships — owned by you, seen only on your account.",
    icon: Brain,
    what_you_provide: [
      "Everything from Levels 1–2 (and Level 3 once it ships)",
      "Reflective journal prompts you choose to answer",
      "Post-date notes and outcome tracking",
    ],
    what_you_get: [
      "Live today — Score history and growth timeline across every audit",
      "Live today — Signal Spectrum, your 8 dimensions tracked over time",
      "Live today — Send-through trends, what your messaging is actually doing",
      "Coming next — Cross-audit pattern recognition: what you repeat, what shifts",
      "Coming next — Reflective journal + post-date notes",
      "Future — Mismatch risk profiles and readiness signals",
      "Future on demand — True end-to-end encryption of your private intelligence layer",
    ],
    modules: ["Score History", "Signal Spectrum", "Send-Through Trends", "Pattern Mirror (next)"],
    module_links: ["/dashboard", "/style-map", "/insights", "/progress/patterns"],
    insight: "This is your private psychological asset — a living record of your dating self, scoped to your account, never sold, never used for advertising. Some pieces are already in your dashboard today; the deeper pattern mirror and journal layers are the next things we ship.",
    technical: "Private to your authenticated account. Data is stored on MatchLab Club infrastructure, never sold or shared with third parties, and can be exported or permanently deleted at any time from Settings → Privacy. True end-to-end encryption (keys held only by you) is a future option we'll add when paying users ask for it.",
    accentColor: "hsl(326 100% 65%)",
  },
  {
    num: 5,
    status: "vision" as LevelStatus,
    title: "Aggregate Insight Business",
    tagline: "What we learn collectively makes individual coaching smarter — with no individual exposed.",
    icon: Globe,
    what_you_provide: [
      "Your consented, anonymised participation in aggregate analysis",
      "Opt-in benchmarking against similar cohorts",
      "Optional contribution to coaching tool research",
    ],
    what_you_get: [
      "Smarter, benchmarked personal scores (how do you compare to your cohort?)",
      "Research-backed coaching recommendations",
      "Access to aggregate trend reports and dating intelligence research",
      "Community benchmarks: what profiles convert, what message styles work by city, age, platform",
    ],
    modules: ["Trend Intelligence", "Cohort Benchmarks", "Coach Tools", "Partner Reports"],
    module_links: ["/waitlist", "/wellness", "/copilot", "/pricing"],
    insight: "The sustainable B2B layer: anonymised insight reports for coaches, therapists, dating apps, and researchers. Built on consent infrastructure, not data harvesting. This is the business model that doesn't require compromising the trust layer.",
    technical: "Differential privacy, k-anonymity thresholds, no raw profile export ever. B2B clients receive statistical summaries only.",
    accentColor: "hsl(348 55% 67%)",
  },
];

const PRIVACY_PRINCIPLES = [
  { icon: Eye, title: "Preview before analysis", desc: "At Levels 3+, you see exactly what data will be processed before we touch it. Line by line if you want.", color: "hsl(var(--brand-indigo))" },
  { icon: CheckCircle, title: "Consent at every level", desc: "Each data source requires its own explicit opt-in. Approving Gmail doesn't mean approving Calendar. Each switch is separate.", color: "hsl(var(--brand-green))" },
  { icon: Trash2, title: "Delete everything, permanently", desc: "One click removes your account, all audits, all stored intelligence, and all preferences — no 30-day hold, no 'we keep anonymised data' loophole.", color: "hsl(var(--brand-gold))" },
  { icon: Lock, title: "Private intelligence stays private", desc: "Your Level 4 intelligence layer is scoped to your account, never sold, never used to train external models, and never shared with third parties. You can export or permanently delete it from Settings → Privacy at any time.", color: "hsl(326 100% 65%)" },
  { icon: Database, title: "We never sell raw personal content", desc: "Not your messages. Not your profile. Not your photos. Not your conversation history. Not your journal. Nothing individual, ever.", color: "hsl(var(--brand-rose))" },
  { icon: BarChart3, title: "Aggregate intelligence is earned, not extracted", desc: "Level 5 only exists because individuals opt in to anonymous benchmarking. The business model is consent infrastructure — not surveillance.", color: "hsl(190 55% 60%)" },
];

const MOAT_POINTS = [
  { icon: Shield, title: "Trust is the moat", desc: "In an industry drowning in privacy violations and opaque data use, the platform that earns radical trust wins the long-term customer relationship. Trust can't be copied — it's built over time." },
  { icon: Brain, title: "The intelligence layer compounds", desc: "A user's Level 4 personal intelligence profile gets smarter with every audit, every conversation analysed, every date logged. The longer someone uses MatchLab Club, the more valuable their mirror becomes — and the higher the switching cost." },
  { icon: TrendingUp, title: "Aggregate insight is defensible", desc: "The Level 5 B2B layer — anonymised dating trend intelligence — has no peer. No competitor has the consent infrastructure to build it ethically. We build the infrastructure first; the insight business follows." },
  { icon: Users, title: "The community is the product", desc: "A community of people doing serious self-reflection on their dating lives — with data to back it — is the most valuable coaching audience on the planet. Podcasters, coaches, therapists, and dating apps will pay to reach them." },
];

export default function Roadmap() {
  useMeta("Platform Vision", "See everything that's live, in development, and on the roadmap for MatchLab Club. Privacy-first. No AI key required.");
  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg">
        {/* Decorative orbs */}
        <div className="orb orb-violet fixed w-[700px] h-[700px] -top-60 -right-60 opacity-40 pointer-events-none" />
        <div className="orb orb-gold fixed w-[400px] h-[400px] top-1/2 -left-40 opacity-30 pointer-events-none" />
        <div className="orb orb-plum fixed w-[500px] h-[500px] bottom-0 right-1/4 opacity-30 pointer-events-none" />

        {/* ── HERO ── */}
        <section className="relative pt-20 md:pt-32 pb-20 px-4 overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-[hsl(248_62%_52%/0.25)] text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_65%)] mb-7">
                <Sparkles className="w-3.5 h-3.5" /> Product Vision · Investor Preview
              </span>
            </motion.div>
            <motion.h1 {...fadeUp(0.06)} className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              <span className="text-foreground">You Control</span>{" "}
              <span className="gradient-text-violet italic">the Mirror.</span>
            </motion.h1>
            <motion.p {...fadeUp(0.12)} className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
              The Dating Intelligence Roadmap
            </motion.p>
            <motion.p {...fadeUp(0.16)} className="text-base text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed mb-12">
              We're building the only personal dating intelligence platform that treats your insight as
              yours to own — from a free 3-minute signal check to a private, compounding intelligence layer
              that makes your self-understanding a permanent asset.
            </motion.p>

            {/* Platform stats */}
            <motion.div {...fadeUp(0.2)} className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
              {[
                { value: "5", label: "Levels of depth", sub: "Start free. Go as deep as you want." },
                { value: "100%", label: "Opt-in consent", sub: "Every feature, every data source." },
                { value: "0", label: "Data sold", sub: "Raw personal content. Ever. Period." },
              ].map((stat, i) => (
                <div key={i} className="glass border border-white/8 rounded-2xl p-5 text-center card-hover">
                  <p className="text-4xl font-bold gradient-text mb-1">{stat.value}</p>
                  <p className="text-sm font-semibold text-foreground mb-0.5">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </div>
              ))}
            </motion.div>

            <motion.div {...fadeUp(0.25)} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-13 px-9 rounded-full font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse">
                <Link href="/signal-check"><Headphones className="mr-2 h-4 w-4" /> Free 3-Min Signal Check</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-13 px-8 rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
                <Link href="/start">Full Dating Audit <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ── 5 LEVELS TIMELINE ── */}
        <section className="py-16 md:py-24 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <motion.div {...fadeUp(0)} className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">The Platform Architecture</p>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground">Five levels of depth.</h2>
              <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
                Start with what you can share in 3 minutes. Go as deep as your comfort, consent, and curiosity take you.
              </p>
            </motion.div>

            {/* Timeline */}
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-8 md:left-10 top-8 bottom-8 w-px" style={{ background: "linear-gradient(180deg, hsl(var(--brand-green)) 0%, hsl(var(--brand-indigo)) 25%, hsl(var(--brand-gold)) 50%, hsl(var(--brand-pink)) 75%, hsl(var(--brand-rose)) 100%)", opacity: 0.4 }} />

              <div className="space-y-8">
                {LEVELS.map((level, i) => {
                  const status = STATUS_CONFIG[level.status];
                  return (
                    <motion.div
                      key={level.num}
                      {...fadeUp(i * 0.1)}
                      className="flex items-start gap-6 md:gap-8"
                      data-testid={`card-level-${level.num}`}
                    >
                      {/* Node */}
                      <div className="flex-shrink-0 relative z-10">
                        <div
                          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center font-bold text-white transition-all"
                          style={{
                            background: `linear-gradient(135deg, ${withAlpha(level.accentColor, 0.3)}, ${withAlpha(level.accentColor, 0.15)})`,
                            border: `2px solid ${withAlpha(level.accentColor, 0.5)}`,
                            boxShadow: status.glow,
                          }}
                        >
                          <span className="text-xs font-semibold opacity-70 mb-0.5">LVL</span>
                          <span className="text-2xl font-bold" style={{ color: level.accentColor }}>{level.num}</span>
                        </div>
                      </div>

                      {/* Card */}
                      <div
                        className="flex-1 glass rounded-3xl p-7 card-hover"
                        style={{ borderColor: `${withAlpha(level.accentColor, 0.2)}`, borderWidth: "1px", borderStyle: "solid" }}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: withAlpha(level.accentColor, 0.12) }}>
                              <level.icon className="w-5 h-5" style={{ color: level.accentColor }} />
                            </div>
                            <div>
                              <h3 className="font-bold text-foreground text-lg leading-tight">{level.title}</h3>
                              <p className="text-sm text-muted-foreground italic mt-0.5">{level.tagline}</p>
                            </div>
                          </div>
                          <span
                            className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                            style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}`, boxShadow: status.glow }}
                          >
                            {status.label}
                          </span>
                        </div>

                        {/* What you provide / get */}
                        <div className="grid sm:grid-cols-2 gap-5 mb-5">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">What you provide</p>
                            <ul className="space-y-1.5">
                              {level.what_you_provide.map((item, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: level.accentColor }} />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">What you get</p>
                            <ul className="space-y-1.5">
                              {level.what_you_get.map((item, j) => (
                                <li key={j} className="flex items-start gap-2 text-sm text-foreground/85">
                                  <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: level.accentColor }} />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Insight */}
                        <div className="rounded-2xl p-4 border-l-2 mb-4" style={{ background: withAlpha(level.accentColor, 0.06), borderColor: withAlpha(level.accentColor, 0.4) }}>
                          <p className="text-sm text-foreground/80 leading-relaxed italic">"{level.insight}"</p>
                        </div>

                        {/* Technical note */}
                        <div className="flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: level.accentColor }} />
                          <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-semibold text-muted-foreground/80">Technical note:</span> {level.technical}</p>
                        </div>

                        {/* Module links */}
                        {level.status === "live" && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/6">
                            <p className="w-full text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Try it now →</p>
                            {level.modules.map((mod, j) => (
                              <Link key={j} href={level.module_links[j]}>
                                <span
                                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80 cursor-pointer"
                                  style={{ background: withAlpha(level.accentColor, 0.12), color: level.accentColor, border: `1px solid ${withAlpha(level.accentColor, 0.25)}` }}
                                >
                                  {mod}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {level.status === "dev" && (
                          <div className="mt-4 pt-4 border-t border-white/6">
                            <Link href="/waitlist">
                              <span className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                Join waitlist for early access →
                              </span>
                            </Link>
                          </div>
                        )}
                        {(level.status === "roadmap" || level.status === "phase3") && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/6">
                            <p className="w-full text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Coming in future updates</p>
                            {level.modules.map((mod, j) => (
                              <span key={j} className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: "hsl(248 40% 94%)", color: "hsl(228 18% 55%)", border: "1px solid hsl(248 40% 90%)" }}>{mod}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRIVACY PLEDGE ── */}
        <section className="py-20 md:py-28 px-4 border-t border-white/5 relative overflow-hidden">
          <div className="orb orb-violet absolute w-[500px] h-[500px] top-0 right-0 opacity-30 pointer-events-none" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div {...fadeUp(0)} className="text-center mb-14">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: "hsl(var(--brand-indigo) / 0.15)", border: "1px solid hsl(var(--brand-indigo) / 0.3)", boxShadow: "0 0 30px hsl(var(--brand-indigo) / 0.2)" }}>
                <Shield className="w-7 h-7 text-[hsl(248_62%_52%)]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">Non-Negotiable</p>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">The Privacy Pledge</h2>
              <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Every product decision at MatchLab Club is filtered through one question: does this respect the person trusting us with their most private self? If not, it doesn't ship.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {PRIVACY_PRINCIPLES.map((p, i) => (
                <motion.div key={i} {...fadeUp(i * 0.07)} className="glass border border-white/8 rounded-2xl p-6 card-hover">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${withAlpha(p.color, 0.12)}`, border: `1px solid ${withAlpha(p.color, 0.2)}` }}>
                    <p.icon className="w-5 h-5" style={{ color: p.color }} />
                  </div>
                  <p className="font-semibold text-foreground text-sm mb-2">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Hard commitments */}
            <motion.div {...fadeUp(0.3)} className="glass border border-white/8 rounded-3xl p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Hard Commitments — Not Marketing Copy</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  "We never sell raw personal content, private messages, or identifiable profiles",
                  "We never build advertising profiles from your personal data",
                  "We never sell or share with data brokers, third-party advertisers, or analytics firms",
                  "We never use private data to train AI models without explicit, opt-in consent",
                  "We never retain data after account deletion (72-hour maximum for technical reasons)",
                  "We never access more data than you've explicitly approved for a specific purpose",
                  "We never sell our user database, even in an acquisition — consent rights transfer with the company",
                  "The Level 5 aggregate layer contains zero individually identifiable information, ever",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="w-4 h-4 rounded-full bg-[hsl(142_55%_45%/0.15)] border border-[hsl(142_55%_45%/0.3)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)]" />
                    </div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── WHY THIS MOAT IS REAL ── */}
        <section className="py-20 md:py-28 px-4 border-t border-white/5 relative overflow-hidden">
          <div className="orb orb-gold absolute w-[400px] h-[400px] bottom-0 left-0 opacity-25 pointer-events-none" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div {...fadeUp(0)} className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(43_65%_68%)] mb-3">Business Architecture</p>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                The moat is <span className="gradient-text-gold italic">trust infrastructure.</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
                The competitor who wins long-term in personal intelligence won't be the one with the most data. It'll be the one people actually trust with it.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-5 mb-14">
              {MOAT_POINTS.map((point, i) => (
                <motion.div key={i} {...fadeUp(i * 0.08)} className="glass border border-white/8 rounded-2xl p-7 card-hover">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-[hsl(248_62%_52%/0.12)] border border-[hsl(248_62%_52%/0.2)]">
                    <point.icon className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Business model clarity */}
            <motion.div {...fadeUp(0.3)} className="glass border border-white/8 rounded-3xl p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">How the Business Model Scales</p>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  {
                    revenue: "Consumer Coaching",
                    tiers: ["Free Signal Check (acquisition)", "Full Dating Reset — $97 one-time", "Monthly Coaching — $197/mo"],
                    color: "hsl(var(--brand-indigo))",
                    label: "Today",
                  },
                  {
                    revenue: "Premium Intelligence",
                    tiers: ["Personal Intelligence Layer — subscription", "Coaching session bundles", "Partner integrations — premium tier"],
                    color: "hsl(var(--brand-gold))",
                    label: "Phase 2–3",
                  },
                  {
                    revenue: "B2B Insight Layer",
                    tiers: ["Anonymised trend reports for coaches & therapists", "Dating app aggregate benchmarks", "Research partner reports"],
                    color: "hsl(326 100% 65%)",
                    label: "Phase 4–5",
                  },
                ].map((bm, i) => (
                  <div key={i} className="rounded-2xl p-5" style={{ background: `${withAlpha(bm.color, 0.07)}`, border: `1px solid ${withAlpha(bm.color, 0.2)}` }}>
                    <span className="text-xs font-bold uppercase tracking-wider mb-1 block" style={{ color: bm.color }}>{bm.label}</span>
                    <p className="font-semibold text-foreground text-sm mb-3">{bm.revenue}</p>
                    <ul className="space-y-1.5">
                      {bm.tiers.map((tier, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: bm.color }} />
                          {tier}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── WHAT'S LIVE NOW ── */}
        <section className="py-20 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <motion.div {...fadeUp(0)} className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(142_55%_65%)] mb-3">Available Right Now</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">Levels 1 and 2 are live.</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                Every module below is shipped, demo-ready, and free to try. Level 4 has its first pieces in your dashboard today — the deeper pattern mirror lands next.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Sparkles, title: "Dating Diagnosis", desc: "Profile category, strengths, and what to fix first", href: "/diagnosis", label: "Live" },
                { icon: FileText, title: "Full Profile Audit", desc: "Score, rewrite, prompts, photos, action plan", href: "/start", label: "Live" },
                { icon: MessageSquare, title: "Message Lab", desc: "Tone analysis + 4 reply options with rationale", href: "/lab", label: "Live" },
                { icon: Headphones, title: "3-Min Signal Check", desc: "Free 3-minute check — score + 1 fix", href: "/signal-check", label: "Live" },
                { icon: Camera, title: "Profile Reader (OCR)", desc: "Upload a screenshot — we extract the signals", href: "/profile-reader", label: "Live" },
                { icon: BarChart3, title: "Dating Blueprint", desc: "Score history, signal spectrum, send-through trends", href: "/dashboard", label: "Live" },
                { icon: Brain, title: "Mirror & Archetype", desc: "Your communication style and profile archetype", href: "/mirror", label: "Live" },
                { icon: MessageSquare, title: "Next Message", desc: "AI-assisted reply for an in-flight conversation", href: "/next-message", label: "Live" },
                { icon: Layers, title: "Integrations Roadmap", desc: "Consent-first data connection preview", href: "/integrations", label: "Preview" },
              ].map((module, i) => (
                <motion.div key={i} {...fadeUp(i * 0.07)}>
                  <Link href={module.href}>
                    <div className="glass border border-white/8 rounded-2xl p-5 card-hover cursor-pointer h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(142_55%_45%/0.12)] border border-[hsl(142_55%_45%/0.2)]">
                          <module.icon className="w-4.5 h-4.5 text-[hsl(142_55%_60%)]" />
                        </div>
                        <span className="text-xs font-bold tag-strength border px-2.5 py-0.5 rounded-full">{module.label}</span>
                      </div>
                      <p className="font-semibold text-foreground text-sm mb-1">{module.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{module.desc}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-24 md:py-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(248_62%_52%/0.1)] via-[hsl(326_100%_59%/0.07)] to-[hsl(43_65%_62%/0.06)]" />
          <div className="orb orb-violet absolute w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <motion.div {...fadeUp(0)}>
              <Sparkles className="w-10 h-10 text-[hsl(248_62%_62%)] mx-auto mb-6" />
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                Start with what you<br />
                <span className="gradient-text italic">can share in 3 minutes.</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                The intelligence layer starts the moment you paste your first bio.
                Level 1 is free, instant, and shows you exactly what's possible.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-14 px-10 rounded-full font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse shadow-[0_4px_30px_hsl(248_62%_52%/0.5)]">
                  <Link href="/signal-check">
                    <Headphones className="mr-2 h-5 w-5" /> Free Signal Check
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-14 px-9 rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
                  <Link href="/start">Full Dating Audit <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6">No account required to start. No credit card. Full Level 1 access is free.</p>
            </motion.div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function MessageSquare({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}