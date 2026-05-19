import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Headphones, Sparkles } from "lucide-react";
import { useState } from "react";

const TIERS = [
  {
    name: "Free Audit",
    price: "$0",
    promoPrice: null,
    period: "",
    popular: false,
    badge: null,
    desc: "See exactly where you stand — with honesty, not flattery.",
    cta: "Get My Free Audit",
    href: "/start",
    accentColor: "hsl(228 18% 55%)",
    features: [
      "1 complete Dating Readiness Audit",
      "Your Dating Readiness Score (0–100)",
      "Bio critique — honest, specific, no fluff",
      "Top 3 action items",
      "2 photo guidance points",
      "Import Communication Patterns (demo)",
    ],
    excluded: [
      "Rewritten bio + prompts",
      "Full photo checklist (5 categories)",
      "Message coaching sessions",
      "Full 5-step action plan",
      "Score history tracking",
    ],
    walkaway: ["Your score", "Your top 3 action items", "What you're projecting"],
  },
  {
    name: "Full Dating Reset",
    price: "$97",
    promoPrice: null,
    period: "one-time",
    popular: true,
    badge: "Most Popular",
    desc: "Everything you need to completely transform how you're presenting yourself.",
    cta: "Begin My Reset",
    href: "/start",
    accentColor: "hsl(268 52% 68%)",
    features: [
      "Unlimited Dating Readiness Audits",
      "Complete rewritten bio + all prompts",
      "Full photo checklist (5 categories)",
      "10 message coaching sessions",
      "Full 5-step personalised action plan",
      "Score history + progress tracking",
      "Import Communication Patterns (full)",
      "Priority access to new features",
    ],
    excluded: [
      "Direct human coach access",
      "Weekly strategy sessions",
      "Members-only community",
    ],
    walkaway: ["A rewritten profile that sounds like you", "10 message coaching credits", "A score you can actually track"],
  },
  {
    name: "Monthly Coaching",
    price: "$197",
    promoPrice: "$118",
    period: "per month",
    popular: false,
    badge: "Podcast Listener Deal",
    desc: "Everything in Reset — plus ongoing coaching, strategy sessions, and community.",
    cta: "Start My Coaching",
    href: "/waitlist",
    accentColor: "hsl(43 65% 65%)",
    features: [
      "Everything in Full Dating Reset",
      "Direct access to a real dating coach",
      "Weekly 45-min strategy session",
      "Unlimited message coaching",
      "Audit after every major profile change",
      "Members-only community access",
      "Pre-date coaching briefs",
      "Priority feature access — everything first",
    ],
    excluded: [],
    walkaway: ["A real coach in your corner", "Unlimited coaching, unlimited audits", "A community of people doing the work"],
  },
];

const FAQS = [
  { q: "How is this different from generic dating advice?", a: "We give you specific, personalised output: a rewritten version of YOUR bio, coaching on YOUR messages, and an action plan built around YOUR situation. Nothing here could apply to someone else — that's the point." },
  { q: "Is the Free Audit actually free? No hidden catch?", a: "Yes, completely free. We give you a real, substantive audit because we believe if you see the quality, you'll upgrade. You get the score, the critique, and your top 3 action items — no credit card required." },
  { q: "How does the coaching engine work?", a: "Our coaching engine is deterministic — built on structured dating frameworks, real profile patterns, and coaching methodology. For Monthly Coaching, a human coach reviews every report and is directly available to you." },
  { q: "What if I'm not happy?", a: "We'll redo it or refund it. Dating is vulnerable and we take this seriously. Reach out within 30 days and we'll make it right — no questions asked." },
  { q: "Is my data private?", a: "Your bios, messages, and profile data are encrypted and never sold or shared with any third party. You can delete everything permanently from your account at any time." },
  { q: "How quickly will I see results?", a: "Most members who implement the action plan see measurably better results — more matches, better conversations, more dates — within 7–14 days. We track your score over time so progress is visible, not just felt." },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-40 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-30 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">

          {/* Podcast Banner */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl p-5 mb-12 text-center overflow-hidden shimmer"
            style={{ background: "linear-gradient(135deg, hsl(43 65% 62% / 0.15) 0%, hsl(43 65% 45% / 0.08) 100%)", border: "1px solid hsl(43 65% 62% / 0.25)" }}
            data-testid="banner-podcast-promo"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Headphones className="w-5 h-5 text-[hsl(43_65%_68%)]" />
              <span className="font-semibold text-foreground">Podcast listener deal:</span>
              <span className="text-muted-foreground">40% off Monthly Coaching for life. Use code</span>
              <code className="px-2.5 py-1 rounded-lg bg-[hsl(43_65%_62%/0.15)] text-[hsl(43_65%_72%)] font-bold text-sm border border-[hsl(43_65%_62%/0.3)]">PODCAST40</code>
              <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-[hsl(348_55%_65%/0.15)] border border-[hsl(348_55%_65%/0.2)] text-[hsl(348_55%_72%)] font-medium">Expires soon</span>
            </div>
          </motion.div>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-3">Invest in clarity</p>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Simple, honest pricing.</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start free. Upgrade when you see the quality. Cancel or delete anytime.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-20">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="relative flex flex-col"
                data-testid={`card-pricing-${tier.name.toLowerCase().replace(/ /g, "-")}`}
              >
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap"
                      style={{
                        background: tier.popular
                          ? "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))"
                          : "linear-gradient(135deg, hsl(43 65% 55%), hsl(43 65% 42%))",
                        color: "white",
                        boxShadow: tier.popular ? "0 4px 16px hsl(268 52% 68% / 0.4)" : "0 4px 16px hsl(43 65% 55% / 0.4)",
                      }}
                    >
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div
                  className={`flex-1 flex flex-col glass rounded-3xl p-7 pt-8 ${tier.popular ? "border-violet-glow" : "border border-white/8"}`}
                  style={tier.popular ? { boxShadow: "0 0 60px hsl(268 52% 68% / 0.12), 0 20px 50px rgb(0 0 0 / 0.4)" } : {}}
                >
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: tier.accentColor }}>{tier.name}</p>
                    <div className="flex items-end gap-2 mb-2">
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
                  <div className="rounded-xl p-3.5 mb-5" style={{ background: `${tier.accentColor.replace(")", " / 0.07)")}`, border: `1px solid ${tier.accentColor.replace(")", " / 0.15)")}` }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tier.accentColor }}>What you walk away with</p>
                    {tier.walkaway.map((w, j) => (
                      <div key={j} className="flex items-start gap-2 text-xs text-foreground/80 mt-1">
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

                  <Button
                    asChild
                    className="w-full rounded-full h-11 font-semibold border-0"
                    style={
                      tier.popular
                        ? { background: "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))", boxShadow: "0 4px 20px hsl(268 52% 68% / 0.4)" }
                        : { background: `${tier.accentColor.replace(")", " / 0.15)")}`, color: tier.accentColor, border: `1px solid ${tier.accentColor.replace(")", " / 0.25)")}` }
                    }
                    data-testid={`button-pricing-cta-${i}`}
                  >
                    <Link href={tier.href}>
                      {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* FAQ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div key={i} className="glass border border-white/8 rounded-2xl overflow-hidden" data-testid={`faq-${i}`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-white/2 transition-colors"
                    data-testid={`button-faq-${i}`}
                  >
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-center mt-16">
            <p className="text-muted-foreground mb-4 text-sm">Start with the free audit. No commitment, no credit card.</p>
            <Button
              asChild size="lg"
              className="rounded-full px-10 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse"
              data-testid="button-final-cta"
            >
              <Link href="/start">Get My Free Audit <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
