import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeta } from "@/hooks/useMeta";
import { capturePurchaseInterest } from "@/lib/apiClient";
import {
  CheckCircle2, Sparkles, Lock, ArrowRight, ExternalLink,
  Zap, Star, Crown, AlertTriangle, Tag
} from "lucide-react";
import { motion } from "framer-motion";

type Product = "signal-audit" | "dating-reset" | "wingman";

interface ProductConfig {
  name: string;
  price: string;
  priceDetail: string;
  badge: string;
  badgeColor: string;
  description: string;
  features: string[];
  cta: string;
  icon: React.ElementType;
  gradient: string;
  amountCents: number;
  stripeEnvKey: string | null;
  successCopy: string;
}

const PRODUCTS: Record<Product, ProductConfig> = {
  "signal-audit": {
    name: "Profile Signal Audit",
    price: "$29",
    priceDetail: "One-time. No subscription.",
    badge: "One-time audit",
    badgeColor: "hsl(190 75% 50%)",
    description:
      "Your full Profile Signal Audit with bio rewrite, all prompts rewritten, photo checklist, and your 7-day action plan. One payment, everything delivered.",
    features: [
      "Your full Signal Score (0–100) + 8-dimension Spectrum",
      "Bio rewritten to actually sound like you",
      "Every prompt rewritten with coach notes",
      "Photo checklist across 5 categories",
      "Dating Diagnosis — pattern review",
      "Personalised 7-day action plan",
      "Founder review note during beta (within 48h)",
    ],
    cta: "Get My Audit — $29",
    icon: Zap,
    gradient: "from-[hsl(190_75%_50%)] to-[hsl(190_75%_38%)]",
    amountCents: 2900,
    stripeEnvKey: "VITE_STRIPE_SIGNAL_AUDIT_LINK",
    successCopy: "Your Profile Signal Audit is confirmed.",
  },
  "dating-reset": {
    name: "The Dating Reset",
    price: "$97",
    priceDetail: "One-time. No subscription.",
    badge: "Most Popular",
    badgeColor: "hsl(var(--brand-indigo))",
    description:
      "A complete rebuild of how you present yourself — profile, prompts, messaging, photos, and a 7-day action plan. Walk away with a profile that's finally working.",
    features: [
      "Everything in the $29 Signal Audit, plus:",
      "Unlimited future Signal Audits (re-run after every change)",
      "Chemistry Lab — 10 message coaching sessions",
      "Communication pattern import (full)",
      "Score history + progress tracking",
      "Founder review note during beta (within 48h)",
      "Priority access to new features",
    ],
    cta: "Get The Dating Reset — $97",
    icon: Star,
    gradient: "from-[hsl(348_55%_58%)] to-[hsl(248_62%_58%)]",
    amountCents: 9700,
    stripeEnvKey: "VITE_STRIPE_DATING_RESET_LINK",
    successCopy: "The Dating Reset is confirmed.",
  },
  "wingman": {
    name: "Monthly Wingman",
    price: "$197",
    priceDetail: "/month · Cancel anytime.",
    badge: "For serious daters",
    badgeColor: "hsl(43 65% 52%)",
    description:
      "Your personal dating coach, available whenever you need guidance. Weekly sessions, unlimited coaching.",
    features: [
      "Everything in The Dating Reset",
      "Weekly 1:1 coaching sessions",
      "Unlimited message coaching",
      "Monthly profile refresh and updates",
      "Priority access to new features",
      "Direct founder access",
      "Cancel anytime, no penalty",
    ],
    cta: "Join Monthly Wingman — $197/mo",
    icon: Crown,
    gradient: "from-[hsl(43_65%_52%)] to-[hsl(30_60%_48%)]",
    amountCents: 19700,
    stripeEnvKey: "VITE_STRIPE_WINGMAN_LINK",
    successCopy: "Welcome to Monthly Wingman.",
  },
};

