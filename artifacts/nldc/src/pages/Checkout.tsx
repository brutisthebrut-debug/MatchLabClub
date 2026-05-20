import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeta } from "@/hooks/useMeta";
import { captureLead, capturePurchaseInterest } from "@/lib/apiClient";
import {
  CheckCircle2, Sparkles, Lock, ArrowRight, ExternalLink,
  Zap, Star, Crown, AlertTriangle
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
    price: "Free",
    priceDetail: "No credit card. No catch.",
    badge: "Start here",
    badgeColor: "hsl(268 52% 68%)",
    description:
      "Find out exactly what your profile is communicating — and get it rewritten. Takes 3 minutes.",
    features: [
      "Signal Score (0–100 with full breakdown)",
      "Signal Spectrum — 8 dimensions scored",
      "Full bio critique in plain English",
      "AI-rewritten bio you can copy instantly",
      "Prompt rewrites (if you provided them)",
      "Photo guidance checklist",
      "7-day action plan",
    ],
    cta: "Start My Free Audit",
    icon: Zap,
    gradient: "from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)]",
    amountCents: 0,
    stripeEnvKey: null,
    successCopy: "Your free audit is ready to begin.",
  },
  "dating-reset": {
    name: "The Dating Reset",
    price: "$97",
    priceDetail: "One-time. No subscription.",
    badge: "Best value",
    badgeColor: "hsl(348 55% 58%)",
    description:
      "A complete profile and messaging rebuild. Walk away with a profile that's finally working.",
    features: [
      "Everything in Signal Audit",
      "In-depth Signal Spectrum deep-dive",
      "Dating Diagnosis with category breakdown",
      "Chemistry Lab — unlimited message coaching",
      "Conversation pattern analysis",
      "30-day progress check-in session",
      "Priority support",
    ],
    cta: "Get The Dating Reset — $97",
    icon: Star,
    gradient: "from-[hsl(348_55%_58%)] to-[hsl(268_52%_58%)]",
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

function FreeAuditForm({ product }: { product: "signal-audit" }) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ firstName: "", email: "" });
  const [loading, setLoading] = useState(false);
  const config = PRODUCTS[product];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (form.email) {
        await captureLead({
          firstName: form.firstName || null,
          email: form.email,
          source: "checkout-signal-audit",
          interest: "signal-audit",
        }).catch(() => {});
      }
    } finally {
      navigate("/start");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <Label htmlFor="email" className="text-sm text-muted-foreground">Email — save your result (optional)</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="bg-white/5 border-white/10 text-foreground"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className={`w-full bg-gradient-to-r ${config.gradient} text-white font-semibold rounded-xl h-12 text-base hover:opacity-90 transition-opacity`}
      >
        {loading ? "Starting…" : config.cta}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
      <button
        type="button"
        onClick={() => navigate("/start")}
        className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
      >
        Skip and start without saving →
      </button>
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
        <Lock className="w-3 h-3" />
        Free forever. No card needed.
      </div>
    </form>
  );
}

function PaidForm({ product }: { product: "dating-reset" | "wingman" }) {
  const config = PRODUCTS[product];
  const stripeLink = config.stripeEnvKey
    ? (import.meta.env as Record<string, string>)[config.stripeEnvKey]
    : null;

  const [form, setForm] = useState({ firstName: "", email: "" });
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
          <p className="font-semibold text-foreground">You're on the early list.</p>
          <p className="text-sm text-muted-foreground mt-1">
            We'll email you as soon as checkout opens — and you'll get first access.
          </p>
        </div>
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
        <p className="text-xs text-amber-300/80 leading-relaxed">
          <strong>Coming soon.</strong> Checkout isn't live yet — but you can join the early list and we'll notify you the moment it opens.
        </p>
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
      <Button
        type="submit"
        disabled={loading}
        className={`w-full bg-gradient-to-r ${config.gradient} text-white font-semibold rounded-xl h-12 text-base hover:opacity-90 transition-opacity`}
      >
        {loading ? "Saving…" : `Notify me when ${config.name} opens`}
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
                    <CheckCircle2 className="w-4 h-4 text-[hsl(268_52%_68%)] mt-0.5 flex-shrink-0" />
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
              <Sparkles className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="font-semibold text-foreground">
                {resolvedProduct === "signal-audit" ? "Start your free audit" : "Complete your order"}
              </h2>
            </div>

            {resolvedProduct === "signal-audit" ? (
              <FreeAuditForm product="signal-audit" />
            ) : (
              <PaidForm product={resolvedProduct as "dating-reset" | "wingman"} />
            )}

            {resolvedProduct !== "signal-audit" && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                  <CheckCircle2 className="w-3 h-3" />
                  14-day money-back guarantee
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                  <CheckCircle2 className="w-3 h-3" />
                  Cancel anytime, no penalty
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                  <CheckCircle2 className="w-3 h-3" />
                  Your data is never shared or sold
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cross-sell */}
        {resolvedProduct === "signal-audit" && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">Want more than a free audit?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/checkout/dating-reset"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-[hsl(348_55%_68%)] hover:bg-white/5 transition-colors border border-[hsl(348_55%_58%/0.2)]"
              >
                The Dating Reset — $97 →
              </Link>
              <Link
                href="/checkout/wingman"
                className="px-5 py-2.5 glass rounded-xl text-sm font-medium text-[hsl(43_65%_62%)] hover:bg-white/5 transition-colors border border-[hsl(43_65%_52%/0.2)]"
              >
                Monthly Wingman — $197/mo →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
