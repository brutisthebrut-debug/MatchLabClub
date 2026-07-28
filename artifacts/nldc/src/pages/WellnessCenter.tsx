import { withAlpha } from "@/lib/brandColor";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { ToolHandoff } from "@/components/ToolHandoff";
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
  WELLNESS_QUESTIONS,
  DOMAIN_META,
  FEATURE_USAGE_MAP,
  FEATURE_META,
  getDimensionsByDomain,
  getFeaturesForDimension,
  getFeatureReadiness,
  getQuestionsByDimension,
  type FeatureKey,
  type WellnessQuestion,
} from "@/lib/wellnessQuestionBank";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const DIMENSION_ICONS: Record<string, React.ElementType> = {
  emotional: Heart,
  physical: Activity,
  social: Users,
  intellectual: BookOpen,
  spiritual: Sparkles,
  occupational: Briefcase,
  financial: DollarSign,
  environmental: Trees,
  communication: MessageSquare,
  conflict: AlertCircle,
  boundaries: Shield,
  affection: Heart,
  intimacy: Lock,
  lifestyle: Compass,
  future_vision: ArrowRight,
  values: Sparkles,
  family: Users,
  culture: BookOpen,
};

// ── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  savedAnswer,
  onSave,
}: {
  question: WellnessQuestion;
  savedAnswer?: string;
  onSave: (questionId: string, answer: string) => Promise<void>;
}) {
  const [text, setText] = useState(savedAnswer ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!savedAnswer);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  async function handleSave() {
  if (!text.trim()) return;
  setSaving(true);
  try {
  await onSave(question.id, text.trim());
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
  className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-[hsl(248_62%_52%/0.4)] transition-colors"
  />
  <div className="flex items-center justify-between gap-3 mt-2">
  <div className="flex items-center gap-2">
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
  className="rounded-full text-xs h-7 px-4 bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_50%)] border-0 disabled:opacity-40"
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
  onSave: (qId: string, answer: string) => Promise<void>;
  index: number;
}) {
  const answered = mod.questions.filter(q => answeredIds.has(q.id)).length;
  const total = mod.questions.length;
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
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
  <p className="text-xs font-semibold tabular-nums" style={{ color: pct >= 80 ? "hsl(var(--brand-green))" : pct >= 40 ? "hsl(var(--brand-gold))" : "hsl(220 10% 55%)" }}>
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
  const pct = d.completionPct ?? 0;
  return (
  <div key={d.dimension} className="glass-strong rounded-xl border border-white/5 p-4">
  <div className="flex items-center gap-2 mb-2">
  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
  style={{ background: withAlpha(meta.color, 0.13) }}>
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
  const color = pct >= 60 ? "hsl(var(--brand-green))" : pct >= 30 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";

  return (
  <motion.div {...fadeUp(0.2)} className="glass-strong rounded-2xl border border-[hsl(248_62%_52%/0.18)] p-5 mb-6">
  <div className="flex items-start justify-between gap-4 mb-4">
  <div>
  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-1">Match Readiness Signal</p>
  <h3 className="font-serif text-lg font-semibold text-foreground">
  {mr.readyForMatching ? "Your wellness map is looking strong" : "Keep building your wellness map"}
  </h3>
  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
  {mr.readyForMatching
  ? "This is one of five signals I use for matching, and yours is well covered."
  : `Answer ${5 - (mr.strongDimensions?.length ?? 0)} more dimension areas to deepen this signal.`}
  </p>
  </div>
  <div className="flex flex-col items-center flex-shrink-0">
  <span className="text-3xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
  <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">covered</span>
  </div>
  </div>
  <Progress value={pct} className="h-2 bg-white/8 mb-3" />
  <div className="flex flex-wrap items-center justify-between gap-2">
  {mr.readyForMatching ? (
  <div className="flex items-center gap-1.5 text-xs text-[hsl(142_55%_60%)]">
  <CheckCircle2 className="w-3.5 h-3.5" />
  <span>Strong wellness coverage feeding your match profile</span>
  </div>
  ) : (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
  <Lock className="w-3.5 h-3.5" />
  <span>Your wellness map is one of five signals that build match readiness</span>
  </div>
  )}
  <Link href="/matching" className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(248_62%_62%)] hover:underline" data-testid="link-wellness-matching">
  See full match readiness <ArrowRight className="w-3 h-3" />
  </Link>
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
  borderColor: t.approvedForMatching ? "hsl(var(--brand-green) / 0.3)" : "hsl(220 10% 35%)",
  background: t.approvedForMatching ? "hsl(var(--brand-green) / 0.07)" : "hsl(232 18% 15%)",
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

// ── Domain overview ───────────────────────────────────────────────────────────

function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
  <svg width={size} height={size} className="flex-shrink-0" aria-hidden="true">
  <circle cx={size / 2} cy={size / 2} r={r} stroke={withAlpha(color, 0.15)} strokeWidth={stroke} fill="none" />
  <circle
  cx={size / 2} cy={size / 2} r={r}
  stroke={color} strokeWidth={stroke} fill="none"
  strokeDasharray={c} strokeDashoffset={offset}
  strokeLinecap="round"
  transform={`rotate(-90 ${size / 2} ${size / 2})`}
  style={{ transition: "stroke-dashoffset 400ms ease" }}
  />
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill={color}>
  {pct}%
  </text>
  </svg>
  );
}

const FEATURE_ORDER: FeatureKey[] = ["compass", "coach", "report", "insights"];

const FEATURE_CHIP_COLOR: Record<FeatureKey, string> = {
  compass: "hsl(248 62% 62%)",
  coach: "hsl(190 55% 60%)",
  report: "hsl(326 100% 65%)",
  insights: "hsl(43 65% 72%)",
};

function FeatureBadges({ dimensionId }: { dimensionId: string }) {
  const features = getFeaturesForDimension(dimensionId);
  if (!features.length) return null;
  return (
  <div className="flex flex-wrap gap-1 mt-2">
  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 self-center">
  Feeds
  </span>
  {features.map(f => {
  const c = FEATURE_CHIP_COLOR[f];
  return (
  <span
  key={f}
  className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
  style={{ color: c, borderColor: withAlpha(c, 0.3), background: withAlpha(c, 0.08) }}
  >
  {FEATURE_META[f].short}
  </span>
  );
  })}
  </div>
  );
}

type DimensionState = "answered" | "partial" | "empty";

function StateChip({ state }: { state: DimensionState }) {
  const meta: Record<DimensionState, { label: string; color: string }> = {
  answered: { label: "Answered", color: "hsl(var(--brand-green))" },
  partial: { label: "Partial", color: "hsl(var(--brand-gold))" },
  empty: { label: "Empty", color: "hsl(220 10% 55%)" },
  };
  const m = meta[state];
  return (
  <span
  className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border"
  style={{ color: m.color, borderColor: withAlpha(m.color, 0.3), background: withAlpha(m.color, 0.08) }}
  data-testid={`dimension-state-${state}`}
  >
  {m.label}
  </span>
  );
}

function DimensionInlineRow({
  dimensionId,
  answeredIds,
  onSave,
}: {
  dimensionId: string;
  answeredIds: Set<string>;
  onSave: (qId: string, answer: string) => Promise<void>;
}) {
  const meta = DIMENSION_META[dimensionId];
  const Icon = DIMENSION_ICONS[dimensionId] ?? Sparkles;
  const questions = getQuestionsByDimension(dimensionId);
  const answered = questions.filter(q => answeredIds.has(q.id)).length;
  const total = questions.length;
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  const [open, setOpen] = useState(false);

  if (!meta) return null;

  const state: DimensionState = answered === 0 ? "empty" : answered >= total ? "answered" : "partial";

  return (
  <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden" data-testid={`dimension-row-${dimensionId}`}>
  <button
  type="button"
  onClick={() => setOpen(o => !o)}
  className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/3 transition-colors"
  >
  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
  style={{ background: withAlpha(meta.color, 0.13) }}>
  <Icon className="w-4 h-4" style={{ color: meta.color }} />
  </div>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
  <StateChip state={state} />
  <span className="text-[10px] tabular-nums text-muted-foreground/60">
  {answered}/{total}
  </span>
  </div>
  <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-0.5">{meta.blurb}</p>
  <FeatureBadges dimensionId={dimensionId} />
  </div>
  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
  <span className="inline-flex items-center gap-1 rounded-full text-[11px] h-7 px-3 border border-white/15 text-foreground/80">
  {open ? "Close" : pct === 0 ? "Start" : pct === 100 ? "Review" : "Continue"}
  {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
  </span>
  <span className="text-[9px] tabular-nums text-muted-foreground/50">{pct}%</span>
  </div>
  </button>
  <div className="px-4 pb-2">
  <Progress value={pct} className="h-1 bg-white/8" />
  </div>
  <AnimatePresence>
  {open && (
  <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.2 }}
  className="overflow-hidden"
  >
  <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/5">
  {questions.map(q => (
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
  </div>
  );
}

function DomainCard({
  domain,
  answeredIds,
  expanded,
  onToggle,
}: {
  domain: typeof DOMAIN_META[number];
  answeredIds: Set<string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const allQuestions = WELLNESS_QUESTIONS.filter(q => domain.dimensionIds.includes(q.dimension));
  const answered = allQuestions.filter(q => answeredIds.has(q.id)).length;
  const total = allQuestions.length;
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);

  const dimsWithData = domain.dimensionIds.filter(dim =>
  WELLNESS_QUESTIONS.some(q => q.dimension === dim && answeredIds.has(q.id)),
  ).length;

  return (
  <button
  onClick={onToggle}
  data-testid={`domain-card-${domain.id}`}
  className={`text-left rounded-2xl border p-4 transition-all w-full ${
  expanded ? "border-white/20 bg-white/4" : "border-white/8 bg-white/2 hover:border-white/15"
  }`}
  style={expanded ? { boxShadow: `0 0 0 1px ${withAlpha(domain.color, 0.25)}` } : undefined}
  >
  <div className="flex items-start gap-3">
  <ProgressRing pct={pct} color={domain.color} />
  <div className="flex-1 min-w-0">
  <p className="text-sm font-semibold text-foreground leading-tight">{domain.label}</p>
  <p className="text-[11px] text-muted-foreground/70 leading-snug mt-1">{domain.description}</p>
  <p className="text-[10px] text-muted-foreground/50 mt-2 tabular-nums">
  {dimsWithData} of {domain.dimensionIds.length} dimensions with data · {answered}/{total} questions
  </p>
  </div>
  </div>
  </button>
  );
}

function DomainOverview({
  answeredIds,
  onSave,
}: {
  answeredIds: Set<string>;
  onSave: (qId: string, answer: string) => Promise<void>;
}) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(DOMAIN_META[0]?.id ?? null);

  const totalQuestions = WELLNESS_QUESTIONS.length;
  const totalAnswered = WELLNESS_QUESTIONS.filter(q => answeredIds.has(q.id)).length;
  const overallPct = totalQuestions === 0 ? 0 : Math.round((totalAnswered / totalQuestions) * 100);
  const dimensionsExplored = Object.keys(DIMENSION_META).filter(dim =>
  WELLNESS_QUESTIONS.some(q => q.dimension === dim && answeredIds.has(q.id)),
  ).length;

  return (
  <motion.div {...fadeUp(0.14)} className="mb-6">
  {/* Top-level horizontal progress */}
  <div className="glass-strong rounded-2xl border border-white/5 p-5 mb-4" data-testid="wellness-density-summary">
  <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
  <div>
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Wellness density</p>
  <p className="text-sm font-semibold text-foreground mt-0.5">
  {dimensionsExplored} of 18 dimensions have data
  </p>
  <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">
  Density grows as you touch more dimensions. Depth grows as you answer more questions in each.
  </p>
  </div>
  <div className="flex items-center gap-5">
  <div className="text-right">
  <p className="text-2xl font-bold tabular-nums" style={{ color: "hsl(248 62% 65%)" }}>
  {Math.round((dimensionsExplored / 18) * 100)}%
  </p>
  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">density</p>
  </div>
  <div className="text-right">
  <p className="text-2xl font-bold tabular-nums text-foreground">{overallPct}%</p>
  <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
  depth · {totalAnswered}/{totalQuestions}
  </p>
  </div>
  </div>
  </div>
  <div className="space-y-1.5">
  <div className="flex items-center gap-2">
  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 w-14">Density</span>
  <Progress value={Math.round((dimensionsExplored / 18) * 100)} className="h-1.5 bg-white/8 flex-1" />
  </div>
  <div className="flex items-center gap-2">
  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 w-14">Depth</span>
  <Progress value={overallPct} className="h-1.5 bg-white/8 flex-1" />
  </div>
  </div>
  </div>

  {/* Domain grid */}
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {DOMAIN_META.map(d => (
  <DomainCard
  key={d.id}
  domain={d}
  answeredIds={answeredIds}
  expanded={expandedDomain === d.id}
  onToggle={() => setExpandedDomain(prev => (prev === d.id ? null : d.id))}
  />
  ))}
  </div>

  {/* Expanded dimensions list */}
  <AnimatePresence initial={false}>
  {expandedDomain && (
  <motion.div
  key={expandedDomain}
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.25 }}
  className="overflow-hidden"
  >
  <div className="pt-4 space-y-2">
  {getDimensionsByDomain(expandedDomain).map(dimId => (
  <DimensionInlineRow
  key={dimId}
  dimensionId={dimId}
  answeredIds={answeredIds}
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

// ── What this powers ──────────────────────────────────────────────────────────

function WhatThisPowers() {
  const [open, setOpen] = useState(false);
  return (
  <motion.div {...fadeUp(0.18)} className="mb-6 glass-strong rounded-2xl border border-white/5 overflow-hidden">
  <button
  onClick={() => setOpen(o => !o)}
  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/2 transition-colors"
  >
  <div>
  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">What this powers</p>
  <p className="text-sm font-semibold text-foreground mt-0.5">See which dimensions feed which features</p>
  </div>
  {open ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
  </button>
  <AnimatePresence>
  {open && (
  <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.25 }}
  className="overflow-hidden"
  >
  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/5">
  {FEATURE_ORDER.map(f => {
  const dims = FEATURE_USAGE_MAP[f];
  const labels = dims.map(d => DIMENSION_META[d]?.label ?? d);
  return (
  <div key={f} className="rounded-xl bg-white/2 border border-white/5 p-3">
  <p className="text-xs font-semibold text-foreground">
  {FEATURE_META[f].label} uses these {dims.length} dimensions
  </p>
  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{FEATURE_META[f].blurb}</p>
  <p className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">
  {labels.join(", ")}.
  </p>
  </div>
  );
  })}
  </div>
  </motion.div>
  )}
  </AnimatePresence>
  </motion.div>
  );
}

function FeatureReadinessPanel({ answeredIds }: { answeredIds: Set<string> }) {
  return (
  <motion.div
  {...fadeUp(0.16)}
  className="mb-6 glass-strong rounded-2xl border border-white/5 p-4 sm:p-5"
  data-testid="panel-feature-readiness"
  >
  <div className="flex items-center justify-between mb-1">
  <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">
  Where your answers go
  </p>
  <p className="text-[10px] text-muted-foreground/50">
  Live coverage per feature
  </p>
  </div>
  <p className="text-sm text-muted-foreground/80 mb-4 leading-relaxed">
  Each tool reads a specific slice of your profile. The percentage is how
  much of that slice you've filled in. The questions below are the
  highest-impact next steps for each.
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {FEATURE_ORDER.map(f => {
  const r = getFeatureReadiness(f, answeredIds, 3);
  const color = FEATURE_CHIP_COLOR[f];
  const meta = FEATURE_META[f];
  return (
  <div
  key={f}
  className="rounded-xl border border-white/5 bg-white/2 p-3 flex flex-col gap-3"
  data-testid={`feature-readiness-${f}`}
  style={{ borderColor: withAlpha(color, 0.18) }}
  >
  <div className="flex items-center gap-3">
  <ProgressRing pct={r.coveragePct} color={color} size={52} />
  <div className="min-w-0">
  <p className="text-xs font-semibold text-foreground truncate">
  {meta.label}
  </p>
  <p className="text-[11px] text-muted-foreground/70 leading-snug">
  {r.coveredDimensions}/{r.totalDimensions} dimensions ·{" "}
  {r.answeredQuestions}/{r.totalQuestions} answers
  </p>
  <p className="text-[10px] text-muted-foreground/55 mt-1 leading-snug">
  {meta.blurb}
  </p>
  </div>
  </div>
  {r.nextQuestions.length > 0 ? (
  <div className="space-y-1.5">
  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
  Lift this next
  </p>
  <ul className="space-y-1">
  {r.nextQuestions.map(q => (
  <li
  key={q.id}
  className="text-[11px] text-foreground/85 leading-snug flex items-start gap-1.5"
  data-testid={`feature-${f}-next-${q.id}`}
  >
  <span
  className="mt-1 w-1 h-1 rounded-full flex-shrink-0"
  style={{ background: color }}
  aria-hidden="true"
  />
  <span>
  <span className="text-muted-foreground/50">
  {DIMENSION_META[q.dimension]?.label ?? q.dimension}
  {" · "}
  </span>
  {q.text}
  </span>
  </li>
  ))}
  </ul>
  </div>
  ) : (
  <div className="rounded-md bg-[hsl(142_55%_60%/0.08)] border border-[hsl(142_55%_60%/0.2)] px-2 py-1.5">
  <p className="text-[11px] text-[hsl(142_55%_72%)] font-medium">
  Fully covered. Every question feeding {meta.short} is
  answered.
  </p>
  </div>
  )}
  </div>
  );
  })}
  </div>
  </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WellnessCenter() {
  useMeta(
  "Compatibility Profile Builder",
  "Build your wellness compatibility profile, 18 dimensions, progressive questions, and a matching readiness score.",
  );

  const { user, login } = useAuth();
  const { data: profileData } = useGetWellnessProfile();
  const { data: answersData } = useListWellnessAnswers({});
  const { mutateAsync: saveAnswer } = useCreateWellnessAnswer();

  const answeredIds = new Set((answersData?.answers ?? []).map(a => a.questionId));

  const totalAnswered = answeredIds.size;
  const overallPct = profileData?.matchingReadiness?.overallPct ?? 0;

  async function handleSave(questionId: string, answer: string) {
  const question = PROFILE_MODULES.flatMap(m => m.questions).find(q => q.id === questionId);
  if (!question) return;
  await saveAnswer({
  data: {
  questionId,
  dimension: question.dimension,
  category: question.category,
  questionText: question.text,
  answer,
  },
  });
  }

  const tags = (profileData?.tags ?? []) as Array<{ tag: string; label: string; category: string; approvedForMatching: boolean | null }>;

  return (
  <AppLayout>
  <HubTabs hub="connections" />
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
  Answer at your own pace across 18 wellness dimensions. Each answer is saved
  privately first. You decide separately whether Echo may use it, whether it
  belongs in your Mirror, and whether it may inform matching.
  </p>
  <div className="mt-4 flex flex-wrap items-center gap-3">
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(248_45%_157%)] border border-white/5 text-xs text-muted-foreground">
  <Shield className="w-3 h-3 text-[hsl(142_55%_60%)]" />
  Saved first. Nothing feeds matching until you approve it.
  </div>
  {totalAnswered > 0 && (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(142_55%_60%/0.09)] border border-[hsl(142_55%_60%/0.2)] text-xs text-[hsl(142_55%_72%)]">
  <CheckCircle2 className="w-3 h-3" />
  {totalAnswered} answer{totalAnswered !== 1 ? "s" : ""} saved · {overallPct}% approved for matching
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
  <span className="hidden sm:inline text-[11px] text-muted-foreground/55">, what you share is yours</span>
  </div>
  <div className="flex flex-wrap gap-1.5 items-center">
  <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider mr-0.5 hidden sm:inline">Also in this package:</span>
  {[
  { name: "Data Vault", href: "/vault" },
  { name: "Future Matching", href: "/future-connections" },
  { name: "User Control", href: "/user-control" },
  { name: "Privacy", href: "/privacy" },
  { name: "Integrations", href: "/integrations" },
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

  {/* Per-feature readiness, shows live coverage + next best questions
  for each downstream tool (Compass, Coach, Mirror, Insights). */}
  <FeatureReadinessPanel answeredIds={answeredIds} />

  {/* Insight tags (if any) */}
  {tags.length > 0 && <InsightTagsPanel tags={tags} />}

  {/* Auth gate */}
  {!user && (
  <motion.div {...fadeUp(0.12)} className="mb-6 glass-strong rounded-2xl border border-[hsl(248_62%_52%/0.2)] p-6 text-center space-y-3">
  <Lock className="w-6 h-6 mx-auto text-[hsl(248_62%_52%)]" />
  <p className="text-sm font-semibold text-foreground">Sign in to save your answers</p>
  <p className="text-xs text-muted-foreground leading-relaxed">
  You can read the questions now. Saving requires an account so your profile persists across sessions.
  </p>
  <Button onClick={() => login()} className="rounded-full bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] border-0">
  Sign in free <ArrowRight className="w-4 h-4 ml-1.5" />
  </Button>
  </motion.div>
  )}

  {/* Domain-grouped overview */}
  <DomainOverview answeredIds={answeredIds} onSave={handleSave} />

  {/* What this powers */}
  <WhatThisPowers />

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
  <motion.div {...fadeUp(0.4)} className="glass-strong rounded-2xl p-6 sm:p-7 border border-[hsl(248_62%_52%/0.2)] text-center space-y-4">
  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">What happens next</p>
  <h3 className="font-serif text-xl font-semibold">Compatibility matching is coming</h3>
  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
  When live matching opens, only the answers you explicitly approve for
  matching will help surface people compatible with how you think,
  communicate, and live, not just photos and bios.
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

  <div className="mt-6">
  <ToolHandoff
  testId="wellness-handoff"
  fedLine="Every dimension you answer becomes part of how I understand you, which powers better matches. Keep building the picture."
  steps={[
  { label: "Take a quiz", href: "/quizzes", desc: "A fast way to fill in more dimensions." },
  { label: "Get a compatibility read", href: "/compatibility-compass", desc: "See how your profile reads for fit." },
  { label: "Check your readiness", href: "/me", desc: "Watch your Match Readiness climb." },
  ]}
  />
  </div>

  </div>
  </div>
  </AppLayout>
  );
}
