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
import { motion } from "framer-motion";
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
  type Audit,
  type ListAuditsParams,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  recordPendingAuditDelete,
  clearPendingAuditDelete,
  drainPendingAuditDeletes,
} from "@/lib/pendingAuditDeletes";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { HandoffShareDialog } from "@/components/HandoffShareDialog";
import { hasAnyAnonymousIds } from "@/lib/anonymousIds";
import {
  AUTO_REFRESH_BATCH_SIZE,
  hasSwept,
  loadAutoRefreshPref,
  markSwept,
} from "@/lib/autoRefreshPref";
import {
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
  ChevronRight, FlaskConical, Stethoscope, Zap,
  Wand2, ScanFace, BarChart2, Heart, Compass, BookOpen, Camera,
  MessageCircle, User, Map, Brain, Rss, Shield, Users, BarChart, Lightbulb, Layers,
  Calendar, Star, Images, Trash2, RefreshCw, Search, X,
} from "lucide-react";

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
      { icon: RefreshCw,     label: "What Changed?",     desc: "Quick check-in on progress",       href: "/copilot/what-changed"    },
    ],
  },
  {
    label: "Settings & Trust", color: "hsl(228 18% 55%)",
    items: [
      { icon: Heart,         label: "Wellness Center",   desc: "8 dimensions of readiness",        href: "/wellness"        },
      { icon: Layers,        label: "Connection Center", desc: "Bring in context on your terms",   href: "/connections"     },
      { icon: Shield,        label: "Data Vault",        desc: "Preview, export, or delete",       href: "/vault"           },
      { icon: Settings,      label: "Integrations",      desc: "Manage connections",               href: "/integrations"    },
      { icon: Star,          label: "Beta Feedback",     desc: "Help shape what gets built",       href: "/feedback"        },
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
  useMeta("Your Dashboard", "Your Signal Score history, recent audits, coaching sessions, and quick actions — all in one place.");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 50;

  const rawSearch = useSearch();
  const [, navigate] = useLocation();

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

  // Sync filter state → URL so choices survive page reload and navigation.
  // We drive state → URL (not URL → state) to avoid feedback loops.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (sort !== "newest") params.set("sort", sort);
    if (scoreRange !== "all") params.set("range", scoreRange);
    const newSearch = params.toString();
    const target = newSearch ? `/?${newSearch}` : "/";
    navigate(target, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sort, scoreRange]);

  const filtersActive =
    debouncedQuery.length > 0 || sort !== "newest" || scoreRange !== "all";
  const filterParams = useMemo<ListAuditsParams>(
    () => ({
      sort,
      ...(debouncedQuery.length > 0 ? { q: debouncedQuery } : {}),
      ...(scoreRange !== "all" ? { scoreRange } : {}),
    }),
    [sort, debouncedQuery, scoreRange],
  );

  const listAuditsKey = useMemo(
    () =>
      [
        ...getListAuditsQueryKey(filterParams),
        "infinite",
        PAGE_SIZE,
      ] as const,
    [filterParams],
  );
  const {
    data: auditsData,
    isLoading: auditsLoading,
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
  type InfiniteAuditData = { pages: Audit[][]; pageParams: unknown[] };
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
    () =>
      (audits ?? []).filter((a) =>
        staleHintFromGeneratedAt(a.reportGeneratedAt) !== null,
      ),
    [audits],
  );

  // Per-row single-audit refresh
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(() => new Set());
  const handleRefreshOne = useCallback(
    async (audit: Audit) => {
      if (refreshingIds.has(audit.id)) return;
      setRefreshingIds((prev) => new Set(prev).add(audit.id));
      try {
        await generateAuditReport(audit.id);
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
      setRefreshState({
        inProgress: true,
        done: 0,
        total: items.length,
        failed: 0,
      });
      let failed = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          await generateAuditReport(items[i].id);
        } catch {
          failed += 1;
        }
        setRefreshState((s) => ({ ...s, done: i + 1, failed }));
      }
      await queryClient.invalidateQueries({ queryKey: listAuditsKey });
      await queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
      setRefreshState((s) => ({ ...s, inProgress: false }));
      toast({
        title:
          failed === 0
            ? "Reports refreshed"
            : failed === items.length
              ? "Couldn't refresh reports"
              : "Reports refreshed with some errors",
        description:
          failed === 0
            ? `Regenerated ${items.length} stale ${
                items.length === 1 ? "report" : "reports"
              }.`
            : `${items.length - failed} refreshed, ${failed} failed.`,
        variant: failed === items.length ? "destructive" : undefined,
      });
    },
    [refreshState.inProgress, queryClient, listAuditsKey, toast],
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
  }, [staleAudits, pickerSelected, refreshAudits]);

  // Background auto-refresh: when the user has opted in, quietly regenerate a
  // small batch of the oldest stale reports once per session so the list view
  // shows the latest analysis without per-card clicks. Failures are swallowed.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (auditsLoading) return;
    if (refreshState.inProgress) return;
    if (hasSwept()) return;
    if (!loadAutoRefreshPref()) return;
    if (staleAudits.length === 0) return;
    markSwept();
    const batch = staleAudits.slice(0, AUTO_REFRESH_BATCH_SIZE);
    let cancelled = false;
    (async () => {
      for (const audit of batch) {
        if (cancelled) return;
        try {
          await generateAuditReport(audit.id);
        } catch {
          // swallow — background refresh must never block the UI
        }
      }
      if (cancelled) return;
      try {
        await queryClient.invalidateQueries({ queryKey: listAuditsKey });
        await queryClient.invalidateQueries({
          queryKey: getGetAuditSummaryQueryKey(),
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    auditsLoading,
    refreshState.inProgress,
    staleAudits,
    queryClient,
    listAuditsKey,
  ]);

  const deleteAudit = useDeleteAudit({
    mutation: {
      onError: () => {
        toast({
          title: "Couldn't delete",
          description: "Something went wrong. Try again.",
          variant: "destructive",
        });
      },
      onSuccess: (_data, vars) => {
        clearPendingAuditDelete(vars.id);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listAuditsKey });
      },
    },
  });

  const bulkDeleteAudits = useBulkDeleteAudits({
    mutation: {
      onMutate: async ({ data }) => {
        await queryClient.cancelQueries({ queryKey: listAuditsKey });
        const previous = queryClient.getQueryData<InfiniteAuditData>(listAuditsKey);
        const ids = new Set(data.ids);
        if (previous) {
          queryClient.setQueryData<InfiniteAuditData>(listAuditsKey, {
            ...previous,
            pages: previous.pages.map((p) => p.filter((a) => !ids.has(a.id))),
          });
        }
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(listAuditsKey, ctx.previous);
        toast({
          title: "Couldn't delete",
          description: "Something went wrong. Try again.",
          variant: "destructive",
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listAuditsKey });
        queryClient.invalidateQueries({ queryKey: getGetAuditSummaryQueryKey() });
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
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current = null;
        deleteAudit.mutate({ id: pending.audit.id });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const runBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkDeleteAudits.mutate({ data: { ids } });
    clearSelection();
    setConfirmOpen(false);
  };

  const [trashBannerDismissed, setTrashBannerDismissed] = useState<boolean>(
    () => isDashboardBannerDismissed(),
  );
  const { data: expiringTrashedData } = useListExpiringTrashedAudits(undefined, {
    query: {
      queryKey: getListExpiringTrashedAuditsQueryKey(),
      enabled: isAuthenticated && loadTrashReminderPref() && !trashBannerDismissed,
    },
  });

  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary({
    query: { queryKey: getGetAuditSummaryQueryKey() }
  });
  // Unfiltered "latest" lookup so the "Continue where you left off" card and
  // brand-new-user detection don't disappear when filters are applied below.
  const latestAuditsKey = useMemo(
    () => getListAuditsQueryKey({ limit: 1 }),
    [],
  );
  const { data: latestAuditList, isLoading: latestAuditLoading } =
    useInfiniteQuery({
      queryKey: [...latestAuditsKey, "latest-one"] as const,
      queryFn: ({ signal }) => listAudits({ limit: 1 }, { signal }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
      enabled: isAuthenticated,
    });
  const latestAuditFromQuery = latestAuditList?.pages?.[0]?.[0] ?? null;
  const { data: profiles, isLoading: profilesLoading } = useListProfiles({
    query: { enabled: isAuthenticated, queryKey: getListProfilesQueryKey() },
  });
  const { data: messageSessions, isLoading: messagesLoading } = useListMessageCoachingSessions({
    query: { enabled: isAuthenticated, queryKey: getListMessageCoachingSessionsQueryKey() },
  });
  const { data: insights, isLoading: insightsLoading } = useListInsights({
    query: { enabled: isAuthenticated, queryKey: getListInsightsQueryKey() },
  });

  // "User has any audits" is independent of the active filter — derive from
  // the unfiltered summary / latest lookup so applying a filter that returns
  // no rows doesn't collapse the rest of the dashboard back into demo mode.
  const hasRealAudits =
    (summary?.totalAudits ?? 0) > 0 || !!latestAuditFromQuery;
  const hasFilteredAudits = !!(audits && audits.length > 0);
  const hasProfiles = !!(profiles && profiles.length > 0);
  const hasMessages = !!(messageSessions && messageSessions.length > 0);
  const hasInsights = !!(insights && insights.length > 0);
  const accountDataLoading =
    auditsLoading ||
    latestAuditLoading ||
    profilesLoading ||
    messagesLoading ||
    insightsLoading;
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
  const latestRealAudit = hasRealAudits
    ? latestAuditFromQuery ?? (audits && audits[0]) ?? null
    : null;

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

          {/* Expiring trash banner */}
          {!trashBannerDismissed &&
            loadTrashReminderPref() &&
            expiringTrashedData &&
            expiringTrashedData.audits.length > 0 &&
            (() => {
              const earliest = expiringTrashedData.audits[0]?.deletedAt;
              const left = earliest
                ? Math.max(
                    0,
                    expiringTrashedData.retentionDays -
                      Math.floor(
                        (Date.now() - new Date(earliest).getTime()) /
                          (24 * 60 * 60 * 1000),
                      ),
                  )
                : 0;
              const when =
                left <= 0
                  ? "today"
                  : left === 1
                    ? "tomorrow"
                    : `in ${left} days`;
              const count = expiringTrashedData.audits.length;
              return (
                <motion.div {...fadeUp(0.05)} className="mb-4">
                  <div
                    data-testid="banner-dashboard-trash-expiring"
                    className="flex items-start gap-3 rounded-2xl border border-[hsl(348_55%_55%/0.5)] bg-[hsl(348_55%_55%/0.07)] px-4 py-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(348_55%_68%)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[hsl(348_55%_78%)]">
                        {count === 1
                          ? "1 deleted audit is about to be permanently removed"
                          : `${count} deleted audits are about to be permanently removed`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {count === 1 ? "It" : "The earliest"} purges {when}.{" "}
                        <Link
                          href="/trash"
                          className="underline underline-offset-2 hover:text-foreground transition-colors"
                          data-testid="link-dashboard-trash-expiring"
                        >
                          View Recently deleted
                        </Link>{" "}
                        to restore anything you want to keep.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        dismissDashboardBanner();
                        setTrashBannerDismissed(true);
                      }}
                      className="flex-shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Dismiss expiring trash warning"
                      data-testid="button-dismiss-trash-banner"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })()}

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
          {showDemo && (
            <motion.div {...fadeUp(0.06)} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/3 border border-white/8 mb-4">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_65%_65%)] inline-block flex-shrink-0" />
                <span>You're looking at <strong className="text-foreground/70">sample data</strong> — your real score appears after your first Signal Audit.</span>
              </div>
              <Link href="/signal-check" className="text-xs font-semibold text-[hsl(268_52%_68%)] hover:text-[hsl(268_52%_78%)] transition-colors whitespace-nowrap flex-shrink-0">Get my score →</Link>
            </motion.div>
          )}
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground text-sm">Score History</p>
                    {showDemo && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground/50">Sample</span>}
                  </div>
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
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
              <h2 className="font-semibold text-foreground text-sm">Recent Audits</h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/trash"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Recently deleted
                </Link>
                {hasRealAudits && !selectionMode && staleAudits.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[hsl(43_65%_75%)] hover:text-[hsl(43_65%_85%)] text-xs"
                    onClick={openRefreshPicker}
                    disabled={refreshState.inProgress}
                    data-testid="button-refresh-stale-reports"
                    aria-label={`Refresh ${staleAudits.length} stale ${staleAudits.length === 1 ? "report" : "reports"}`}
                  >
                    <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshState.inProgress ? "animate-spin" : ""}`} />
                    {refreshState.inProgress
                      ? `Refreshing ${refreshState.done}/${refreshState.total}…`
                      : `Refresh stale (${staleAudits.length})`}
                  </Button>
                ) : null}
                {hasRealAudits && (
                  selectionMode ? (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none" data-testid="label-select-all">
                        <Checkbox
                          checked={
                            audits && audits.length > 0 && audits.every((a) => selectedIds.has(a.id))
                              ? true
                              : selectedIds.size > 0
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(checked) => {
                            if (!audits) return;
                            if (checked === true) {
                              setSelectedIds(new Set(audits.map((a) => a.id)));
                              lastClickedIdRef.current = null;
                            } else {
                              setSelectedIds(new Set());
                              lastClickedIdRef.current = null;
                            }
                          }}
                          aria-label="Select all visible audits"
                          data-testid="checkbox-select-all"
                        />
                        Select all
                      </label>
                      <span className="text-xs text-muted-foreground" data-testid="text-selection-count">
                        {selectedIds.size} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={clearSelection}
                        data-testid="button-cancel-select"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs rounded-full"
                        onClick={() => setConfirmOpen(true)}
                        disabled={bulkDeleteAudits.isPending || selectedIds.size === 0}
                        data-testid="button-delete-selected"
                      >
                        Delete selected
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={enterSelectionMode}
                      data-testid="button-enter-select"
                    >
                      Select
                    </Button>
                  )
                )}
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" data-testid="button-new-audit">
                  <Link href="/start">New Audit <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </div>

            {hasRealAudits && !selectionMode && (
              <div className="mb-4 space-y-2.5" data-testid="audits-filters">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name or bio"
                    aria-label="Search audits"
                    className="pl-9 pr-9 h-9 text-sm bg-white/3 border-white/10 rounded-full"
                    data-testid="input-audits-search"
                  />
                  {searchInput.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      data-testid="button-audits-search-clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { value: "newest", label: "Newest", icon: Clock },
                      { value: "topScore", label: "Top score", icon: Trophy },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => {
                    const active = sort === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSort(value)}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-[hsl(268_52%_68%/0.18)] border-[hsl(268_52%_68%/0.5)] text-[hsl(268_52%_88%)]"
                            : "bg-white/3 border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                        }`}
                        aria-pressed={active}
                        data-testid={`chip-sort-${value}`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    );
                  })}
                  <span className="mx-1 self-center h-4 w-px bg-white/10" aria-hidden="true" />
                  {(
                    [
                      { value: "all", label: "All", tone: null },
                      { value: "high", label: "High 75+", tone: "hsl(142 55% 60%)" },
                      { value: "medium", label: "Medium 55–74", tone: "hsl(43 65% 65%)" },
                      { value: "low", label: "Low <55", tone: "hsl(348 55% 65%)" },
                    ] as const
                  ).map(({ value, label, tone }) => {
                    const active = scoreRange === value;
                    const activeStyle = active && tone
                      ? {
                          background: `${tone.replace(")", " / 0.18)")}`,
                          borderColor: `${tone.replace(")", " / 0.5)")}`,
                          color: tone,
                        }
                      : undefined;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScoreRange(value)}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? tone
                              ? ""
                              : "bg-[hsl(268_52%_68%/0.18)] border-[hsl(268_52%_68%/0.5)] text-[hsl(268_52%_88%)]"
                            : "bg-white/3 border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                        }`}
                        style={activeStyle}
                        aria-pressed={active}
                        data-testid={`chip-range-${value}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {auditsLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
            ) : hasRealAudits && !hasFilteredAudits && filtersActive ? (
              <div className="text-center py-10" data-testid="audits-no-results">
                <div className="w-14 h-14 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                  <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground mb-1">No matches found</p>
                <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto leading-relaxed">
                  Nothing matches your search and filters. Try clearing them to see all your audits.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full text-xs"
                  onClick={resetFilters}
                  data-testid="button-reset-audit-filters"
                >
                  Reset filters
                </Button>
              </div>
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
                  const staleHint = staleHintFromGeneratedAt(audit.reportGeneratedAt);
                  const isSelected = selectedIds.has(audit.id);
                  if (selectionMode) {
                    const visibleIds = audits!.map((a) => a.id);
                    const handleRowActivate = (shiftKey: boolean) => {
                      if (shiftKey && lastClickedIdRef.current !== null && lastClickedIdRef.current !== audit.id) {
                        selectRangeTo(audit.id, visibleIds);
                      } else {
                        toggleSelected(audit.id);
                      }
                    };
                    return (
                      <div
                        key={audit.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleRowActivate(e.shiftKey)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleRowActivate(e.shiftKey);
                          }
                        }}
                        className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer card-hover gap-3 ${
                          isSelected
                            ? "border-[hsl(268_52%_68%/0.6)] bg-[hsl(268_52%_68%/0.08)]"
                            : "border-white/6 hover:border-[hsl(268_52%_68%/0.25)] hover:bg-white/2"
                        }`}
                        data-testid={`row-audit-${audit.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelected(audit.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if ((e as React.MouseEvent).shiftKey && lastClickedIdRef.current !== null && lastClickedIdRef.current !== audit.id) {
                                e.preventDefault();
                                selectRangeTo(audit.id, visibleIds);
                              }
                            }}
                            aria-label={`Select ${audit.firstName}'s audit`}
                            data-testid={`checkbox-audit-${audit.id}`}
                          />
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
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${audit.status === "complete" ? "tag-strength border" : "tag-risk border"}`}>{audit.status}</span>
                      </div>
                    );
                  }
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
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Clock className="w-3 h-3 flex-shrink-0" /> {date}
                            <span className="hidden sm:inline">· {audit.currentApps?.join(", ")}</span>
                            {staleHint ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[hsl(43_65%_55%/0.35)] bg-[hsl(43_65%_55%/0.12)] text-[hsl(43_65%_75%)]"
                                data-testid={`badge-stale-${audit.id}`}
                                title="This report was generated more than 30 days ago. Regenerate it for a fresh take."
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                {staleHint}
                              </span>
                            ) : null}
                            {staleHint ? (
                              <button
                                type="button"
                                data-testid={`button-refresh-one-${audit.id}`}
                                aria-label={`Regenerate ${audit.firstName}'s report`}
                                disabled={refreshingIds.has(audit.id)}
                                onClick={(e) => { e.preventDefault(); void handleRefreshOne(audit); }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[hsl(43_65%_55%/0.5)] bg-[hsl(43_65%_55%/0.18)] text-[hsl(43_65%_75%)] hover:bg-[hsl(43_65%_55%/0.28)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RefreshCw className={`w-2.5 h-2.5 ${refreshingIds.has(audit.id) ? "animate-spin" : ""}`} />
                                {refreshingIds.has(audit.id) ? "Regenerating…" : "Regenerate"}
                              </button>
                            ) : null}
                            {debouncedQuery.length > 0 && audit.matchContext ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[hsl(268_52%_55%/0.35)] bg-[hsl(268_52%_55%/0.1)] text-[hsl(268_52%_78%)]"
                                data-testid={`badge-match-${audit.id}`}
                                title={audit.matchContext.snippet ?? undefined}
                              >
                                <Search className="w-2.5 h-2.5" />
                                {audit.matchContext.matchedField === "name" ? "name match" : audit.matchContext.snippet ? `bio: "${audit.matchContext.snippet}"` : "bio match"}
                              </span>
                            ) : null}
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
                {hasNextPage ? (
                  <div
                    ref={loadMoreRef}
                    data-testid="audits-load-more-sentinel"
                    className="h-8 flex items-center justify-center"
                  >
                    {isFetchingNextPage ? (
                      <Skeleton className="h-12 w-full rounded-2xl" />
                    ) : null}
                  </div>
                ) : null}
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
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="dialog-confirm-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedIds.size === 1
                ? "Delete this audit?"
                : `Delete ${selectedIds.size} audits?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size === 1
                ? "This will permanently remove 1 audit. This can't be undone."
                : `This will permanently remove ${selectedIds.size} audits. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          className="max-w-md"
          data-testid="dialog-refresh-stale-picker"
        >
          <DialogHeader>
            <DialogTitle>Refresh stale reports</DialogTitle>
            <DialogDescription>
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
                onClick={() =>
                  setPickerSelected(new Set(staleAudits.map((a) => a.id)))
                }
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
                    ? "border-[hsl(268_52%_68%/0.6)] bg-[hsl(268_52%_68%/0.15)] text-foreground"
                    : "border-white/10 hover:border-white/20 hover:bg-white/4"
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
                      ? "border-[hsl(268_52%_68%/0.5)] bg-[hsl(268_52%_68%/0.08)]"
                      : "border-white/6 hover:bg-white/2"
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
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPickerOpen(false)}
              data-testid="button-refresh-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmRefreshPicker}
              disabled={pickerSelected.size === 0}
              data-testid="button-refresh-picker-confirm"
            >
              Refresh {pickerSelected.size}{" "}
              {pickerSelected.size === 1 ? "report" : "reports"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
