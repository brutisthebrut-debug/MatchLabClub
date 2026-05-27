import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Wrench, Shield, CheckCircle2, Lock, Users, Heart, MessageSquare,
  Sparkles, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { useGetWellnessProfile } from "@workspace/api-client-react";
import { DIMENSION_META } from "@/lib/wellnessQuestionBank";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

// ── Compatibility signal dimension row ───────────────────────────────────────

function DimensionSignalRow({
  dimension, completionPct, approvedForMatching,
}: { dimension: string; completionPct: number; approvedForMatching: boolean }) {
  const meta = DIMENSION_META[dimension];
  if (!meta) return null;
  const signalStrength = approvedForMatching ? completionPct : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: approvedForMatching ? meta.color : "hsl(220 10% 30%)" }} />
      <p className="text-xs text-muted-foreground/70 w-40 flex-shrink-0">{meta.label}</p>
      <div className="flex-1 flex items-center gap-2">
        <Progress value={signalStrength} className="h-1 flex-1 bg-white/8" />
        <span className="text-[10px] text-muted-foreground/40 tabular-nums w-8 text-right">{signalStrength}%</span>
      </div>
      {!approvedForMatching && (
        <Lock className="w-3 h-3 text-muted-foreground/25 flex-shrink-0" />
      )}
    </div>
  );
}

// ── What matching would look like ────────────────────────────────────────────

const SAMPLE_MATCHES = [
  {
    label: "Jordan, 34",
    dims: ["communication", "values", "lifestyle", "conflict"],
    sharedTags: ["Direct communicator", "Routine-driven", "Values-aligned first"],
    strength: 87,
    note: "Strong alignment on communication style and daily rhythm. Potential divergence on social independence needs.",
  },
  {
    label: "Alex, 29",
    dims: ["emotional", "intimacy", "future_vision", "affection"],
    sharedTags: ["Emotionally reflective", "Affectionate expressor", "Future-family-oriented"],
    strength: 74,
    note: "Deep emotional resonance. Future vision overlap is high. Physical affection style warrants early conversation.",
  },
  {
    label: "Morgan, 31",
    dims: ["intellectual", "spiritual", "financial", "occupational"],
    sharedTags: ["Intellectually-driven", "Financially intentional", "Experience-oriented"],
    strength: 68,
    note: "Shared curiosity and financial values. Occupational ambition levels show some divergence worth exploring.",
  },
];

