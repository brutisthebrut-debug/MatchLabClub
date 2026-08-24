import { withAlpha } from "@/lib/brandColor";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Sparkles, Zap, Heart, Lock, Target, Gauge } from "lucide-react";
import { useEffect, useState } from "react";
import { TrustBadge } from "@/components/TrustBadge";
import { ShareButton } from "@/components/echo/ShareButton";
import { trackEvent } from "@/lib/analytics";

const TIER_SHARE_TEXT: Record<string, string> = {
  "Free Signal Check": "MatchLab Club Free Signal Check: a 3-minute audit that shows what your profile is actually projecting.",
  "Dating Reset": "MatchLab Club Dating Reset: $97 for a full rebuild of how you show up, profile, prompts, photos, and messaging.",
  "Wingman": "MatchLab Club Wingman: $197 a month when enrollment is open, with expanded support and consideration for the controlled introduction pilot.",
};

interface PricingTier {
  name: string;
  outcome: string;
  readinessPayoff: string;
  price: string;
  promoPrice: string | null;
  period: string;
  popular: boolean;
  badge: string | null;
  desc: string;
  cta: string;
  href: string;
  nextStep: string;
  accentColor: string;
  icon: React.ElementType;
  features: string[];
  excluded: string[];
  walkaway: string[];
  betaNote?: string;
}

