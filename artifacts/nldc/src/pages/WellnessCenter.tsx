import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Heart, Activity, Users, BookOpen, Sparkles, Briefcase, DollarSign, Trees,
  ArrowRight, Shield, ChevronDown, ChevronUp, CheckCircle2, Lock, Unlock,
  MessageSquare, Compass, AlertCircle, SkipForward,
} from "lucide-react";
import { LifePulseCard, dimensionScoreFromPulse } from "@/components/wellness/LifePulseCard";
import {
  useGetRecentLifePulses,
  useGetWellnessProfile,
  useListWellnessAnswers,
  useCreateWellnessAnswer,
  type WellnessProfile,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  DIMENSION_META,
  PROFILE_MODULES,
  type WellnessQuestion,
} from "@/lib/wellnessQuestionBank";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const DIMENSION_ICONS: Record<string, React.ElementType> = {
  emotional:     Heart,
  physical:      Activity,
  social:        Users,
  intellectual:  BookOpen,
  spiritual:     Sparkles,
  occupational:  Briefcase,
  financial:     DollarSign,
  environmental: Trees,
  communication: MessageSquare,
  conflict:      AlertCircle,
  boundaries:    Shield,
  affection:     Heart,
  intimacy:      Lock,
  lifestyle:     Compass,
  future_vision: ArrowRight,
  values:        Sparkles,
  family:        Users,
  culture:       BookOpen,
};

// ── Consent level badge ─────────────────────────────────────────────────────

type ConsentLevel = "coaching" | "matching" | "research";

const CONSENT_META: Record<ConsentLevel, { label: string; color: string; blurb: string }> = {
  coaching:  { label: "Coaching only",  color: "hsl(190 55% 60%)",  blurb: "Used only for your personal coaching and readiness insights." },
  matching:  { label: "Matching",       color: "hsl(142 55% 60%)",  blurb: "May be used for compatibility matching when you opt in." },
  research:  { label: "Research",       color: "hsl(268 52% 68%)",  blurb: "Anonymised contribution to product research." },
};