function SampleMatchCard({ match, index }: { match: typeof SAMPLE_MATCHES[number]; index: number }) {
  const [open, setOpen] = useState(false);
  const color = match.strength >= 80 ? "hsl(142 55% 60%)" : match.strength >= 70 ? "hsl(43 65% 65%)" : "hsl(190 55% 60%)";

  return (
    <motion.div {...fadeUp(0.1 + index * 0.04)} className="glass-strong rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center">
                <Users className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{match.label}</p>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Sample profile · not a real person</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>{match.strength}%</span>
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">signal match</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {match.sharedTags.map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(268_52%_68%/0.1)] border border-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)]">
              {tag}
            </span>
          ))}
        </div>

        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {open ? "Hide insight" : "Show insight"}
        </button>

        {open && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">{match.note}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.dims.map(d => {
                const meta = DIMENSION_META[d];
                if (!meta) return null;
                return (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{ color: meta.color, borderColor: meta.color.replace(")", " / 0.25)"), background: meta.color.replace(")", " / 0.07)") }}>
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── How matching works explainer ─────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Build your compatibility profile",
    desc: "Answer across 18 dimensions at your own pace. No time limit, no pressure. Skip anything sensitive.",
    color: "hsl(268 52% 68%)",
    icon: Sparkles,
    href: "/wellness",
    cta: "Go to Profile Builder",
  },
  {
    step: "2",
    title: "Approve what's used for matching",
    desc: "Every answer is coaching-only by default. You explicitly approve which dimensions surface to potential matches.",
    color: "hsl(142 55% 60%)",
    icon: Shield,
    href: "/user-control",
    cta: "Review consent settings",
  },
  {
    step: "3",
    title: "Get matched on real signal",
    desc: "When matching opens, we surface people with genuine compatibility — not just appearance or location. Values, communication, conflict style, future vision.",
    color: "hsl(43 65% 65%)",
    icon: Heart,
    href: "/future-connections",
    cta: "Coming soon",
    disabled: true,
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FutureConnections() {
  useMeta(
    "Future Matching",
    "Compatibility matching built on real signal — 18 wellness dimensions, consent-first. See how it works and what your profile would show.",
  );

  const { data: profileData } = useGetWellnessProfile();
  const dims    = profileData?.dimensions ?? [];
  const mr      = profileData?.matchingReadiness;
  const overallPct = mr?.overallPct ?? 0;
  const ready   = mr?.readyForMatching ?? false;

  // Simulate consent: anything > 40% completion is "approved" in the sample preview
  const approvedDims = dims.filter(d => (d.completionPct ?? 0) >= 40);

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(190_55%_60%/0.2)] text-xs font-medium text-[hsl(190_55%_72%)] mb-3">
              <Wrench className="w-3 h-3" /> Future Matching
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              Matching built on <span className="gradient-text-violet">real signal.</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed mb-4">
              When compatibility matching opens, it'll be built on 18 dimensions of how you actually think, communicate, and live — not just photos and bios. Here's what that looks like with your profile today.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(232_38%_15%)] border border-white/5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
              No live matching. This is a preview — no one sees your profile yet.
            </div>
          </motion.div>

          {/* Your signal strength panel */}
          <motion.div {...fadeUp(0.06)} className="glass-strong rounded-2xl border border-[hsl(268_52%_68%/0.18)] p-5 sm:p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-1">Your Signal Strength</p>
                <h3 className="font-serif text-lg font-semibold">
                  {ready ? "Profile ready for matching" : "Building your matching signal"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {approvedDims.length} of {dims.length} dimensions contributing signal
                  {!ready && " · keep answering to strengthen your profile"}
                </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-3xl font-bold tabular-nums" style={{ color: overallPct >= 60 ? "hsl(142 55% 60%)" : "hsl(43 65% 65%)" }}>
                  {overallPct}%
                </span>
                <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">profile complete</span>
              </div>
            </div>
            <Progress value={overallPct} className="h-1.5 bg-white/8 mb-5" />

            {dims.length > 0 ? (
              <div className="space-y-2">
                {dims.slice(0, 9).map(d => (
                  <DimensionSignalRow
                    key={d.dimension}
                    dimension={d.dimension}
                    completionPct={d.completionPct ?? 0}
                    approvedForMatching={(d.completionPct ?? 0) >= 40}
                  />
                ))}
                {dims.length > 9 && (
                  <p className="text-[10px] text-muted-foreground/40 pt-1">
                    + {dims.length - 9} more dimensions · <Link href="/wellness" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">view all</Link>
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <Lock className="w-5 h-5 mx-auto text-muted-foreground/25" />
                <p className="text-xs text-muted-foreground/50">No profile answers yet. Start the Compatibility Profile Builder to see your signal strength.</p>
                <Button asChild size="sm" className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0">
                  <Link href="/wellness">Build Profile <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
                </Button>
              </div>
            )}
          </motion.div>

          {/* Sample matches preview */}
          <motion.div {...fadeUp(0.12)} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-sm font-semibold text-foreground">What matching could surface</p>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.12)] border border-[hsl(43_65%_65%/0.2)] text-[hsl(43_65%_72%)]">
                Sample · not real people
              </span>
            </div>
            <div className="space-y-3">
              {SAMPLE_MATCHES.map((m, i) => <SampleMatchCard key={m.label} match={m} index={i} />)}
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div {...fadeUp(0.18)} className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">How it works</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div key={step.step} {...fadeUp(0.18 + i * 0.04)} className="glass-strong rounded-2xl border border-white/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: step.color }}>Step {step.step}</span>
                      <Icon className="w-3.5 h-3.5" style={{ color: step.color }} />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground mb-2 leading-tight">{step.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.desc}</p>
                    {step.disabled ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/40 px-2.5 py-1 rounded-full border border-white/8">
                        <Lock className="w-2.5 h-2.5" /> {step.cta}
                      </span>
                    ) : (
                      <Link href={step.href} className="inline-flex items-center gap-1 text-[11px] font-semibold hover:opacity-80 transition-opacity" style={{ color: step.color }}>
                        {step.cta} <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Consent & privacy promise */}
          <motion.div {...fadeUp(0.3)} className="glass-strong rounded-2xl border border-[hsl(142_55%_60%/0.15)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[hsl(142_55%_60%)]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55%_72%)]">Privacy promise</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              {[
                { title: "Coaching only by default", desc: "Every answer starts as private. Nothing surfaces to matching without your explicit approval." },
                { title: "No automatic sharing",     desc: "When matching launches, you opt your profile in — it doesn't happen automatically." },
                { title: "Delete any time",          desc: "Every answer, tag, and profile dimension can be deleted from your Data Vault at any time." },
              ].map(item => (
                <div key={item.title} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-[hsl(142_55%_60%)] flex-shrink-0" />
                    <p className="font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="text-muted-foreground/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/wellness"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Build Profile</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/user-control"><Shield className="w-3.5 h-3.5 mr-1.5" />Consent Settings</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/vault"><Lock className="w-3.5 h-3.5 mr-1.5" />Data Vault</Link>
              </Button>
            </div>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
