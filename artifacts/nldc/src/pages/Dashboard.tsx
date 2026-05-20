import { useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAudits,
  useGetAuditSummary,
  getGetAuditSummaryQueryKey,
  useListProfiles,
  useListMessageCoachingSessions,
  useListInsights,
  getListProfilesQueryKey,
  getListMessageCoachingSessionsQueryKey,
  getListInsightsQueryKey,
  getListAuditsQueryKey,
  useDeleteAudit,
  type Audit,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { HandoffShareDialog } from "@/components/HandoffShareDialog";
import { hasAnyAnonymousIds } from "@/lib/anonymousIds";
import {
  ArrowRight, FileText, MessageSquare, Mail, Settings,
  TrendingUp, AlertTriangle, Clock, Sparkles, Trophy, Eye,
  ChevronRight, FlaskConical, Stethoscope, Zap,
  Wand2, ScanFace, BarChart2, Heart, Compass, BookOpen, Camera,
  MessageCircle, User, Map, Brain, Rss, Shield, Users, BarChart, Lightbulb, Layers,
  Calendar, Star, Images, Trash2,
} from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const glowColor = score >= 75 ? "hsl(142 55% 60% / 0.4)" : score >= 55 ? "hsl(43 65% 65% / 0.3)" : "hsl(348 55% 65% / 0.3)";
  return (
    <div className="relative w-36 h-36 mx-auto" data-testid="score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" style={{ filter: `drop-shadow(0 0 18px ${glowColor})` }}>
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke="hsl(232 28% 20%)" fill="none" />
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground" data-testid="score-number">{score}</span>
        <span className="text-[10px] text-muted-foreground font-medium">Signal Score</span>
      </div>
    </div>
  );
}

const SIGNAL_BARS = [
  { label: "Warmth",      value: 78, color: "hsl(348 55% 65%)" },
  { label: "Confidence",  value: 72, color: "hsl(268 52% 68%)" },
  { label: "Specificity", value: 50, color: "hsl(285 45% 65%)" },
  { label: "Playfulness", value: 55, color: "hsl(43 65% 65%)"  },
];

const DEMO_SUMMARY = {
  totalAudits: 2,
  averageScore: 70,
  latestScore: 78,
  scoreHistory: [
    { date: "May 12", score: 61 },
    { date: "May 17", score: 78 },
  ],
  topStrengths: [
    "Genuine warmth and emotional availability",
    "Clear about what you're looking for",
    "Consistency and follow-through",
  ],
  topRisks: [
    "Generic phrases dilute your profile",
    "Opening messages lack specificity",
    "Photo selection needs curation",
  ],
};

