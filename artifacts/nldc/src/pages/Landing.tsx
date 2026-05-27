import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Sparkles, Headphones, Eye, Clock, FileText } from "lucide-react";
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
    "Find out what your dating profile is really saying — and get it rewritten. Free 3-min Signal Check or the full Profile Signal Audit. No account needed to start.",
  );
  return (
    <AppLayout>
      {/* ── Hero — ONE primary action; Audit positioned as the natural next step ── */}
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
              Paste your bio. Get an honest read on what it's actually saying — and one rewritten line that shows what's possible. <span className="text-foreground/80 font-medium">3 minutes. No account. Free.</span>
            </motion.p>

            {/* PRIMARY CTA — single, oversized, unmissable */}
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
                Built for every dating context — straight, gay, queer, bi, trans, non-binary, mono &amp; poly.
              </p>

              {/* Risk reversal — quiet promise, prominent placement */}
              <div
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 mt-3 px-4 py-2 rounded-full glass border border-[hsl(142_55%_60%/0.25)]"
                data-testid="strip-risk-reversal"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(142_55%_72%)]">
                  <CheckCircle className="w-3 h-3" /> 30-day money-back guarantee
                </span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(142_55%_72%)]">
                  <Shield className="w-3 h-3" /> Delete everything anytime
                </span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[hsl(142_55%_72%)]">
                  <Eye className="w-3 h-3" /> Founder-reviewed in beta
                </span>
              </div>

              {/* Sample report — frictionless escape hatch */}
              <Link
                href="/sample-report"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[hsl(248_62%_52%)] hover:underline"
                data-testid="link-hero-sample-report"
              >
                <Eye className="w-3.5 h-3.5" /> Or see an example report first
                <ArrowRight className="w-3 h-3" />
              </Link>
            </motion.div>
          </div>

          {/* "What you'll get" — keeps Signal Check tangible without competing for the click */}
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

          {/* Audit upgrade — presented as the natural next step, not a competing choice */}
          <motion.div
            className="max-w-2xl mx-auto mt-7 p-5 rounded-2xl glass border border-[hsl(248_62%_52%/0.25)] flex flex-col sm:flex-row items-start sm:items-center gap-4"
            data-testid="card-hero-full-audit"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] shadow-[0_4px_16px_hsl(248_62%_52%/0.4)]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-0.5">Ready for the full picture?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                After your Signal Check, upgrade to the <span className="font-semibold text-foreground/85">Profile Signal Audit</span> — 8-dimension breakdown, full bio + prompt rewrites, and a 7-day plan.
              </p>
            </div>
            <Link
              href="/start"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(248_62%_52%)] hover:underline whitespace-nowrap"
              data-testid="button-hero-full-audit"
            >
              Skip to the Audit <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works — the 3-step narrative ── */}
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
                desc: "A prioritised plan built around your specific audit — not generic advice. Track your score as you implement.",
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

      {/* ── Before / After — concrete proof ── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="orb orb-plum absolute w-80 h-80 -left-40 top-20 opacity-50 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3">The Transformation</p>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground">
              See what changes when you're{" "}
              <span className="gradient-text-violet italic">seen accurately.</span>
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-3">Illustrative example — the kind of rewrite our coaching engine produces</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <motion.div
              className="glass rounded-3xl p-7 relative border border-foreground/8"
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            >
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(248_40%_94%)] text-muted-foreground border border-foreground/8">
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
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-[hsl(0_60%_50%/0.08)] text-[hsl(0_60%_45%)] border border-[hsl(0_60%_50%/0.2)]">{tag}</span>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            >
              {/* Badge lives OUTSIDE the shimmer card — shimmer uses overflow:hidden
                  to clip its moving gradient, which would otherwise clip this -top-3 pill. */}
              <div className="absolute -top-3 left-6 z-10">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white shadow-[0_2px_12px_hsl(248_62%_52%/0.4)]">
                  ✦ After Your Audit
                </span>
              </div>
              <div
                className="glass rounded-3xl p-7 relative shimmer"
                style={{ border: "1px solid hsl(var(--brand-indigo) / 0.3)", boxShadow: "0 0 40px hsl(var(--brand-indigo) / 0.08)" }}
              >
              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3D35CC] to-[#FF2D9B] flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_hsl(248_62%_52%/0.4)]">J</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Jordan, 31</p>
                  <p className="text-xs text-[hsl(43_65%_50%)] font-medium">Signal Score: 78/100 ↑</p>
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
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── What we fix — 4 pillars ── */}
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
                { num: "01", title: "What you're projecting", desc: "We show you what your profile is actually communicating — and how it reads to someone swiping.", color: "hsl(var(--brand-indigo))" },
                { num: "02", title: "Your profile text", desc: "Your bio and prompts, rewritten to sound genuinely like you — specific, memorable, worth responding to.", color: "hsl(var(--brand-gold))" },
                { num: "03", title: "Your conversations", desc: "Tone analysis and 5 tailored reply options — from warm to direct to date invitation — for every situation.", color: "hsl(190 55% 50%)" },
                { num: "04", title: "Your action plan", desc: "A concrete, prioritised 7-day plan built around your specific audit — not generic advice.", color: "hsl(142 55% 50%)" },
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

      {/* ── Trust — Early access / founder reviewed ── */}
      <section className="py-20 md:py-24 border-t border-foreground/5 relative overflow-hidden">
        <div className="orb orb-gold absolute w-96 h-96 right-0 top-20 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(43_65%_50%)] mb-3">Why this isn't another dating app</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Built for people doing the work — <span className="gradient-text italic">not chasing tricks.</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mt-4 leading-relaxed text-sm">
              We're in private beta and reviewing every report ourselves. You get founder-level attention on your audit.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { icon: "🔬", title: "Founder-reviewed", desc: "Every audit during private beta is reviewed by the founders personally. You're not getting a generic output — you're getting our full attention on your specific situation.", color: "hsl(var(--brand-indigo))" },
              { icon: "🤝", title: "You shape the product", desc: "Beta members get direct access to give feedback, request features, and influence what we build next. Help us build the tool you actually wish existed.", color: "hsl(var(--brand-gold))" },
              { icon: "🔒", title: "Launch pricing, locked in", desc: "Beta members lock in today's pricing for life. As we add more features and move out of beta, the price goes up — yours doesn't.", color: "hsl(142 55% 50%)" },
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
              Dating is vulnerable. We treat everything you share with the highest level of respect, security, and discretion.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: "🔒", title: "Never sold",       desc: "Your data is yours. We never sell or share with third parties." },
              { icon: "🗑", title: "Delete anytime",   desc: "One click permanently removes your account and all history." },
              { icon: "✋", title: "Consent first",    desc: "You control exactly what we analyze. Nothing is assumed." },
              { icon: "🚫", title: "Zero judgment",    desc: "An entirely private space to process your dating life honestly." },
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