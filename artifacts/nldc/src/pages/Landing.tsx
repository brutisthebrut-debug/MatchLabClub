import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Sparkles, Headphones, TrendingUp, Eye, MessageSquare, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useMeta } from "@/hooks/useMeta";
import { TrustBadge } from "@/components/TrustBadge";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Landing() {
  useMeta(
    "Free Dating Profile Audit & Message Coaching",
    "Find out what your dating profile is really saying — and get it rewritten. Free Signal Check, full Profile Signal Audit, Chemistry Lab message coaching. Takes 3 minutes."
  );
  return (
    <AppLayout>
      {/* ── Hero ── */}
      <section className="relative mesh-bg overflow-hidden pt-16 md:pt-32 pb-20 md:pb-36">
        {/* Decorative orbs */}
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-60 -right-60 opacity-80 pointer-events-none" />
        <div className="orb orb-gold absolute w-[400px] h-[400px] bottom-0 left-1/4 opacity-60 pointer-events-none" />
        <div className="orb orb-plum absolute w-[300px] h-[300px] top-40 left-0 opacity-70 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Headline */}
            <motion.h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
              {...fadeUp(0.08)}
            >
              <span className="text-foreground">Stop being</span>{" "}
              <span className="gradient-text-violet italic">overlooked.</span>
              <br />
              <span className="text-foreground">Start being</span>{" "}
              <span className="gradient-text">chosen.</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed mb-10"
              {...fadeUp(0.15)}
            >
              Your profile is already saying something. We show you exactly what,
              rewrite what isn't working, and coach your conversations.
              Most members see results within 48 hours.
            </motion.p>

            {/* CTAs */}
            <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" {...fadeUp(0.22)}>
              <Button
                asChild
                size="lg"
                className="h-14 px-9 text-base font-semibold rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse hover:opacity-90 transition-opacity shadow-[0_4px_24px_hsl(248_62%_52%/0.4)]"
                data-testid="button-hero-cta"
              >
                <Link href="/start">
                  Get My Dating Audit <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-14 px-8 text-base font-medium rounded-full border border-foreground/12 hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-all"
                data-testid="button-hero-sample-report"
              >
                <Link href="/sample-report">
                  <Eye className="mr-2 h-4 w-4" /> See Sample Report
                </Link>
              </Button>
            </motion.div>

            {/* Free entry nudge */}
            <motion.div className="flex flex-wrap items-center justify-center gap-3 mt-5" {...fadeUp(0.28)}>
              <Link
                href="/signal-check"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[hsl(43_65%_62%/0.3)] hover:border-[hsl(43_65%_62%/0.55)] hover:bg-[hsl(43_65%_62%/0.06)] transition-all group"
                data-testid="link-landing-sample-report"
              >
                <Headphones className="w-3.5 h-3.5 text-[hsl(43_65%_68%)]" />
                <span className="text-xs font-semibold text-foreground">Free 3-min Signal Check</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
              <span className="text-xs text-muted-foreground/50">No account needed</span>
            </motion.div>

            {/* Beta badge */}
            <motion.div className="flex items-center justify-center gap-3 mt-6" {...fadeUp(0.3)}>
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border border-[hsl(248_62%_52%/0.25)]">
                <span className="w-2 h-2 rounded-full bg-[hsl(142_55%_60%)] animate-pulse flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Private beta · Founder reviews every report · Built on real dating science</span>
              </div>
            </motion.div>
          </div>

          {/* Floating stat cards */}
          <motion.div
            className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-16"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            {[
              { value: "8", label: "dimensions of your dating signal — scored and explained", color: "hsl(248 62% 52%)" },
              { value: "3 min", label: "to get your Signal Score, bio critique, and action items", color: "hsl(43 65% 65%)" },
              { value: "7-day", label: "personalised action plan included in every full audit", color: "hsl(348 55% 65%)" },
            ].map((stat, i) => (
              <div
                key={i}
                className="glass border border-white/8 rounded-2xl p-5 text-center card-hover shimmer"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <p className="text-3xl font-bold mb-1" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Product Journey ── */}
      <section className="py-8 border-t border-white/5 bg-[hsl(248_40%_96%/0.5)]">
        <div className="container mx-auto px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-center text-muted-foreground/40 mb-5">How the path works</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { n: "1", label: "Check your signal",         href: "/start",         color: "hsl(248 62% 52%)" },
              { n: "2", label: "Get your Signal Score",  href: "/signal-check",  color: "hsl(43 65% 65%)"  },
              { n: "3", label: "Read your report",       href: "/sample-report", color: "hsl(142 55% 60%)" },
              { n: "4", label: "Pick your plan",         href: "/pricing",       color: "hsl(190 55% 60%)" },
              { n: "5", label: "Track your progress",    href: "/dashboard",     color: "hsl(326 100% 65%)" },
            ].map((step, i) => (
              <span key={step.n} className="flex items-center gap-2">
                <Link href={step.href} className="flex items-center gap-2 px-3 py-2 rounded-full glass border border-white/8 hover:border-white/18 transition-all group">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: step.color.replace(")", " / 0.18)"), color: step.color }}>{step.n}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">{step.label}</span>
                </Link>
                {i < 4 && <ArrowRight className="w-3 h-3 text-muted-foreground/25 hidden sm:block flex-shrink-0" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="orb orb-plum absolute w-80 h-80 -left-40 top-20 opacity-50 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <motion.p
              className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            >The Transformation
            </motion.p>
            <motion.h2
              className="text-3xl md:text-5xl font-bold text-foreground"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            >
              See what changes when you're{" "}
              <span className="gradient-text-violet italic">seen accurately.</span>
            </motion.h2>
            <motion.p
              className="text-xs text-muted-foreground/50 mt-3"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            >Illustrative example — the kind of rewrite our coaching engine produces</motion.p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <motion.div
              className="glass border border-white/8 rounded-3xl p-7 relative"
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            >
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(248_40%_94%)] text-muted-foreground border border-white/8">
                  Before Your Audit
                </span>
              </div>
              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(248_40%_92%)] flex items-center justify-center text-sm font-bold text-muted-foreground">J</div>
                <div>
                  <p className="font-semibold text-foreground/70 text-sm">Jordan, 31</p>
                  <p className="text-xs text-muted-foreground/60">Signal Score: 42/100</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "Software engineer who loves hiking and cooking. Big foodie. Looking for someone who is adventurous and loves to have fun. I'm told I'm easy to talk to and have a great sense of humor."
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {["⚠ Vague", "⚠ Cliché language", "⚠ No hook", "⚠ Invisible"].map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-[hsl(0_60%_50%/0.1)] text-[hsl(0_60%_65%)] border border-[hsl(0_60%_50%/0.2)]">{tag}</span>
                ))}
              </div>
            </motion.div>

            {/* After */}
            <motion.div
              className="glass border-violet-glow rounded-3xl p-7 relative shimmer"
              initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            >
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white shadow-[0_2px_12px_hsl(248_62%_52%/0.4)]">
                  ✦ After Your Audit
                </span>
              </div>
              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_hsl(248_62%_52%/0.4)]">J</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Jordan, 31</p>
                  <p className="text-xs text-[hsl(43_65%_68%)] font-medium">Signal Score: 78/100 ↑</p>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                "I make a genuinely great first date — I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to. Currently: too invested in my sourdough starter, rewatching things I've already seen, trying to find someone worth getting off the couch for."
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {["✓ Specific", "✓ Memorable", "✓ Conversation hook", "✓ Distinctly you"].map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs tag-strength border">{tag}</span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Free Signal Check ── */}
      <section className="py-20 md:py-24 border-t border-white/5 relative overflow-hidden">
        <div className="orb orb-gold absolute w-[500px] h-[500px] -right-40 top-0 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[hsl(43_65%_62%/0.25)] text-xs font-semibold text-[hsl(43_65%_72%)] uppercase tracking-widest mb-5">
                  <Sparkles className="w-3.5 h-3.5" /> Free · No Account Needed
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                  The 3-Minute<br />
                  <span className="gradient-text-gold italic">Signal Check.</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Paste your bio, choose your goal, and get your Signal Strength score, your profile category, your #1 improvement area, and a rewritten line — in under 3 minutes. Completely free. No account required.
                </p>
                <div className="space-y-3 mb-7">
                  {[
                    "Your Signal Strength score (0–100)",
                    "Your profile category — e.g. 'The Hidden Gem'",
                    "#1 improvement area, specific to your profile",
                    "One rewritten line showing exactly what's possible",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="rounded-full font-semibold" style={{ background: "linear-gradient(135deg, hsl(43 65% 55%), hsl(43 65% 42%))", boxShadow: "0 4px 20px hsl(43 65% 55% / 0.35)" }} data-testid="button-landing-signal-check">
                    <Link href="/signal-check"><Headphones className="mr-2 h-4 w-4" /> Check My Signal — Free</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="rounded-full border border-foreground/12 text-muted-foreground hover:text-foreground hover:bg-foreground/5">
                    <Link href="/start">Full Audit Instead <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                className="glass rounded-3xl p-7 shimmer"
                style={{ borderColor: "hsl(43 65% 62% / 0.3)", borderWidth: "1px", borderStyle: "solid", boxShadow: "0 0 60px hsl(43 65% 55% / 0.08)" }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">Example Signal Check Result</p>
                <div className="flex items-center gap-5 mb-5">
                  <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 font-bold" style={{ background: "hsl(248 62% 52% / 0.12)", border: "1px solid hsl(248 62% 52% / 0.3)", boxShadow: "0 0 20px hsl(248 62% 52% / 0.2)" }}>
                    <span className="text-3xl font-bold text-[hsl(248_62%_58%)]">64</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2" style={{ background: "hsl(248 62% 52% / 0.12)", color: "hsl(248 62% 58%)", border: "1px solid hsl(248 62% 52% / 0.3)" }}>The Hidden Gem</span>
                    <p className="text-sm text-muted-foreground">Real depth that isn't translating to your profile yet.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl p-4 bg-[hsl(43_65%_62%/0.07)] border border-[hsl(43_65%_62%/0.2)]">
                    <p className="text-xs font-semibold text-[hsl(43_65%_67%)] mb-1">#1 Improvement</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Generic language is masking your actual personality — replace 'loves hiking and cooking' with a specific scene only you'd describe.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 bg-[hsl(248_40%_95%)] border border-white/8">
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-xs text-muted-foreground/60 italic">"Easy to talk to, loves hiking..."</p>
                    </div>
                    <div className="rounded-xl p-3 bg-[hsl(248_62%_52%/0.07)] border border-[hsl(248_62%_52%/0.25)]">
                      <p className="text-xs text-[hsl(248_62%_62%)] mb-1">After ✦</p>
                      <p className="text-xs text-foreground italic">"I make a genuinely great first date..."</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 md:py-28 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">The Process</p>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground">
              Honest. Specific. <span className="gradient-text italic">Yours.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mt-4 leading-relaxed">
              Three steps from invisible profile to someone worth swiping right for.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Paste your profile",
                desc: "Drop in your bio, prompts, and optionally a conversation sample. Takes 3 minutes. No account required to start.",
                color: "hsl(248 62% 52%)",
              },
              {
                step: "02",
                title: "Receive your honest audit",
                desc: "Get a Dating Readiness Score, bio critique, rewritten copy, photo guidance, and a 5-step action plan. Built around you specifically.",
                color: "hsl(43 65% 65%)",
              },
              {
                step: "03",
                title: "Implement. Match better.",
                desc: "Apply the changes. Track your score over time. Use message coaching to convert matches to dates. Most members see results in 48 hours.",
                color: "hsl(142 55% 60%)",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="glass border border-white/8 rounded-3xl p-7 card-hover"
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <div className="text-4xl font-bold mb-5 font-mono" style={{ color: item.color }}>{item.step}</div>
                <h3 className="text-lg font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tools Grid ── */}
      <section className="py-20 md:py-24 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">The Toolkit</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Every tool you need. <span className="gradient-text italic">All in one place.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">From a 3-minute Signal Check to a full Dating Reset — all free to start, all built around your specific profile and situation.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { icon: Sparkles, title: "Dating Diagnosis", desc: "60-second triage. Paste your bio, get your profile category and the single thing to fix first. Best as a quick gut-check before going deeper.", href: "/diagnosis", badge: "Free", badgeColor: "hsl(142 55% 60%)", accentColor: "hsl(248 62% 52%)" },
              { icon: TrendingUp, title: "3-Min Signal Check", desc: "Fastest entry point: paste your bio, get your Signal Strength score and one rewritten line — in 3 minutes flat.", href: "/signal-check", badge: "Free · 3 min", badgeColor: "hsl(43 65% 65%)", accentColor: "hsl(43 65% 65%)" },
              { icon: CheckCircle, title: "Profile Signal Audit", desc: "The full audit. Signal Score, 8-dimension Signal Spectrum, complete bio + prompt rewrites, photo guidance, and a 7-day action plan you can start tomorrow.", href: "/start", badge: "Free to Start", badgeColor: "hsl(248 62% 52%)", accentColor: "hsl(142 55% 60%)" },
              { icon: MessageSquare, title: "Chemistry Lab", desc: "Paste any message or conversation. Get tone analysis, your recommended next action, and 5 reply options — Warm, Playful, Direct, Date Ask, Graceful Exit.", href: "/lab", badge: "Free", badgeColor: "hsl(190 55% 60%)", accentColor: "hsl(190 55% 60%)" },
              { icon: MessageSquare, title: "Message Coach", desc: "Deeper session coaching: paste a full conversation, choose your goal, and receive 3 tailored reply options with rationale.", href: "/coach", badge: "Free", badgeColor: "hsl(326 100% 65%)", accentColor: "hsl(326 100% 65%)" },
              { icon: BookOpen, title: "The MatchLab Journal", desc: "Dating science, profile psychology, and message coaching insights — written for people who want to understand what's actually happening.", href: "/blog", badge: "Read Free", badgeColor: "hsl(43 65% 65%)", accentColor: "hsl(43 65% 65%)" },
            ].map((tool, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Link href={tool.href}>
                  <div className="glass border border-white/8 rounded-2xl p-6 h-full card-hover cursor-pointer" style={{ borderColor: `${tool.accentColor.replace(")", " / 0.1)")}` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tool.accentColor.replace(")", " / 0.12)")}`, border: `1px solid ${tool.accentColor.replace(")", " / 0.2)")}` }}>
                        <tool.icon className="w-5 h-5" style={{ color: tool.accentColor }} />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${tool.badgeColor.replace(")", " / 0.12)")}`, color: tool.badgeColor, border: `1px solid ${tool.badgeColor.replace(")", " / 0.2)")}` }}>{tool.badge}</span>
                    </div>
                    <h3 className="font-bold text-foreground mb-2 text-sm">{tool.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                    <div className="flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color: tool.accentColor }}>
                      Try it <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Fix — 4-pillar positioning ── */}
      <section className="py-16 md:py-20 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">Four things we fix</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Most dating problems come from the same four places.
              </h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { num: "01", title: "What you're projecting", desc: "We show you what your profile is actually communicating — and how it reads to someone swiping.", color: "hsl(248 62% 52%)", bg: "hsl(248 62% 52% / 0.07)", border: "hsl(248 62% 52% / 0.2)" },
                { num: "02", title: "Your profile text", desc: "Your bio and prompts, rewritten to sound genuinely like you — specific, memorable, and worth responding to.", color: "hsl(43 65% 65%)", bg: "hsl(43 65% 65% / 0.07)", border: "hsl(43 65% 65% / 0.2)" },
                { num: "03", title: "Your conversations", desc: "Tone analysis and 5 tailored reply options — from warm to direct to date invitation — for every situation.", color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.07)", border: "hsl(190 55% 60% / 0.2)" },
                { num: "04", title: "Your action plan", desc: "A concrete, prioritised 7-day plan built around your specific audit — not generic advice.", color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.07)", border: "hsl(142 55% 60% / 0.2)" },
              ].map((item, i) => (
                <motion.div key={i} className="rounded-2xl p-6 card-hover" style={{ background: item.bg, border: `1px solid ${item.border}` }}
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

      {/* ── Early Access Social Proof ── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="orb orb-gold absolute w-96 h-96 right-0 top-20 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(43_65%_68%)] mb-3">Early Access</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              We're in private beta — <span className="gradient-text italic">be among the first.</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mt-4 leading-relaxed">
              We're building in public and reviewing every report ourselves. That means you get founder-level attention on your audit — and we get honest feedback to make it better.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: "🔬",
                title: "Founder-reviewed",
                desc: "Every audit during private beta is reviewed by the founders personally. You're not getting a generic output — you're getting our full attention on your specific situation.",
                color: "hsl(248 62% 52%)",
              },
              {
                icon: "🤝",
                title: "You shape the product",
                desc: "Beta members get direct access to give feedback, request features, and influence what we build next. This is your chance to help build the tool you actually wish existed.",
                color: "hsl(43 65% 65%)",
              },
              {
                icon: "🔒",
                title: "Launch pricing, locked in",
                desc: "Beta members lock in today's pricing for life. As we add more features and move out of beta, the price goes up — yours doesn't.",
                color: "hsl(142 55% 60%)",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="glass border border-white/8 rounded-3xl p-7 flex flex-col card-hover"
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl mb-4">{card.icon}</p>
                <h3 className="font-bold text-foreground mb-3">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{card.desc}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="text-center mt-10"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
          >
            <Link href="/waitlist" className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-[hsl(248_62%_52%/0.3)] text-sm font-semibold text-[hsl(248_62%_62%)] hover:border-[hsl(248_62%_52%/0.55)] transition-all">
              Join the early cohort <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-20 md:py-24 border-t border-white/5 relative overflow-hidden">
        <div className="orb orb-violet absolute w-[350px] h-[350px] right-0 top-10 opacity-35 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-5">Why we exist</p>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-7 leading-tight">
                Most people don't know<br />
                <span className="gradient-text-violet italic">what they're communicating.</span>
              </h2>
              <div className="line-accent max-w-xs mx-auto mb-8" />
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Your dating profile isn't failing because you're not interesting. It's failing because the way you're presenting yourself doesn't match who you actually are. That gap — between who you are and what your profile shows — is exactly what we close.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                We believe everyone deserves to understand what they're communicating — and to feel genuinely confident in how they show up. Not through flattery, not through generic advice, but through honest, specific reflection that shows you what to change and why.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 font-semibold glow-pulse">
                  <Link href="/start">Get My Free Signal Audit <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full border border-foreground/12 text-muted-foreground hover:text-foreground hover:bg-foreground/5">
                  <Link href="/roadmap">Our Vision <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Why We Built This ── */}
      <section className="py-20 md:py-28 relative overflow-hidden border-t border-white/5">
        <div className="orb orb-violet absolute w-[500px] h-[500px] -right-40 top-0 opacity-60 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-[hsl(248_62%_52%/0.25)] text-xs font-semibold text-[hsl(248_62%_62%)] uppercase tracking-widest mb-6">
                <Sparkles className="w-3.5 h-3.5" /> Why we built this
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5 leading-tight">
                For people doing the work —<br />
                <span className="gradient-text-violet italic">not chasing tricks.</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                Most dating advice is designed for the average person having average problems. It's vague on purpose — vague advice can't be wrong.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                We built MatchLab Club for people who are emotionally available, self-aware, and genuinely ready — but whose profiles don't show any of that yet. The technology isn't the point. Honest reflection is.
              </p>
              <Button asChild className="rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 font-semibold glow-pulse">
                <Link href="/waitlist">Join the Early Cohort <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Platform Vision Teaser ── */}
      <section className="py-20 md:py-24 border-t border-white/5 relative overflow-hidden">
        <div className="orb orb-plum absolute w-[400px] h-[400px] -left-40 top-10 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-5 gap-8 items-center">
              <motion.div className="md:col-span-2" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">Platform Vision</p>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                  You Control<br />
                  <span className="gradient-text-violet italic">the Mirror.</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed text-sm mb-6">
                  This is just Level 1. We're building a 5-level consent-based personal intelligence platform — where your dating insight compounds over time and stays entirely yours.
                </p>
                <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5" data-testid="button-view-roadmap">
                  <Link href="/roadmap">See the Full Roadmap <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </motion.div>
              <motion.div className="md:col-span-3" initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <div className="space-y-2.5">
                  {[
                    { num: 1, title: "User-Entered Dating Audit", status: "Live Today", statusColor: "hsl(142 55% 62%)", desc: "Bio, prompts, messages → Score, rewrite, coaching", live: true },
                    { num: 2, title: "User-Uploaded Presence Audit", status: "In Development", statusColor: "hsl(248 62% 58%)", desc: "Screenshots, profile links → Cross-platform analysis", live: false },
                    { num: 3, title: "Opt-In Connected Analysis", status: "Roadmap", statusColor: "hsl(43 65% 67%)", desc: "User-approved imports → Automatic pattern insights", live: false },
                    { num: 4, title: "Private Intelligence Layer", status: "Phase 3", statusColor: "hsl(326 100% 65%)", desc: "Private compounding profile of your dating self", live: false },
                    { num: 5, title: "Aggregate Insight Business", status: "Vision", statusColor: "hsl(348 55% 67%)", desc: "Anonymised trends → B2B insight, no individual exposed", live: false },
                  ].map((level, i) => (
                    <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${level.live ? "border-[hsl(142_55%_45%/0.25)] bg-[hsl(142_55%_45%/0.06)]" : "border-foreground/5 bg-[hsl(248_40%_96%/0.5)]"}`} style={{ opacity: level.live ? 1 : 0.6 + i * 0.08 }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: `${level.statusColor.replace(")", " / 0.12)")}`, color: level.statusColor, border: `1px solid ${level.statusColor.replace(")", " / 0.25)")}` }}>{level.num}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${level.live ? "text-foreground" : "text-muted-foreground"}`}>{level.title}</p>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${level.statusColor.replace(")", " / 0.1)")}`, color: level.statusColor }}>{level.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{level.desc}</p>
                      </div>
                      {level.live && <CheckCircle className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy Promise ── */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <Shield className="w-10 h-10 text-[hsl(248_62%_52%)] mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Your private sanctuary.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Dating is vulnerable. We treat everything you share with the highest level of respect, security, and discretion.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
            {[
              { icon: "🔒", title: "Never Sold", desc: "Your data is yours. We never sell or share with third parties." },
              { icon: "🗑", title: "Delete Anytime", desc: "One click permanently removes your account and all history." },
              { icon: "✋", title: "Consent First", desc: "You control exactly what we analyze. Nothing is assumed." },
              { icon: "🚫", title: "Zero Judgment", desc: "An entirely private space to process your dating life honestly." },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="glass border border-white/8 rounded-2xl p-6 text-center card-hover"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              >
                <p className="text-3xl mb-3">{item.icon}</p>
                <h3 className="font-semibold text-foreground text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(248_62%_52%/0.12)] via-[hsl(326_100%_59%/0.08)] to-[hsl(43_65%_62%/0.06)]" />
        <div className="orb orb-violet absolute w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <Sparkles className="w-10 h-10 text-[hsl(248_62%_62%)] mx-auto mb-6" />
            <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-5 leading-tight">
              Ready to be seen<br />
              <span className="gradient-text italic">for who you actually are?</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Takes 3 minutes. No credit card. Your first Dating Readiness Report is completely free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-14 px-10 text-base font-semibold rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse shadow-[0_4px_30px_hsl(248_62%_52%/0.5)]"
                data-testid="button-final-cta"
              >
                <Link href="/start">
                  Start My Reset <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-14 px-8 rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
                <Link href="/waitlist">Join the Waitlist</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">Free audit · No credit card · Instant results</p>
            <TrustBadge className="mt-3 justify-center" />
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
