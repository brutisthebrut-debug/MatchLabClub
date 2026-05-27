import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { captureLead } from "@/lib/apiClient";
import {
  CheckCircle2, Sparkles, ArrowRight, Zap, MessageCircle,
  Star, ExternalLink, Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PERKS = [
  {
    icon: Zap,
    title: "Free Profile Signal Audit",
    desc: "Your full Signal Score (0–100), Signal Spectrum across 8 dimensions, a complete bio rewrite, and a 7-day action plan. This is the whole free tier — unlocked for every Shebangs listener.",
  },
  {
    icon: MessageCircle,
    title: "Chemistry Lab message coaching",
    desc: "Paste any conversation and get 5 styled reply options — Warm, Playful, Direct, Date Ask, and Graceful Exit. With rationale for each one.",
  },
  {
    icon: Star,
    title: "20% off The Dating Reset",
    desc: "Use code SHEBANGS20 at checkout for 20% off The Dating Reset ($97). That's a full profile rebuild, unlimited Chemistry Lab, and a 30-day check-in for $77.60.",
  },
];

const WHAT_MATCHLAB_DOES = [
  "Tells you what your dating profile is actually communicating — not what you think it's saying",
  "Rewrites your bio to be specific, warm, and interesting (not try-hard)",
  "Scores your profile across 8 dimensions so you know exactly what to fix first",
  "Coaches your message replies so you're never staring at your phone wondering what to say",
  "Analyses your conversation patterns so you understand your own style",
];

export default function ShebangsPartner() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ firstName: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useMeta(
    "Shebangs × MatchLab Club — Exclusive Partner Offer",
    "Shebangs.club members get exclusive access to MatchLab Club's free Profile Signal Audit and 20% off The Dating Reset. Find out what your profile is really saying."
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) { setError("Email is required"); return; }
    setLoading(true);
    setError("");
    try {
      await captureLead({
        firstName: form.firstName || null,
        email: form.email,
        source: "shebangs",
        interest: "signal-audit",
        metadata: { partnerSource: "shebangs.club", page: "/partners/shebangs" },
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      {/* Partner hero */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="orb orb-violet absolute w-[600px] h-[600px] -top-40 left-1/2 -translate-x-1/2 opacity-25 pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 relative z-10 max-w-4xl">
          {/* Partner badge */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="glass px-4 py-2 rounded-full text-sm font-semibold text-muted-foreground border border-white/10">
              Shebangs.club
            </div>
            <span className="text-muted-foreground/40">×</span>
            <div className="glass px-4 py-2 rounded-full text-sm font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              MatchLab Club
            </div>
          </div>

          <div className="text-center space-y-6">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground leading-tight">
              You came from Shebangs.<br />
              <span className="gradient-text-violet">That already tells us something.</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              Shebangs listeners are people who take dating seriously — who want to show up as themselves and actually connect. That's exactly who MatchLab Club was built for.
            </p>
            <p className="text-muted-foreground/70 max-w-xl mx-auto">
              As a Shebangs member, you get full free access to the Profile Signal Audit, Chemistry Lab message coaching, and 20% off The Dating Reset.
            </p>
          </div>
        </div>
      </section>

      {/* What MatchLab Club does */}
      <section className="py-12 border-y border-white/5">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest text-center mb-8">What MatchLab Club actually does</p>
          <ul className="space-y-3">
            {WHAT_MATCHLAB_DOES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-[hsl(248_62%_52%)] mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Perks */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest text-center mb-10">Your Shebangs perks</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {PERKS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-2xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Lead capture */}
          <div className="max-w-md mx-auto">
            <div className="glass-strong rounded-2xl p-8 border border-[hsl(248_62%_52%/0.2)] space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Shebangs exclusive
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground">Claim your free access</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Drop your email and we'll send you the discount code + get your audit started.
                </p>
              </div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4 py-2"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">You're in.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Discount code <strong className="text-foreground font-mono">SHEBANGS20</strong> is on its way to your inbox.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/signal-check")}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
                    >
                      Start your Signal Check
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
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
                      className="w-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] text-white font-semibold rounded-xl h-12 text-base hover:opacity-90"
                    >
                      {loading ? "Saving…" : "Get my Shebangs perks"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                      <Lock className="w-3 h-3" />
                      No spam. Unsubscribe anytime. Your data stays private.
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground/50 mb-3">Or jump straight in</p>
              <div className="flex gap-3 justify-center">
                <Link href="/signal-check" className="px-4 py-2 glass rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors border border-white/8">
                  Free Signal Check →
                </Link>
                <Link href="/start" className="px-4 py-2 glass rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors border border-white/8">
                  Full Audit →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Shebangs */}
      <section className="py-12 border-t border-white/5">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl text-center">
          <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest mb-4">About this partnership</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            MatchLab Club partnered with <a href="https://shebangs.club" target="_blank" rel="noopener noreferrer" className="text-[hsl(248_62%_62%)] hover:underline inline-flex items-center gap-1">Shebangs.club <ExternalLink className="w-3 h-3" /></a> because we share the same belief: dating should be approached with honesty, self-awareness, and a genuine desire to connect — not strategy and performance. Shebangs listeners already think this way. We're just here to help you show it.
          </p>
        </div>
      </section>
    </AppLayout>
  );
}
