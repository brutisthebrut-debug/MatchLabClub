import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle, Shield, Sparkles, Headphones, Star, TrendingUp, Play, Quote, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function Landing() {
  return (
    <AppLayout>
      {/* ── Podcast Banner ── */}
      <div className="bg-gradient-to-r from-[hsl(268_52%_68%/0.15)] via-[hsl(285_45%_60%/0.1)] to-[hsl(43_65%_62%/0.12)] border-b border-white/5 py-2.5">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2.5 text-sm font-medium">
          <Headphones className="w-4 h-4 text-[hsl(43_65%_68%)]" />
          <span className="text-foreground/80">As heard on <strong className="text-foreground">The Love Reset Podcast</strong></span>
          <span className="hidden md:inline text-muted-foreground">—</span>
          <Link href="/waitlist" className="hidden md:inline gradient-text-gold font-semibold hover:opacity-80 transition-opacity">
            Claim 40% off with code PODCAST40 →
          </Link>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative mesh-bg overflow-hidden pt-20 md:pt-32 pb-24 md:pb-36">
        {/* Decorative orbs */}
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-60 -right-60 opacity-80 pointer-events-none" />
        <div className="orb orb-gold absolute w-[400px] h-[400px] bottom-0 left-1/4 opacity-60 pointer-events-none" />
        <div className="orb orb-plum absolute w-[300px] h-[300px] top-40 left-0 opacity-70 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-[hsl(268_52%_68%/0.2)] text-xs font-semibold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(268_52%_68%)] animate-pulse" />
                Podcast Launch — Limited Early Access
              </span>
            </motion.div>

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
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
              {...fadeUp(0.15)}
            >
              Your profile isn't failing you because you're not dateable.
              It's failing you because it doesn't show who you actually are.
              We fix that — honestly, specifically, without the generic advice.
            </motion.p>

            {/* CTAs */}
            <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4" {...fadeUp(0.22)}>
              <Button
                asChild
                size="lg"
                className="h-14 px-9 text-base font-semibold rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse hover:opacity-90 transition-opacity shadow-[0_4px_24px_hsl(268_52%_68%/0.4)]"
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
                className="h-14 px-8 text-base font-medium rounded-full border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
              >
                <Link href="#how-it-works">
                  <Play className="mr-2 h-4 w-4" /> See How It Works
                </Link>
              </Button>
            </motion.div>

            {/* Social proof avatars */}
            <motion.div className="flex items-center justify-center gap-3 mt-10" {...fadeUp(0.3)}>
              <div className="flex -space-x-2.5">
                {["A", "M", "J", "S", "R"].map((l, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-[hsl(232_38%_7%)] flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: `hsl(${268 - i * 18} 52% ${58 + i * 3}%)` }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <span className="text-foreground font-semibold">2,847 audits</span>
                <span className="text-muted-foreground"> completed. Avg score gain: </span>
                <span className="text-[hsl(43_65%_68%)] font-semibold">+23 pts.</span>
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
              { value: "94%", label: "of members report higher-quality conversations", color: "hsl(268 52% 68%)" },
              { value: "3.2×", label: "average increase in meaningful matches", color: "hsl(43 65% 65%)" },
              { value: "48h", label: "to see results after implementing your audit", color: "hsl(348 55% 65%)" },
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

      {/* ── Before / After ── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="orb orb-plum absolute w-80 h-80 -left-40 top-20 opacity-50 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <motion.p
              className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3"
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
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <motion.div
              className="glass border border-white/8 rounded-3xl p-7 relative"
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            >
              <div className="absolute -top-3 left-6">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[hsl(232_34%_16%)] text-muted-foreground border border-white/8">
                  Before Your Audit
                </span>
              </div>
              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(232_28%_20%)] flex items-center justify-center text-sm font-bold text-muted-foreground">J</div>
                <div>
                  <p className="font-semibold text-foreground/70 text-sm">Jordan, 31</p>
                  <p className="text-xs text-muted-foreground/60">Dating Readiness Score: 42/100</p>
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
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_58%)] text-white shadow-[0_2px_12px_hsl(268_52%_68%/0.4)]">
                  ✦ After Your Audit
                </span>
              </div>
              <div className="flex items-center gap-3 mb-5 mt-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_hsl(268_52%_68%/0.4)]">J</div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Jordan, 31</p>
                  <p className="text-xs text-[hsl(43_65%_68%)] font-medium">Dating Readiness Score: 78/100 ↑</p>
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
                  <Headphones className="w-3.5 h-3.5" /> Free for Podcast Listeners
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
                  <Button asChild variant="ghost" size="lg" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
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
                  <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 font-bold" style={{ background: "hsl(268 52% 68% / 0.12)", border: "1px solid hsl(268 52% 68% / 0.3)", boxShadow: "0 0 20px hsl(268 52% 68% / 0.2)" }}>
                    <span className="text-3xl font-bold text-[hsl(268_52%_72%)]">64</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-2" style={{ background: "hsl(268 52% 68% / 0.12)", color: "hsl(268 52% 72%)", border: "1px solid hsl(268 52% 68% / 0.3)" }}>The Hidden Gem</span>
                    <p className="text-sm text-muted-foreground">Real depth that isn't translating to your profile yet.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl p-4 bg-[hsl(43_65%_62%/0.07)] border border-[hsl(43_65%_62%/0.2)]">
                    <p className="text-xs font-semibold text-[hsl(43_65%_67%)] mb-1">#1 Improvement</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Generic language is masking your actual personality — replace 'loves hiking and cooking' with a specific scene only you'd describe.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3 bg-[hsl(232_28%_14%)] border border-white/8">
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-xs text-muted-foreground/60 italic">"Easy to talk to, loves hiking..."</p>
                    </div>
                    <div className="rounded-xl p-3 bg-[hsl(268_52%_68%/0.07)] border border-[hsl(268_52%_68%/0.25)]">
                      <p className="text-xs text-[hsl(268_60%_78%)] mb-1">After ✦</p>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3">The Process</p>
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
                color: "hsl(268 52% 68%)",
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
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3">The Toolkit</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Every tool you need. <span className="gradient-text italic">All in one place.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">From a 3-minute free check to a full dating reset — all free to start, all built around your specific situation.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { icon: Sparkles, title: "Dating Diagnosis", desc: "Paste your bio and get your profile category, a diagnostic summary, what's working, and what to fix first.", href: "/diagnosis", badge: "Free", badgeColor: "hsl(142 55% 60%)", accentColor: "hsl(268 52% 68%)" },
              { icon: TrendingUp, title: "3-Min Signal Check", desc: "Fastest entry point: paste your bio, get your Signal Strength score and one rewritten line — in 3 minutes flat.", href: "/signal-check", badge: "Free · Podcast", badgeColor: "hsl(43 65% 65%)", accentColor: "hsl(43 65% 65%)" },
              { icon: CheckCircle, title: "Full Profile Audit", desc: "Complete Dating Readiness Score, bio rewrite, all prompts, photo checklist, messaging analysis, and 5-step action plan.", href: "/start", badge: "Free to Start", badgeColor: "hsl(268 52% 68%)", accentColor: "hsl(142 55% 60%)" },
              { icon: MessageSquare, title: "Message Lab", desc: "Paste any message or conversation. Get tone analysis, likely impression, and 4 reply options — Warm, Clear, Playful, Direct.", href: "/lab", badge: "Free", badgeColor: "hsl(190 55% 60%)", accentColor: "hsl(190 55% 60%)" },
              { icon: MessageSquare, title: "Message Coach", desc: "Deeper session coaching: paste a full conversation, choose your goal, and receive 3 tailored reply options with rationale.", href: "/coach", badge: "Free", badgeColor: "hsl(285 45% 65%)", accentColor: "hsl(285 45% 65%)" },
              { icon: Shield, title: "Platform Vision", desc: "See the full 5-level dating intelligence roadmap — from free audit to private personal intelligence. Investor-demo ready.", href: "/roadmap", badge: "Vision", badgeColor: "hsl(43 65% 65%)", accentColor: "hsl(43 65% 65%)" },
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

      {/* ── Testimonials ── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="orb orb-gold absolute w-96 h-96 right-0 top-20 opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(43_65%_68%)] mb-3">Real Members</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              What it feels like when your profile finally <span className="gradient-text italic">sounds like you.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { quote: "My match rate tripled, but more importantly, I stopped dreading conversations. My profile finally sounds like me — and the people reaching out actually get what I'm about.", name: "Sarah, 31", label: "Found a relationship in 6 weeks" },
              { quote: "I've been on apps for two years and felt like I was screaming into a void. Two weeks after my audit, I had four dates lined up. The bio rewrite alone changed everything.", name: "Marcus, 28", label: "3× more matches in first week" },
              { quote: "What got me was how honest it was. Not mean, just accurate. It showed me exactly what I was projecting vs. what I wanted to project. That clarity was worth more than the rewrite.", name: "Elena, 35", label: "Engaged after meeting on Hinge" },
            ].map((review, i) => (
              <motion.div
                key={i}
                className="glass border border-white/8 rounded-3xl p-7 flex flex-col card-hover"
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              >
                <Quote className="w-8 h-8 text-[hsl(268_52%_68%/0.4)] mb-4 flex-shrink-0" />
                <p className="text-sm text-foreground/85 leading-relaxed flex-1 italic">"{review.quote}"</p>
                <div className="mt-6 pt-5 border-t border-white/5">
                  <div className="flex text-[hsl(43_65%_65%)] mb-1">
                    {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-current" />)}
                  </div>
                  <p className="font-semibold text-foreground text-sm">{review.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{review.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Podcast Launch Block ── */}
      <section className="py-20 md:py-28 relative overflow-hidden border-t border-white/5">
        <div className="orb orb-violet absolute w-[500px] h-[500px] -right-40 top-0 opacity-60 pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-[hsl(43_65%_62%/0.25)] text-xs font-semibold text-[hsl(43_65%_72%)] uppercase tracking-widest mb-6">
                  <Headphones className="w-3.5 h-3.5" /> Podcast Launch
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5 leading-tight">
                  Why we built this<br />
                  <span className="gradient-text-gold italic">(and why now.)</span>
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-5">
                  Most dating advice is designed for the average person having average problems. It's vague on purpose — vague advice can't be wrong.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-5">
                  We built Next Level Dating Club for people who are emotionally available, self-aware, and genuinely ready — but whose profiles don't show any of that. The technology isn't the point. Honest reflection is.
                </p>
                <p className="text-foreground/70 text-sm leading-relaxed mb-8 border-l-2 border-[hsl(268_52%_68%/0.4)] pl-4 italic">
                  "We launched alongside The Love Reset Podcast because we wanted to meet people who were already doing the work — and give them better tools."
                </p>
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse">
                  <Link href="/waitlist">Join the Early Cohort <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </motion.div>

              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              >
                {/* Podcast card */}
                <div className="glass border-gold-glow rounded-3xl p-6 shimmer">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[hsl(43_65%_55%)] to-[hsl(43_65%_40%)] flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_hsl(43_65%_55%/0.3)]">
                      <Headphones className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">The Love Reset Podcast</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Official coaching partner</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Listener-exclusive offer: 40% off Monthly Coaching for life. Use code <strong className="text-[hsl(43_65%_70%)] font-semibold">PODCAST40</strong> at checkout.
                  </p>
                </div>

                {/* Perks */}
                <div className="glass border border-white/8 rounded-3xl p-6">
                  <p className="font-semibold text-foreground text-sm mb-4">Podcast listener perks</p>
                  <div className="space-y-3">
                    {[
                      "40% off Monthly Coaching — locked in forever",
                      "First access before public launch",
                      "Free Full Dating Reset (first 50 members)",
                      "Priority invite to members-only community",
                    ].map((perk, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle className="w-4 h-4 text-[hsl(268_52%_68%)] flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
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
                <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3">Platform Vision</p>
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
                    { num: 2, title: "User-Uploaded Presence Audit", status: "In Development", statusColor: "hsl(268 52% 72%)", desc: "Screenshots, profile links → Cross-platform analysis", live: false },
                    { num: 3, title: "Opt-In Connected Analysis", status: "Roadmap", statusColor: "hsl(43 65% 67%)", desc: "User-approved imports → Automatic pattern insights", live: false },
                    { num: 4, title: "Private Intelligence Layer", status: "Phase 3", statusColor: "hsl(285 45% 68%)", desc: "Private compounding profile of your dating self", live: false },
                    { num: 5, title: "Aggregate Insight Business", status: "Vision", statusColor: "hsl(348 55% 67%)", desc: "Anonymised trends → B2B insight, no individual exposed", live: false },
                  ].map((level, i) => (
                    <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${level.live ? "border-[hsl(142_55%_45%/0.25)] bg-[hsl(142_55%_45%/0.06)]" : "border-white/5 bg-[hsl(232_28%_12%/0.5)]"}`} style={{ opacity: level.live ? 1 : 0.6 + i * 0.08 }}>
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
            <Shield className="w-10 h-10 text-[hsl(268_52%_68%)] mx-auto mb-5" />
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
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(268_52%_68%/0.12)] via-[hsl(285_45%_60%/0.08)] to-[hsl(43_65%_62%/0.06)]" />
        <div className="orb orb-violet absolute w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <Sparkles className="w-10 h-10 text-[hsl(268_52%_78%)] mx-auto mb-6" />
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
                className="h-14 px-10 text-base font-semibold rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse shadow-[0_4px_30px_hsl(268_52%_68%/0.5)]"
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
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
