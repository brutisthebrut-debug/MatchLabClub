import { withAlpha } from "@/lib/brandColor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAudits,
  useGetAuditSummary,
  useBulkDeleteAudits,
  getGetAuditSummaryQueryKey,
  getListAuditsQueryKey,
  useListProfiles,
  useListMessageCoachingSessions,
  useListInsights,
  getListProfilesQueryKey,
  getListMessageCoachingSessionsQueryKey,
  getListInsightsQueryKey,
  useDeleteAudit,
  generateAuditReport,
  deleteAudit as deleteAuditRequest,
  useListExpiringTrashedAudits,
  getListExpiringTrashedAuditsQueryKey,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useGetMatchingBenchmarks,
  getGetMatchingBenchmarksQueryKey,
  type Audit,
  type ListAuditsParams,
} from "@workspace/api-client-react";
import { ReadinessDeltaCard } from "@/components/ReadinessDeltaCard";
import { SampleDataBadge } from "@/components/SampleDataBadge";
import { MatchBenchmarkCard } from "@/components/MatchBenchmarkCard";
import { useAuth } from "@workspace/replit-auth-web";
import {
  recordPendingAuditDelete,
  clearPendingAuditDelete,
  drainPendingAuditDeletes,
} from "@/lib/pendingAuditDeletes";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, Area, AreaChart, YAxis, CartesianGrid } from "recharts";
import { HandoffShareDialog } from "@/components/HandoffShareDialog";
import { WelcomePanel } from "@/components/WelcomePanel";
import { ToolHandoff } from "@/components/ToolHandoff";
import { FeatureHub } from "@/components/FeatureHub";
import { hasAnyAnonymousIds } from "@/lib/anonymousIds";
import { readSavedProgressEntries, type ProgressEntryLike } from "@/lib/contextBuilder";
import {
  AUTO_REFRESH_BATCH_SIZE,
  hasSwept,
  loadAutoRefreshPref,
  markSwept,
} from "@/lib/autoRefreshPref";
import {
  clearSkippedAuditIds,
  loadSkippedAuditIds,
  saveSkippedAuditIds,
} from "@/lib/skippedRefreshAudits";
import {
  dismissDashboardBanner,
  isDashboardBannerDismissed,
  loadTrashReminderPref,
} from "@/lib/trashReminderPref";
import {
  ArrowRight, FileText, MessageSquare, Mail, Settings,
  TrendingUp, AlertTriangle, Clock, Sparkles, Trophy, Eye,
  ChevronRight, FlaskConical, Stethoscope, Zap, Gauge,
  Wand2, ScanFace, BarChart2, Heart, Compass, BookOpen, Camera,
  MessageCircle, User, Map, Brain, Rss, Shield, Users, BarChart, Lightbulb, Layers,
  Calendar, Star, Images, Trash2, RefreshCw, Search, X, ShieldAlert,
  ArrowUpRight, Play, CheckCircle2, AlertCircle, History
} from "lucide-react";