function PaidForm({ product }: { product: Product }) {
  const config = PRODUCTS[product];
  const stripeLink = config.stripeEnvKey
    ? (import.meta.env as Record<string, string>)[config.stripeEnvKey]
    : null;

  const [form, setForm] = useState({ firstName: "", email: "", promoCode: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (stripeLink) {
    return (
      <div className="space-y-4">
        <a
          href={stripeLink}
          className={`flex items-center justify-center gap-2 w-full bg-gradient-to-r ${config.gradient} text-white font-semibold rounded-xl h-12 text-base hover:opacity-90 transition-opacity`}
        >
          <Lock className="w-4 h-4" />
          {config.cta}
          <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
        </a>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
          <Lock className="w-3 h-3" />
          Secured by Stripe. 14-day money-back guarantee.
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 py-4"
      >
        <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">You're on the early list for {config.name}.</p>
          <p className="text-sm text-muted-foreground mt-1">
            We'll email you the moment checkout opens — you'll get first access{form.promoCode ? ", and your promo code will be applied during follow-up" : ""}.
          </p>
        </div>
        <Link
          href="/sample-report"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_88%)] transition-colors"
        >
          See a real sample report while you wait <ArrowRight className="w-3 h-3" />
        </Link>
      </motion.div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) { setError("Email is required"); return; }
    setLoading(true);
    setError("");
    try {
      await capturePurchaseInterest({
        firstName: form.firstName || null,
        email: form.email,
        product,
        amountCents: config.amountCents,
        source: `checkout-${product}`,
        promoCode: form.promoCode.trim() || null,
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-300/80 leading-relaxed space-y-1.5">
          <p><strong>Beta — payment opens shortly.</strong> Save your spot now and we'll email you the moment checkout opens, at the locked-in beta price.</p>
          <p className="text-amber-300/60">No charge today. Beta orders get the founder review note. You can also start your free Signal Check at <Link href="/start" className="underline hover:text-amber-200">/start</Link>.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="firstName" className="text-sm text-muted-foreground">First name (optional)</Label>
        <Input
          id="firstName"
          placeholder="Alex"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          className="bg-white/5 border-white/10 text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm text-muted-foreground">Email *</Label>
        <Input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setError(""); }}
          className="bg-white/5 border-white/10 text-foreground"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="promoCode" className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Promo code (optional)
        </Label>
        <Input
          id="promoCode"
          placeholder="Enter code"
          value={form.promoCode}
          onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value.toUpperCase().slice(0, 64) }))}
          className="bg-white/5 border-white/10 text-foreground font-mono tracking-wider"
          data-testid="input-checkout-promo-code"
          autoCapitalize="characters"
        />
        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
          Promo codes are handled personally during beta follow-up — we'll apply yours when we email you.
        </p>
      </div>
      <Button
        type="submit"
        disabled={loading}
        className={`w-full bg-gradient-to-r ${config.gradient} text-white font-semibold rounded-xl h-12 text-base hover:opacity-90 transition-opacity`}
        data-testid="button-checkout-submit"
      >
        {loading ? "Saving…" : `Save my spot for ${config.name}`}
      </Button>
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
        <Lock className="w-3 h-3" />
        No charge now. You'll get first access when checkout opens.
      </div>
    </form>
  );
}

const VALID_PRODUCTS: Product[] = ["signal-audit", "dating-reset", "wingman"];

export default function Checkout({ product }: { product: string }) {
  const resolvedProduct: Product = VALID_PRODUCTS.includes(product as Product)
    ? (product as Product)
    : "dating-reset";

  const config = PRODUCTS[resolvedProduct];
  const Icon = config.icon;

  useMeta(
    `Checkout — ${config.name}`,
    `${config.name}: ${config.description}`
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-5xl">
        <div className="text-center mb-10">
          <Link href="/pricing" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            ← Back to pricing
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Order summary */}
          <div className="glass rounded-2xl p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div
                  className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2"
                  style={{ background: `${config.badgeColor}20`, color: config.badgeColor, border: `1px solid ${config.badgeColor}40` }}
                >
                  {config.badge}
                </div>
                <h1 className="font-serif text-2xl font-bold text-foreground">{config.name}</h1>
                <p className="text-muted-foreground text-sm mt-1">{config.description}</p>
              </div>
            </div>

            <div className="divider-gradient" />

            <div>
              <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-4">What's included</p>
              <ul className="space-y-3">
                {config.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(248_62%_52%)] mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="divider-gradient" />

            <div className="flex items-end gap-2">
              <span className="font-serif text-3xl font-bold text-foreground">{config.price}</span>
              <span className="text-muted-foreground text-sm mb-1">{config.priceDetail}</span>
            </div>
          </div>

          {/* Payment / form */}
          <div className="glass-strong rounded-2xl p-8 border border-white/8 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[hsl(248_62%_52%)]" />
              <h2 className="font-semibold text-foreground">
                {resolvedProduct === "wingman" ? "Save your spot" : "Complete your order"}
              </h2>
            </div>

            <PaidForm product={resolvedProduct} />

            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <CheckCircle2 className="w-3 h-3" />
                30-day guarantee — we'll redo it or refund it
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <CheckCircle2 className="w-3 h-3" />
                Cancel anytime, no penalty
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <CheckCircle2 className="w-3 h-3" />
                Your data is never shared or sold
              </div>
              <div className="pt-2 text-center">
                <Link href="/sample-report" className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                  See a real sample report <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-sell */}
        {resolvedProduct === "signal-audit" && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Want the full rebuild instead?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/checkout/dating-reset"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-[hsl(248_62%_62%)] hover:bg-white/5 transition-colors border border-[hsl(248_62%_52%/0.25)]"
              >
                The Dating Reset — $97 →
              </Link>
              <Link
                href="/start"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 transition-colors border border-white/10"
              >
                Start free Signal Check instead →
              </Link>
            </div>
          </div>
        )}
        {resolvedProduct === "dating-reset" && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Just need the one-time audit?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/checkout/signal-audit"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-[hsl(190_75%_60%)] hover:bg-white/5 transition-colors border border-[hsl(190_75%_50%/0.25)]"
              >
                Profile Signal Audit — $29 →
              </Link>
              <Link
                href="/start"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 transition-colors border border-white/10"
              >
                Start free Signal Check instead →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
