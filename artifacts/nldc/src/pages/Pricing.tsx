import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Headphones, Sparkles, Zap, Heart, Star } from "lucide-react";
import { useState } from "react";
import { TrustBadge } from "@/components/TrustBadge";

const TIERS = [
  {
    name: "Signal Check",
    price: "$0",
    promoPrice: null,
    period: "",
    popular: false,
    badge: null,
    desc: "3 minutes. No card. Walk away knowing your Signal Score, your archetype, and the one thing most likely to change your results.",
    cta: "Get My Free Audit",
    href: "/start",
    nextStep: "→ 3-minute intake wizard · no credit card · instant report",
    accentColor: "hsl(228 18% 60%)",
    icon: Sparkles,
    features: [
      "1 complete Profile Signal Audit",
      "Your Signal Score (0–100)",
      "Signal Spectrum — 8 dimensions",
      "Bio critique — honest and specific",
      "Top 3 action items",
      "2 photo guidance points",
      "Chemistry Lab — message analysis (demo)",
    ],
    excluded: [
      "Rewritten bio + prompts",
      "Full photo checklist (5 categories)",
      "Message coaching sessions",
      "7-day action plan",
      "Score history tracking",
    ],
    walkaway: ["Your Signal Score", "Your top 3 action items", "What you're actually projecting"],
  },
  {
    name: "Profile Signal Audit",
    price: "$29",
    promoPrice: null,
    period: "one-time",
    popular: false,
    badge: null,
    desc: "Complete audit with full bio rewrite, all prompt rewrites, photo checklist, and your 7-day action plan. One payment, done.",
    cta: "Get My Audit — $29",
    href: "/checkout/signal-audit",
    nextStep: "→ Secure Stripe checkout · report delivered instantly after intake",
    accentColor: "hsl(190 75% 40%)",
    icon: Star,
    features: [
      "1 complete Profile Signal Audit",
      "Your Signal Score (0–100)",
      "Signal Spectrum — 8 dimensions",
      "Full bio rewrite — sounds like you",
      "All prompts rewritten with coach notes",
      "Photo checklist (5 categories)",
      "7-day personalised action plan",
      "Dating Diagnosis summary",
    ],
    excluded: [
      "Unlimited future audits",
      "Score history tracking",
      "Message coaching sessions",
      "Direct coach access",
    ],
    walkaway: [
      "A bio rewritten to sound like you",
      "Your 7-day action plan",
      "Honest, specific photo guidance",
    ],
  },
  {
    name: "The Dating Reset",
    price: "$97",
    promoPrice: null,
    period: "one-time",
    popular: true,
    badge: "Most Popular",
    desc: "A complete rebuild of how you present yourself — profile, prompts, messaging, photos, and a 7-day action plan.",
    cta: "Begin My Reset",
    href: "/checkout/dating-reset",
    nextStep: "→ Secure checkout · founder-reviewed within 48 hours · start Day 1 immediately",
    accentColor: "hsl(268 52% 68%)",
    icon: Zap,
    features: [
      "Unlimited Profile Signal Audits",
      "Full Signal Spectrum across 8 dimensions",
      "Complete rewritten bio — sounds like you, not a template",
      "All prompts rewritten with coach notes",
      "Full photo checklist (5 categories)",
      "Dating Diagnosis — pattern review",
      "Chemistry Lab — full message coaching",
      "10 message coaching sessions",
      "7-day personalised action plan",
      "Score history + progress tracking",
      "Communication Pattern Import (full)",
      "Priority access to new features",
    ],
    excluded: [
      "Direct human coach access",
      "Weekly strategy sessions",
      "Members-only community",
    ],
    walkaway: ["A profile rewritten to actually sound like you", "Your 7-day action plan", "10 message coaching credits + Chemistry Lab access"],
  },
  {
    name: "Wingman Membership",
    price: "$197",
    promoPrice: "$118",
    period: "per month",
    popular: false,
    badge: "Launch Cohort Deal",
    desc: "Everything in The Dating Reset — plus a real human coach in your corner, every week.",
    cta: "Join the Wingman Club",
    href: "/waitlist",
    nextStep: "→ Join the waitlist · invited in cohort order · today's price locks in for life",
    accentColor: "hsl(43 65% 65%)",
    icon: Heart,
    features: [
      "Everything in The Dating Reset",
      "Direct access to a real dating coach",
      "Weekly 45-min strategy session",
      "Unlimited message coaching",
      "Audit after every major profile change",
      "Members-only community access",
      "Pre-date coaching briefs",
      "Priority access to all new features — first",
    ],
    excluded: [],
    walkaway: ["A real coach in your corner, weekly", "Unlimited coaching and audits", "A community of people doing the work"],
  },
];

