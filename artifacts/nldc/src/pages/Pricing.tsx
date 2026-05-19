import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Headphones, HelpCircle } from "lucide-react";
import { useState } from "react";

const TIERS = [
  {
    name: "Free Audit",
    price: "$0",
    period: "",
    badge: null,
    desc: "See exactly where you stand. No credit card required.",
    cta: "Get My Free Audit",
    href: "/start",
    variant: "outline" as const,
    features: [
      "1 complete profile audit",
      "Dating Readiness Score (0-100)",
      "Top 3 action items",
      "Bio critique (honest, specific)",
      "2 photo guidance points",
      "Email Insight Import (demo mode)",
    ],
    excluded: [
      "Rewritten bio and prompts",
      "Full photo checklist",
      "Message coaching sessions",
      "Full action plan",
      "Score history tracking",
    ],
  },
  {
    name: "Full Dating Reset",
    price: "$97",
    period: "one-time",
    badge: "Most Popular",
    desc: "Everything you need to completely transform your profile and strategy.",
    cta: "Get Started",
    href: "/start",
    variant: "default" as const,
    features: [
      "Unlimited profile audits",
      "Complete rewritten bio + all prompts",
      "Full photo guidance checklist",
      "10 message coaching sessions",
      "Full 5-step action plan",
      "Score history tracking",
      "Email Insight Import (full analysis)",
      "Priority access to new features",
    ],
    excluded: [
      "Direct coach access",
      "Weekly strategy sessions",
      "Community access",
    ],
  },
  {
    name: "Monthly Coaching",
    price: "$197",
    promoPrice: "$118",
    period: "per month",
    badge: "Early Listener Deal",
    desc: "Everything in Reset, plus ongoing coaching for sustained transformation.",
    cta: "Start Coaching",
    href: "/waitlist",
    variant: "default" as const,
    features: [
      "Everything in Full Dating Reset",
      "Direct access to a real dating coach",
      "Weekly 45-minute strategy session",
      "Unlimited message coaching",
      "Profile audits after every major change",
      "Community access (members-only)",
      "Pre-date coaching briefs",
      "Priority feature access",
    ],
    excluded: [],
  },
];

const FAQS = [
  {
    q: "How is this different from other dating coaching apps?",
    a: "Most apps give you generic advice. We give you specific, personalized output: a rewritten version of YOUR bio, coaching on YOUR messages, and an action plan built around YOUR situation. Nothing here could apply to someone else.",
  },
  {
    q: "Is the Free Audit actually free? No hidden catch?",
    a: "Yes, fully free. We give you a real, substantive audit because we believe if you see the value, you'll upgrade. You get the score, the critique, and your top 3 action items — no credit card required.",
  },
  {
    q: "How do you generate the coaching? Is it AI?",
    a: "Yes — we use AI trained on real coaching frameworks and thousands of successful dating profiles. The output is reviewed for quality and accuracy. For Monthly Coaching, you also get direct access to a human coach who reviews your reports.",
  },
  {
    q: "What if I'm not happy with my audit?",
    a: "We'll redo it or refund it, no questions asked. Dating is vulnerable and we take this seriously. Reach out within 30 days and we'll make it right.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your profile data, bios, and messages are encrypted and never sold or shared. You can delete everything anytime from your account settings. See our Privacy Promise on the Integrations page for full details.",
  },
  {
    q: "How soon will I see results?",
    a: "Most users who implement the action plan see measurably more matches within 7-14 days. The quality of those conversations tends to improve even faster. We track your score over time so you can see the progress.",
  },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Podcast promo banner */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-primary rounded-2xl p-5 text-primary-foreground text-center mb-12 flex items-center justify-center gap-3 flex-wrap"
            data-testid="banner-podcast-promo"
          >
            <Headphones className="w-5 h-5 opacity-80" />
            <span className="font-semibold">Podcast listener deal:</span>
            <span className="opacity-90">40% off Monthly Coaching for life. Use code <strong>PODCAST40</strong> at checkout.</span>
            <Badge className="bg-primary-foreground text-primary font-bold">Expires soon</Badge>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">Simple, honest pricing</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start free. Upgrade when you see the value. Cancel or delete anytime.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className={`relative bg-card border rounded-3xl p-8 flex flex-col ${i === 1 ? "border-primary shadow-lg scale-[1.02]" : "border-card-border"}`}
                data-testid={`card-pricing-${tier.name.toLowerCase().replace(/ /g, "-")}`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`${i === 2 ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"} font-semibold text-xs px-3 py-1`}>
                      {tier.badge}
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tier.name}</p>
                  <div className="flex items-end gap-2 mb-1">
                    {tier.promoPrice ? (
                      <>
                        <span className="text-4xl font-bold text-foreground" data-testid={`price-${i}`}>{tier.promoPrice}</span>
                        <span className="text-lg text-muted-foreground line-through">{tier.price}</span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-foreground" data-testid={`price-${i}`}>{tier.price}</span>
                    )}
                    {tier.period && <span className="text-sm text-muted-foreground mb-1">/{tier.period}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tier.desc}</p>
                </div>

                <div className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-sm" data-testid={`feature-${i}-${j}`}>
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                  {tier.excluded.map((f, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-sm opacity-40">
                      <div className="w-4 h-4 rounded-full border border-current flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>

                <Button
                  asChild
                  variant={i === 0 ? "outline" : "default"}
                  className="w-full rounded-full h-11 font-semibold"
                  data-testid={`button-pricing-cta-${i}`}
                >
                  <Link href={tier.href}>
                    {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="bg-card border border-card-border rounded-2xl overflow-hidden"
                  data-testid={`faq-${i}`}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/20 transition-colors"
                    data-testid={`button-faq-${i}`}
                  >
                    <p className="font-semibold text-foreground text-sm pr-4">{faq.q}</p>
                    <HelpCircle className={`w-5 h-5 flex-shrink-0 transition-colors ${openFaq === i ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 border-t border-border">
                      <p className="text-sm text-muted-foreground leading-relaxed mt-4">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-center mt-16"
          >
            <p className="text-muted-foreground mb-4 text-sm">Start with the free audit. No commitment, no credit card.</p>
            <Button asChild size="lg" className="rounded-full px-10 font-semibold" data-testid="button-final-cta">
              <Link href="/start">Get My Free Audit <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
