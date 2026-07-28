import { useState } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useMeta } from "@/hooks/useMeta";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  FileText,
  Heart,
  Eye,
  EyeOff,
  MessageCircle,
  Lightbulb,
  Send,
  Share2,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetMirrorTrends,
  useGetMirrorPortrait,
  getGetMirrorPortraitQueryKey,
  useAskMirror,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useListJournalEntries,
  useListPostDateNotes,
  useGetMyJourneySummary,
  getGetMyJourneySummaryQueryKey,
  useGetMySignalMap,
  getGetMySignalMapQueryKey,
  type MirrorPortrait,
} from "@workspace/api-client-react";
import { ClimbCard } from "@/components/climb/ClimbCard";
import { MomentumRecap } from "@/components/climb/MomentumRecap";
import { NextBestActionCoach } from "@/components/coach/NextBestActionCoach";
import { SignalDensityMap } from "@/components/SignalDensityMap";
import { DEMO_PORTRAIT, DEMO_MOMENTUM, DEMO_SIGNAL_MAP } from "@/lib/mirrorDemo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import {
  hasPendingFirstRead,
  markFirstReadSeen,
} from "@/lib/onboardingState";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function ReadinessGauge({ score }: { score: number }) {
  const radius = 56;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const tone =
    score >= 75
      ? "hsl(var(--brand-green))"
      : score >= 50
        ? "hsl(var(--brand-gold))"
        : "hsl(var(--brand-rose))";
  return (
    <div className="relative flex h-36 w-36 items-center justify-center drop-shadow-xl">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth="8"
          fill="none"
          strokeOpacity="0.5"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={tone}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-full m-3 shadow-inner border border-white/20">
        <span className="font-serif text-4xl font-bold text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">/ 100</span>
      </div>
    </div>
  );
}