function ConsentBadge({ level, onChange }: { level: ConsentLevel; onChange: (l: ConsentLevel) => void }) {
  const [open, setOpen] = useState(false);
  const meta = CONSENT_META[level];
  const levels: ConsentLevel[] = ["coaching", "matching", "research"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border transition-all"
        style={{ color: meta.color, borderColor: meta.color.replace(")", " / 0.35)"), background: meta.color.replace(")", " / 0.09)") }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
        {meta.label}
        <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 z-20 glass-strong border border-white/10 rounded-xl p-2 min-w-[180px] shadow-xl"
          >
            {levels.map(l => {
              const m = CONSENT_META[l];
              return (
                <button
                  key={l}
                  onClick={() => { onChange(l); setOpen(false); }}
                  className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: m.color }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight">{m.blurb}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  savedAnswer,
  onSave,
}: {
  question: WellnessQuestion;
  savedAnswer?: string;
  onSave: (questionId: string, answer: string, consentLevel: ConsentLevel) => Promise<void>;
}) {
  const [text, setText]   = useState(savedAnswer ?? "");
  const [consent, setConsent] = useState<ConsentLevel>("coaching");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(!!savedAnswer);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(question.id, text.trim(), consent);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${saved ? "bg-[hsl(142_55%_60%/0.05)] border-[hsl(142_55%_60%/0.2)]" : "bg-white/2 border-white/8"}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-sm text-foreground leading-relaxed">{question.text}</p>
        {question.sensitive && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.12)] text-[hsl(43_65%_72%)] border border-[hsl(43_65%_65%/0.2)] flex-shrink-0">
            Sensitive
          </span>
        )}
      </div>
      {saved ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/70 italic flex-1 leading-relaxed">"{text}"</p>
          <button onClick={() => setSaved(false)} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0">Edit</button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Your answer..."
            rows={2}
            className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-[hsl(268_52%_68%/0.4)] transition-colors"
          />
          <div className="flex items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-2">
              <ConsentBadge level={consent} onChange={setConsent} />
              {question.sensitive && (
                <button onClick={() => setSkipped(true)} className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                  <SkipForward className="w-3 h-3" /> Skip
                </button>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!text.trim() || saving}
              className="rounded-full text-xs h-7 px-4 bg-gradient-to-r from-[hsl(268_52%_55%)] to-[hsl(285_45%_50%)] border-0 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Module accordion ─────────────────────────────────────────────────────────

function ProfileModule({
  mod,
  answeredIds,
  onSave,
  index,
}: {
  mod: typeof PROFILE_MODULES[number];
  answeredIds: Set<string>;
  onSave: (qId: string, answer: string, consent: ConsentLevel) => Promise<void>;
  index: number;
}) {
  const answered = mod.questions.filter(q => answeredIds.has(q.id)).length;
  const total    = mod.questions.length;
  const pct      = total === 0 ? 0 : Math.round((answered / total) * 100);
  const [open, setOpen] = useState(index === 0);

  return (
    <motion.div {...fadeUp(0.04 + index * 0.025)} className="glass-strong rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/2 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-foreground text-sm">{mod.label}</p>
            {mod.sensitive && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.12)] text-[hsl(43_65%_72%)] border border-[hsl(43_65%_65%/0.2)]">
                Optional
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{mod.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold tabular-nums" style={{ color: pct >= 80 ? "hsl(142 55% 60%)" : pct >= 40 ? "hsl(43 65% 65%)" : "hsl(220 10% 55%)" }}>
              {answered}/{total}
            </p>
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">answered</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
        </div>
      </button>

      {pct > 0 && (
        <div className="px-5 pb-3 -mt-1">
          <Progress value={pct} className="h-1 bg-white/8" />
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
              {mod.questions.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  savedAnswer={answeredIds.has(q.id) ? "(answered)" : undefined}
                  onSave={onSave}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Dimension summary grid ────────────────────────────────────────────────────

function DimensionGrid({ profile }: { profile: WellnessProfile | undefined }) {
  const { data: pulseData } = useGetRecentLifePulses();
  const latestPulse = pulseData?.latest ?? null;

  if (!profile) return null;
  const dims = profile.dimensions ?? [];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
      {dims.map(d => {
        const Icon = DIMENSION_ICONS[d.dimension] ?? Sparkles;
        const meta = DIMENSION_META[d.dimension];
        if (!meta) return null;
        const signal = dimensionScoreFromPulse(d.dimension, latestPulse);
        const pct    = d.completionPct ?? 0;
        return (
          <div key={d.dimension} className="glass-strong rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: meta.color.replace(")", " / 0.13)") }}>
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight">{meta.label}</p>
              </div>
              {signal.value !== null && (
                <span className="text-xs font-bold tabular-nums" style={{ color: meta.color }}>{signal.value}/5</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-1.5 bg-white/8 flex-1" />
              <span className="text-[10px] tabular-nums text-muted-foreground/50 flex-shrink-0">{pct}%</span>
            </div>
            {d.nextQuestion && pct < 100 && (
              <p className="text-[10px] text-muted-foreground/40 mt-2 leading-relaxed line-clamp-2 italic">
                Next: {d.nextQuestion}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Matching readiness panel ──────────────────────────────────────────────────

function MatchingReadinessPanel({ profile }: { profile: WellnessProfile | undefined }) {
  if (!profile?.matchingReadiness) return null;
  const mr = profile.matchingReadiness;
  const pct = mr.overallPct ?? 0;
  const color = pct >= 60 ? "hsl(142 55% 60%)" : pct >= 30 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";

  return (
    <motion.div {...fadeUp(0.2)} className="glass-strong rounded-2xl border border-[hsl(268_52%_68%/0.18)] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(268_52%_78%)] mb-1">Matching Readiness</p>
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {mr.readyForMatching ? "Profile ready for matching" : "Keep building your profile"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {mr.readyForMatching
              ? "You've answered enough to begin compatibility matching when it opens."
              : `Complete ${5 - (mr.strongDimensions?.length ?? 0)} more dimension areas to unlock matching readiness.`}
          </p>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">complete</span>
        </div>
      </div>
      <Progress value={pct} className="h-2 bg-white/8 mb-3" />
      <div className="flex items-center gap-2">
        {mr.readyForMatching ? (
          <div className="flex items-center gap-1.5 text-xs text-[hsl(142_55%_60%)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Matching pool — when feature opens, your profile will be considered</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Lock className="w-3.5 h-3.5" />
            <span>Matching unlocks at 30% profile completion with 5+ strong dimensions</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Insight tags panel ────────────────────────────────────────────────────────

function InsightTagsPanel({ tags }: { tags: Array<{ tag: string; label: string; category: string; approvedForMatching: boolean | null }> }) {
  if (!tags.length) return null;
  return (
    <motion.div {...fadeUp(0.22)} className="glass-strong rounded-2xl border border-white/5 p-5 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(43_65%_72%)]">Compatibility Insight Tags</p>
        <Link href="/vault" className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">Manage in Vault →</Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span
            key={t.tag}
            className="text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{
              color: t.approvedForMatching ? "hsl(142 55% 72%)" : "hsl(220 10% 65%)",
              borderColor: t.approvedForMatching ? "hsl(142 55% 60% / 0.3)" : "hsl(220 10% 35%)",
              background: t.approvedForMatching ? "hsl(142 55% 60% / 0.07)" : "hsl(232 18% 15%)",
            }}
          >
            {t.approvedForMatching ? <Unlock className="w-2.5 h-2.5 flex-shrink-0" /> : <Lock className="w-2.5 h-2.5 flex-shrink-0" />}
            {t.label}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/35 mt-3 leading-relaxed">
        <Lock className="w-2.5 h-2.5 inline-block mr-1" />Locked tags are coaching-only · <Unlock className="w-2.5 h-2.5 inline-block mr-1" />Unlocked are approved for future compatibility matching.
      </p>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WellnessCenter() {
  useMeta(
    "Compatibility Profile Builder",
    "Build your wellness compatibility profile — 18 dimensions, progressive questions, and a matching readiness score.",
  );

  const { user } = useAuth();
  const { data: profileData } = useGetWellnessProfile();
  const { data: answersData }  = useListWellnessAnswers({});
  const { mutateAsync: saveAnswer } = useCreateWellnessAnswer();

  const answeredIds = new Set((answersData?.answers ?? []).map(a => a.questionId));

  const totalAnswered = answeredIds.size;
  const overallPct = profileData?.matchingReadiness?.overallPct ?? 0;

  async function handleSave(questionId: string, answer: string, consentLevel: ConsentLevel) {
    const question = PROFILE_MODULES.flatMap(m => m.questions).find(q => q.id === questionId);
    if (!question) return;
    await saveAnswer({
      data: {
        questionId,
        dimension:    question.dimension,
        category:     question.category,
        questionText: question.text,
        answer,
        consentLevel,
      },
    });
  }

  const tags = (profileData?.tags ?? []) as Array<{ tag: string; label: string; category: string; approvedForMatching: boolean | null }>;

  return (
    <AppLayout>
      <div className="min-h-screen pt-20 pb-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="orb orb-violet fixed w-[400px] h-[400px] top-0 right-0 opacity-30 pointer-events-none" />
        <div className="orb orb-teal fixed w-[300px] h-[300px] bottom-0 left-0 opacity-30 pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-strong border border-[hsl(43_65%_65%/0.2)] text-xs font-medium text-[hsl(43_65%_72%)] mb-3">
              <Sparkles className="w-3 h-3" />
              Compatibility Profile
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Build your <span className="gradient-text-violet">compatibility profile</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm">
              Answer at your own pace across 18 wellness dimensions. Every answer stays private unless you explicitly approve it for matching. Skip anything that doesn't feel right.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(232_38%_15%)] border border-white/5 text-xs text-muted-foreground">
                <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
                Coaching-only by default. You control what's used for matching.
              </div>
              {totalAnswered > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(142_55%_60%/0.09)] border border-[hsl(142_55%_60%/0.2)] text-xs text-[hsl(142_55%_72%)]">
                  <CheckCircle2 className="w-3 h-3" />
                  {totalAnswered} answer{totalAnswered !== 1 ? "s" : ""} saved · {overallPct}% complete
                </div>
              )}
            </div>
          </motion.div>

          {/* Context + Trust strip */}
          <div className="glass border rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{ borderColor: "hsl(228 30% 62% / 0.2)" }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(228_30%_62%)]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[hsl(228_30%_72%)]">Context + Trust</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground/55">— what you share is yours</span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
              {[
                { name: "Data Vault",        href: "/vault"              },
                { name: "Future Matching",   href: "/future-connections" },
                { name: "User Control",      href: "/user-control"       },
                { name: "Privacy",           href: "/privacy"            },
                { name: "Integrations",      href: "/integrations"       },
              ].map(t => (
                <Link key={t.href} href={t.href}
                  className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors whitespace-nowrap">
                  {t.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Life Pulse */}
          <LifePulseCard />

          {/* Matching readiness */}
          <MatchingReadinessPanel profile={profileData} />

          {/* Insight tags (if any) */}
          {tags.length > 0 && <InsightTagsPanel tags={tags} />}

          {/* Auth gate */}
          {!user && (
            <motion.div {...fadeUp(0.12)} className="mb-6 glass-strong rounded-2xl border border-[hsl(268_52%_68%/0.2)] p-6 text-center space-y-3">
              <Lock className="w-6 h-6 mx-auto text-[hsl(268_52%_68%)]" />
              <p className="text-sm font-semibold text-foreground">Sign in to save your answers</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can read the questions now. Saving requires an account so your profile persists across sessions.
              </p>
              <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0">
                <Link href="/login">Sign in free <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            </motion.div>
          )}

          {/* Progressive profile modules */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground">Profile modules</p>
              <p className="text-[11px] text-muted-foreground/50">{PROFILE_MODULES.length} modules · answer at your own pace</p>
            </div>
            <div className="space-y-3">
              {PROFILE_MODULES.map((mod, i) => (
                <ProfileModule
                  key={mod.id}
                  mod={mod}
                  answeredIds={answeredIds}
                  onSave={handleSave}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Dimension summary */}
          {profileData && profileData.dimensions && profileData.dimensions.length > 0 && (
            <motion.div {...fadeUp(0.3)} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Dimensions overview</p>
                <p className="text-[11px] text-muted-foreground/50">18 dimensions</p>
              </div>
              <DimensionGrid profile={profileData} />
            </motion.div>
          )}

          {/* Footer CTAs */}
          <motion.div {...fadeUp(0.4)} className="glass-strong rounded-2xl p-6 sm:p-7 border border-[hsl(268_52%_68%/0.2)] text-center space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[hsl(268_52%_78%)]">What happens next</p>
            <h3 className="font-serif text-xl font-semibold">Compatibility matching is coming</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              When live matching opens, your completed profile will be used to surface people who are actually compatible with how you think, communicate, and live — not just photos and bios.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/future-connections">Future Matching Preview <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/user-control">Consent & privacy <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            </div>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
