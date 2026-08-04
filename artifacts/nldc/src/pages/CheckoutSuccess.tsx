import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import {
  CheckCircle2, Sparkles, ArrowRight, MessageCircle, Zap, Star,
  Clock, Mail, BookOpen, Heart,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getGetBillingCheckoutStatusQueryKey,
  useGetBillingCheckoutStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

interface ProductCopy {
  name: string;
  headline: string;
  subhead: string;
  nextHref: string;
  nextLabel: string;
  steps: { icon: React.ElementType; title: string; desc: string; timeframe: string }[];
}

const PRODUCT_COPY: Record<string, ProductCopy> = {
  "signal-audit": {
  name: "Profile Signal Audit",
  headline: "Your audit is confirmed.",
  subhead: "Your Profile Signal Audit is ready. Here's how to get the most out of it in the next 48 hours.",
  nextHref: "/start",
  nextLabel: "Run My Signal Audit",
  steps: [
  {
  icon: Zap,
  title: "Complete your audit intake",
  desc: "Takes 3 minutes. Paste your bio, a message sample, and your goal. The more you give, the sharper the coaching.",
  timeframe: "Right now",
  },
  {
  icon: Star,
  title: "Read your full report",
  desc: "Your Signal Score, 8-dimension Spectrum, rewritten bio, prompt rewrites, and photo checklist, all in one place.",
  timeframe: "~5 min after submission",
  },
  {
  icon: BookOpen,
  title: "Work your 7-day action plan",
  desc: "Each day has one specific change. Start with Day 1 tonight, small edits compound quickly.",
  timeframe: "This week",
  },
  {
  icon: Mail,
  title: "Founder review note",
  desc: "During beta, every order gets a personal founder note within 48 hours. Watch your inbox.",
  timeframe: "Within 48 hours",
  },
  ],
  },
  "dating-reset": {
  name: "The Dating Reset",
  headline: "The Dating Reset is yours.",
  subhead: "Everything is ready. Here's the order that gets you results fastest.",
  nextHref: "/start",
  nextLabel: "Start My Dating Reset",
  steps: [
  {
  icon: Zap,
  title: "Run your full Signal Audit first",
  desc: "This is the foundation. Everything else builds on what your audit uncovers, don't skip it.",
  timeframe: "Right now",
  },
  {
  icon: MessageCircle,
  title: "Take your Chemistry Lab session",
  desc: "Paste a real conversation you're in right now. Get 3 coached replies. Playful, Direct, Warm, with rationale.",
  timeframe: "After your audit",
  },
  {
  icon: Heart,
  title: "Build your Compatibility Profile",
  desc: "18 wellness dimensions at your own pace. Consent-first, coaching only until you decide otherwise.",
  timeframe: "This week",
  },
  {
  icon: Mail,
  title: "Founder review note",
  desc: "Personal founder note within 48 hours. We look at every Dating Reset order directly.",
  timeframe: "Within 48 hours",
  },
  ],
  },
  "wingman": {
  name: "Monthly Wingman",
  headline: "Welcome to the team.",
  subhead: "Your Wingman membership is active. We'll be in touch within 24 hours to schedule your first session.",
  nextHref: "/dashboard",
  nextLabel: "Go to Dashboard",
  steps: [
  {
  icon: Clock,
  title: "Expect a message within 24 hours",
  desc: "We'll reach out to your email to schedule your first strategy session and understand your current situation.",
  timeframe: "Within 24 hours",
  },
  {
  icon: Zap,
  title: "Get your baseline audit in",
  desc: "Before your first session, complete your Signal Audit. It gives us a concrete starting point to coach from.",
  timeframe: "Before first session",
  },
  {
  icon: MessageCircle,
  title: "Unlimited message coaching is live",
  desc: "Start using Chemistry Lab for any conversation you're in right now. Don't wait for your first session.",
  timeframe: "Immediately",
  },
  {
  icon: Heart,
  title: "Build your Compatibility Profile",
  desc: "Your Wingman sessions go deeper when we have your 18-dimension profile to work from.",
  timeframe: "This week",
  },
  ],
  },
};

const EXPLORE_CARDS = [
  { icon: Zap, label: "Run your Signal Audit", href: "/start", color: "hsl(190 75% 50%)" },
  { icon: MessageCircle, label: "Chemistry Lab", href: "/lab", color: "hsl(var(--brand-indigo))" },
  { icon: Heart, label: "Compatibility Profile", href: "/wellness", color: "hsl(var(--brand-rose))" },
  { icon: Sparkles, label: "View Dashboard", href: "/dashboard", color: "hsl(var(--brand-gold))" },
];

export default function CheckoutSuccess() {
  const params = new URLSearchParams(
  typeof window !== "undefined" ? window.location.search : ""
  );
  const product = params.get("product") || "signal-audit";
  const sessionId = params.get("session_id") ?? "";
  const copy = PRODUCT_COPY[product] ?? PRODUCT_COPY["signal-audit"]!;
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const checkoutStatus = useGetBillingCheckoutStatus(sessionId, {
    query: {
      queryKey: getGetBillingCheckoutStatusQueryKey(sessionId),
      enabled: isAuthenticated && sessionId.length > 0,
      retry: 2,
    },
  });

  useMeta(
    checkoutStatus.data?.confirmed ? "Order Confirmed" : "Confirming Payment",
    "MatchLab Club verifies checkout with Stripe before paid access begins.",
  );

  if (
    authLoading ||
    (isAuthenticated && sessionId.length > 0 && checkoutStatus.isLoading)
  ) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-24 max-w-xl text-center">
          <Clock className="w-10 h-10 mx-auto mb-5 text-[hsl(248_62%_62%)] animate-pulse" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Confirming your payment…</h1>
          <p className="text-muted-foreground mt-3">Stripe gets the final word. This usually takes a moment.</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated || !checkoutStatus.data?.confirmed) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-24 max-w-xl text-center">
          <Clock className="w-12 h-12 mx-auto mb-6 text-amber-400" />
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Payment is not confirmed yet.
          </h1>
          <p className="text-muted-foreground leading-relaxed mt-4 mb-8">
            Paid access starts only after MatchLab verifies the Stripe session.
            An incomplete payment never unlocks a plan.
          </p>
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[hsl(248_62%_52%)] text-white font-semibold"
            >
              Sign in to verify checkout
            </button>
          ) : (
            <Link
              href={`/checkout/${product}`}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[hsl(248_62%_52%)] text-white font-semibold"
            >
              Return to checkout <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
  <AppLayout>
  <div className="container mx-auto px-4 md:px-6 py-20 max-w-2xl">

  {/* Hero confirmation */}
  <motion.div {...fadeUp(0)} className="text-center mb-14">
  <motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: "spring", stiffness: 200, damping: 20 }}
  className="w-20 h-20 rounded-full bg-[hsl(142_55%_60%/0.15)] flex items-center justify-center mx-auto mb-8"
  >
  <CheckCircle2 className="w-10 h-10 text-[hsl(142_55%_60%)]" />
  </motion.div>

  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(142_55%_65%)] border border-[hsl(142_55%_60%/0.3)] mb-6">
  <CheckCircle2 className="w-3.5 h-3.5" />
  Order confirmed
  </div>

  <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
  {copy.headline}
  </h1>
  <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-8">
  {copy.subhead}
  </p>

  <Link
  href={copy.nextHref}
  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-base"
  >
  {copy.nextLabel}
  <ArrowRight className="w-4 h-4" />
  </Link>
  </motion.div>

  {/* Step-by-step next actions */}
  <motion.div {...fadeUp(0.15)} className="mb-14">
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-5">What to do next</p>
  <div className="space-y-3">
  {copy.steps.map((step, i) => {
  const Icon = step.icon;
  return (
  <div key={i} className="glass border border-white/8 rounded-2xl p-4 flex items-start gap-4">
  <div className="w-9 h-9 rounded-xl bg-[hsl(248_62%_52%/0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
  <Icon className="w-4 h-4 text-[hsl(248_62%_58%)]" />
  </div>
  <div className="flex-1 min-w-0">
  <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
  <p className="text-sm font-semibold text-foreground">{step.title}</p>
  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground/50 flex-shrink-0">
  {step.timeframe}
  </span>
  </div>
  <p className="text-xs text-muted-foreground/70 leading-relaxed">{step.desc}</p>
  </div>
  </div>
  );
  })}
  </div>
  </motion.div>

  {/* Explore more */}
  <motion.div {...fadeUp(0.3)}>
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">Explore everything that's available</p>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {EXPLORE_CARDS.map(({ icon: Icon, label, href, color }) => (
  <Link
  key={href}
  href={href}
  className="glass rounded-xl p-4 flex flex-col items-center gap-2.5 hover:bg-white/5 transition-colors group text-center"
  >
  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${withAlpha(color, 0.12)}` }}>
  <Icon className="w-4 h-4" style={{ color }} />
  </div>
  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{label}</span>
  </Link>
  ))}
  </div>
  </motion.div>

  </div>
  </AppLayout>
  );
}
