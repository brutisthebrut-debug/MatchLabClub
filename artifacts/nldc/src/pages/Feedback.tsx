import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Star, CheckCircle2, ArrowRight, Shield, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "nldc_feedback_submitted";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          <Star
            className="w-7 h-7 transition-colors"
            fill={(hover || value) >= n ? "hsl(var(--brand-gold))" : "transparent"}
            stroke={(hover || value) >= n ? "hsl(var(--brand-gold))" : "hsl(var(--muted-foreground) / 0.3)"}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-muted-foreground/50 self-center ml-1.5">
          {["", "Not useful", "Somewhat useful", "Useful", "Very useful", "Incredibly useful"][value]}
        </span>
      )}
    </div>
  );
}

function QuoteCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`"${text}"`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this quote:", `"${text}"`);
        }
      }}
      aria-label={copied ? "Quote copied to clipboard" : "Copy quote to clipboard"}
      className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-2 min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(248_62%_52%/0.6)] rounded-md px-1 -mx-1"
    >
      {copied ? <Check className="w-3 h-3 text-[hsl(142_55%_60%)]" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
      {copied ? "Copied quote" : "Copy quote"}
    </button>
  );
}

export default function Feedback() {
  useMeta("Beta Feedback", "Tell us what was useful, what was confusing, and what you'd pay for. Early feedback shapes everything.");

  const [rating, setRating] = useState(0);
  const [useful, setUseful] = useState("");
  const [confusing, setConfusing] = useState("");
  const [wouldPay, setWouldPay] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quotePermission, setQuotePermission] = useState(false);
  const [quote, setQuote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasEnough = rating > 0 || useful.trim().length > 10;

  const handleSubmit = async () => {
    if (!hasEnough) return;
    setLoading(true);
    try {
      const feedback = {
        rating,
        useful: useful.trim(),
        confusing: confusing.trim(),
        wouldPay: wouldPay.trim(),
        name: name.trim(),
        email: email.trim(),
        quotePermission,
        quote: quotePermission ? (quote.trim() || useful.trim()) : "",
        submittedAt: new Date().toISOString(),
      };

      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: name.trim() || "Beta user",
          email: email.trim() || undefined,
          source: "beta-feedback",
          interest: JSON.stringify({ rating, useful: feedback.useful, confusing: feedback.confusing, wouldPay: feedback.wouldPay }),
        }),
      }).catch(() => {});

      localStorage.setItem(STORAGE_KEY, JSON.stringify(feedback));
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const finalQuote = quotePermission ? (quote.trim() || useful.trim()) : "";

  if (submitted) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg py-10 px-4">
          <div className="max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass border border-[hsl(142_55%_60%/0.3)] rounded-2xl p-8 text-center"
            >
              <CheckCircle2 className="w-12 h-12 text-[hsl(142_55%_60%)] mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">Thank you.</h1>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                This is genuinely useful. Early feedback shapes what gets built next.
                {email.trim() && " I'll follow up if I have questions."}
              </p>
              {finalQuote && (
                <div className="glass border border-white/8 rounded-xl p-4 text-left mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/40 mb-2">Your quote</p>
                  <p className="text-sm text-muted-foreground italic">"{finalQuote}"</p>
                  <QuoteCopy text={finalQuote} />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signal-check"
                  className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(348_55%_65%)] text-white">
                  Free Signal Check <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
                </Link>
                <Link href="/gallery"
                  className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors">
                  Before & After Gallery →
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 right-0 opacity-15 pointer-events-none" />
        <div className="max-w-lg mx-auto relative z-10">

          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-muted-foreground/60 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] animate-pulse" />
              Beta · First 25 users
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Beta Feedback</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              You're one of the first people using this. Your feedback shapes what gets built next.
              Takes 3 minutes. No login needed.
            </p>
          </motion.div>

          <div className="space-y-6">
            {/* Accuracy rating */}
            <motion.div {...fadeUp(0.06)} className="glass border border-white/8 rounded-2xl p-5">
              <p className="font-semibold text-foreground text-sm mb-1">How accurate or useful did the output feel?</p>
              <p className="text-xs text-muted-foreground/50 mb-4">Rate based on any tool result you've seen — Signal Check, Blueprint, Next Message, or other.</p>
              <StarRating value={rating} onChange={setRating} />
            </motion.div>

            {/* What was useful */}
            <motion.div {...fadeUp(0.1)} className="glass border border-white/8 rounded-2xl p-5">
              <label className="block font-semibold text-foreground text-sm mb-1">What was most useful?</label>
              <p className="text-xs text-muted-foreground/50 mb-3">Be specific if you can — which tool, what about the output.</p>
              <Textarea
                value={useful}
                onChange={e => setUseful(e.target.value)}
                placeholder="The profile rewrite felt genuinely specific to my situation..."
                className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[80px]"
                maxLength={500}
              />
            </motion.div>

            {/* Confusing */}
            <motion.div {...fadeUp(0.14)} className="glass border border-white/8 rounded-2xl p-5">
              <label className="block font-semibold text-foreground text-sm mb-1">What was confusing or missing?</label>
              <p className="text-xs text-muted-foreground/50 mb-3">What felt unclear, not relevant, or like it should exist but didn't?</p>
              <Textarea
                value={confusing}
                onChange={e => setConfusing(e.target.value)}
                placeholder="I wasn't sure what to do after the signal check..."
                className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[80px]"
                maxLength={500}
              />
            </motion.div>

            {/* Would pay for */}
            <motion.div {...fadeUp(0.18)} className="glass border border-white/8 rounded-2xl p-5">
              <label className="block font-semibold text-foreground text-sm mb-1">What would you actually pay for?</label>
              <p className="text-xs text-muted-foreground/50 mb-3">Could be a feature, a service, a format — even a rough idea helps.</p>
              <Textarea
                value={wouldPay}
                onChange={e => setWouldPay(e.target.value)}
                placeholder="A monthly plan that gives me ongoing message coaching..."
                className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[70px]"
                maxLength={400}
              />
            </motion.div>

            {/* Optional contact */}
            <motion.div {...fadeUp(0.22)} className="glass border border-white/8 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-foreground text-sm">Optional — name and email</p>
              <p className="text-xs text-muted-foreground/50">Only if you want a follow-up or to be included in early access.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="First name"
                  className="w-full h-10 rounded-xl px-3 text-sm bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[hsl(248_62%_52%/0.4)]"
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full h-10 rounded-xl px-3 text-sm bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[hsl(248_62%_52%/0.4)]"
                />
              </div>
            </motion.div>

            {/* Quote permission */}
            <motion.div {...fadeUp(0.26)} className="glass border border-white/8 rounded-2xl p-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quotePermission}
                  onChange={e => setQuotePermission(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 accent-[hsl(248_62%_52%)] flex-shrink-0"
                />
                <div>
                  <p className="font-semibold text-foreground text-sm">You may use an anonymous quote from me</p>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">No name, no email — just the quote, attributed to "Beta user" or similar.</p>
                </div>
              </label>
              {quotePermission && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground/50 mb-2">Your quote (or we'll use your "most useful" answer above)</p>
                  <Textarea
                    value={quote}
                    onChange={e => setQuote(e.target.value)}
                    placeholder={useful.trim() || "The output felt surprisingly specific to my situation..."}
                    className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[70px]"
                    maxLength={300}
                  />
                </div>
              )}
            </motion.div>

            <motion.div {...fadeUp(0.3)}>
              <Button
                onClick={handleSubmit}
                disabled={loading || !hasEnough}
                className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(348_55%_60%)] border-0 disabled:opacity-40"
              >
                {loading ? "Saving…" : "Send feedback"}
              </Button>
              <p className="text-center text-xs text-muted-foreground/35 mt-2">
                No account needed. Takes 3 minutes.
              </p>
            </motion.div>

            {/* Trust note */}
            <motion.div {...fadeUp(0.35)} className="glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground/45 leading-relaxed">
                <strong className="text-muted-foreground/60">Your feedback is for product development only.</strong>{" "}
                Quotes are only used with permission and are always anonymised. Your email is never sold or shared.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