function ScoreDirectionIcon({
  direction,
}: {
  direction: "up" | "down" | "flat";
}) {
  if (direction === "up") return <TrendingUp className="h-5 w-5 text-emerald-500" />;
  if (direction === "down") return <TrendingDown className="h-5 w-5 text-rose-500" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

function ToneIcon({ tone }: { tone: "positive" | "watch" | "neutral" }) {
  if (tone === "positive") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (tone === "watch") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Sparkles className="h-4 w-4 text-muted-foreground" />;
}

function fmtShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function MirrorPortraitSection({
  portrait,
  isDemo,
}: {
  portrait: MirrorPortrait;
  isDemo: boolean;
}) {
  const mappedCount = portrait.known.length;
  const totalAreas = portrait.known.length + portrait.blindSpots.length;
  const questPercent = totalAreas === 0 ? 0 : Math.round((mappedCount / totalAreas) * 100);
  
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <div
          data-testid="card-mirror-portrait"
          className="glass-strong rounded-[2rem] p-8 md:p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-12 opacity-40 pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-[#3D35CC]/20 to-[#FF2D9B]/20 blur-3xl" />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-700 text-xs font-semibold">
                <Eye className="h-3.5 w-3.5" />
                {portrait.stageLabel}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 border border-white/40 text-muted-foreground text-xs font-semibold">
                {portrait.coveragePercent}% of you mapped
              </div>
              {isDemo && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 text-xs font-semibold border border-rose-500/20">
                  Sample view, sign in for your own
                </div>
              )}
            </div>
            <p
              data-testid="text-mirror-headline"
              className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-foreground"
            >
              {portrait.headline}
            </p>
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed font-medium">
              {portrait.stageBlurb}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div variants={fadeUp} className="h-full">
          <div data-testid="card-mirror-known" className="glass rounded-[2rem] p-6 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-[#3D35CC]/10 flex items-center justify-center shrink-0">
                <Eye className="h-5 w-5 text-[#3D35CC]" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">What I can see so far</h3>
            </div>
            
            <div className="flex-1">
              {portrait.known.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 bg-white/40 rounded-xl border border-white/40 text-center">
                  Nothing yet. Feed me one signal and I will start to know you.
                </p>
              ) : (
                <ul className="space-y-5">
                  {portrait.known.map((k) => (
                    <li key={k.key} data-testid={`row-known-${k.key}`} className="group">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-foreground">{k.label}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold bg-white/50 px-2 py-0.5 rounded-full">
                          {k.coverage}% covered · {k.confidence}% sure
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 shadow-inner">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3D35CC] to-[#7B5CF5] transition-all duration-1000 ease-out"
                          style={{ width: `${k.coverage}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-medium text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">{k.insight}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="h-full">
          <div data-testid="card-mirror-blindspots" className="glass rounded-[2rem] p-6 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <EyeOff className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground">What I cannot see yet</h3>
            </div>
            
            <div className="flex-1">
              {totalAreas > 0 && (
                <div className="mb-6 bg-white/40 p-4 rounded-2xl border border-white/50" data-testid="blindspot-quest-progress">
                  <div className="flex items-center justify-between text-xs text-foreground font-bold mb-2 uppercase tracking-wide">
                    <span>{mappedCount} of {totalAreas} areas mapped</span>
                    <span className="text-[#3D35CC]">{questPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-out relative overflow-hidden"
                      style={{ width: `${questPercent}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                    </div>
                  </div>
                </div>
              )}
              {portrait.blindSpots.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 bg-white/40 rounded-xl border border-white/40 text-center font-medium">
                  Every area is mapped. Keep feeding outcomes and your Mirror stays sharp.
                </p>
              ) : (
                <ol className="space-y-3">
                  {portrait.blindSpots.map((b, i) => (
                    <li
                      key={b.key}
                      data-testid={`row-blindspot-${b.key}`}
                      className="flex gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 hover:bg-white/60 transition-colors shadow-sm"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-700 border border-amber-500/20 shadow-inner"
                        aria-hidden="true"
                      >
                        {mappedCount + i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{b.label}</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">{b.why}</p>
                        <Link
                          href={b.href}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white px-3 py-1.5 rounded-full border shadow-sm"
                          data-testid={`link-blindspot-${b.key}`}
                        >
                          {b.actionLabel}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={fadeUp}>
        <NextBestActionCoach
          action={
            portrait.nextSignal
              ? {
                  key: portrait.nextSignal.key,
                  label: portrait.nextSignal.label,
                  detail: portrait.nextSignal.detail,
                  points: portrait.nextSignal.points,
                  href: portrait.nextSignal.href,
                }
              : null
          }
          eligible={portrait.eligible}
          testId="card-mirror-next"
        />
      </motion.div>
    </motion.div>
  );
}

interface MirrorTurn {
  role: "you" | "mirror";
  text: string;
  grounding?: string[];
  followUp?: string;
  isFallback?: boolean;
}

const STARTER_QUESTIONS = [
  "What do you actually know about me?",
  "Am I ready to match?",
  "What should I work on next?",
  "Who should I be looking for?",
];

function MirrorChat({ disabled }: { disabled: boolean }) {
  const qc = useQueryClient();
  const ask = useAskMirror();
  const [turns, setTurns] = useState<MirrorTurn[]>([]);
  const [draft, setDraft] = useState("");

  async function send(question: string): Promise<void> {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setTurns((t) => [...t, { role: "you", text: q }]);
    setDraft("");
    try {
      const res = await ask.mutateAsync({ data: { question: q } });
      setTurns((t) => [
        ...t,
        {
          role: "mirror",
          text: res.answer,
          grounding: res.grounding,
          followUp: res.followUp,
          isFallback: res.isFallback,
        },
      ]);
      qc.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "mirror",
          text: "I could not reach my deeper read just now. Try again in a moment, and your signals are safe either way.",
        },
      ]);
    }
  }

  return (
    <div data-testid="card-mirror-chat" className="glass-strong rounded-[2rem] p-6 md:p-8 flex flex-col shadow-lg border border-white/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5 text-[#3D35CC]" />
        </div>
        <h3 className="font-serif text-xl font-bold text-foreground">Ask your Mirror anything</h3>
      </div>
      
      <div className="flex-1">
        {disabled ? (
          <p className="text-sm font-medium text-muted-foreground bg-white/40 p-4 rounded-xl border border-white/50 text-center">
            Sign in to talk to your Mirror. It only ever speaks from the real
            signals on your own account.
          </p>
        ) : (
          <>
            {turns.length === 0 ? (
              <p className="mb-6 text-sm font-medium text-muted-foreground leading-relaxed">
                I answer only from what your real signals tell me. If I cannot see
                something, I will say so and point you to the signal that would fill
                the gap.
              </p>
            ) : (
              <ul className="mb-6 space-y-4" data-testid="list-mirror-turns">
                {turns.map((t, i) => (
                  <motion.li
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    key={i}
                    data-testid={`turn-${t.role}-${i}`}
                    className={
                      t.role === "you"
                        ? "ml-auto max-w-[85%] rounded-[1.5rem] rounded-br-md bg-gradient-to-r from-[#3D35CC] to-[#7B5CF5] px-5 py-3.5 text-white shadow-md"
                        : "mr-auto max-w-[90%] rounded-[1.5rem] rounded-bl-md border border-white/60 bg-white/80 backdrop-blur-md px-5 py-4 shadow-sm"
                    }
                  >
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed font-medium ${t.role === 'you' ? 'text-white' : 'text-foreground'}`}>{t.text}</p>
                    {t.grounding && t.grounding.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.grounding.map((g, gi) => (
                          <span key={gi} className="px-2.5 py-1 bg-black/5 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-black/5">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.followUp && (
                      <button
                        type="button"
                        onClick={() => void send(t.followUp!)}
                        data-testid={`followup-${i}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-left text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-white shadow-sm"
                      >
                        <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                        {t.followUp}
                      </button>
                    )}
                    {t.role === "mirror" && t.isFallback === false && (
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
                        Deep AI lane
                      </p>
                    )}
                  </motion.li>
                ))}
              </ul>
            )}

            {turns.length === 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    data-testid={`starter-${q.slice(0, 10)}`}
                    className="rounded-full border border-white/60 bg-white/50 px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-all hover:bg-white hover:border-[#3D35CC]/30 hover:text-[#3D35CC] hover:shadow-md"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="flex items-end gap-3 bg-white/60 p-2 rounded-3xl border border-white shadow-sm focus-within:ring-2 focus-within:ring-[#3D35CC]/30 transition-shadow"
            >
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder="Ask me what I see in you..."
                rows={1}
                className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus-visible:ring-0 shadow-none px-4 py-3 text-sm font-medium"
                data-testid="input-mirror-question"
              />
              <Button
                type="submit"
                size="icon"
                disabled={ask.isPending || !draft.trim()}
                className="rounded-full h-11 w-11 shrink-0 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white shadow-md hover:shadow-lg transition-all border-0"
                data-testid="button-send-mirror"
              >
                <Send className="h-4.5 w-4.5" />
              </Button>
            </form>
            {ask.isPending && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs font-bold text-[#3D35CC] text-center animate-pulse tracking-wide uppercase">
                Reading your signals...
              </motion.p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function YourMirror() {
  useMeta(
    "Your Mirror",
    "See your patterns over time, the trends in how you date, and what is moving your readiness.",
  );
  const { data, isLoading, isError } = useGetMirrorTrends();
  const { data: journalData } = useListJournalEntries({ view: "active", limit: 3 });
  const { data: notesData } = useListPostDateNotes({ view: "active", limit: 3 });
  const recentReflections = journalData?.entries ?? [];
  const recentDates = notesData?.notes ?? [];

  const { isAuthenticated } = useAuth();
  const [firstRead] = useState(() => hasPendingFirstRead());
  const { data: matchingState, isError: matchingStateError } = useGetMatchingState({
    query: { queryKey: getGetMatchingStateQueryKey(), enabled: isAuthenticated },
  });
  const { data: journeySummary, isError: journeySummaryError } = useGetMyJourneySummary({
    query: {
      queryKey: getGetMyJourneySummaryQueryKey(),
      enabled: isAuthenticated,
    },
  });
  const {
    data: portrait,
    isLoading: portraitLoading,
    isError: portraitError,
  } = useGetMirrorPortrait({
    query: { queryKey: getGetMirrorPortraitQueryKey(), retry: false },
  });
  const portraitFailedForUser = isAuthenticated && portraitError && !portrait;
  const isDemo = !portrait && !portraitFailedForUser;
  const shownPortrait = portrait ?? DEMO_PORTRAIT;

  const { data: signalMap, isError: signalMapError } = useGetMySignalMap({
    query: { queryKey: getGetMySignalMapQueryKey(), enabled: isAuthenticated },
  });
  const shownSignalMap = signalMap ?? DEMO_SIGNAL_MAP;
  const signalMapIsDemo = !signalMap;

  // Honest error reconciliation: for a signed-in user, a failed live run on any
  // core query must be visible rather than silently masked by DEMO_* data.
  // Anonymous visitors keep their intentional demo fallback untouched.
  const coreQueryFailedForUser =
    isAuthenticated &&
    (matchingStateError || journeySummaryError || signalMapError);

  return (
    <AppLayout>
    <HubTabs hub="mirror" />
    <div className="min-h-screen bg-background mesh-bg overflow-x-hidden">
      <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12 relative z-10">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-8 rounded-full font-bold hover:bg-white/50 backdrop-blur-sm" data-testid="link-back-dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mb-12"
        >
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 border border-white shadow-sm mb-4 text-xs font-bold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[#3D35CC]" />
              Your Mirror
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              The machine's read <br className="hidden sm:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]">on you, so far</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
              Your Mirror is the model MatchLab keeps of you, built only from the
              real signals you feed it. It tells you what it can see, where it is
              still guessing, and the one move that sharpens the picture most. Ask
              it anything below.
            </p>
          </motion.div>
        </motion.div>

        {firstRead && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-[2rem] border border-[hsl(var(--brand-pink)/0.28)] bg-gradient-to-br from-[hsl(var(--brand-indigo)/0.12)] via-card/90 to-[hsl(var(--brand-pink)/0.1)] p-6 shadow-lg md:p-8"
            data-testid="first-read-handoff"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--brand-indigo))]">
                  Chapter 2 of 8 · First read
                </p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-foreground md:text-3xl">
                  This is a beginning, not a diagnosis.
                </h2>
                <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
                  Keep what feels true. Correct what does not. Anything you saved
                  stays private by default, and nothing can shape matching until
                  you confirm it in Your Mirror.
                </p>
              </div>
              <Button
                asChild
                className="shrink-0 rounded-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] px-5 font-bold text-white shadow-md"
              >
                <Link
                  href="/quiz"
                  onClick={markFirstReadSeen}
                  data-testid="first-read-continue"
                >
                  Give me one quick instinct
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.section>
        )}

        {coreQueryFailedForUser && (
          <div
            className="glass rounded-[2rem] p-6 text-center mb-8"
            data-testid="mirror-error"
          >
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-[hsl(348_55%_78%)]" />
            <p className="text-sm text-muted-foreground">
              We could not load your Mirror right now. Please refresh and try again.
            </p>
          </div>
        )}

        <div className="mb-16 space-y-8">
          {portraitLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-40 w-full rounded-[2rem] bg-white/40" />
              <Skeleton className="h-64 w-full rounded-[2rem] bg-white/40" />
            </div>
          ) : portraitFailedForUser ? (
            <div className="glass rounded-[2rem] p-8 border-destructive/20 bg-destructive/5 text-center">
              <p className="text-sm font-bold text-destructive" data-testid="text-portrait-error">
                Couldn't load your Mirror right now. Try refreshing the page in a moment.
              </p>
            </div>
          ) : (
            <>
              <MirrorPortraitSection portrait={shownPortrait} isDemo={isDemo} />
              {isDemo ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
                  <MomentumRecap summary={DEMO_MOMENTUM} isDemo />
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }} className="space-y-8">
                  <ClimbCard
                    score={matchingState?.readiness?.score ?? 0}
                    threshold={matchingState?.readinessThreshold ?? 50}
                    streak={matchingState?.activityStreak}
                  />
                  <MomentumRecap summary={journeySummary ?? DEMO_MOMENTUM} />
                  <div className="flex justify-center">
                    <Button
                      asChild
                      variant="outline"
                      className="rounded-full bg-white/60 border-white shadow-sm font-bold hover:bg-white hover:shadow-md transition-all"
                      data-testid="link-share-card-mirror"
                    >
                      <Link href="/share-card">
                        <Share2 className="mr-2 h-4 w-4 text-[#3D35CC]" aria-hidden="true" />
                        Share my climb
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
                <MirrorChat disabled={isDemo} />
              </motion.div>
            </>
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <SignalDensityMap map={shownSignalMap} isDemo={signalMapIsDemo} />
        </motion.div>

        <div className="mb-8 mt-16 border-t border-black/5 pt-12 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#3D35CC]/20 to-transparent" />
          <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            Your patterns over time
          </h2>
          <p className="mt-3 max-w-2xl text-base font-medium text-muted-foreground leading-relaxed">
            The deterministic trend view across every audit you have run: what
            keeps coming up as a strength, what keeps coming up as a risk, and how
            your score has moved. No Claude pass on this section.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full rounded-[2rem] bg-white/40" />
            <Skeleton className="h-64 w-full rounded-[2rem] bg-white/40" />
            <Skeleton className="h-64 w-full rounded-[2rem] bg-white/40" />
          </div>
        )}

        {isError && (
          <div className="glass rounded-[2rem] p-8 border-destructive/20 bg-destructive/5 text-center">
            <p className="text-sm font-bold text-destructive">
              Couldn't load your Mirror right now. Try refreshing the page in a moment.
            </p>
          </div>
        )}

        {data && (
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="space-y-8"
          >
            <motion.div variants={fadeUp}>
              <div data-testid="card-headline" className="glass-elevated rounded-[2rem] p-6 md:p-10 relative overflow-hidden group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#3D35CC]/10 to-[#FF2D9B]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl pointer-events-none" />
                <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-center">
                  <div data-testid="readiness-gauge" className="flex flex-col items-center gap-3 shrink-0">
                    <ReadinessGauge score={data.readinessScore} />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground bg-white/50 px-3 py-1 rounded-full border border-white">
                      Readiness
                    </p>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#3D35CC] mb-2">
                      Headline
                    </p>
                    <p className="font-serif text-2xl md:text-3xl font-bold leading-tight text-foreground">
                      {data.headlineInsight}
                    </p>
                    {data.hasEnoughData && (
                      <p className="mt-4 text-sm font-medium text-muted-foreground flex flex-wrap justify-center md:justify-start gap-x-2 gap-y-1">
                        <span className="bg-white/50 px-2.5 py-0.5 rounded-full border border-white/50 shadow-sm">
                          {data.totalAudits} audit{data.totalAudits === 1 ? "" : "s"}
                        </span>
                        {data.spanDays > 0 && (
                          <span className="bg-white/50 px-2.5 py-0.5 rounded-full border border-white/50 shadow-sm">
                            across {data.spanDays} day{data.spanDays === 1 ? "" : "s"}
                          </span>
                        )}
                        {data.engagementWindow.auditsPerMonth > 0 && (
                          <span className="bg-white/50 px-2.5 py-0.5 rounded-full border border-white/50 shadow-sm">
                            ~{data.engagementWindow.auditsPerMonth}/mo
                          </span>
                        )}
                        {data.engagementWindow.mostActiveDay && (
                          <span className="bg-white/50 px-2.5 py-0.5 rounded-full border border-white/50 shadow-sm text-[#3D35CC]">
                            Active {data.engagementWindow.mostActiveDay}s
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {data.scoreHistory.length >= 2 && (
              <motion.div variants={fadeUp}>
                <div data-testid="card-sparkline" className="glass rounded-[2rem] p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h3 className="flex items-center gap-3 font-serif text-xl font-bold text-foreground">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      Score history
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="bg-white/60 px-3 py-1.5 rounded-full border border-white shadow-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Latest vs Prev:</span>
                        <span className={data.scoreDelta.currentVsPrevious > 0 ? "text-emerald-600" : data.scoreDelta.currentVsPrevious < 0 ? "text-rose-600" : "text-foreground"}>
                          {data.scoreDelta.currentVsPrevious > 0 ? "+" : ""}
                          {data.scoreDelta.currentVsPrevious}
                        </span>
                      </span>
                      <span className="bg-white/60 px-3 py-1.5 rounded-full border border-white shadow-sm flex items-center gap-1.5">
                        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">30-Day:</span>
                        <span className={data.scoreDelta.rolling30Delta > 0 ? "text-emerald-600" : data.scoreDelta.rolling30Delta < 0 ? "text-rose-600" : "text-foreground"}>
                          {data.scoreDelta.rolling30Delta > 0 ? "+" : ""}
                          {data.scoreDelta.rolling30Delta}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="h-48 w-full -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.scoreHistory.map((p) => ({
                          score: p.score,
                          date: new Date(p.createdAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          ),
                        }))}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="mirrorScoreFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3D35CC" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#3D35CC" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                          stroke="transparent"
                          tickMargin={12}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                          stroke="transparent"
                          width={40}
                          tickMargin={8}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.5)",
                            borderRadius: "1rem",
                            fontSize: 12,
                            fontWeight: "bold",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                            padding: "12px 16px"
                          }}
                          itemStyle={{ color: "#3D35CC" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#3D35CC"
                          strokeWidth={3}
                          fill="url(#mirrorScoreFill)"
                          activeDot={{ r: 6, fill: "#FF2D9B", stroke: "white", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}

            {data.scoreHistory.length > 0 && (
              <motion.div variants={fadeUp}>
                <div data-testid="card-timeline" className="glass rounded-[2rem] p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-[#3D35CC]" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-foreground">Growth timeline</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {data.scoreHistory.map((p, i) => (
                      <Link
                        key={`pt-${p.auditId ?? i}`}
                        href={p.auditId ? `/report/${p.auditId}` : "/your-mirror"}
                      >
                        <div
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
                          data-testid={`timeline-chip-${i}`}
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#3D35CC] transition-colors" />
                          <span className="text-xs font-bold text-foreground">
                            {new Date(p.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground group-hover:text-[#FF2D9B] transition-colors">· {p.score}</span>
                        </div>
                      </Link>
                    ))}
                    {data.engagementWindow.dormancyGapCount > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-transparent border border-black/5 border-dashed">
                        <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {data.engagementWindow.dormancyGapCount} break{data.engagementWindow.dormancyGapCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <motion.div variants={fadeUp} className="h-full">
                <div data-testid="card-mirror-strengths" className="glass rounded-[2rem] p-6 md:p-8 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-foreground">Consistent strengths</h3>
                  </div>
                  {data.repeatedStrengths.length === 0 ? (
                    <p className="text-sm font-medium text-muted-foreground bg-white/40 p-4 rounded-xl border border-white/50 text-center">
                      No themes have repeated yet. Run another audit to start surfacing your reliable strengths.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.repeatedStrengths.map((s, i) => (
                        <li
                          key={s.key}
                          className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-4 hover:bg-white/60 transition-colors shadow-sm"
                          data-testid={`persistent-strength-${i}`}
                        >
                          <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 border border-emerald-500/20 shrink-0">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{s.label}</p>
                            <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">{s.count}x across audits</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="h-full">
                <div data-testid="card-mirror-risks" className="glass rounded-[2rem] p-6 md:p-8 h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-foreground">Recurring risks</h3>
                  </div>
                  {data.recurringRisks.length === 0 ? (
                    <p className="text-sm font-medium text-muted-foreground bg-white/40 p-4 rounded-xl border border-white/50 text-center">
                      Nothing is recurring as a risk yet, that is a good sign.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.recurringRisks.map((r, i) => (
                        <li
                          key={r.key}
                          className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 p-4 hover:bg-white/60 transition-colors shadow-sm"
                          data-testid={`persistent-risk-${i}`}
                        >
                          <div className="mt-0.5 rounded-full bg-amber-500/20 p-1 border border-amber-500/20 shrink-0">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{r.label}</p>
                            <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">{r.count}x across audits</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            </div>

            {data.themeShifts.length > 0 && (
              <motion.div variants={fadeUp}>
                <div data-testid="card-mirror-shifts" className="glass rounded-[2rem] p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-[#3D35CC]" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-foreground">How you are changing</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.themeShifts.map((s, i) => (
                      <div
                        key={`shift-${i}`}
                        className="flex flex-col rounded-2xl border border-white/60 bg-white/40 p-5 hover:bg-white/60 transition-colors shadow-sm"
                        data-testid={`theme-shift-${i}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#3D35CC] bg-white px-2.5 py-1 rounded-full shadow-sm border border-white">
                            {s.label}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-white/70 px-2.5 py-1 rounded-full border border-white capitalize">
                            {s.direction}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                          <span className="font-bold text-foreground/70">From:</span> {s.from} <br />
                          <span className="font-bold text-foreground/70">To:</span> {s.to}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <motion.div variants={fadeUp} className="h-full">
                <div data-testid="card-last-reflections" className="glass rounded-[2rem] p-6 md:p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <h3 className="flex items-center gap-3 font-serif text-xl font-bold text-foreground">
                      <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-[#3D35CC]" />
                      </div>
                      Last 3 reflections
                    </h3>
                    <Link
                      href="/mirror/journal"
                      className="text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/60 px-3 py-1.5 rounded-full border border-white shadow-sm"
                      data-testid="link-all-reflections"
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="flex-1">
                    {recentReflections.length === 0 ? (
                      <p className="text-sm font-medium text-muted-foreground bg-white/40 p-4 rounded-xl border border-white/50 text-center">
                        No reflections yet. Use the{" "}
                        <Link href="/mirror/journal" className="text-[#3D35CC] font-bold underline-offset-2 hover:underline">
                          Journal
                        </Link>{" "}
                        to log what you actually want.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {recentReflections.map((e) => (
                          <li
                            key={e.id}
                            data-testid={`row-recent-reflection-${e.id}`}
                            className="rounded-2xl border border-white/60 bg-white/40 p-4 hover:bg-white/60 transition-colors shadow-sm"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {fmtShort(e.createdAt)}
                              </span>
                              {e.tags?.slice(0, 2).map((t) => (
                                <span key={t} className="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold text-[#3D35CC] border border-white shadow-sm">
                                  {t}
                                </span>
                              ))}
                            </div>
                            {e.prompt && (
                              <p className="text-sm font-bold text-foreground mb-1 line-clamp-1">
                                {e.prompt}
                              </p>
                            )}
                            <p className="line-clamp-2 text-xs font-medium text-muted-foreground leading-relaxed">{e.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="h-full">
                <div data-testid="card-last-dates" className="glass rounded-[2rem] p-6 md:p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <h3 className="flex items-center gap-3 font-serif text-xl font-bold text-foreground">
                      <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                        <Heart className="h-5 w-5 text-rose-500" />
                      </div>
                      Last 3 dates
                    </h3>
                    <Link
                      href="/mirror/dates"
                      className="text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/60 px-3 py-1.5 rounded-full border border-white shadow-sm"
                      data-testid="link-all-dates"
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="flex-1">
                    {recentDates.length === 0 ? (
                      <p className="text-sm font-medium text-muted-foreground bg-white/40 p-4 rounded-xl border border-white/50 text-center">
                        No post-date notes yet. After your next date, run a{" "}
                        <Link href="/copilot/debrief" className="text-[#3D35CC] font-bold underline-offset-2 hover:underline">
                          Debrief
                        </Link>{" "}
                        to capture what happened.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {recentDates.map((n) => (
                          <li
                            key={n.id}
                            data-testid={`row-recent-date-${n.id}`}
                            className="rounded-2xl border border-white/60 bg-white/40 p-4 hover:bg-white/60 transition-colors shadow-sm"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {fmtShort(n.dateAt ?? n.createdAt)}
                              </span>
                              {n.personLabel && (
                                <span className="px-2 py-0.5 bg-white rounded-full text-[10px] font-bold text-rose-600 border border-white shadow-sm">
                                  {n.personLabel}
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-xs font-medium text-muted-foreground leading-relaxed">{n.summary}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div variants={fadeUp}>
              <div className="glass-strong rounded-[2rem] p-8 md:p-10 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#3D35CC]/5 to-[#FF2D9B]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <h3 className="font-serif text-2xl font-bold text-foreground mb-3">
                    Run another audit to deepen the pattern.
                  </h3>
                  <p className="text-base text-muted-foreground font-medium mb-8 max-w-lg mx-auto">
                    Every audit you add sharpens what the Mirror can show you.
                  </p>
                  <Link href="/start">
                    <Button 
                      data-testid="button-new-audit"
                      className="rounded-full px-8 h-12 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all border-0"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Start a new audit
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
