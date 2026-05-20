import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { WelcomePanel } from "@/components/WelcomePanel";
import { motion } from "framer-motion";
import { RefreshCw, ArrowRight, Trophy, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "nldc_what_changed";

interface Reflection {
  different: string;
  tried: string;
  noticing: string;
  nextMove: string;
  savedAt: string;
}

function summarize(r: Reflection): string[] {
  const lines: string[] = [];
  if (r.different.trim()) lines.push(`What's shifted: ${r.different.trim()}`);
  if (r.tried.trim()) lines.push(`What you tried: ${r.tried.trim()}`);
  if (r.noticing.trim()) lines.push(`What you're seeing: ${r.noticing.trim()}`);
  if (r.nextMove.trim()) lines.push(`One move: ${r.nextMove.trim()}`);
  return lines;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function WhatChanged() {
  useMeta("What Changed Since Last Time", "A short check-in on what's shifted, what you tried, and what you're noticing.");

  const [different, setDifferent] = useState("");
  const [tried, setTried] = useState("");
  const [noticing, setNoticing] = useState("");
  const [nextMove, setNextMove] = useState("");
  const [saved, setSaved] = useState<Reflection | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const { isAuthenticated } = useAuth();
  const isBrandNewUser = isAuthenticated && !saved;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const r = JSON.parse(raw) as Reflection; setSaved(r); }
    } catch {}
  }, []);

  const hasInput = different.trim() || tried.trim() || noticing.trim() || nextMove.trim();

  const handleSave = () => {
    const r: Reflection = {
      different, tried, noticing, nextMove,
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
    setSaved(r);
    setShowSummary(true);
  };

  const handleClear = () => {
    setDifferent(""); setTried(""); setNoticing(""); setNextMove("");
    setShowSummary(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSaved(null);
  };

  const summaryLines = saved ? summarize(saved) : [];
  const savedDate = saved ? new Date(saved.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-teal fixed w-[350px] h-[350px] -top-10 right-10 opacity-20 pointer-events-none" />
        <div className="max-w-xl mx-auto relative z-10">

          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(190_55%_60%)] to-[hsl(268_52%_68%)] flex items-center justify-center shadow-[0_0_16px_hsl(190_55%_60%/0.3)]">
                <RefreshCw className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-semibold text-[hsl(190_55%_70%)]">Copilot Check-In</p>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">What Changed?</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              A quick check-in on what's shifted since last time. You don't need to have made progress.
              Just noticing something is progress.
            </p>
          </motion.div>

          {isBrandNewUser && (
            <WelcomePanel
              icon={<RefreshCw className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to What Changed"
              title="Your first check-in"
              description="Take five minutes to note what's shifted, what you tried, and what you're noticing. Over time these check-ins become the clearest read on your progress."
              testId="whatchanged-empty-state"
            />
          )}

          {/* Previous reflection */}
          {saved && !showSummary && (
            <motion.div {...fadeUp(0.04)} className="mb-5 glass border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Last check-in · {savedDate}</p>
                <button onClick={handleClear} className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Clear</button>
              </div>
              <div className="space-y-1.5">
                {summaryLines.map((l, i) => (
                  <p key={i} className="text-xs text-muted-foreground/60 leading-relaxed">{l}</p>
                ))}
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="mt-3 text-xs text-[hsl(190_55%_65%)] hover:text-[hsl(190_55%_75%)] transition-colors"
              >
                Start a new check-in →
              </button>
            </motion.div>
          )}

          {/* Form */}
          {(!saved || showSummary === false) && (
            <motion.div {...fadeUp(0.08)} className="space-y-5">
              {[
                { label: "What's different since last time?", hint: "You don't need something big — even 'I noticed I check the app less' counts.", value: different, set: setDifferent },
                { label: "What did you try or experiment with?", hint: "A message, a profile change, a new approach, anything.", value: tried, set: setTried },
                { label: "What are you noticing about yourself?", hint: "Patterns, feelings, reactions — not just results.", value: noticing, set: setNoticing },
                { label: "One thing you want to do differently this week", hint: "Specific and small is better than vague and ambitious.", value: nextMove, set: setNextMove },
              ].map(({ label, hint, value, set }) => (
                <div key={label} className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground/50">{hint}</p>
                  <Textarea
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="bg-white/5 border-white/10 text-foreground resize-none text-sm min-h-[70px]"
                    maxLength={400}
                  />
                </div>
              ))}

              <Button
                onClick={handleSave}
                disabled={!hasInput}
                className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(190_55%_55%)] to-[hsl(268_52%_65%)] border-0 disabled:opacity-40"
              >
                Save this check-in
              </Button>
            </motion.div>
          )}

          {/* Summary after saving */}
          {showSummary && saved && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="glass border border-[hsl(190_55%_60%/0.3)] rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(190_55%_60%)] mb-3">Saved · {savedDate}</p>
                <div className="space-y-2">
                  {summaryLines.map((l, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">{l}</p>
                  ))}
                </div>
              </div>

              {saved.nextMove.trim() && (
                <div className="glass border border-[hsl(43_65%_65%/0.25)] rounded-2xl px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_65%)] mb-1">This week's move</p>
                  <p className="text-sm text-foreground">{saved.nextMove}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Link href="/progress/wins"
                  className="glass border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-colors group">
                  <Trophy className="w-5 h-5 text-[hsl(43_65%_65%)] mb-2" />
                  <p className="font-semibold text-foreground text-sm group-hover:text-white transition-colors">Log a win</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">If anything felt like forward movement</p>
                </Link>
                <Link href="/progress/pattern-breaker"
                  className="glass border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-colors group">
                  <Zap className="w-5 h-5 text-[hsl(268_52%_68%)] mb-2" />
                  <p className="font-semibold text-foreground text-sm group-hover:text-white transition-colors">Pattern Breaker</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">5 small actions for this week</p>
                </Link>
              </div>

              <button
                onClick={() => { setShowSummary(false); handleClear(); }}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors py-2"
              >
                Start a fresh check-in
              </button>
            </motion.div>
          )}

          {/* Trust note */}
          <motion.div {...fadeUp(0.45)} className="mt-8 glass border border-white/5 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/45 leading-relaxed">
              <strong className="text-muted-foreground/60">Stored locally in your browser.</strong>{" "}
              Nothing here is sent anywhere. This is a private note to yourself.
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.5)} className="mt-4 text-center">
            <Link href="/copilot" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1">
              Back to Copilot <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