const DEMO_AUDITS = [
  { id: 1, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 61, status: "complete", createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
  { id: 2, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 78, status: "complete", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble", "The League"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
];

const HOW_YOU_COME_ACROSS = [
  { label: "You come across as...",             values: ["Genuine", "Thoughtful", "Warm"],            color: "tag-strength border" },
  { label: "You may unintentionally project...", values: ["Slightly guarded", "Generic (pre-audit)"], color: "tag-risk border"     },
  { label: "Your conversation energy is...",     values: ["Curious", "Attentive", "Measured"],        color: "tag-violet border"   },
];

const ACTION_GROUPS = [
  {
    label: "Start Here", color: "hsl(268 52% 68%)",
    items: [
      { icon: FileText,      label: "New Audit",         desc: "Full profile audit + 7-day plan",  href: "/start"          },
      { icon: Camera,        label: "Scan a Profile",    desc: "Screenshot → instant mini-audit",  href: "/scan"           },
      { icon: Zap,           label: "Signal Check",      desc: "3-minute quick read",              href: "/signal-check"   },
    ],
  },
  {
    label: "Profile Tools", color: "hsl(43 65% 65%)",
    items: [
      { icon: Stethoscope,   label: "Dating Diagnosis",  desc: "Find your pattern",                href: "/diagnosis"      },
      { icon: Wand2,         label: "Profile Glow-Up",   desc: "10 rewrites for any platform",     href: "/glow-up"        },
      { icon: ScanFace,      label: "Mirror Profile",    desc: "See yourself as others do",        href: "/mirror"         },
      { icon: User,          label: "Profile Reader",    desc: "Decode someone's profile",         href: "/profile-reader" },
      { icon: Images,        label: "Before & After",    desc: "Sample rewrites by scenario",      href: "/gallery"        },
    ],
  },
  {
    label: "Message Tools", color: "hsl(190 55% 60%)",
    items: [
      { icon: FlaskConical,  label: "Chemistry Lab",     desc: "Analyse a message",                href: "/lab"            },
      { icon: MessageSquare, label: "Message Coach",     desc: "5 styled reply options",           href: "/coach"          },
      { icon: MessageCircle, label: "Next Message",      desc: "7 copy-ready options",             href: "/next-message"   },
      { icon: BarChart2,     label: "Style Map",         desc: "9 dimensions of your style",       href: "/style-map"      },
      { icon: Mail,          label: "Import Patterns",   desc: "Communication style analysis",     href: "/insights"       },
    ],
  },
  {
    label: "Self-Insight", color: "hsl(285 45% 65%)",
    items: [
      { icon: Sparkles,      label: "Signal Type Quiz",  desc: "8 questions → your archetype",     href: "/quiz"                   },
      { icon: BookOpen,      label: "Blueprint",         desc: "Your personalized action plan",    href: "/blueprint"              },
      { icon: Star,          label: "Dating Archetype",  desc: "6-question shareable quiz",        href: "/archetype"              },
      { icon: Heart,         label: "Post-Date Reflect", desc: "Pursue / pause / pass read",       href: "/reflection"             },
      { icon: Eye,           label: "Connection Style",  desc: "Your attachment pattern",          href: "/connection-style"       },
      { icon: Compass,       label: "Compat. Compass",   desc: "Dynamics that support you",        href: "/compatibility-compass"  },
    ],
  },
  {
    label: "Wingman Studio", color: "hsl(348 55% 65%)",
    items: [
      { icon: MessageSquare, label: "Help Me Reply",     desc: "Guided reply workflow",            href: "/copilot/reply"   },
      { icon: Wand2,         label: "Improve Profile",   desc: "Prioritized rewrite plan",         href: "/copilot/profile" },
      { icon: Heart,         label: "Flirt Coach",       desc: "Draft messages for any moment",    href: "/copilot/flirt"   },
      { icon: Calendar,      label: "Prep for a Date",   desc: "Practical pre-date card",          href: "/copilot/prep"    },
    ],
  },
  {
    label: "Growth Tracker", color: "hsl(142 55% 60%)",
    items: [
      { icon: Trophy,        label: "Dating Wins Log",   desc: "Log moments of courage + wins",    href: "/progress/wins"           },
      { icon: Zap,           label: "Pattern Breaker",   desc: "5 actions to shift this week",     href: "/progress/pattern-breaker"},
      { icon: Clock,         label: "My Timeline",       desc: "Log wins, patterns, questions",    href: "/progress/timeline"       },
      { icon: Brain,         label: "Pattern Board",     desc: "Recurring themes",                 href: "/progress/patterns"       },
      { icon: BarChart,      label: "Scorecard",         desc: "7 growth dimension meters",        href: "/progress/scorecard"      },
      { icon: Users,         label: "Companion",         desc: "Copy-ready situation guidance",    href: "/progress/companion"      },
    ],
  },
  {
    label: "Settings & Trust", color: "hsl(228 18% 55%)",
    items: [
      { icon: Heart,         label: "Wellness Center",   desc: "8 dimensions of readiness",        href: "/wellness"        },
      { icon: Layers,        label: "Connection Center", desc: "Bring in context on your terms",   href: "/connections"     },
      { icon: Shield,        label: "Data Vault",        desc: "Preview, export, or delete",       href: "/vault"           },
      { icon: Settings,      label: "Integrations",      desc: "Manage connections",               href: "/integrations"    },
    ],
  },
];

const WINGMAN_NOTES = [
  { note: "Your opener doesn't need to be clever. It needs to be specific. One real detail beats three perfect lines.", action: "Try Next Message", href: "/next-message" },
  { note: "If you haven't messaged them in 3 days, send the re-engage option — low-pressure, no explanation required.", action: "Open Message Coach", href: "/coach" },
  { note: "The bio rewrite that works best is the one that sounds like you'd actually say it out loud.", action: "Profile Glow-Up", href: "/glow-up" },
  { note: "Most people don't 'catch up' — they just start somewhere. What's the one move available to you right now?", action: "See My Plan", href: "/copilot/weekly-plan" },
  { note: "Weekend energy: lower the bar. A short, genuine message beats a perfect long one every time.", action: "Help Me Reply", href: "/copilot/reply" },
  { note: "If something went well this week, log it in your Timeline before the detail fades. Small wins compound.", action: "My Timeline", href: "/progress/timeline" },
  { note: "Specificity is your superpower. The more specific your profile, the more specific the people who match you.", action: "Improve My Profile", href: "/copilot/profile" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function getNextBestAction(latestScore: number, hasRealAudits: boolean) {
  if (!hasRealAudits) {
    return {
      label: "Start Here",
      title: "Get your free Signal Audit",
      desc: "Takes 3 minutes. Get your Signal Score, bio rewrite, and a 7-day action plan.",
      href: "/start",
      color: "hsl(268 52% 68%)",
      cta: "Start My Audit",
    };
  }
  if (latestScore < 55) {
    return {
      label: "Recommended",
      title: "Your score has clear room to grow",
      desc: "Dating Diagnosis will show you exactly what category of issue to fix first — fast.",
      href: "/diagnosis",
      color: "hsl(348 55% 65%)",
      cta: "Run My Diagnosis",
    };
  }
  if (latestScore < 75) {
    return {
      label: "Next Best Move",
      title: "Your profile is solid — now sharpen your messages",
      desc: "Most matches are won or lost in the first few exchanges. Message Coach gets you 3 ready-to-send replies.",
      href: "/coach",
      color: "hsl(43 65% 65%)",
      cta: "Open Message Coach",
    };
  }
  return {
    label: "Keep the Momentum",
    title: "Strong score. Now see how you actually communicate.",
    desc: "Style Map maps 9 dimensions of your communication — warmth, clarity, directness, and more.",
    href: "/style-map",
    color: "hsl(142 55% 60%)",
    cta: "Map My Style",
  };
}

const UNDO_WINDOW_MS = 5000;

export default function Dashboard() {
  useMeta("Your Dashboard", "Your Signal Score history, recent audits, coaching sessions, and quick actions — all in one place.");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const listAuditsKey = getListAuditsQueryKey();
  const { data: audits, isLoading: auditsLoading } = useListAudits();
  const deleteAudit = useDeleteAudit({
    mutation: {
      onError: () => {
        toast({
          title: "Couldn't delete",
          description: "Something went wrong. Try again.",
          variant: "destructive",
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listAuditsKey });
      },
    },
  });

  const pendingRef = useRef<{
    audit: Audit;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const finalizePending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    deleteAudit.mutate({ id: pending.audit.id });
  }, [deleteAudit]);

  const undoPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    const current = queryClient.getQueryData<Audit[]>(listAuditsKey) ?? [];
    if (!current.some((a) => a.id === pending.audit.id)) {
      const restored = [...current, pending.audit].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      queryClient.setQueryData<Audit[]>(listAuditsKey, restored);
    }
  }, [queryClient, listAuditsKey]);

  const handleDeleteAudit = useCallback(
    (audit: Audit) => {
      if (pendingRef.current) finalizePending();
      const previous = queryClient.getQueryData<Audit[]>(listAuditsKey);
      if (previous) {
        queryClient.setQueryData<Audit[]>(
          listAuditsKey,
          previous.filter((a) => a.id !== audit.id),
        );
      }
      const timer = setTimeout(() => finalizePending(), UNDO_WINDOW_MS);
      pendingRef.current = { audit, timer };
      const t = toast({
        title: "Match removed",
        description: `${audit.firstName}'s audit was deleted.`,
        duration: UNDO_WINDOW_MS,
        action: (
          <ToastAction
            altText="Undo delete"
            data-testid={`button-undo-delete-${audit.id}`}
            onClick={() => {
              undoPending();
              t.dismiss();
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    },
    [finalizePending, queryClient, listAuditsKey, toast, undoPending],
  );

  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current = null;
        deleteAudit.mutate({ id: pending.audit.id });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary({
    query: { queryKey: getGetAuditSummaryQueryKey() }
  });
  const { data: profiles, isLoading: profilesLoading } = useListProfiles({
    query: { enabled: isAuthenticated, queryKey: getListProfilesQueryKey() },
  });
  const { data: messageSessions, isLoading: messagesLoading } = useListMessageCoachingSessions({
    query: { enabled: isAuthenticated, queryKey: getListMessageCoachingSessionsQueryKey() },
  });
  const { data: insights, isLoading: insightsLoading } = useListInsights({
    query: { enabled: isAuthenticated, queryKey: getListInsightsQueryKey() },
  });

  const hasRealAudits = !!(audits && audits.length > 0);
  const hasProfiles = !!(profiles && profiles.length > 0);
  const hasMessages = !!(messageSessions && messageSessions.length > 0);
  const hasInsights = !!(insights && insights.length > 0);
  const accountDataLoading =
    auditsLoading || profilesLoading || messagesLoading || insightsLoading;
  const isBrandNewUser =
    isAuthenticated &&
    !accountDataLoading &&
    !hasRealAudits &&
    !hasProfiles &&
    !hasMessages &&
    !hasInsights;
  const showDemo = !isAuthenticated && !hasRealAudits;
  const showHandoffOffer = !isAuthenticated && hasAnyAnonymousIds();
  const displayAudits = hasRealAudits ? audits : showDemo ? DEMO_AUDITS : [];
  const EMPTY_SUMMARY = { totalAudits: 0, averageScore: 0, latestScore: 0, scoreHistory: [], topStrengths: [], topRisks: [] };
  const displaySummary = hasRealAudits ? summary ?? DEMO_SUMMARY : showDemo ? DEMO_SUMMARY : EMPTY_SUMMARY;
  const latestScore = displaySummary.latestScore ?? 0;
  const grade = latestScore >= 85 ? "A" : latestScore >= 72 ? "B" : latestScore >= 58 ? "C" : latestScore >= 42 ? "D" : "F";
  const gradeColor = latestScore >= 75 ? "hsl(142 55% 60%)" : latestScore >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const scoreDelta = (displaySummary.latestScore ?? 0) - (displaySummary.scoreHistory[0]?.score ?? 0);
  const nextAction = getNextBestAction(latestScore, hasRealAudits);
  const latestRealAudit = hasRealAudits ? audits![0] : null;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-50 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-40 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-6 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Welcome back</p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Your Dating Blueprint</h1>
            </div>
            {showHandoffOffer && (
              <div className="flex-shrink-0 pt-1" data-testid="handoff-cta">
                <HandoffShareDialog />
              </div>
            )}
          </motion.div>

          {/* Wingman Note */}
          {(() => {
            const note = WINGMAN_NOTES[new Date().getDay()];
            return (
              <motion.div {...fadeUp(0.03)} className="mb-4">
                <div className="rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-[hsl(268_52%_68%/0.07)] border border-[hsl(268_52%_68%/0.18)]">
                  <Sparkles className="w-4 h-4 text-[hsl(268_52%_72%)] flex-shrink-0 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(268_52%_68%)] mb-0.5">Today's Wingman Note</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{note.note}</p>
                  </div>
                  <Link href={note.href}
                    className="flex-shrink-0 text-xs font-semibold text-[hsl(268_52%_78%)] hover:text-[hsl(268_52%_88%)] transition-colors whitespace-nowrap self-end sm:self-auto">
                    {note.action} →
                  </Link>
                </div>
              </motion.div>
            );
          })()}

          {/* Next Best Action Banner */}
          <motion.div {...fadeUp(0.04)} className="mb-5">
            <div
              className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shimmer"
              style={{
                background: `${nextAction.color.replace(")", " / 0.08)")}`,
                border: `1px solid ${nextAction.color.replace(")", " / 0.25)")}`,
              }}
              data-testid="card-next-best-action"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: nextAction.color.replace(")", " / 0.15)") }}>
                <Lightbulb className="w-4 h-4" style={{ color: nextAction.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: nextAction.color }}>{nextAction.label}</p>
                <p className="font-semibold text-foreground text-sm leading-snug">{nextAction.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nextAction.desc}</p>
              </div>
              <Button asChild size="sm" className="rounded-full px-5 font-semibold border-0 flex-shrink-0 self-start sm:self-auto"
                style={{ background: nextAction.color, color: "hsl(232 38% 7%)" }}>
                <Link href={nextAction.href}>{nextAction.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </motion.div>

          {/* Continue Where You Left Off / Start Here */}
          <motion.div {...fadeUp(0.07)} className="mb-5">
            {hasRealAudits ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Continue where you left off</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Link href={`/report/${latestRealAudit!.id}`} className="glass border border-white/8 rounded-2xl p-4 hover:border-[hsl(268_52%_68%/0.3)] transition-all block card-hover">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-3.5 h-3.5 text-[hsl(268_52%_68%)]" />
                      <span className="text-xs font-semibold text-[hsl(268_52%_78%)]">Latest Report</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{latestRealAudit!.firstName}'s Audit</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Score {latestRealAudit!.readinessScore} · {new Date(latestRealAudit!.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </Link>
                  <Link href="/coach" className="glass border border-white/8 rounded-2xl p-4 hover:border-[hsl(285_45%_62%/0.3)] transition-all block card-hover">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-[hsl(285_45%_65%)]" />
                      <span className="text-xs font-semibold text-[hsl(285_52%_78%)]">Message Coach</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">Coach a reply</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Paste a conversation → 3 styled options</p>
                  </Link>
                  <Link href="/progress/timeline" className="glass border border-white/8 rounded-2xl p-4 hover:border-[hsl(190_55%_60%/0.3)] transition-all block card-hover">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-[hsl(190_55%_60%)]" />
                      <span className="text-xs font-semibold text-[hsl(190_55%_72%)]">My Timeline</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">Log a note</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Track wins, questions, patterns</p>
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Start here — 3 steps to your baseline</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { n: "1", title: "Get your Signal Audit", desc: "3 minutes · Free · Instant score", href: "/start", color: "hsl(268 52% 68%)", icon: Sparkles },
                    { n: "2", title: "Build your Blueprint", desc: "Self-insight in 4 questions", href: "/blueprint", color: "hsl(43 65% 65%)", icon: BookOpen },
                    { n: "3", title: "Check your Wellness", desc: "8 dimensions of readiness", href: "/wellness", color: "hsl(142 55% 60%)", icon: Heart },
                  ].map(step => {
                    const Icon = step.icon;
                    return (
                      <Link key={step.n} href={step.href} className="glass border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all block card-hover">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: step.color }}>Step {step.n}</span>
                          <Icon className="w-3.5 h-3.5" style={{ color: step.color }} />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {isBrandNewUser && (
            <motion.div {...fadeUp(0.1)} className="mb-5" data-testid="dashboard-empty-state">
              <div className="relative rounded-3xl p-6 sm:p-10 text-center overflow-hidden shimmer"
                style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.12), hsl(285 45% 60% / 0.08), hsl(43 65% 62% / 0.06))" }}>
                <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
                <div className="orb orb-violet absolute w-64 h-64 -right-20 -top-20 opacity-50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-[hsl(268_52%_68%/0.15)] border border-[hsl(268_52%_68%/0.25)] mx-auto mb-4 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[hsl(268_52%_78%)]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-2">Welcome to Next Level Dating Club</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Your dashboard is ready for its first signal</h2>
                  <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm leading-relaxed">
                    Start your free Signal Audit and we'll fill this page with your real score, strengths, growth areas, and a 7-day action plan — all in about 3 minutes.
                  </p>
                  <Button asChild className="rounded-full px-8 bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold" data-testid="button-empty-state-start-audit">
                    <Link href="/start">Start My First Audit <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <p className="text-[11px] text-muted-foreground/70 mt-4">Free · No credit card · Takes 3 minutes</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Signal Score + History */}
          {!isBrandNewUser && (<>
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Score Card */}
            <motion.div {...fadeUp(0.07)}
              className="mirror-card rounded-3xl p-6 flex flex-col items-center text-center shimmer"
              data-testid="card-readiness-score">
              <div className="line-accent w-full mb-4" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Signal Score</p>
              {summaryLoading ? <Skeleton className="w-36 h-36 rounded-full" /> : <ScoreRing score={latestScore} />}
              <p className="text-5xl font-bold mt-3" style={{ color: gradeColor }} data-testid="grade-letter">{grade}</p>
              <p className="text-xs text-muted-foreground mt-1">Profile grade</p>
              {!hasRealAudits && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground/50 mt-2 inline-block">Example data</span>
              )}
              {scoreDelta > 0 && (
                <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-[hsl(142_55%_45%/0.12)] border border-[hsl(142_55%_45%/0.2)]">
                  <TrendingUp className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" />
                  <span className="text-xs font-semibold text-[hsl(142_55%_60%)]">+{scoreDelta} pts</span>
                </div>
              )}
            </motion.div>

            {/* Score History */}
            <motion.div {...fadeUp(0.1)} className="glass border border-white/8 rounded-3xl p-5 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-foreground text-sm">Score History</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your progress over time</p>
                </div>
                {scoreDelta > 0 && (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(142_55%_60%)]">
                    <TrendingUp className="w-4 h-4" /> +{scoreDelta} pts
                  </div>
                )}
              </div>
              {summaryLoading ? <Skeleton className="h-28 w-full rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={displaySummary.scoreHistory} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(228 18% 55%)" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(232 34% 11%)", border: "1px solid hsl(232 28% 22%)", borderRadius: "12px", fontSize: "12px", color: "hsl(220 30% 94%)" }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(268 52% 68%)" strokeWidth={3}
                      dot={{ r: 5, fill: "hsl(268 52% 68%)", stroke: "hsl(232 38% 7%)", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {displaySummary.scoreHistory.length < 2 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Complete a second audit to track your progress curve</p>
              )}
              <div className="mt-4 pt-4 border-t border-white/6">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Top Signal Dimensions</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {SIGNAL_BARS.map((bar, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{bar.label}</span>
                        <span className="font-semibold" style={{ color: bar.color }}>{bar.value}</span>
                      </div>
                      <div className="signal-bar-track">
                        <div className="signal-bar-fill" style={{ width: `${bar.value}%`, background: bar.color, animationDelay: `${i * 0.1}s` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* How You're Coming Across */}
          <motion.div {...fadeUp(0.13)} className="glass border border-white/8 rounded-3xl p-5 sm:p-6 mb-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Eye className="w-4 h-4 text-[hsl(268_52%_68%)]" />
              <h2 className="font-semibold text-foreground text-sm">How You're Coming Across</h2>
              <span className="ml-auto text-xs text-muted-foreground">Based on latest audit</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {HOW_YOU_COME_ACROSS.map((group, i) => (
                <div key={i}>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.values.map((v, j) => (
                      <span key={j} className={`px-2.5 py-1 rounded-full text-xs font-medium ${group.color}`}>{v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Strengths + Growth */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <motion.div {...fadeUp(0.16)} className="glass border border-white/8 rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-[hsl(142_55%_60%)]" />
                <p className="font-semibold text-foreground text-sm">Your Strengths</p>
              </div>
              {summaryLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full rounded-full" />)}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySummary.topStrengths.map((s, i) => (
                    <span key={i} className="tag-strength border px-2.5 py-1 rounded-full text-xs font-medium" data-testid={`badge-strength-${i}`}>{s}</span>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div {...fadeUp(0.19)} className="glass border border-white/8 rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-[hsl(43_65%_65%)]" />
                <p className="font-semibold text-foreground text-sm">Growth Areas</p>
              </div>
              {summaryLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full rounded-full" />)}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySummary.topRisks.map((r, i) => (
                    <span key={i} className="tag-risk border px-2.5 py-1 rounded-full text-xs font-medium" data-testid={`badge-risk-${i}`}>{r}</span>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
          </>)}

          {/* Quick Actions — Grouped */}
          <motion.div {...fadeUp(0.22)} className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-foreground text-sm">Your Tools</p>
              <Link href="/copilot">
                <span className="text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex items-center gap-1">
                  Wingman Studio <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="space-y-5">
              {ACTION_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5 px-0.5" style={{ color: group.color }}>{group.label}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {group.items.map((action, i) => (
                      <Link key={i} href={action.href} data-testid={`card-quick-action-${action.label.toLowerCase().replace(/ /g, "-")}`}>
                        <div className="glass border border-white/8 rounded-2xl p-3 hover:border-[hsl(268_52%_68%/0.3)] hover:shadow-[0_8px_30px_rgb(0_0_0/0.35)] transition-all cursor-pointer h-full card-hover">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2" style={{ background: `${group.color.replace(")", " / 0.12)")}` }}>
                            <action.icon className="w-3.5 h-3.5" style={{ color: group.color }} />
                          </div>
                          <p className="font-semibold text-foreground text-xs leading-tight">{action.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">{action.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Audits */}
          {!isBrandNewUser && (
          <motion.div {...fadeUp(0.26)} className="glass border border-white/8 rounded-3xl p-5 sm:p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground text-sm">Recent Audits</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" data-testid="button-new-audit">
                <Link href="/start">New Audit <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            {auditsLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
            ) : !hasRealAudits ? (
              <div className="text-center py-10" data-testid="audits-empty-state">
                <div className="w-14 h-14 rounded-full bg-[hsl(268_52%_68%/0.1)] mx-auto mb-3 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[hsl(268_52%_78%)]" />
                </div>
                <p className="font-semibold text-foreground mb-1">No audits yet</p>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">Your first audit sets the baseline — Signal Score, bio critique, and a 7-day action plan.</p>
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold" data-testid="button-start-first-audit">
                  <Link href="/start">Get My Free Signal Audit <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {audits!.map((audit) => {
                  const score = audit.readinessScore ?? 0;
                  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
                  const bg    = score >= 75 ? "hsl(142 55% 45% / 0.12)" : score >= 55 ? "hsl(43 65% 55% / 0.12)" : "hsl(348 55% 55% / 0.12)";
                  const date  = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <div
                      key={audit.id}
                      className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-white/6 hover:border-[hsl(268_52%_68%/0.25)] hover:bg-white/2 transition-all card-hover gap-3"
                      data-testid={`row-audit-${audit.id}`}
                    >
                      <Link href={`/report/${audit.id}`} className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: bg, color }}>
                          {score}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{audit.firstName}'s Signal Audit</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 flex-shrink-0" /> {date}
                            <span className="hidden sm:inline">· {audit.currentApps?.join(", ")}</span>
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${audit.status === "complete" ? "tag-strength border" : "tag-risk border"}`}>{audit.status}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAudit(audit)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_55%/0.12)] transition-colors"
                          aria-label={`Delete ${audit.firstName}'s audit`}
                          data-testid={`button-delete-audit-${audit.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link href={`/report/${audit.id}`} aria-hidden="true" tabIndex={-1} className="text-muted-foreground">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
          )}

          {/* Upgrade CTA */}
          <motion.div {...fadeUp(0.3)}
            className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.15), hsl(285 45% 60% / 0.1), hsl(43 65% 62% / 0.08))" }}
            data-testid="card-upgrade-cta">
            <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
            <div className="orb orb-violet absolute w-64 h-64 -right-20 -top-20 opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <div className="line-accent max-w-xs mx-auto mb-4" />
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-2">Unlock Everything</p>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">Ready for The Dating Reset?</h3>
              <p className="text-muted-foreground mb-5 max-w-lg mx-auto text-sm leading-relaxed">
                Complete profile rewrite, Signal Spectrum, Dating Diagnosis, Chemistry Lab, and a 7-day action plan. One payment.
              </p>
              <Button asChild className="rounded-full px-8 bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse" data-testid="button-upgrade-cta">
                <Link href="/pricing">The Dating Reset — $97 <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