const FAQS = [
  { q: "How is this different from generic dating advice?", a: "We give you specific, personalised output: a rewritten version of YOUR bio, coaching on YOUR messages, your Signal Spectrum across 8 dimensions, and an action plan built around YOUR situation. Nothing here could apply to someone else — that's the point." },
  { q: "Is the free audit actually free? No hidden catch?", a: "Yes, completely free. We give you a real, substantive audit including your Signal Score and Spectrum because we believe if you see the quality, you'll upgrade. No credit card required." },
  { q: "What is The Dating Reset, exactly?", a: "It's a complete overhaul of your dating presence — your bio rewritten to sound like you, all prompts improved, a full photo checklist, your 8-dimension Signal Spectrum, Dating Diagnosis, Chemistry Lab message coaching, and a 7-day action plan. One payment, everything included." },
  { q: "How does the coaching engine work?", a: "Our coaching engine is deterministic — built on structured dating frameworks, real profile patterns, and coaching methodology. No external AI API means it never fails from rate limits. For Monthly Coaching, a human coach reviews and is directly available to you." },
  { q: "What if I'm not happy?", a: "We'll redo it or refund it. Dating is vulnerable and we take this seriously. Reach out within 30 days and we'll make it right — no questions asked." },
  { q: "Is my data private?", a: "Your bios, messages, and profile data are encrypted and never sold or shared with any third party. You can delete everything permanently from your account at any time. See our full consent-first privacy architecture on the Integrations page." },
  { q: "How quickly will I see results?", a: "Most members who implement the action plan see measurably better results — more matches, better conversations, more dates — within 7–14 days. We track your Signal Score over time so progress is visible, not just felt." },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Pricing() {
  useMeta("Pricing — Free, $29, $97 & $197 Coaching", "Four ways to get your dating profile working. Free Signal Check, $29 one-time audit, The Dating Reset ($97), or Monthly Wingman coaching ($197/mo).");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-40 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-30 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">

          {/* Launch Cohort Banner */}
          <motion.div {...fadeUp(0)}
            className="relative rounded-2xl p-5 mb-12 text-center overflow-hidden shimmer"
            style={{ background: "linear-gradient(135deg, hsl(43 65% 62% / 0.15), hsl(43 65% 45% / 0.08))", border: "1px solid hsl(43 65% 62% / 0.25)" }}
            data-testid="banner-launch-cohort"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Sparkles className="w-5 h-5 text-[hsl(43_65%_68%)]" />
              <span className="font-semibold text-foreground">Launch cohort:</span>
              <span className="text-muted-foreground">today's price locks in for life. Join the waitlist to claim your spot.</span>
              <Link href="/waitlist" className="text-xs font-semibold text-[hsl(43_65%_72%)] px-2.5 py-1 rounded-full bg-[hsl(43_65%_62%/0.15)] border border-[hsl(43_65%_62%/0.3)] hover:bg-[hsl(43_65%_62%/0.22)] transition-colors">Reserve spot →</Link>
            </div>
          </motion.div>

          {/* Shebangs Partner */}
          <motion.div {...fadeUp(0.04)}
            className="relative rounded-2xl p-4 mb-10 overflow-hidden glass"
            style={{ border: "1px solid hsl(268 52% 55% / 0.12)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Launch partner</span>
              <div className="h-4 w-px bg-foreground/10 hidden sm:block" />
              <a href="https://shebangs.club" target="_blank" rel="noopener noreferrer"
                className="font-semibold text-foreground text-sm hover:text-[hsl(43_65%_68%)] transition-colors">
                Shebangs.club
              </a>
              <span className="text-sm text-muted-foreground">— exclusive member perks for NLDC users</span>
              <a href="https://shebangs.club" target="_blank" rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 sm:ml-auto">
                Learn more <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </motion.div>

          {/* Header */}
          <motion.div {...fadeUp(0.07)} className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3">Invest in clarity</p>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Simple, honest pricing.</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed mb-5">
              Start free. Upgrade when you see the quality. Cancel or delete anytime.
            </p>
            <Link href="/sample-report"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-[hsl(268_52%_68%/0.25)] hover:border-[hsl(268_52%_68%/0.5)] hover:bg-[hsl(268_52%_68%/0.06)] transition-all group text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(268_52%_68%)]" />
              Not sure yet? See a full sample report first
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-14">
            {TIERS.map((tier, i) => (
              <motion.div key={tier.name} {...fadeUp(0.12 + i * 0.07)}
                className="relative flex flex-col"
                data-testid={`card-pricing-${tier.name.toLowerCase().replace(/ /g, "-")}`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap"
                      style={{
                        background: tier.popular
                          ? "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))"
                          : "linear-gradient(135deg, hsl(43 65% 55%), hsl(43 65% 42%))",
                        color: "white",
                        boxShadow: tier.popular ? "0 4px 16px hsl(268 52% 68% / 0.4)" : "0 4px 16px hsl(43 65% 55% / 0.4)",
                      }}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className={`flex-1 flex flex-col rounded-3xl p-5 pt-6 sm:p-7 sm:pt-8 ${tier.popular ? "mirror-card" : "glass border border-white/8"}`}
                  style={tier.popular ? { border: "1px solid hsl(268 52% 68% / 0.35)", boxShadow: "0 0 60px hsl(268 52% 68% / 0.12), 0 20px 50px rgb(0 0 0 / 0.4)" } : {}}>

                  {tier.popular && <div className="line-accent mb-6" />}

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${tier.accentColor.replace(")", " / 0.12)")}`, border: `1px solid ${tier.accentColor.replace(")", " / 0.2)")}` }}>
                        <tier.icon className="w-4 h-4" style={{ color: tier.accentColor }} />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tier.accentColor }}>{tier.name}</p>
                    </div>
                    <div className="flex items-end gap-2 mb-3">
                      {tier.promoPrice ? (
                        <>
                          <span className="text-4xl font-bold text-foreground" data-testid={`price-${i}`}>{tier.promoPrice}</span>
                          <span className="text-lg text-muted-foreground line-through mb-1">{tier.price}</span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-foreground" data-testid={`price-${i}`}>{tier.price}</span>
                      )}
                      {tier.period && <span className="text-sm text-muted-foreground mb-1">/{tier.period}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tier.desc}</p>
                  </div>

                  {/* What you walk away with */}
                  <div className="rounded-xl p-4 mb-5" style={{ background: `${tier.accentColor.replace(")", " / 0.07)")}`, border: `1px solid ${tier.accentColor.replace(")", " / 0.15)")}` }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: tier.accentColor }}>What you walk away with</p>
                    {tier.walkaway.map((w, j) => (
                      <div key={j} className="flex items-start gap-2 text-xs text-foreground/80 mt-1.5">
                        <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: tier.accentColor }} />
                        {w}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 mb-7 flex-1">
                    {tier.features.map((f, j) => (
                      <div key={j} className="flex items-start gap-2.5 text-sm" data-testid={`feature-${i}-${j}`}>
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tier.accentColor }} />
                        <span className="text-foreground/85">{f}</span>
                      </div>
                    ))}
                    {tier.excluded.map((f, j) => (
                      <div key={j} className="flex items-start gap-2.5 text-sm opacity-30">
                        <div className="w-4 h-4 rounded-full border border-current flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Button asChild className="w-full rounded-full h-12 font-semibold border-0"
                    style={
                      tier.popular
                        ? { background: "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))", boxShadow: "0 4px 20px hsl(268 52% 68% / 0.4)" }
                        : { background: `${tier.accentColor.replace(")", " / 0.14)")}`, color: tier.accentColor, border: `1px solid ${tier.accentColor.replace(")", " / 0.25)")}` }
                    }
                    data-testid={`button-pricing-cta-${i}`}>
                    <Link href={tier.href}>
                      {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <p className="text-center text-[11px] text-foreground/75 mt-2.5 leading-snug px-1">{tier.nextStep}</p>
                  {tier.price !== "$0" && (
                    <p className="text-center text-[11px] text-muted-foreground mt-1.5">30-day guarantee — we'll redo it or refund it</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          <TrustBadge className="mt-2 mb-2" />

          {/* What Happens After You Pay */}
          <motion.div {...fadeUp(0.26)} className="max-w-3xl mx-auto mb-12">
            <div className="text-center mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-2">No surprises</p>
              <h2 className="text-2xl font-bold text-foreground">What happens after you pay</h2>
            </div>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  title: "You submit your profile details",
                  desc: "Bio, prompts, a quick conversation sample, and optionally a photo context note. Takes about 5 minutes. Nothing is shared with third parties — ever.",
                  color: "hsl(268 52% 68%)",
                },
                {
                  step: "2",
                  title: "Your report generates instantly",
                  desc: "Signal Score, Personal Blueprint, full bio rewrite, rewritten prompts, photo checklist, message strategy, Compatibility Compass, and your 7-day action plan. Ready in seconds.",
                  color: "hsl(190 55% 60%)",
                },
                {
                  step: "3",
                  title: "During beta: a personal founder review note",
                  desc: "For founding beta users, the founder reads your report and writes a personal note on the 1–2 highest-leverage things specific to your situation. This takes up to 48 hours and is not a template.",
                  color: "hsl(43 65% 65%)",
                },
                {
                  step: "4",
                  title: "You start with Day 1 of your action plan",
                  desc: "Don't wait for the founder note. Start with the 7-day plan immediately — most people who do it see measurably better results within the first week.",
                  color: "hsl(142 55% 60%)",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 glass border border-white/8 rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ background: item.color }}>
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-0.5">{item.title}</p>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 glass border border-white/5 rounded-xl p-4 flex items-start gap-3">
              <span className="text-base flex-shrink-0">🔒</span>
              <p className="text-xs text-muted-foreground/55 leading-relaxed">
                <strong className="text-muted-foreground/70">Privacy promise:</strong>{" "}
                You control what is saved. Private content is not sold. You choose what becomes part of your profile — and you can export or delete everything at any time from your account page.
              </p>
            </div>
          </motion.div>

          {/* Founding Beta offer */}
          <motion.div {...fadeUp(0.28)} className="max-w-3xl mx-auto mb-10 rounded-2xl border border-[hsl(142_55%_60%/0.25)] bg-[hsl(142_55%_60%/0.05)] p-6">
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="w-10 h-10 rounded-xl bg-[hsl(142_55%_60%/0.15)] border border-[hsl(142_55%_60%/0.25)] flex items-center justify-center text-xl flex-shrink-0">
                🌱
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(142_55%_65%)]">Founding Beta</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[hsl(142_55%_60%/0.3)] text-[hsl(142_55%_65%)] bg-[hsl(142_55%_60%/0.1)]">First 25 users</span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Early access — founder involvement guaranteed</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  The first 25 users to run a full Dating Reset get the product at today's price — $97 one-time — and a personal founder review note with every report. This is a real read of your situation, not a template. It won't scale at this price once we're past the founding cohort.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Link href="/sample-report"
                    className="text-xs text-[hsl(142_55%_65%)] hover:text-[hsl(142_55%_75%)] transition-colors underline underline-offset-2">
                    See a sample report →
                  </Link>
                  <Link href="/checkout/dating-reset"
                    className="px-4 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, hsl(142 55% 50%), hsl(190 55% 55%))" }}>
                    Claim a founding spot
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Founder-Reviewed Beta Offer */}
          <motion.div {...fadeUp(0.3)}
            className="max-w-3xl mx-auto mb-16 rounded-3xl p-7 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 20% / 0.6), hsl(43 65% 20% / 0.3))", border: "1px solid hsl(268 52% 68% / 0.25)", boxShadow: "0 0 60px hsl(268 52% 68% / 0.08)" }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(43 65% 65%), transparent)", transform: "translate(30%, -30%)" }} />
            <div className="relative z-10">
              <div className="flex items-start gap-4 flex-col sm:flex-row">
                <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl"
                  style={{ background: "hsl(43 65% 65% / 0.15)", border: "1px solid hsl(43 65% 65% / 0.25)" }}>
                  🔬
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-[hsl(43_65%_72%)]">Beta Offer</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[hsl(348_55%_65%/0.3)] text-[hsl(348_55%_65%)] bg-[hsl(348_55%_65%/0.1)]">Limited spots</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Founder-Reviewed Dating Reset</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Early beta users get the full $97 Dating Reset — plus a personal note from the founder reviewing your results and suggesting one specific next move. Not a template. An actual read of your situation.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "What you get", value: "Full Dating Reset + founder personal review note" },
                      { label: "Turnaround", value: "Within 48 hours of your audit completing" },
                      { label: "Why limited", value: "Founder does every review personally — keeping it to 20 spots" },
                    ].map(item => (
                      <div key={item.label} className="rounded-xl bg-white/4 border border-white/8 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">{item.label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Link href="/checkout/dating-reset"
                      className="px-5 py-2.5 rounded-full text-sm font-semibold border-0 text-white"
                      style={{ background: "linear-gradient(135deg, hsl(43 65% 55%), hsl(268 52% 58%))", boxShadow: "0 4px 20px hsl(43 65% 55% / 0.3)" }}>
                      Claim a Founder-Reviewed Spot →
                    </Link>
                    <p className="text-xs text-muted-foreground/50">Same price as the Dating Reset — $97 one-time</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div {...fadeUp(0.35)} className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={i} className="glass border border-white/8 rounded-2xl overflow-hidden" data-testid={`faq-${i}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-white/2 transition-colors"
                    data-testid={`button-faq-${i}`}>
                    <p className="font-semibold text-foreground text-sm pr-4">{faq.q}</p>
                    <span className={`text-lg transition-transform flex-shrink-0 ${openFaq === i ? "rotate-45 text-[hsl(268_52%_68%)]" : "text-muted-foreground"}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 border-t border-white/6">
                      <p className="text-sm text-muted-foreground leading-relaxed mt-4">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div {...fadeUp(0.4)} className="text-center mt-16">
            <p className="text-muted-foreground mb-4 text-sm">Start with the free audit. No commitment, no credit card.</p>
            <Button asChild size="lg" className="rounded-full px-10 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse" data-testid="button-final-cta">
              <Link href="/start">Get My Free Signal Audit <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