function formatRelativeTimestamp(iso: string | undefined | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type AuditSort = "newest" | "topScore";
type AuditScoreRange = "all" | "low" | "medium" | "high";

const STALE_REPORT_MS = 30 * 24 * 60 * 60 * 1000;

function staleHintFromGeneratedAt(generatedAt: string | null | undefined): string | null {
  if (!generatedAt) return null;
  const t = new Date(generatedAt).getTime();
  if (Number.isNaN(t)) return null;
  const age = Date.now() - t;
  if (age < STALE_REPORT_MS) return null;
  const weeks = Math.floor(age / (7 * 24 * 60 * 60 * 1000));
  if (weeks >= 52) {
    const years = Math.floor(weeks / 52);
    return `Report from ${years === 1 ? "a year" : `${years} years`} ago`;
  }
  if (weeks >= 8) {
    const months = Math.floor(weeks / 4);
    return `Report from ${months} months ago`;
  }
  return `Report from ${weeks} weeks ago`;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(var(--brand-green))" : score >= 55 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";
  const glowColor = score >= 75 ? "hsl(var(--brand-green) / 0.6)" : score >= 55 ? "hsl(var(--brand-gold) / 0.5)" : "hsl(var(--brand-rose) / 0.5)";
  
  return (
    <div className="relative w-40 h-40 mx-auto group" data-testid="score-ring">
      <div className="absolute inset-0 rounded-full blur-[40px] opacity-40 mix-blend-screen transition-opacity duration-700 group-hover:opacity-70" style={{ background: color }} />
      <svg className="w-full h-full -rotate-90 relative z-10 drop-shadow-xl" viewBox="0 0 140 140" style={{ filter: `drop-shadow(0 0 20px ${glowColor})` }}>
        <circle cx="70" cy="70" r={radius} strokeWidth="12" stroke="hsl(248 40% 92%)" className="dark:stroke-white/10" fill="none" />
        <circle cx="70" cy="70" r={radius} strokeWidth="12" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-4xl font-black text-foreground tracking-tighter" data-testid="score-number">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold mt-1">Score</span>
      </div>
    </div>
  );
}

const SIGNAL_BARS = [
  { label: "Warmth", value: 78, color: "hsl(var(--brand-rose))" },
  { label: "Confidence", value: 72, color: "hsl(var(--brand-indigo))" },
  { label: "Specificity", value: 50, color: "hsl(326 100% 65%)" },
  { label: "Playfulness", value: 55, color: "hsl(var(--brand-gold))" },
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

const DEMO_AUDITS: Audit[] = [
  { id: 1, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 61, status: "complete", source: "manual", createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
  { id: 2, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 78, status: "complete", source: "manual", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble", "The League"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
];

const HOW_YOU_COME_ACROSS = [
  { label: "You come across as...", values: ["Genuine", "Thoughtful", "Warm"], color: "tag-strength border border-white/10" },
  { label: "You may unintentionally project...", values: ["Slightly guarded", "Generic (pre-audit)"], color: "tag-risk border border-white/10" },
  { label: "Your conversation energy is...", values: ["Curious", "Attentive", "Measured"], color: "tag-violet border border-white/10" },
];

const ACTION_GROUPS = [
  {
    label: "Core Tools", color: "hsl(var(--brand-indigo))",
    items: [
      { icon: FileText, label: "New Audit", desc: "Full profile audit + 7-day plan", href: "/start" },
      { icon: Camera, label: "Scan a Profile", desc: "Screenshot → instant mini-audit", href: "/scan" },
      { icon: Zap, label: "Signal Check", desc: "3-minute quick read", href: "/signal-check" },
    ],
  },
  {
    label: "Profile Tools", color: "hsl(var(--brand-gold))",
    items: [
      { icon: Stethoscope, label: "Dating Diagnosis", desc: "Find your pattern", href: "/signal-check" },
      { icon: Wand2, label: "Profile Glow-Up", desc: "10 rewrites for any platform", href: "/glow-up" },
      { icon: ScanFace, label: "Profile Reflection", desc: "See yourself as others do", href: "/mirror" },
      { icon: User, label: "Profile Reader", desc: "Decode someone's profile", href: "/profile-reader" },
      { icon: Images, label: "Before & After", desc: "Sample rewrites by scenario", href: "/gallery" },
    ],
  },
  {
    label: "Message Lab", color: "hsl(190 55% 60%)",
    items: [
      { icon: FlaskConical, label: "Chemistry Lab", desc: "Analyse a message", href: "/lab" },
      { icon: MessageSquare, label: "Message Coach", desc: "5 styled reply options", href: "/coach" },
      { icon: MessageCircle, label: "Next Message", desc: "7 copy-ready options", href: "/next-message" },
      { icon: BarChart2, label: "Style Map", desc: "9 dimensions of your style", href: "/style-map" },
      { icon: Mail, label: "Import Patterns", desc: "Communication style analysis", href: "/insights" },
    ],
  },
  {
    label: "Self-Insight", color: "hsl(326 100% 65%)",
    items: [
      { icon: Sparkles, label: "Signal Type Quiz", desc: "8 questions → your archetype", href: "/quiz" },
      { icon: BookOpen, label: "Blueprint", desc: "Your personalized action plan", href: "/blueprint" },
      { icon: Star, label: "Dating Archetype", desc: "6-question shareable quiz", href: "/archetype" },
      { icon: Heart, label: "Post-Date Reflect", desc: "Pursue / pause / pass read", href: "/reflection" },
      { icon: Eye, label: "Connection Style", desc: "Your attachment pattern", href: "/connection-style" },
      { icon: Compass, label: "Compat. Compass", desc: "Dynamics that support you", href: "/compatibility-compass" },
    ],
  },
  {
    label: "Wingman Studio", color: "hsl(var(--brand-rose))",
    items: [
      { icon: MessageSquare, label: "Help Me Reply", desc: "Guided reply workflow", href: "/copilot/reply" },
      { icon: Wand2, label: "Improve Profile", desc: "Prioritized rewrite plan", href: "/copilot/profile" },
      { icon: Heart, label: "Flirt Coach", desc: "Draft messages for any moment", href: "/copilot/flirt" },
      { icon: Calendar, label: "Prep for a Date", desc: "Practical pre-date card", href: "/copilot/prep" },
    ],
  },
  {
    label: "Growth Tracker", color: "hsl(var(--brand-green))",
    items: [
      { icon: Sparkles, label: "Your Mirror", desc: "Patterns across every audit", href: "/your-mirror" },
      { icon: Trophy, label: "Dating Wins Log", desc: "Log moments of courage + wins", href: "/progress/wins" },
      { icon: Zap, label: "Pattern Breaker", desc: "5 actions to shift this week", href: "/progress/pattern-breaker"},
      { icon: Clock, label: "My Timeline", desc: "Log wins, patterns, questions", href: "/progress/timeline" },
      { icon: Brain, label: "Pattern Board", desc: "Recurring themes", href: "/progress/patterns" },
      { icon: BarChart, label: "Scorecard", desc: "7 growth dimension meters", href: "/progress/scorecard" },
      { icon: Users, label: "Companion", desc: "Copy-ready situation guidance", href: "/progress/companion" },
      { icon: RefreshCw, label: "What Changed?", desc: "Quick check-in on progress", href: "/copilot/what-changed" },
    ],
  },
  {
    label: "Context & Trust", color: "hsl(228 18% 55%)",
    items: [
      { icon: Heart, label: "Wellness Center", desc: "8 dimensions of readiness", href: "/wellness" },
      { icon: Layers, label: "Connection Center", desc: "Bring in context on your terms", href: "/connections" },
      { icon: Shield, label: "Data Vault", desc: "Preview, export, or delete", href: "/vault" },
      { icon: Settings, label: "Integrations", desc: "Manage connections", href: "/integrations" },
      { icon: Star, label: "Beta Feedback", desc: "Help shape what gets built", href: "/feedback" },
    ],
  },
];

const WINGMAN_NOTES = [
  { note: "Your opener doesn't need to be clever. It needs to be specific. One real detail beats three perfect lines.", action: "Try Next Message", href: "/next-message" },
  { note: "If you haven't messaged them in 3 days, send the re-engage option. Low-pressure, no explanation required.", action: "Open Message Coach", href: "/coach" },
  { note: "The bio rewrite that works best is the one that sounds like you'd actually say it out loud.", action: "Profile Glow-Up", href: "/glow-up" },
  { note: "Most people don't 'catch up'. They just start somewhere. What's the one move available to you right now?", action: "See My Plan", href: "/copilot/weekly-plan" },
  { note: "Weekend energy: lower the bar. A short, genuine message beats a perfect long one every time.", action: "Help Me Reply", href: "/copilot/reply" },
  { note: "If something went well this week, log it in your Timeline before the detail fades. Small wins compound.", action: "My Timeline", href: "/progress/timeline" },
  { note: "Specificity is your superpower. The more specific your profile, the more specific the people who match you.", action: "Improve My Profile", href: "/copilot/profile" },
];

const PACKAGE_CARDS = [
  {
    name: "The Dating Reset",
    tagline: "Find exactly what to fix: score, bio rewrite, and 7-day plan.",
    hint: "Start with a free Signal Check →",
    hintHref: "/signal-check",
    color: "hsl(var(--brand-indigo))",
    icon: BookOpen,
    hubHref: "/signal-check",
    tools: [
      { label: "Signal Check", href: "/signal-check" },
      { label: "Dating Blueprint", href: "/blueprint" },
      { label: "Profile Glow-Up", href: "/glow-up" },
    ],
  },
  {
    name: "Message Lab",
    tagline: "Turn any conversation into a clear next move. Replies ready to copy.",
    hint: "Start with Chemistry Lab →",
    hintHref: "/lab",
    color: "hsl(190 55% 60%)",
    icon: MessageSquare,
    hubHref: "/lab",
    tools: [
      { label: "Message Coach", href: "/coach" },
      { label: "Next Message", href: "/next-message" },
      { label: "Style Map", href: "/style-map" },
    ],
  },
  {
    name: "Growth Tracker",
    tagline: "Log wins, spot patterns, and break the habits holding you back.",
    hint: "Start with Wins Log →",
    hintHref: "/progress/wins",
    color: "hsl(var(--brand-green))",
    icon: TrendingUp,
    hubHref: "/progress/timeline",
    tools: [
      { label: "Dating Wins Log", href: "/progress/wins" },
      { label: "Pattern Breaker", href: "/progress/pattern-breaker" },
      { label: "Weekly Growth Plan", href: "/copilot/weekly-plan" },
    ],
  },
  {
    name: "Context + Trust",
    tagline: "Build your compatibility profile: 18 dimensions, consent-first, coaching by default.",
    hint: "Build Compatibility Profile →",
    hintHref: "/wellness",
    color: "hsl(228 30% 62%)",
    icon: Shield,
    hubHref: "/wellness",
    tools: [
      { label: "Compatibility Profile", href: "/wellness" },
      { label: "Future Matching", href: "/future-connections" },
      { label: "Data Vault", href: "/vault" },
      { label: "User Control", href: "/user-control" },
    ],
  },
] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function getNextBestAction(latestScore: number, hasRealAudits: boolean) {
  if (!hasRealAudits) {
    return {
      label: "Your Move",
      title: "Let's get my first real read on you",
      desc: "Give me three minutes and I'll hand you back your Signal Score, a bio rewrite, and a 7-day plan.",
      href: "/start",
      color: "hsl(var(--brand-indigo))",
      cta: "Start My Audit",
      icon: Sparkles
    };
  }
  if (latestScore < 55) {
    return {
      label: "Recommended",
      title: "I think we can move this number",
      desc: "Run a free Signal Check and I'll show you exactly which thing to fix first. It's quick.",
      href: "/signal-check",
      color: "hsl(var(--brand-rose))",
      cta: "Run My Signal Check",
      icon: AlertCircle
    };
  }
  if (latestScore < 75) {
    return {
      label: "Next Best Move",
      title: "Your profile is solid. Let's sharpen your messages",
      desc: "Most matches are won or lost in the first few exchanges. Bring me a chat and I'll get you 3 ready-to-send replies.",
      href: "/coach",
      color: "hsl(var(--brand-gold))",
      cta: "Open Message Coach",
      icon: MessageSquare
    };
  }
  return {
    label: "Keep the Momentum",
    title: "Strong score. Let's look at how you actually communicate.",
    desc: "Style Map reads 9 dimensions of how you come across: warmth, clarity, directness, and more.",
    href: "/style-map",
    color: "hsl(var(--brand-green))",
    cta: "Map My Style",
    icon: Compass
  };
}

const UNDO_WINDOW_MS = 5000;

const VALID_SORTS: AuditSort[] = ["newest", "topScore"];
const VALID_RANGES: AuditScoreRange[] = ["all", "low", "medium", "high"];

function parseAuditFiltersFromSearch(search: string): {
  searchInput: string;
  sort: AuditSort;
  scoreRange: AuditScoreRange;
} {
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? "";
  const sortParam = params.get("sort") ?? "";
  const rangeParam = params.get("range") ?? "";
  const sort: AuditSort = (VALID_SORTS as string[]).includes(sortParam)
    ? (sortParam as AuditSort)
    : "newest";
  const scoreRange: AuditScoreRange = (VALID_RANGES as string[]).includes(rangeParam)
    ? (rangeParam as AuditScoreRange)
    : "all";
  return { searchInput: q, sort, scoreRange };
}

export default function Dashboard() {
  useMeta("Your Dashboard", "Your Match Readiness, recent audits, coaching sessions, and quick actions, all in one place.");
  const { isAuthenticated, user } = useAuth();
  const firstName = user?.firstName?.trim() || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 50;

  const rawSearch = useSearch();
  const [, navigate] = useLocation();

  const [showAllTools, setShowAllTools] = useState(false);

  const [searchInput, setSearchInput] = useState<string>(
    () => parseAuditFiltersFromSearch(rawSearch).searchInput,
  );
  const [sort, setSort] = useState<AuditSort>(
    () => parseAuditFiltersFromSearch(rawSearch).sort,
  );
  const [scoreRange, setScoreRange] = useState<AuditScoreRange>(
    () => parseAuditFiltersFromSearch(rawSearch).scoreRange,
  );

  const debouncedQuery = useDebouncedValue(searchInput.trim(), 250);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (sort !== "newest") params.set("sort", sort);
    if (scoreRange !== "all") params.set("range", scoreRange);
    const newSearch = params.toString();
    const target = newSearch ? `/dashboard?${newSearch}` : "/dashboard";
    navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sort, scoreRange]);

  const filtersActive = debouncedQuery.length > 0 || sort !== "newest" || scoreRange !== "all";
  const filterParams = useMemo<ListAuditsParams>(
    () => ({
      sort,
      ...(debouncedQuery.length > 0 ? { q: debouncedQuery } : {}),
      ...(scoreRange !== "all" ? { scoreRange } : {}),
    }),
    [sort, debouncedQuery, scoreRange],
  );

  const listAuditsKey = useMemo(
    () => [...getListAuditsQueryKey(filterParams), "infinite", PAGE_SIZE] as const,
    [filterParams],
  );
  
  const {
    data: auditsData,
    isLoading: auditsLoading,
    isError: auditsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: listAuditsKey,
    queryFn: ({ pageParam = 0, signal }) =>
      listAudits(
        { ...filterParams, limit: PAGE_SIZE, offset: pageParam as number },
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE
        ? undefined
        : allPages.reduce((sum, p) => sum + p.length, 0),
  });

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setSort("newest");
    setScoreRange("all");
  }, []);
  
  const audits = useMemo<Audit[] | undefined>(
    () => (auditsData ? auditsData.pages.flat() : undefined),
    [auditsData],
  );

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const lastClickedIdRef = useRef<number | null>(null);

  const toggleSelected = (id: number) => {
    lastClickedIdRef.current = id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    lastClickedIdRef.current = null;
  };
  
  const enterSelectionMode = () => {
    setSelectionMode(true);
    lastClickedIdRef.current = null;
  };
  
  const selectRangeTo = (id: number, visibleIds: number[]) => {
    const anchor = lastClickedIdRef.current;
    if (anchor === null || anchor === id) {
      toggleSelected(id);
      return;
    }
    const startIdx = visibleIds.indexOf(anchor);
    const endIdx = visibleIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) {
      toggleSelected(id);
      return;
    }
    const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const rangeIds = visibleIds.slice(lo, hi + 1);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const rid of rangeIds) next.add(rid);
      return next;
    });
    lastClickedIdRef.current = id;
  };

  const staleAudits = useMemo(
    () => (audits ?? []).filter((a) => staleHintFromGeneratedAt(a.reportGeneratedAt) !== null),
    [audits],
  );

  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(() => new Set());
  const handleRefreshOne = useCallback(
    async (audit: Audit) => {
      if (refreshingIds.has(audit.id)) return;
      setRefreshingIds((prev) => new Set(prev).add(audit.id));
      try {
        await generateAuditReport(audit.id);
        clearSkippedAuditIds([audit.id]);
        await queryClient.invalidateQueries({ queryKey: listAuditsKey });
        await queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
      } catch {
        toast({ title: "Couldn't refresh", description: "Something went wrong. Try again.", variant: "destructive" });
      } finally {
        setRefreshingIds((prev) => { const next = new Set(prev); next.delete(audit.id); return next; });
      }
    },
    [refreshingIds, queryClient, listAuditsKey, toast],
  );

  const [refreshState, setRefreshState] = useState<{
    inProgress: boolean;
    done: number;
    total: number;
    failed: number;
  }>({ inProgress: false, done: 0, total: 0, failed: 0 });

  const refreshAudits = useCallback(
    async (items: Audit[]) => {
      if (refreshState.inProgress || items.length === 0) return;
      setRefreshState({ inProgress: true, done: 0, total: items.length, failed: 0 });
      let done = 0;
      let failed = 0;
      for (const audit of items) {
        setRefreshingIds((prev) => new Set(prev).add(audit.id));
        try {
          await generateAuditReport(audit.id);
        } catch {
          failed++;
        } finally {
          done++;
          setRefreshState((prev) => ({ ...prev, done, failed }));
          setRefreshingIds((prev) => {
            const next = new Set(prev);
            next.delete(audit.id);
            return next;
          });
        }
      }
      clearSkippedAuditIds(items.map((a) => a.id));
      await queryClient.invalidateQueries({ queryKey: listAuditsKey });
      await queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
      toast({
        title: "Refresh complete",
        description: `Refreshed ${done - failed} reports.${failed > 0 ? ` (${failed} failed)` : ""}`,
      });
      setRefreshState({ inProgress: false, done: 0, total: 0, failed: 0 });
    },
    [listAuditsKey, queryClient, refreshState.inProgress, toast],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<Audit["id"]>>(
    new Set(),
  );
  const [pickerSort, setPickerSort] = useState<"score" | "oldest" | "newest">("score");
  const sortedStaleAudits = useMemo(() => {
    const arr = [...staleAudits];
    if (pickerSort === "score") {
      return arr.sort((a, b) => {
        const sa = a.readinessScore ?? -1;
        const sb = b.readinessScore ?? -1;
        if (sb !== sa) return sb - sa;
        const ta = a.reportGeneratedAt ? new Date(a.reportGeneratedAt).getTime() : 0;
        const tb = b.reportGeneratedAt ? new Date(b.reportGeneratedAt).getTime() : 0;
        return ta - tb;
      });
    }
    if (pickerSort === "oldest") {
      return arr.sort((a, b) => {
        const ta = a.reportGeneratedAt ? new Date(a.reportGeneratedAt).getTime() : 0;
        const tb = b.reportGeneratedAt ? new Date(b.reportGeneratedAt).getTime() : 0;
        return ta - tb;
      });
    }
    return arr.sort((a, b) => {
      const ta = a.reportGeneratedAt ? new Date(a.reportGeneratedAt).getTime() : 0;
      const tb = b.reportGeneratedAt ? new Date(b.reportGeneratedAt).getTime() : 0;
      return tb - ta;
    });
  }, [staleAudits, pickerSort]);
  const openRefreshPicker = useCallback(() => {
    const skipped = loadSkippedAuditIds();
    const initialSelected = new Set(
      staleAudits.filter((a) => !skipped.has(a.id)).map((a) => a.id),
    );
    setPickerSelected(initialSelected);
    setPickerSort("score");
    setPickerOpen(true);
  }, [staleAudits]);
  const togglePickerSelected = useCallback((id: Audit["id"]) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const confirmRefreshPicker = useCallback(async () => {
    const chosen = staleAudits.filter((a) => pickerSelected.has(a.id));
    const skippedIds = new Set(
      staleAudits.filter((a) => !pickerSelected.has(a.id)).map((a) => a.id),
    );
    saveSkippedAuditIds(skippedIds);
    setPickerOpen(false);
    await refreshAudits(chosen);
    clearSkippedAuditIds(chosen.map((a) => a.id));
  }, [staleAudits, pickerSelected, refreshAudits]);

  const [autoRefreshState, setAutoRefreshState] = useState<{
    inProgress: boolean;
    done: number;
    total: number;
    failed: number;
  }>({ inProgress: false, done: 0, total: 0, failed: 0 });

  useEffect(() => {
    if (!isAuthenticated || !audits) return;
    if (autoRefreshState.inProgress || hasSwept()) return;
    if (!loadAutoRefreshPref()) {
      return;
    }
    const skippedIds = loadSkippedAuditIds();
    const toRefresh = audits
      .filter((a) => {
        if (staleHintFromGeneratedAt(a.reportGeneratedAt) === null) return false;
        if (a.status !== "complete") return false;
        if (skippedIds.has(a.id)) return false;
        return true;
      })
      .slice(0, AUTO_REFRESH_BATCH_SIZE);

    if (toRefresh.length === 0) {
      return;
    }

    let isCancelled = false;
    const runBackgroundRefresh = async () => {
      setAutoRefreshState({
        inProgress: true,
        done: 0,
        total: toRefresh.length,
        failed: 0,
      });
      let done = 0;
      let failed = 0;

      for (const audit of toRefresh) {
        if (isCancelled) break;
        setRefreshingIds((prev) => new Set(prev).add(audit.id));
        try {
          await generateAuditReport(audit.id);
        } catch {
          failed++;
        } finally {
          done++;
          setAutoRefreshState((prev) => ({ ...prev, done, failed }));
          setRefreshingIds((prev) => {
            const next = new Set(prev);
            next.delete(audit.id);
            return next;
          });
        }
      }
      if (!isCancelled) {
        markSwept();
        queryClient.invalidateQueries({ queryKey: listAuditsKey });
        queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
        setAutoRefreshState({ inProgress: false, done: 0, total: 0, failed: 0 });
      }
    };
    runBackgroundRefresh();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, audits, autoRefreshState.inProgress, listAuditsKey, queryClient]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (!hasNextPage) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
            break;
          }
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, audits?.length]);

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError } = useGetAuditSummary({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetAuditSummaryQueryKey(),
    },
  });

  const { data: profiles } = useListProfiles({
    query: { enabled: isAuthenticated, queryKey: getListProfilesQueryKey() },
  });
  const { data: messageSessions } = useListMessageCoachingSessions({
    query: { enabled: isAuthenticated, queryKey: getListMessageCoachingSessionsQueryKey() },
  });
  const { data: insights } = useListInsights({
    query: { enabled: isAuthenticated, queryKey: getListInsightsQueryKey() },
  });
  const { data: expiringTrashedData } = useListExpiringTrashedAudits(undefined, {
    query: { enabled: isAuthenticated, queryKey: getListExpiringTrashedAuditsQueryKey() },
  });
  const { data: matchingState } = useGetMatchingState({
    query: { enabled: isAuthenticated, queryKey: getGetMatchingStateQueryKey() },
  });
  const { data: matchingBenchmarks } = useGetMatchingBenchmarks({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetMatchingBenchmarksQueryKey(),
    },
  });
  const [trashBannerDismissed, setTrashBannerDismissed] = useState(() => isDashboardBannerDismissed());

  const hasRealProfiles = (profiles && profiles.length > 0) || false;
  const hasRealMessageSessions = (messageSessions && messageSessions.length > 0) || false;
  const hasRealInsights = (insights && insights.length > 0) || false;

  const deleteAudit = useDeleteAudit();
  const { mutateAsync: bulkDeleteAudits, isPending: isBulkDeleting } = useBulkDeleteAudits();

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    try {
      await bulkDeleteAudits({ data: { ids: idsToDelete } });
      clearSelection();
      setConfirmOpen(false);
      toast({ title: "Moved to Trash", description: `${idsToDelete.length} audit${idsToDelete.length === 1 ? "" : "s"} moved to trash.` });
      drainPendingAuditDeletes();
      queryClient.invalidateQueries({ queryKey: listAuditsKey });
      queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListExpiringTrashedAuditsQueryKey() });
    } catch {
      toast({ title: "Delete Failed", description: "An error occurred.", variant: "destructive" });
    }
  };

  type InfiniteAuditData = { pages: Audit[][]; pageParams: unknown[] };

  const pendingRef = useRef<{
    audit: Audit;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const finalizePending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    clearPendingAuditDelete(pending.audit.id);
    deleteAudit.mutate({ id: pending.audit.id });
  }, [deleteAudit]);

  const undoPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    clearPendingAuditDelete(pending.audit.id);
    const current = queryClient.getQueryData<InfiniteAuditData>(listAuditsKey);
    if (!current) return;
    if (current.pages.some((p) => p.some((a) => a.id === pending.audit.id))) return;
    const pages = current.pages.length > 0 ? [...current.pages] : [[]];
    pages[0] = [pending.audit, ...pages[0]].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    queryClient.setQueryData<InfiniteAuditData>(listAuditsKey, {
      ...current,
      pages,
    });
  }, [queryClient, listAuditsKey]);

  const handleDeleteAudit = useCallback(
    (audit: Audit) => {
      if (pendingRef.current) finalizePending();
      const previous = queryClient.getQueryData<InfiniteAuditData>(listAuditsKey);
      if (previous) {
        queryClient.setQueryData<InfiniteAuditData>(listAuditsKey, {
          ...previous,
          pages: previous.pages.map((p) => p.filter((a) => a.id !== audit.id)),
        });
      }
      const timer = setTimeout(() => finalizePending(), UNDO_WINDOW_MS);
      pendingRef.current = { audit, timer };
      recordPendingAuditDelete(audit.id);
      const t = toast({
        title: "Audit moved to trash",
        description: `${audit.firstName}'s audit was deleted. It will be permanently removed in 30 days.`,
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
    const orphaned = drainPendingAuditDeletes();
    if (orphaned.length > 0) {
      const previous = queryClient.getQueryData<InfiniteAuditData>(listAuditsKey);
      if (previous) {
        const ids = new Set(orphaned);
        queryClient.setQueryData<InfiniteAuditData>(listAuditsKey, {
          ...previous,
          pages: previous.pages.map((p) => p.filter((a) => !ids.has(a.id))),
        });
      }
      Promise.allSettled(
        orphaned.map((id) => deleteAuditRequest(id)),
      ).finally(() => {
        queryClient.invalidateQueries({ queryKey: listAuditsKey });
        queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
      });
    }
    return () => {
      // On unmount, flush any in-flight pending delete. We mutate directly but
      // deliberately leave the persisted localStorage entry in place: the next
      // mount's drain effect above awaits the DELETE before invalidating, so it
      // is the reliable executor when the unmount races a remount re-fetch. The
      // timer-path finalizePending (mounted case) is what clears persistence, so
      // a completed-then-revisited delete is not re-issued.
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current = null;
        deleteAudit.mutate({ id: pending.audit.id });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRealAudits = (summaryData && summaryData.totalAudits > 0) || false;
  const isBrandNewUser = isAuthenticated && !hasRealAudits && !hasRealProfiles && !hasRealMessageSessions && !hasRealInsights;
  const accountDataLoading = summaryLoading || auditsLoading;
  const showHandoffOffer = hasAnyAnonymousIds() && isAuthenticated;

  const showDemo = !hasRealAudits && !accountDataLoading;
  const displaySummary = showDemo ? DEMO_SUMMARY : summaryData || DEMO_SUMMARY;
  const displayAudits = showDemo ? DEMO_AUDITS : audits || [];

  const latestScore = displaySummary.latestScore ?? 0;
  const grade = latestScore >= 80 ? "A" : latestScore >= 70 ? "B" : latestScore >= 60 ? "C" : latestScore >= 50 ? "D" : "F";
  const gradeColor = latestScore >= 75 ? "hsl(var(--brand-green))" : latestScore >= 55 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";
  const readinessThreshold = matchingState?.readinessThreshold ?? 50;
  const readinessSnapshot = matchingState?.readiness.score ?? latestScore;
  const readinessEligible = matchingState?.eligible ?? readinessSnapshot >= readinessThreshold;
  const ptsToThreshold = Math.max(0, Math.round(readinessThreshold - readinessSnapshot));

  const { data: latestAuditPages } = useInfiniteQuery({
    queryKey: getListAuditsQueryKey({ sort: "newest" }),
    queryFn: ({ signal }) => listAudits({ sort: "newest", limit: 1 }, { signal }),
    initialPageParam: 0,
    getNextPageParam: () => undefined,
    enabled: isAuthenticated,
  });
  const latestAuditFromQuery = latestAuditPages?.pages[0]?.[0];

  const latestMessageSession = useMemo(() => {
    if (!messageSessions || messageSessions.length === 0) return null;
    return [...messageSessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [messageSessions]);

  const latestProgressEntry = useMemo<ProgressEntryLike | null>(() => {
    const entries = readSavedProgressEntries();
    if (entries.length === 0) return null;
    return entries.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    })[0];
  }, []);

  const hasAnyRecentContext = Boolean(latestAuditFromQuery || latestMessageSession || latestProgressEntry);
  const scoreDelta = (displaySummary.latestScore ?? 0) - (displaySummary.scoreHistory[0]?.score ?? 0);
  const nextAction = getNextBestAction(latestScore, hasRealAudits);
  const latestRealAudit = hasRealAudits ? latestAuditFromQuery ?? (audits && audits[0]) ?? null : null;

  const showRealEmptyState = isAuthenticated && !accountDataLoading && !hasRealAudits && !summaryError && !auditsError;

  if (showRealEmptyState) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg relative overflow-hidden flex items-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50 pointer-events-none" />
          <div className="orb orb-violet fixed w-[800px] h-[800px] top-[-20%] right-[-10%] opacity-20 pointer-events-none mix-blend-screen" />
          <div className="orb orb-rose fixed w-[600px] h-[600px] bottom-[-10%] left-[-10%] opacity-15 pointer-events-none mix-blend-screen" />
          
          <div className="max-w-2xl mx-auto px-6 text-center relative z-10 w-full" data-testid="dashboard-real-empty-state">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 1 }}>
              <div className="inline-flex w-24 h-24 rounded-[2rem] items-center justify-center mb-8 glass-strong border-[hsl(248_62%_52%/0.4)] shadow-[0_0_40px_hsl(248_62%_52%/0.3)] relative group">
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-[hsl(248_62%_52%/0.2)] to-[hsl(326_100%_59%/0.2)] group-hover:opacity-100 transition-opacity opacity-50" />
                <Sparkles className="w-10 h-10 text-[hsl(248_62%_65%)] relative z-10" />
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
              className="text-5xl sm:text-6xl md:text-7xl font-bold text-foreground tracking-tight mb-6 font-serif"
            >
              No audits yet
            </motion.h1>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
              className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed mb-12"
            >
              Run your first audit and we'll show you exactly what your profile is communicating.
            </motion.p>
            
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <Button asChild className="rounded-full h-16 px-12 text-lg bg-foreground text-background hover:bg-foreground/90 border-0 font-semibold shadow-2xl hover:shadow-[0_0_40px_hsl(248_62%_52%/0.4)] transition-all group" data-testid="button-real-empty-state-start">
                <Link href="/start">
                  Run my first audit 
                  <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>
            
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} className="mt-8 flex flex-col items-center gap-4">
              <Link href="/sample-report" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-white/20 hover:decoration-white/40 transition-colors" data-testid="link-real-empty-state-sample">
                See a sample report
              </Link>
              <p className="text-xs text-muted-foreground/50 tracking-wider uppercase font-semibold">
                Free • No credit card • Takes 3 minutes
              </p>
            </motion.div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-8 md:py-12 px-4 relative">
        <div className="orb orb-violet fixed w-[800px] h-[800px] -top-60 -right-40 opacity-30 mix-blend-screen pointer-events-none" />
        <div className="orb orb-rose fixed w-[600px] h-[600px] bottom-0 -left-40 opacity-20 mix-blend-screen pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div variants={containerVariants} initial="hidden" animate="show">
            
            {/* Header Area */}
            <motion.div variants={itemVariants} className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-sm text-[hsl(248_62%_62%)] font-bold tracking-widest uppercase mb-2">Echo</p>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground tracking-tight font-serif drop-shadow-sm">{firstName ? `Hey ${firstName}, here's where we are.` : "Here's where we are."}</h1>
              </div>
              {showHandoffOffer && (
                <div data-testid="handoff-cta" className="md:self-center">
                  <HandoffShareDialog />
                </div>
              )}
            </motion.div>

            {/* Top Action Banners */}
            <div className="space-y-4 mb-10">
              {isAuthenticated && summaryError && (
                <motion.div variants={itemVariants}>
                  <div className="glass border border-white/8 rounded-2xl p-6 text-center" data-testid="dashboard-summary-error">
                    <ShieldAlert className="w-8 h-8 text-[hsl(348_55%_78%)] mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">We could not load your live readiness data. Please refresh and try again.</p>
                  </div>
                </motion.div>
              )}
              {isAuthenticated && auditsError && (
                <motion.div variants={itemVariants}>
                  <div className="glass border border-white/8 rounded-2xl p-6 text-center" data-testid="dashboard-audits-error">
                    <ShieldAlert className="w-8 h-8 text-[hsl(348_55%_78%)] mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">We could not load your audits. Please refresh and try again.</p>
                  </div>
                </motion.div>
              )}
              <motion.div variants={itemVariants}>
                <div className="glass-elevated rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden group border-[hsl(248_62%_52%/0.2)] hover:border-[hsl(248_62%_52%/0.4)] transition-all" data-testid="card-next-best-action">
                  <div className="absolute inset-0 bg-gradient-to-r from-[hsl(248_62%_52%/0.05)] to-transparent pointer-events-none" />
                  
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 relative z-10 shadow-lg" style={{ background: nextAction.color, boxShadow: `0 8px 30px ${withAlpha(nextAction.color, 0.4)}` }}>
                    <nextAction.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full" style={{ color: nextAction.color, backgroundColor: withAlpha(nextAction.color, 0.1) }}>{nextAction.label}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground leading-tight tracking-tight mb-2">{nextAction.title}</h3>
                    <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">{nextAction.desc}</p>
                  </div>
                  
                  <div className="relative z-10 md:pl-6 md:border-l border-border/50 flex-shrink-0">
                    <Button asChild size="lg" className="w-full md:w-auto rounded-full font-bold shadow-lg transition-transform hover:scale-105" style={{ background: nextAction.color, color: "white" }}>
                      <Link href={nextAction.href}>{nextAction.cta} <ArrowRight className="ml-2 w-5 h-5" /></Link>
                    </Button>
                  </div>
                </div>
              </motion.div>

              {!trashBannerDismissed && loadTrashReminderPref() && expiringTrashedData && (expiringTrashedData.audits?.length ?? 0) > 0 && (() => {
                const earliest = expiringTrashedData.audits[0]?.deletedAt;
                const left = earliest ? Math.max(0, expiringTrashedData.retentionDays - Math.floor((Date.now() - new Date(earliest).getTime()) / (24 * 60 * 60 * 1000))) : 0;
                const when = left <= 0 ? "today" : left === 1 ? "tomorrow" : `in ${left} days`;
                const count = expiringTrashedData.audits.length;
                return (
                  <motion.div variants={itemVariants}>
                    <div data-testid="banner-dashboard-trash-expiring" className="flex items-center gap-4 rounded-2xl border border-[hsl(348_55%_55%/0.4)] bg-[hsl(348_55%_55%/0.1)] px-5 py-4 relative overflow-hidden backdrop-blur-md">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[hsl(348_55%_68%)]" />
                      <div className="w-10 h-10 rounded-full bg-[hsl(348_55%_55%/0.2)] flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-[hsl(348_55%_68%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-[hsl(348_55%_78%)]">
                          {count === 1 ? "1 deleted audit is about to be permanently removed" : `${count} deleted audits are about to be permanently removed`}
                        </p>
                        <p className="text-sm text-[hsl(348_55%_78%/0.8)] mt-0.5">
                          {count === 1 ? "It" : "The earliest"} purges {when}. <Link href="/trash" className="underline underline-offset-4 hover:text-[hsl(348_55%_90%)] font-semibold transition-colors" data-testid="link-dashboard-trash-expiring">View Trash</Link> to restore.
                        </p>
                      </div>
                      <button type="button" onClick={() => { dismissDashboardBanner(); setTrashBannerDismissed(true); }} className="p-2 rounded-xl hover:bg-[hsl(348_55%_55%/0.2)] text-[hsl(348_55%_78%)] transition-colors" aria-label="Dismiss">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })()}

              {matchingState?.readinessDelta && (
                <motion.div variants={itemVariants}>
                  <ReadinessDeltaCard delta={matchingState.readinessDelta} />
                </motion.div>
              )}

              {matchingBenchmarks?.available && (
                <motion.div variants={itemVariants}>
                  <MatchBenchmarkCard benchmarks={matchingBenchmarks} />
                </motion.div>
              )}
            </div>

            {/* Core Stats Row */}
            {!isBrandNewUser && (
              <div className="grid lg:grid-cols-3 gap-6 mb-10">
                {/* Main Score Area */}
                <motion.div variants={itemVariants} className="lg:col-span-1">
                  <div className="glass-strong rounded-[2rem] p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden border-t-2 border-t-white/20 dark:border-t-white/10" data-testid="card-readiness-score">
                    <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[hsl(var(--brand-indigo)/0.1)] to-transparent pointer-events-none" />
                    
                    <div className="flex flex-col items-center gap-1 mb-6 relative z-10">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-[hsl(248_62%_65%)]" />
                        <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">Match Readiness</h2>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 font-medium">The one score that gates matching</p>
                    </div>

                    {summaryLoading ? <Skeleton className="w-40 h-40 rounded-full" /> : <ScoreRing score={readinessSnapshot} />}
                    
                    <div className="mt-8 flex flex-col items-center relative z-10">
                      {readinessEligible ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[hsl(142_55%_45%/0.15)] border border-[hsl(142_55%_45%/0.3)] text-sm font-bold text-[hsl(142_55%_60%)]">
                          <CheckCircle2 className="w-4 h-4" /> Ready for the matching pool
                        </span>
                      ) : (
                        <p className="text-sm font-medium text-muted-foreground">
                          <strong className="text-foreground text-base">{ptsToThreshold}</strong> pts to enter matching
                        </p>
                      )}
                      <div className="flex items-baseline gap-2 mt-4">
                        <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground/70">Latest audit grade</span>
                        <span className="text-xl font-black font-serif" style={{ color: gradeColor }} data-testid="grade-letter">{grade}</span>
                      </div>
                      
                      {!hasRealAudits && <SampleDataBadge className="mt-4" testId="badge-sample-dashboard-score" />}
                      
                      {scoreDelta > 0 && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-[hsl(142_55%_45%/0.15)] border border-[hsl(142_55%_45%/0.3)] shadow-[0_0_15px_hsl(142_55%_45%/0.2)]">
                          <TrendingUp className="w-4 h-4 text-[hsl(142_55%_60%)]" />
                          <span className="text-sm font-bold tracking-wide text-[hsl(142_55%_60%)]">+{scoreDelta} pts on your latest audit</span>
                        </div>
                      )}
                      <Link
                        href="/your-mirror"
                        className="inline-flex items-center gap-1.5 mt-5 text-xs font-bold text-[hsl(248_62%_62%)] hover:text-[hsl(248_62%_72%)] transition-colors"
                        data-testid="link-dashboard-your-mirror"
                      >
                        See the full read in Your Mirror <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>

                {/* Chart & Insights Area */}
                <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col gap-6">
                  {/* Chart */}
                  <div className="glass rounded-[2rem] p-6 sm:p-8 flex-1 flex flex-col relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[hsl(248_62%_52%/0.03)] pointer-events-none" />
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                          <History className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                          Progress History
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1 font-medium">Your score trajectory over time</p>
                      </div>
                      {showDemo && <SampleDataBadge label="Sample" testId="badge-sample-dashboard-chart" />}
                    </div>
                    
                    <div className="flex-1 min-h-[160px] relative z-10 w-full">
                      {summaryLoading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={displaySummary.scoreHistory} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                            <defs>
                              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(248 62% 52%)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(248 62% 52%)" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} />
                            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ background: "rgba(15, 13, 38, 0.9)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                              itemStyle={{ color: "white", fontWeight: "bold" }}
                              labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "4px", fontSize: "12px", fontWeight: "600", textTransform: "uppercase" }}
                            />
                            <Area type="monotone" dataKey="score" stroke="hsl(248 62% 52%)" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 6, fill: "hsl(248 62% 52%)", stroke: "white", strokeWidth: 2, boxShadow: "0 0 10px hsl(248 62% 52%)" }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                      {displaySummary.scoreHistory.length < 2 && (
                        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px] bg-background/20 rounded-2xl">
                          <p className="text-sm font-semibold text-foreground bg-background/80 px-4 py-2 rounded-full border border-border shadow-lg">Complete another audit to build your chart</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="grid sm:grid-cols-2 gap-6 h-full">
                    <div className="glass rounded-[2rem] p-6 flex flex-col relative overflow-hidden border-t-2 border-t-[hsl(142_55%_60%/0.3)] hover:border-t-[hsl(142_55%_60%/0.6)] transition-colors">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-[hsl(142_55%_45%/0.15)] flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-[hsl(142_55%_60%)]" />
                        </div>
                        <h3 className="font-bold text-foreground tracking-tight">Core Strengths</h3>
                      </div>
                      {summaryLoading ? (
                        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-8 w-full rounded-full" />)}</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {displaySummary.topStrengths.slice(0, 3).map((s, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-foreground/90 font-medium bg-white/5 dark:bg-black/20 p-2.5 rounded-xl border border-white/5" data-testid={`badge-strength-${i}`}>
                              <CheckCircle2 className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
                              <span className="leading-snug">{s}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="glass rounded-[2rem] p-6 flex flex-col relative overflow-hidden border-t-2 border-t-[hsl(38_90%_55%/0.3)] hover:border-t-[hsl(38_90%_55%/0.6)] transition-colors">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-[hsl(38_90%_55%/0.15)] flex items-center justify-center">
                          <ShieldAlert className="w-5 h-5 text-[hsl(38_90%_55%)]" />
                        </div>
                        <h3 className="font-bold text-foreground tracking-tight">Focus Areas</h3>
                      </div>
                      {summaryLoading ? (
                        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-8 w-full rounded-full" />)}</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {displaySummary.topRisks.slice(0, 3).map((r, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-foreground/90 font-medium bg-white/5 dark:bg-black/20 p-2.5 rounded-xl border border-white/5" data-testid={`badge-risk-${i}`}>
                              <AlertCircle className="w-4 h-4 text-[hsl(38_90%_55%)] flex-shrink-0 mt-0.5" />
                              <span className="leading-snug">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Quick Resume Section */}
            <motion.div variants={itemVariants} className="mb-12">
              <h2 className="text-xl font-bold tracking-tight text-foreground mb-6 flex items-center gap-2">
                <Play className="w-5 h-5 text-[hsl(326_100%_59%)]" />
                Pick Up Where You Left Off
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {latestRealAudit ? (
                  <Link href={`/report/${latestRealAudit.id}`} className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(248_62%_52%/0.2)] border border-[hsl(248_62%_52%/0.1)] hover:border-[hsl(248_62%_52%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(248_62%_52%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-1">Latest Report</p>
                    <h4 className="text-base font-bold text-foreground mb-1 truncate">{latestRealAudit.firstName}'s Audit</h4>
                    <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      <span>Score <strong className="text-foreground">{latestRealAudit.readinessScore}</strong></span>
                      <span className="opacity-60">{formatRelativeTimestamp(latestRealAudit.createdAt)}</span>
                    </p>
                  </Link>
                ) : (
                  <Link href="/start" className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(248_62%_52%/0.2)] border border-[hsl(248_62%_52%/0.1)] hover:border-[hsl(248_62%_52%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(248_62%_52%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5 text-[hsl(248_62%_52%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_52%)] mb-1">Signal Audit</p>
                    <h4 className="text-base font-bold text-foreground mb-1">Run Your First Audit</h4>
                    <p className="text-sm font-medium text-muted-foreground">Free • Instant • 3 mins</p>
                  </Link>
                )}

                {latestMessageSession ? (
                  <Link href="/coach" className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(190_55%_60%/0.2)] border border-[hsl(190_55%_60%/0.1)] hover:border-[hsl(190_55%_60%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(190_55%_60%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-5 h-5 text-[hsl(190_55%_60%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(190_55%_60%)] mb-1">Message Coach</p>
                    <h4 className="text-base font-bold text-foreground mb-1 truncate">Draft a Reply</h4>
                    <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      <span>Resume draft</span>
                      <span className="opacity-60">{formatRelativeTimestamp(latestMessageSession.createdAt)}</span>
                    </p>
                  </Link>
                ) : (
                  <Link href="/coach" className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(190_55%_60%/0.2)] border border-[hsl(190_55%_60%/0.1)] hover:border-[hsl(190_55%_60%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(190_55%_60%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-5 h-5 text-[hsl(190_55%_60%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(190_55%_60%)] mb-1">Message Lab</p>
                    <h4 className="text-base font-bold text-foreground mb-1">Coach a Reply</h4>
                    <p className="text-sm font-medium text-muted-foreground">Get 3 styled options</p>
                  </Link>
                )}

                {latestProgressEntry ? (
                  <Link href="/progress/timeline" className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(326_100%_59%/0.2)] border border-[hsl(326_100%_59%/0.1)] hover:border-[hsl(326_100%_59%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(326_100%_59%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Clock className="w-5 h-5 text-[hsl(326_100%_59%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(326_100%_59%)] mb-1">Growth Tracker</p>
                    <h4 className="text-base font-bold text-foreground mb-1 truncate">{latestProgressEntry.tag || "Timeline Note"}</h4>
                    <p className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      <span className="truncate pr-4">{latestProgressEntry.note || "Review entry"}</span>
                      <span className="opacity-60 shrink-0">{latestProgressEntry.date ? formatRelativeTimestamp(latestProgressEntry.date) : "Recent"}</span>
                    </p>
                  </Link>
                ) : (
                  <Link href="/progress/timeline" className="glass-strong rounded-2xl p-5 group hover:shadow-[0_8px_30px_hsl(326_100%_59%/0.2)] border border-[hsl(326_100%_59%/0.1)] hover:border-[hsl(326_100%_59%/0.3)] transition-all">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(326_100%_59%/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Brain className="w-5 h-5 text-[hsl(326_100%_59%)]" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(326_100%_59%)] mb-1">Growth Tracker</p>
                    <h4 className="text-base font-bold text-foreground mb-1">Log a Note</h4>
                    <p className="text-sm font-medium text-muted-foreground">Track wins & patterns</p>
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Wingman Note */}
            {(() => {
              const note = WINGMAN_NOTES[new Date().getDay()];
              return (
                <motion.div variants={itemVariants} className="mb-12">
                  <div className="rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6 bg-gradient-to-br from-[hsl(248_62%_52%/0.1)] to-transparent border border-[hsl(248_62%_52%/0.2)] shadow-lg relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[hsl(248_62%_52%/0.1)] rounded-full blur-3xl pointer-events-none" />
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center flex-shrink-0 shadow-[0_4px_20px_hsl(248_62%_52%/0.4)]">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(248_62%_52%)] mb-2 dark:text-[hsl(248_80%_70%)]">Daily Strategy</p>
                      <p className="text-lg md:text-xl font-medium text-foreground leading-relaxed">"{note.note}"</p>
                    </div>
                    <Button asChild size="lg" className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 font-bold border-0 md:w-auto w-full transition-transform hover:scale-105">
                      <Link href={note.href}>{note.action}</Link>
                    </Button>
                  </div>
                </motion.div>
              );
            })()}

            {/* Hubs Grid */}
            <motion.div variants={itemVariants} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[hsl(var(--brand-gold))]" />
                  Explore Toolkit
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowAllTools(t => !t)} className="text-muted-foreground font-bold tracking-wide rounded-full">
                  {showAllTools ? "Collapse" : "View All"} <ArrowRight className={`ml-2 w-4 h-4 transition-transform ${showAllTools ? "rotate-90" : ""}`} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-6 max-w-2xl" data-testid="text-toolkit-readiness-framing">
                Every tool here does two jobs: it helps you right now, and it feeds your Match Readiness. The more the machine knows you, the better it matches you. Matching is the payoff.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PACKAGE_CARDS.map((pkg, i) => (
                  <div key={pkg.name} className="glass rounded-[2rem] p-6 hover:shadow-xl transition-all border border-border hover:border-[hsl(248_62%_52%/0.3)] group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4 group-hover:scale-150 transition-transform duration-700">
                      <pkg.icon className="w-32 h-32" style={{ color: pkg.color }} />
                    </div>
                    <div className="flex items-start gap-4 mb-6 relative z-10">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: pkg.color }}>
                        <pkg.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="text-xl font-bold text-foreground mb-1 tracking-tight">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">{pkg.tagline}</p>
                      </div>
                    </div>
                    <div className="space-y-1 mb-6 relative z-10">
                      {pkg.tools.map(tool => (
                        <Link key={tool.href} href={tool.href} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/10 dark:hover:bg-black/20 transition-colors group/link">
                          <span className="text-sm font-semibold text-foreground/90">{tool.label}</span>
                          <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                      <Button asChild className="flex-1 rounded-xl font-bold shadow-none" style={{ background: withAlpha(pkg.color, 0.1), color: pkg.color }}>
                        <Link href={pkg.hintHref}>{pkg.hint}</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-xl font-bold border-border bg-transparent hover:bg-white/5 dark:hover:bg-white/5">
                        <Link href={pkg.hubHref}>Open Hub</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded Tools */}
              <AnimatePresence>
                {showAllTools && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 space-y-8 overflow-hidden"
                  >
                    {ACTION_GROUPS.map((group) => (
                      <div key={group.label} className="pt-4 border-t border-border/50">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="w-2 h-2 rounded-full" style={{ background: group.color }} />
                          <h4 className="text-lg font-bold text-foreground tracking-tight">{group.label}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.items.map((action, i) => (
                            <Link key={i} href={action.href} data-testid={`card-quick-action-${action.label.toLowerCase().replace(/ /g, "-")}`}>
                              <div className="glass p-4 rounded-[1.5rem] flex items-start gap-4 hover:bg-white/5 dark:hover:bg-white/5 border border-border hover:border-border/80 transition-all cursor-pointer h-full group">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: withAlpha(group.color, 0.1) }}>
                                  <action.icon className="w-5 h-5" style={{ color: group.color }} />
                                </div>
                                <div>
                                  <p className="font-bold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{action.label}</p>
                                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">{action.desc}</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Audit List Section */}
            <motion.div variants={itemVariants} className="mt-16 pt-12 border-t border-border/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Search className="w-6 h-6 text-[hsl(248_62%_52%)]" />
                    Audit Archive
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 font-medium">Search, filter, and manage your past profile reads</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {hasRealAudits && !selectionMode && staleAudits.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs font-bold text-[hsl(43_65%_55%)] hover:text-[hsl(43_65%_45%)] hover:bg-[hsl(43_65%_55%/0.1)]"
                      onClick={openRefreshPicker}
                      disabled={refreshState.inProgress}
                      data-testid="button-refresh-stale-reports"
                      aria-label={`Refresh ${staleAudits.length} stale ${staleAudits.length === 1 ? "report" : "reports"}`}
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshState.inProgress ? "animate-spin" : ""}`} />
                      {refreshState.inProgress
                        ? `Refreshing ${refreshState.done}/${refreshState.total}…`
                        : `Refresh stale (${staleAudits.length})`}
                    </Button>
                  )}
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-3 bg-[hsl(0_72%_52%/0.1)] border border-[hsl(0_72%_52%/0.2)] rounded-full px-4 py-2 text-[hsl(0_72%_62%)]">
                      <span className="text-sm font-bold">{selectedIds.size} selected</span>
                      <div className="w-px h-4 bg-[hsl(0_72%_52%/0.2)]" />
                      <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} className="h-6 px-3 text-xs font-bold hover:bg-[hsl(0_72%_52%/0.2)] text-[hsl(0_72%_62%)] rounded-full">
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearSelection} className="h-6 w-6 p-0 rounded-full hover:bg-[hsl(0_72%_52%/0.2)] text-[hsl(0_72%_62%)]">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="glass rounded-[2rem] p-4 sm:p-6 mb-8 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="text" 
                    placeholder="Search by name or bio content..." 
                    value={searchInput} 
                    onChange={e => setSearchInput(e.target.value)} 
                    className="pl-12 h-14 bg-background/50 border-border/50 rounded-2xl text-base font-medium focus-visible:ring-[hsl(248_62%_52%)]"
                    data-testid="input-search-audits"
                  />
                  {searchInput && (
                    <button onClick={() => setSearchInput("")} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-3 sm:w-auto">
                  <div className="relative">
                    <select 
                      value={sort} 
                      onChange={e => setSort(e.target.value as AuditSort)} 
                      className="h-14 px-4 pr-10 appearance-none bg-background/50 border border-border/50 rounded-2xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(248_62%_52%)] cursor-pointer"
                      data-testid="select-sort-audits"
                    >
                      <option value="newest">Newest First</option>
                      <option value="topScore">Highest Score</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                  
                  <div className="relative">
                    <select 
                      value={scoreRange} 
                      onChange={e => setScoreRange(e.target.value as AuditScoreRange)} 
                      className="h-14 px-4 pr-10 appearance-none bg-background/50 border border-border/50 rounded-2xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(248_62%_52%)] cursor-pointer"
                      data-testid="select-filter-audits"
                    >
                      <option value="all">All Scores</option>
                      <option value="high">High (75+)</option>
                      <option value="medium">Medium (55-74)</option>
                      <option value="low">Low (0-54)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Bar */}
              {(refreshState.inProgress || autoRefreshState.inProgress || filtersActive) && (
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 px-2">
                  {filtersActive && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Filters active</span>
                      <Button variant="link" size="sm" onClick={resetFilters} className="h-8 px-3 text-xs font-bold text-[hsl(248_62%_52%)] hover:text-[hsl(248_62%_62%)]">
                        Clear Filters
                      </Button>
                    </div>
                  )}
                  
                  {(refreshState.inProgress || autoRefreshState.inProgress) && (
                    <div className="flex items-center gap-3 text-sm font-medium bg-[hsl(248_62%_52%/0.1)] border border-[hsl(248_62%_52%/0.2)] px-4 py-2 rounded-full text-[hsl(248_62%_62%)] ml-auto">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating {refreshState.inProgress ? refreshState.done : autoRefreshState.done} of {refreshState.inProgress ? refreshState.total : autoRefreshState.total}...
                    </div>
                  )}
                </div>
              )}

              {/* List */}
              <div className="space-y-4">
                {auditsLoading && !displayAudits.length ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-[2rem] opacity-50" />)}
                  </div>
                ) : displayAudits.length === 0 ? (
                  <div className="text-center py-20 glass rounded-[2rem] border-dashed">
                    <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-lg font-bold text-foreground mb-2">No audits found</p>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">Try adjusting your search or filters to see more results.</p>
                    <Button onClick={resetFilters} variant="outline" className="rounded-full font-bold">Clear Filters</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayAudits.map((audit) => {
                      const isSelected = selectedIds.has(audit.id);
                      const stale = staleHintFromGeneratedAt(audit.reportGeneratedAt);
                      const isRefreshing = refreshingIds.has(audit.id);
                      const grade = audit.readinessScore ? (audit.readinessScore >= 80 ? "A" : audit.readinessScore >= 70 ? "B" : audit.readinessScore >= 60 ? "C" : audit.readinessScore >= 50 ? "D" : "F") : "?";
                      const gradeCol = audit.readinessScore ? (audit.readinessScore >= 75 ? "hsl(var(--brand-green))" : audit.readinessScore >= 55 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))") : "hsl(var(--muted-foreground))";
                      
                      return (
                        <div 
                          key={audit.id} 
                          className={`glass rounded-[2rem] p-5 border transition-all relative overflow-hidden group ${isSelected ? "border-[hsl(248_62%_52%)] ring-1 ring-[hsl(248_62%_52%)] bg-[hsl(248_62%_52%/0.03)]" : "border-border/50 hover:border-border"}`}
                          data-testid={`row-audit-${audit.id}`}
                        >
                          {selectionMode && (
                            <div className="absolute top-4 left-4 z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) { selectRangeTo(audit.id, displayAudits.map(a => a.id)); } else { toggleSelected(audit.id); } }}>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${isSelected ? "bg-[hsl(248_62%_52%)] border-[hsl(248_62%_52%)] text-white" : "border-muted-foreground/30 hover:border-muted-foreground"}`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                            </div>
                          )}
                          
                          <div className={`flex flex-col h-full ${selectionMode ? "pl-10" : ""}`}>
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-inner relative" style={{ background: withAlpha(gradeCol, 0.1), color: gradeCol, border: `1px solid ${withAlpha(gradeCol, 0.2)}` }}>
                                  <span className="text-xl font-black font-serif">{grade}</span>
                                  {audit.readinessScore && (
                                    <div className="absolute -bottom-2 -right-2 bg-background px-1.5 py-0.5 rounded border border-border text-[9px] font-bold shadow-sm">
                                      {audit.readinessScore}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-lg font-bold text-foreground leading-tight tracking-tight">{audit.firstName}'s Audit</h4>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1 flex items-center gap-1.5">
                                    {formatRelativeTimestamp(audit.createdAt)}
                                    <span className="w-1 h-1 rounded-full bg-border" />
                                    {audit.sourceApp || "Upload"}
                                  </p>
                                </div>
                              </div>
                              
                              {!selectionMode && (
                                <div className="flex items-center">
                                  {stale && (
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); handleRefreshOne(audit); }} disabled={isRefreshing} className="h-8 text-xs font-bold text-[hsl(43_65%_55%)] hover:text-[hsl(43_65%_45%)] hover:bg-[hsl(43_65%_55%/0.1)] rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {isRefreshing ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                                      Update
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDeleteAudit(audit); }} data-testid={`button-delete-audit-${audit.id}`} className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Move to trash">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            {audit.matchContext && (
                              <div className="bg-[hsl(248_62%_52%/0.08)] border border-[hsl(248_62%_52%/0.2)] rounded-xl p-3 mb-4 text-xs">
                                <span className="font-bold text-[hsl(248_62%_52%)] uppercase tracking-wider text-[10px] block mb-1">Search Match: {audit.matchContext.matchedField}</span>
                                {audit.matchContext.snippet && <p className="text-foreground/80 italic">"...{audit.matchContext.snippet}..."</p>}
                              </div>
                            )}
                            
                            <div className="mt-auto pt-4 flex items-center justify-between">
                              <div className="flex gap-2">
                                {audit.report?.strengths?.slice(0, 1).map((s, idx) => (
                                  <span key={idx} className="text-[10px] font-bold px-2 py-1 rounded-full bg-[hsl(142_55%_45%/0.1)] text-[hsl(142_55%_55%)] border border-[hsl(142_55%_45%/0.2)] truncate max-w-[120px]">
                                    {s}
                                  </span>
                                ))}
                                {stale && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[hsl(43_65%_55%/0.1)] text-[hsl(43_65%_55%)] border border-[hsl(43_65%_55%/0.2)]">Stale</span>}
                              </div>
                              <Button asChild variant="ghost" size="sm" className="h-8 px-3 rounded-full font-bold hover:bg-white/10 group/btn">
                                <Link href={`/report/${audit.id}`}>
                                  View <ArrowRight className="ml-1.5 w-3.5 h-3.5 opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {hasNextPage ? (
                  <div
                    ref={loadMoreRef}
                    data-testid="audits-load-more-sentinel"
                    className="pt-8 flex items-center justify-center"
                  >
                    {isFetchingNextPage ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Refresh stale reports picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          className="glass-strong border-border/50 rounded-[2rem] sm:max-w-md"
          data-testid="dialog-refresh-stale-picker"
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Refresh stale reports</DialogTitle>
            <DialogDescription className="text-base">
              Pick which old audits to regenerate. Uncheck any you'd rather skip.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="text-refresh-picker-count">
              {pickerSelected.size} of {staleAudits.length} selected
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
                onClick={() => setPickerSelected(new Set(staleAudits.map((a) => a.id)))}
                disabled={pickerSelected.size === staleAudits.length}
                data-testid="button-refresh-picker-select-all"
              >
                Select all
              </button>
              <button
                type="button"
                className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
                onClick={() => setPickerSelected(new Set())}
                disabled={pickerSelected.size === 0}
                data-testid="button-refresh-picker-clear"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="refresh-picker-sort">
            <span className="shrink-0">Sort:</span>
            {(["score", "oldest", "newest"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPickerSort(opt)}
                data-testid={`button-refresh-picker-sort-${opt}`}
                className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${
                  pickerSort === opt
                    ? "border-[hsl(248_62%_52%/0.6)] bg-[hsl(248_62%_52%/0.15)] text-foreground"
                    : "border-border/50 hover:border-border hover:bg-white/5"
                }`}
              >
                {opt === "score" ? "Score" : opt === "oldest" ? "Oldest first" : "Newest first"}
              </button>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto -mx-2 px-2 space-y-1.5">
            {sortedStaleAudits.map((audit) => {
              const checked = pickerSelected.has(audit.id);
              const staleHint = staleHintFromGeneratedAt(audit.reportGeneratedAt);
              return (
                <label
                  key={audit.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.08)]"
                      : "border-border/40 hover:bg-white/5"
                  }`}
                  data-testid={`row-refresh-picker-${audit.id}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePickerSelected(audit.id)}
                    aria-label={`Refresh ${audit.firstName}'s audit`}
                    data-testid={`checkbox-refresh-picker-${audit.id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {audit.firstName}
                      {typeof audit.age === "number" ? `, ${audit.age}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {staleHint ?? "Stale report"}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPickerOpen(false)}
              className="rounded-full font-bold"
              data-testid="button-refresh-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmRefreshPicker}
              disabled={pickerSelected.size === 0}
              className="rounded-full font-bold"
              data-testid="button-refresh-picker-confirm"
            >
              Refresh {pickerSelected.size}{" "}
              {pickerSelected.size === 1 ? "report" : "reports"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="glass-strong border-border/50 rounded-[2rem] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              You are moving <strong>{selectedIds.size}</strong> audit{selectedIds.size === 1 ? "" : "s"} to the trash. They will be permanently deleted in 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-full font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleBulkDelete(); }} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
              {isBulkDeleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