const TIERS: PricingTier[] = [
  {
    name: "Free Signal Check",
    outcome: "Get a useful first read, free",
    readinessPayoff: "Adds your first profile observations to a private record you can refine over time.",
    price: "$0",
    promoPrice: null,
    period: "",
    popular: false,
    badge: null,
    desc: "3 minutes. No card. Walk away with a profile pattern snapshot and one concrete improvement to try.",
    cta: "Get My Free Audit",
    href: "/start",
    nextStep: "→ 3-minute intake wizard · no credit card · instant report",
    accentColor: "hsl(228 18% 60%)",
    icon: Sparkles,
    features: [
      "Free Signal Check: 60-second bio read with one example rewrite",
      "Preview of the full Profile Signal Audit and top 3 risks",
      "Profile pattern snapshot across 8 dimensions",
      "Chemistry Lab teaser, message analysis (demo)",
    ],
    excluded: [
      "Upgrade required to see the full audit, prompt rewrites, photo checklist, and action plan",
      "Full bio rewrite",
      "Message coaching sessions",
      "Saved history and progress context",
    ],
    walkaway: ["Your profile pattern snapshot", "Your top 3 risks", "One example rewrite line"],
  },
  {
    name: "Dating Reset",
    outcome: "Build a focused dating reset",
    readinessPayoff: "A deeper profile record supports better coaching context; it never buys or guarantees an introduction.",
    price: "$97",
    promoPrice: null,
    period: "one-time",
    popular: true,
    badge: "Most Popular",
    desc: "A complete rebuild of how you present yourself. Profile, prompts, messaging, photos, and a 7-day action plan.",
    cta: "Begin My Reset",
    href: "/checkout/dating-reset",
    nextStep: "→ Secure checkout when enrollment is open · access follows verified payment",
    accentColor: "hsl(var(--brand-indigo))",
    icon: Zap,
    features: [
      "Unlimited Profile Signal Audits",
      "Full profile pattern read across 8 dimensions",
      "Complete rewritten bio that sounds like you, not a template",
      "All prompts rewritten with coach notes",
      "Full photo checklist (5 categories)",
      "Dating Diagnosis pattern review",
      "Chemistry Lab, full message coaching",
      "10 message coaching sessions",
      "7-day personalised action plan",
      "Saved history + progress context",
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
    name: "Wingman",
    outcome: "Expanded support, when enrollment is open",
    readinessPayoff: "Includes consideration for a controlled introduction pilot, subject to fit, consent, capacity, and availability.",
    price: "$197",
    promoPrice: null,
    period: "per month",
    popular: false,
    badge: "Limited enrollment",
    desc: "A monthly support tier with expanded coaching capacity and controlled-introduction consideration. Specific availability is confirmed before enrollment.",
    cta: "Check Wingman Availability",
    href: "/checkout/wingman",
    nextStep: "→ Monthly billing · manage or cancel from Account · no introduction guarantee",
    accentColor: "hsl(var(--brand-gold))",
    icon: Heart,
    features: [
      "Everything in The Dating Reset",
      "Expanded coaching and message-review capacity",
      "Audit after every major profile change",
      "Pre-date coaching briefs",
      "Consideration for the controlled introduction pilot",
      "Subscription management through the secure billing portal",
    ],
    excluded: [],
    walkaway: ["A deeper support lane", "More room for iterative coaching", "Pilot consideration without a promised match"],
  },
];

const FAQS = [
  { q: "How is this different from generic dating advice?", a: "We give you specific, personalised output: a rewritten version of YOUR bio, coaching on YOUR messages, your Signal Spectrum across 8 dimensions, and an action plan built around YOUR situation. Nothing here could apply to someone else. That's the point." },
  { q: "Is the free audit actually free? No hidden catch?", a: "Yes. It includes a substantive first profile read and one example rewrite. No credit card is required." },
  { q: "What is The Dating Reset, exactly?", a: "It's a complete overhaul of your dating presence. Your bio rewritten to sound like you, all prompts improved, a full photo checklist, your 8-dimension Signal Spectrum, Dating Diagnosis, Chemistry Lab message coaching, and a 7-day action plan. One payment, everything included." },
  { q: "How does the coaching engine work, and who reviews my audit?", a: "The structural engine runs on MatchLab's servers. Optional Deep AI can add semantic depth for supported tools when you enable it. Human access is limited to services you deliberately request, such as an approved coaching or controlled-introduction workflow, plus support and safety needs. The checkout page controls the exact scope of any paid offer." },
  { q: "What if I'm not happy?", a: "Contact support and we will review the issue and the terms shown for your checkout. Refund rights required by law are unaffected. A full refund of a one-time purchase ends that paid entitlement." },
  { q: "Does this send my data to AI?", a: "The structural engine runs on MatchLab's servers. Optional Deep AI sends the minimum relevant prompt content to the named provider only when you enable that account control. Provider handling is subject to the current provider terms described in Privacy and Integrations. We do not sell your private content to advertisers." },
  { q: "Can I turn the AI off?", a: "Yes. There's one toggle in Settings called Deep AI lane. Off means every call routes through the deterministic engine. No feature disappears, nothing breaks. You just get the structural read without the Claude pass on top. Flip it back on whenever. We log every change so the history is yours." },
  { q: "What if I don't trust AI with my dating life?", a: "Leave the Deep AI lane off. The structural tools remain available without that external model layer. You can export or delete your account data from Account, subject to transaction records a payment processor must retain." },
  { q: "How quickly will I see results?", a: "There is no promised timeline or guaranteed dating outcome. The product gives you structured observations, drafts, and actions to test; results still depend on your choices, other people, platform conditions, fit, and timing." },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Pricing() {
  useMeta(
    "Pricing: Free, $97 & $197 Coaching",
    "Start with a free profile read, choose a one-time reset when enrollment is open, or check availability for the limited Wingman support tier.",
    absoluteUrl(DEFAULT_OG_IMAGE),
    { canonicalUrl: absoluteUrl("/pricing") },
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    trackEvent("pricing_viewed", { source: "pricing_page" });
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-12 px-4 md:px-8 overflow-hidden relative">
        <div className="orb orb-violet fixed w-[600px] h-[600px] -top-32 -right-32 opacity-30 pointer-events-none" />
        <div className="orb orb-gold fixed w-[400px] h-[400px] top-[40%] -left-32 opacity-20 pointer-events-none" />
        <div className="orb orb-rose fixed w-[500px] h-[500px] -bottom-40 right-[10%] opacity-20 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10 pt-4">

          {/* Enrollment Banner */}
          <motion.div {...fadeUp(0)}
            className="relative rounded-2xl p-4 md:p-5 mb-14 text-center overflow-hidden shimmer glass-elevated border-gold-glow card-hover"
            data-testid="banner-enrollment-status"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap relative z-10">
              <Sparkles className="w-5 h-5 text-[hsl(43_65%_68%)] animate-pulse" />
              <span className="font-semibold text-foreground text-[15px]">Controlled enrollment:</span>
              <span className="text-muted-foreground text-[15px]">a paid product opens only after its service scope and capacity are approved.</span>
            </div>
          </motion.div>

          {/* Header */}
          <motion.div {...fadeUp(0.05)} className="text-center mb-16 lg:mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 glass border border-[hsl(248_62%_52%/0.25)]">
              <span className="flex h-2 w-2 rounded-full bg-[hsl(248_62%_52%)]"></span>
              <span className="text-[11px] font-bold uppercase tracking-widest gradient-text">Choose your support depth</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-foreground mb-6 tracking-tight leading-[1.05]">
              Simple, <span className="gradient-text-violet">honest pricing.</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
              Start free. Paid enrollment opens product by product, with the exact scope and billing terms shown before checkout.
            </p>
            <Link href="/sample-report"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass-strong border border-[hsl(248_62%_52%/0.3)] hover:border-[hsl(248_62%_52%/0.6)] hover:bg-[hsl(248_62%_52%/0.08)] transition-all group text-sm font-semibold text-foreground shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(61,53,204,0.15)]">
              <Sparkles className="w-4 h-4 text-[hsl(248_62%_52%)] group-hover:scale-110 transition-transform" />
              Not sure yet? See a full sample report first
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Shebangs Partner */}
          <motion.div {...fadeUp(0.1)}
            className="max-w-3xl mx-auto relative rounded-2xl p-4 mb-16 overflow-hidden glass hover:bg-white/40 transition-colors"
            style={{ border: "1px solid hsl(var(--brand-indigo) / 0.12)" }}
          >
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.1)] px-2 py-0.5 rounded-full">Partner</span>
              <a href="https://shebangs.club" target="_blank" rel="noopener noreferrer"
                className="font-bold text-foreground text-sm hover:text-[hsl(326_100%_59%)] transition-colors">
                Shebangs.club
              </a>
              <span className="text-sm text-muted-foreground/80">exclusive member perks for MatchLab Club users</span>
              <a href="https://shebangs.club" target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 md:ml-auto">
                Learn more <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-20 md:items-stretch">
            {TIERS.map((tier, i) => {
              const pctOff = tier.promoPrice
                ? Math.round(
                    (1 -
                      parseFloat(tier.promoPrice.replace(/[^0-9.]/g, "")) /
                        parseFloat(tier.price.replace(/[^0-9.]/g, ""))) *
                      100,
                  )
                : null;
              
              const isMiddle = tier.popular;

              return (
              <motion.div key={tier.name} {...fadeUp(0.15 + i * 0.1)}
                className={`relative flex flex-col h-full rounded-[2rem] p-6 md:p-8 transition-all duration-300 ${isMiddle ? "glass-elevated border-violet-glow lg:-translate-y-4 shadow-xl z-10" : "glass border border-white/12 hover:-translate-y-1 hover:shadow-lg z-0"}`}
                style={isMiddle ? { 
                  boxShadow: "0 0 80px hsl(248 62% 52% / 0.15), 0 20px 40px rgb(0 0 0 / 0.05)" 
                } : {}}
                data-testid={`card-pricing-${tier.name.toLowerCase().replace(/ /g, "-")}`}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-xl whitespace-nowrap"
                      style={{
                        background: isMiddle
                          ? "linear-gradient(135deg, hsl(248 62% 52%), hsl(326 100% 59%))"
                          : "linear-gradient(135deg, hsl(43 65% 55%), hsl(43 85% 45%))",
                        color: "white",
                        boxShadow: isMiddle ? "0 4px 16px hsl(248 62% 52% / 0.4)" : "0 4px 16px hsl(43 65% 55% / 0.4)",
                      }}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="flex-1 flex flex-col relative z-10">
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: `${withAlpha(tier.accentColor, 0.12)}`, border: `1px solid ${withAlpha(tier.accentColor, 0.25)}` }}>
                        <tier.icon className="w-5 h-5" style={{ color: tier.accentColor }} />
                      </div>
                      <p className="text-[13px] font-bold uppercase tracking-widest" style={{ color: tier.accentColor }}>{tier.name}</p>
                    </div>
                    
                    <p className="text-xl md:text-2xl font-bold leading-tight mb-4 text-foreground" data-testid={`outcome-${i}`}>
                      {tier.outcome}
                    </p>
                    
                    <div className="flex items-end gap-2 mb-4 flex-wrap">
                      {tier.promoPrice ? (
                        <>
                          <span className="text-5xl font-extrabold tracking-tight text-foreground" data-testid={`price-${i}`}>{tier.promoPrice}</span>
                          <span className="text-xl text-muted-foreground/60 line-through mb-1.5 font-medium">{tier.price}</span>
                          {pctOff !== null && pctOff > 0 && (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2 bg-[hsl(142_55%_60%/0.15)] text-[hsl(142_50%_45%)] border border-[hsl(142_55%_60%/0.3)]" data-testid={`badge-save-${i}`}>
                              Save {pctOff}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-5xl font-extrabold tracking-tight text-foreground" data-testid={`price-${i}`}>{tier.price}</span>
                      )}
                      {tier.period && <span className="text-base font-medium text-muted-foreground mb-1.5">/{tier.period}</span>}
                    </div>
                    
                    <p className="text-[15px] text-muted-foreground leading-relaxed min-h-[60px]">{tier.desc}</p>
                    
                    {"readinessPayoff" in tier && tier.readinessPayoff && (
                      <div className="mt-5 flex items-start gap-3 rounded-2xl p-4 bg-white/40 border border-white/10 shadow-sm"
                        data-testid={`readiness-payoff-${i}`}>
                        <Target className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tier.accentColor }} />
                        <p className="text-sm leading-relaxed text-foreground/80 font-medium">{tier.readinessPayoff}</p>
                      </div>
                    )}
                  </div>

                  {/* What you walk away with */}
                  <div className="rounded-2xl p-5 mb-8 flex-1" style={{ background: `${withAlpha(tier.accentColor, 0.05)}`, border: `1px solid ${withAlpha(tier.accentColor, 0.15)}` }}>
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: tier.accentColor }}>What you walk away with</p>
                    <div className="space-y-3">
                      {tier.walkaway.map((w, j) => (
                        <div key={j} className="flex items-start gap-2.5 text-sm font-medium text-foreground/90 leading-snug">
                          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tier.accentColor }} />
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    {tier.features.map((f, j) => (
                      <div key={j} className="flex items-start gap-3 text-sm" data-testid={`feature-${i}-${j}`}>
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tier.accentColor }} />
                        <span className="text-foreground/80 leading-snug">{f}</span>
                      </div>
                    ))}
                    {tier.excluded.map((f, j) => (
                      <div key={j} className="flex items-start gap-3 text-sm opacity-40">
                        <div className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/10">
                    <Button asChild className="w-full rounded-full h-14 text-[15px] font-bold border-0 shadow-md transition-all group overflow-hidden relative"
                      style={
                        isMiddle
                          ? { background: "linear-gradient(135deg, hsl(248 62% 52%), hsl(326 100% 59%))", color: "white" }
                          : { background: `${withAlpha(tier.accentColor, 0.1)}`, color: "hsl(var(--foreground))", border: `1px solid ${withAlpha(tier.accentColor, 0.25)}` }
                      }
                      data-testid={`button-pricing-cta-${i}`}>
                      <Link href={tier.href}>
                        <span className="relative z-10 flex items-center justify-center">
                          {tier.cta} <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                        {isMiddle && <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
                      </Link>
                    </Button>
                    
                    <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed font-medium">{tier.nextStep}</p>
                    
                    {tier.price !== "$0" ? (
                      <p className="text-center text-[11px] font-bold mt-2" style={{ color: "hsl(142 50% 45%)" }}>
                        Checkout-specific refund terms apply. Statutory rights are unaffected
                      </p>
                    ) : (
                      <p className="text-center text-[11px] text-muted-foreground/80 mt-2 font-medium">Free forever · no account required · results saved</p>
                    )}
                    
                    {tier.betaNote && (
                      <div className="mt-4 p-3.5 rounded-2xl text-[11px] text-muted-foreground leading-relaxed glass border border-[hsl(43_65%_55%/0.2)]">
                        <span className="font-bold text-[hsl(43_65%_45%)]">Private beta:</span> {tier.betaNote}
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-center text-muted-foreground">
                      <ShareButton
                        surface="pricing-tier"
                        title="MatchLab Club pricing"
                        text={TIER_SHARE_TEXT[tier.name] ?? "MatchLab Club pricing"}
                        path="/pricing"
                        variant="ghost"
                        label="Share this tier"
                        iconOnly={false}
                        className="h-8 px-3 rounded-full text-xs text-muted-foreground hover:bg-black/5 hover:text-foreground transition-colors"
                        testId={`share-pricing-${tier.name.toLowerCase().replace(/ /g, "-")}`}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
          
          <div className="flex justify-center mb-16">
            <TrustBadge className="scale-110 origin-top" />
          </div>

          {/* One-time audit option */}
          <motion.div {...fadeUp(0.2)} className="max-w-2xl mx-auto mb-24 text-center">
            <div className="p-6 rounded-3xl glass border border-white/10 hover:bg-white/40 transition-colors inline-block">
              <p className="text-[15px] text-muted-foreground leading-relaxed font-medium">
                Just want a single read instead of the full reset? The{" "}
                <Link
                  href="/checkout/signal-audit"
                  className="font-bold text-foreground border-b-2 border-[hsl(248_62%_52%/0.4)] hover:border-[hsl(248_62%_52%)] pb-0.5 transition-colors"
                  data-testid="link-signal-audit-onetime"
                >
                  one-time Signal Audit ($29)
                </Link>{" "}
                is a complete profile audit with a bio rewrite, photo checklist, and 7-day plan. No subscription.
              </p>
            </div>
          </motion.div>

          {/* What Happens After You Pay */}
          <motion.div {...fadeUp(0.25)} className="max-w-4xl mx-auto mb-24 relative">
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[hsl(248_62%_52%/0.2)] to-transparent hidden md:block -translate-x-1/2" />
            <div className="text-center mb-12">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-3 block">No surprises</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">What happens after you pay</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 md:gap-16">
              {[
                {
                  step: "1",
                  title: "You submit your profile details",
                  desc: "Bio, prompts, a quick conversation sample, and optionally a photo context note. Takes about 5 minutes. Your content is never sold. Deeper analysis through Anthropic Claude is opt-in per account, off by default.",
                  color: "hsl(248 62% 52%)",
                  align: "md:text-right md:items-end",
                  padding: "md:pt-0"
                },
                {
                  step: "2",
                  title: "Your report generates instantly",
                  desc: "Profile observations, Personal Blueprint, bio and prompt drafts, photo checklist, message strategy, Compatibility Compass, and your 7-day action plan. Ready in seconds.",
                  color: "hsl(190 70% 50%)",
                  align: "md:text-left md:items-start",
                  padding: "md:pt-24"
                },
                {
                  step: "3",
                  title: "You choose any human-review workflow",
                  desc: "A paid order does not silently authorize founder or coach access. If an approved service includes human review, its scope and timing are shown separately and require your deliberate participation.",
                  color: "hsl(43 65% 55%)",
                  align: "md:text-right md:items-end",
                  padding: "md:pt-0"
                },
                {
                  step: "4",
                  title: "You start with Day 1 of your action plan",
                  desc: "Use the plan as a set of experiments, not a result guarantee. Keep what helps, revise what does not, and move at your own pace.",
                  color: "hsl(142 55% 60%)",
                  align: "md:text-left md:items-start",
                  padding: "md:pt-24"
                },
              ].map((item, index) => (
                <div key={item.step} className={`relative flex flex-col ${item.align} ${item.padding}`}>
                  {/* Timeline Node - Desktop */}
                  <div className="hidden md:flex absolute top-6 md:top-auto md:bottom-auto w-10 h-10 rounded-full items-center justify-center text-white font-bold text-lg shadow-lg z-10"
                    style={{ 
                      background: item.color, 
                      left: index % 2 === 0 ? "calc(100% + 2rem)" : "calc(-2rem - 2.5rem)",
                      marginTop: index % 2 === 0 ? "0" : "6rem"
                    }}>
                    {item.step}
                  </div>
                  
                  <div className="glass-strong rounded-3xl p-6 md:p-8 hover:bg-white/60 transition-colors w-full card-hover">
                    {/* Mobile Step */}
                    <div className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg mb-4"
                      style={{ background: item.color }}>
                      {item.step}
                    </div>
                    <p className="font-bold text-foreground text-lg mb-2">{item.title}</p>
                    <p className="text-[15px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-12 max-w-2xl mx-auto glass-elevated border-[hsl(248_62%_52%/0.15)] rounded-2xl p-5 flex items-start sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(248_62%_52%/0.03)] to-transparent shimmer"></div>
              <div className="w-10 h-10 rounded-full bg-[hsl(248_62%_52%/0.1)] flex items-center justify-center flex-shrink-0 relative z-10">
                <Lock className="w-4 h-4 text-[hsl(248_62%_52%)]" />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed relative z-10">
                <strong className="text-foreground font-semibold">Privacy promise:</strong>{" "}
                You control what is saved. Private content is not sold. You choose what becomes part of your profile, and you can export or delete everything at any time from your account page.
              </p>
            </div>
          </motion.div>

          {/* Controlled introduction pilot */}
          <motion.div {...fadeUp(0.3)}
            className="max-w-4xl mx-auto mb-24 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden text-center sm:text-left"
            style={{ 
              background: "linear-gradient(135deg, hsl(248 62% 16%), hsl(43 65% 18%))", 
              boxShadow: "0 20px 60px hsl(248 62% 52% / 0.15), inset 0 1px 0 hsl(248 62% 52% / 0.3)" 
            }}
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(var(--brand-gold)), transparent)", transform: "translate(20%, -30%)" }} />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-30 pointer-events-none blur-3xl"
              style={{ background: "radial-gradient(circle, hsl(var(--brand-indigo)), transparent)", transform: "translate(-30%, 30%)" }} />
              
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-8">
              <div className="w-20 h-20 rounded-3xl flex-shrink-0 flex items-center justify-center"
                style={{ background: "hsl(43 65% 55% / 0.15)", border: "1px solid hsl(43 65% 55% / 0.3)", boxShadow: "0 0 30px hsl(43 65% 55% / 0.2)" }}>
                <Lock className="w-10 h-10 text-[hsl(43_65%_65%)] drop-shadow-[0_0_8px_hsl(43_65%_65%/0.8)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[hsl(43_65%_65%)]">Controlled pilot</span>
                  <span className="h-1 w-1 rounded-full bg-[hsl(43_65%_65%/0.5)]"></span>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[hsl(348_55%_65%/0.4)] text-[hsl(348_55%_75%)] bg-[hsl(348_55%_65%/0.15)] shadow-[0_0_10px_hsl(348_55%_65%/0.2)]">Limited availability</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">What controlled introductions mean</h3>
                <p className="text-[15px] text-white/70 leading-relaxed mb-8 max-w-2xl">
                  The pilot is not an open marketplace and payment does not buy a match. MatchLab may privately consider eligible members when fit, location, consent, capacity, and availability align. A proposed introduction stays private until an authorized reviewer deliberately sends it.
                </p>
                <div className="grid sm:grid-cols-3 gap-4 mb-8 text-left">
                  {[
                    { label: "What payment means", value: "Access to the purchased support tier, never a guaranteed introduction" },
                    { label: "What stays private", value: "Candidates, internal proposals, and reviewer notes until an introduction is deliberately sent" },
                    { label: "Why availability varies", value: "Fit, mutual consent, geography, member supply, safety, and operating capacity all matter" },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-colors">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">{item.label}</p>
                      <p className="text-[13px] text-white/90 leading-relaxed font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <Link href="/matching"
                    className="w-full sm:w-auto px-8 py-4 rounded-full text-[15px] font-bold border-0 text-[hsl(248_62%_16%)] text-center transition-transform hover:scale-105"
                    style={{ background: "linear-gradient(135deg, hsl(43 65% 55%), hsl(43 85% 65%))", boxShadow: "0 10px 30px hsl(43 65% 55% / 0.4)" }}>
                    Read how the pilot works →
                  </Link>
                  <p className="text-[13px] font-medium text-white/60">No timing, candidate, response, or outcome is promised</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Why this is worth paying for: the matching payoff */}
          <motion.div {...fadeUp(0.35)} className="max-w-4xl mx-auto mb-24">
            <div
              className="rounded-[2.5rem] p-10 md:p-14 text-center relative overflow-hidden glass-strong border-[hsl(248_62%_52%/0.2)] shadow-xl"
            >
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-[hsl(248_62%_52%/0.08)] to-transparent pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)] shadow-[0_0_20px_hsl(248_62%_52%/0.15)]">
                  <Gauge className="w-4 h-4 text-[hsl(248_62%_52%)]" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(248_62%_52%)]">Every tier feeds one meter</span>
                </div>
                
                <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-6 tracking-tight leading-tight max-w-3xl mx-auto">
                  You are buying a defined support product, <span className="gradient-text">not a dating outcome.</span>
                </h2>
                
                <p className="text-[17px] text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
                  Tools can deepen the record MatchLab uses for coaching and, if you opt in, controlled-pilot consideration. Paid status never overrides fit, mutual consent, safety, geography, availability, or human judgment.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Link
                    href="/matching"
                    onClick={() => trackEvent("pricing_to_matching", { source: "pricing_payoff" })}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-white transition-all hover:scale-105"
                    style={{ background: "linear-gradient(135deg, hsl(248 62% 52%), hsl(326 100% 59%))", boxShadow: "0 10px 30px hsl(248 62% 52% / 0.3)" }}
                    data-testid="link-pricing-to-matching"
                  >
                    See how the pilot works
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center gap-2 text-[15px] font-semibold text-muted-foreground hover:text-foreground transition-colors group"
                    data-testid="link-pricing-to-how-it-works"
                  >
                    How MatchLab works
                    <div className="w-1 h-1 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div {...fadeUp(0.4)} className="max-w-3xl mx-auto mb-24">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground text-center mb-10 tracking-tight">Frequently asked questions</h2>
            <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <div key={i} className="glass-elevated border-white/10 rounded-2xl overflow-hidden hover:border-[hsl(248_62%_52%/0.3)] transition-colors" data-testid={`faq-${i}`}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-white/40 transition-colors"
                    data-testid={`button-faq-${i}`}>
                    <p className="font-bold text-foreground text-[15px] pr-6">{faq.q}</p>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openFaq === i ? "bg-[hsl(248_62%_52%/0.1)]" : "bg-white/50"}`}>
                      <span className={`text-xl font-medium transition-transform ${openFaq === i ? "rotate-45 text-[hsl(248_62%_52%)]" : "text-foreground"}`}>+</span>
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6 pt-2">
                      <div className="w-12 h-px bg-gradient-to-r from-[hsl(248_62%_52%/0.5)] to-transparent mb-4"></div>
                      <p className="text-[15px] text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div {...fadeUp(0.5)} className="text-center pb-20 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[hsl(248_62%_52%/0.15)] rounded-full blur-[80px] pointer-events-none"></div>
            <p className="text-muted-foreground mb-6 text-[15px] font-medium relative z-10">Start with the free audit. No commitment, no credit card.</p>
            <Button asChild size="lg" className="rounded-full px-12 h-16 text-lg font-bold bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 glow-pulse shadow-[0_10px_40px_rgba(61,53,204,0.4)] hover:shadow-[0_15px_50px_rgba(61,53,204,0.5)] transition-all hover:scale-105 relative z-10" data-testid="button-final-cta">
              <Link href="/start">
                Get My Free Signal Audit <ArrowRight className="ml-3 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
