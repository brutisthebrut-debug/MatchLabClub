import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { CheckCircle2, Sparkles, ArrowRight, MessageCircle, Zap } from "lucide-react";
import { motion } from "framer-motion";

const PRODUCT_COPY: Record<string, { name: string; next: string; nextHref: string; nextLabel: string }> = {
  "signal-audit": {
    name: "Profile Signal Audit",
    next: "Your audit is ready. Head to your dashboard to see your Signal Score, Signal Spectrum, and rewritten bio.",
    nextHref: "/dashboard",
    nextLabel: "Go to Dashboard",
  },
  "dating-reset": {
    name: "The Dating Reset",
    next: "Everything is unlocked. Start with your full audit, then dive into Chemistry Lab and Dating Diagnosis.",
    nextHref: "/start",
    nextLabel: "Start My Dating Reset",
  },
  "wingman": {
    name: "Monthly Wingman",
    next: "Welcome to the team. We'll be in touch within 24 hours to schedule your first session.",
    nextHref: "/dashboard",
    nextLabel: "Go to Dashboard",
  },
};

const NEXT_STEPS = [
  { icon: Zap, label: "Complete your Profile Signal Audit", href: "/start" },
  { icon: MessageCircle, label: "Try the Chemistry Lab", href: "/lab" },
  { icon: Sparkles, label: "See your Dashboard", href: "/dashboard" },
];

export default function CheckoutSuccess() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const product = params.get("product") || "signal-audit";
  const copy = PRODUCT_COPY[product] ?? PRODUCT_COPY["signal-audit"];

  useMeta("Order Confirmed", "Your order is confirmed. Welcome to Next Level Dating Club.");

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-24 max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-green-400 border border-green-500/30 mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Order confirmed
          </div>

          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
            {copy.name} is yours.
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-10 max-w-md mx-auto">
            {copy.next}
          </p>

          <Link
            href={copy.nextHref}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-base"
          >
            {copy.nextLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16"
        >
          <p className="text-xs text-muted-foreground/50 uppercase tracking-widest mb-6">Explore what's available</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {NEXT_STEPS.map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className="glass rounded-xl p-5 flex flex-col items-center gap-3 hover:bg-white/5 transition-colors group text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
