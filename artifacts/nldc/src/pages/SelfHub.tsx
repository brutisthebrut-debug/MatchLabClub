import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubTabs } from "@/components/layout/HubTabs";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, type Variants } from "framer-motion";
import { Instagram } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  Compass,
  Database,
  Download,
  Eye,
  FileText,
  Heart,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  Plug,
  Share2,
  Sparkles,
  Trophy,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useGetAccountSummary,
  getGetAccountSummaryQueryKey,
  useListWellnessAnswers,
  getListWellnessAnswersQueryKey,
  useListJournalEntries,
  getListJournalEntriesQueryKey,
  useListPostDateNotes,
  getListPostDateNotesQueryKey,
  useGetAiContentConsent,
  getGetAiContentConsentQueryKey,
  useSetAiContentConsent,
  useCreateInstagramPaste,
  useGetMatchingState,
  getGetMatchingStateQueryKey,
  useListInsights,
  getListInsightsQueryKey,
  useListCompassReads,
  getListCompassReadsQueryKey,
  useListImports,
  getListImportsQueryKey,
  useGetDatingWins,
  getGetDatingWinsQueryKey,
  useGetMirrorPortrait,
  getGetMirrorPortraitQueryKey,
  useGetMyReferrals,
  getGetMyReferralsQueryKey,
  useGetMySignalMap,
  getGetMySignalMapQueryKey,
} from "@workspace/api-client-react";
import { ClimbCard } from "@/components/climb/ClimbCard";
import { ShareButton } from "@/components/echo/ShareButton";
import { DEMO_PORTRAIT, DEMO_SIGNAL_MAP } from "@/lib/mirrorDemo";
import { SignalDensityMap } from "@/components/SignalDensityMap";
import { SampleDataBadge } from "@/components/SampleDataBadge";

const WELLNESS_DIMENSION_COUNT = 18;

function referralStatusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Ready to match";
    case "building":
      return "Building readiness";
    case "concierge_only":
      return "Concierge";
    case "paused":
      return "Paused";
    case "off":
      return "Not in pool";
    default:
      return "Joined";
  }
}

function referralStatusClass(status: string): string {
  const base = "text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1 flex-shrink-0 border";
  switch (status) {
    case "ready":
      return `${base} bg-emerald-500/10 text-emerald-700 border-emerald-500/20`;
    case "building":
      return `${base} bg-[#3D35CC]/10 text-[#3D35CC] border-[#3D35CC]/20`;
    case "concierge_only":
      return `${base} bg-[#FF2D9B]/10 text-[#FF2D9B] border-[#FF2D9B]/20`;
    default:
      return `${base} bg-black/5 text-muted-foreground border-black/10`;
  }
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
  }
};

function daysAgo(iso?: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return "-";
  const ms = Date.now() - parsed;
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}...` : t;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  cta,
  testId,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  cta?: string;
  testId: string;
}) {
  return (
    <div className="glass rounded-[2rem] p-6 flex flex-col h-full hover:shadow-lg transition-all duration-300 group" data-testid={testId}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5 text-[#3D35CC]" aria-hidden="true" />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
      </div>
      <div className="text-3xl md:text-4xl font-serif font-bold text-foreground leading-none mb-2" data-testid={`${testId}-value`}>
        {value}
      </div>
      {sub ? <p className="text-xs font-medium text-muted-foreground leading-relaxed mb-5">{sub}</p> : <div className="mb-5" />}
      {href && cta && (
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/50 self-start px-3 py-1.5 rounded-full border border-white shadow-sm group-hover:bg-white"
          data-testid={`${testId}-cta`}
        >
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function CompletenessRing({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const circumference = 2 * Math.PI * 44;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
      <div className="relative h-28 w-28 flex-shrink-0 drop-shadow-xl">
        <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" strokeOpacity="0.5" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#wellness-grad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="wellness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3D35CC" />
              <stop offset="100%" stopColor="#FF2D9B" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-full m-2 shadow-inner border border-white/20">
          <span className="font-serif text-2xl font-bold text-foreground leading-none" data-testid="wellness-ring-pct">
            {pct}%
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 font-bold">complete</span>
        </div>
      </div>
      <div className="flex-1">
        <h3 className="font-serif text-2xl font-bold text-foreground mb-2">{label}</h3>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-4">{sub}</p>
        <Link
          href="/wellness"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/50 px-4 py-2 rounded-full border border-white shadow-sm hover:bg-white"
          data-testid="link-wellness-center"
        >
          Open Wellness Center <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

type SignalSource = {
  key: string;
  label: string;
  icon: typeof Activity;
  active: boolean;
  href?: string;
  state: "live" | "building";
};

function SignalDensityPanel({ sources }: { sources: SignalSource[] }) {
  const liveSources = sources.filter((s) => s.state === "live");
  const active = liveSources.filter((s) => s.active).length;
  const total = liveSources.length;
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  
  return (
    <div data-testid="signal-density-panel">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl font-bold text-foreground mb-2">Sources plugged in</h3>
          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
            {active} of {total} live sources connected. Each one the machine reads fills a lane above.
          </p>
        </div>
        <Link
          href="/connections"
          className="hidden sm:inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/50 px-4 py-2 rounded-full border border-white shadow-sm hover:bg-white"
          data-testid="link-signal-density-connections"
        >
          <Plug className="h-3.5 w-3.5" /> Plug in another
        </Link>
      </div>
      <div
        className="h-3 rounded-full bg-black/5 overflow-hidden mb-6 shadow-inner"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] transition-all duration-1000 ease-out relative overflow-hidden"
          style={{ width: `${pct}%` }}
          data-testid="signal-density-bar"
        >
          <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sources.map((s) => {
          const isLiveActive = s.state === "live" && s.active;
          const isLiveIdle = s.state === "live" && !s.active;
          const isBuilding = s.state === "building";
          
          const tileClasses = [
            "flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all h-full",
            isLiveActive && "border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 shadow-sm",
            isLiveIdle && "border-white/60 bg-white/40 hover:bg-white/60 shadow-sm",
            isBuilding && "border-dashed border-black/10 bg-transparent opacity-60",
          ].filter(Boolean).join(" ");
          
          const iconClasses = [
            "h-4.5 w-4.5 flex-shrink-0",
            isLiveActive && "text-[#3D35CC]",
            (isLiveIdle || isBuilding) && "text-muted-foreground",
          ].filter(Boolean).join(" ");
          
          const tile = (
            <div className={tileClasses}>
              <s.icon className={iconClasses} aria-hidden="true" />
              <span className="text-xs font-bold text-foreground truncate flex-1">{s.label}</span>
              {isLiveActive && <span className="text-[9px] font-bold uppercase tracking-widest text-[#3D35CC] bg-white px-2 py-0.5 rounded-full border border-indigo-500/10 shadow-sm">ON</span>}
              {isLiveIdle && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-white px-2 py-0.5 rounded-full shadow-sm">add</span>}
              {isBuilding && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-black/5 px-2 py-0.5 rounded-full">soon</span>}
            </div>
          );
          
          return s.href && !isBuilding ? (
            <Link key={s.key} href={s.href} data-testid={`signal-tile-${s.key}`} className="block h-full group">
              {tile}
            </Link>
          ) : (
            <div key={s.key} data-testid={`signal-tile-${s.key}`} className="h-full">
              {tile}
            </div>
          );
        })}
      </div>
      <div className="sm:hidden mt-6 text-center">
        <Link
          href="/connections"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/50 px-4 py-2 rounded-full border border-white shadow-sm"
          data-testid="link-signal-density-connections-mobile"
        >
          <Plug className="h-3.5 w-3.5" /> Plug in another source
        </Link>
      </div>
    </div>
  );
}

type StreamKind = "insight" | "compass" | "journal" | "postdate" | "win" | "import";

type StreamItem = {
  key: string;
  kind: StreamKind;
  title: string;
  detail: string;
  href: string;
  occurredAt: string;
};

const STREAM_ICONS: Record<StreamKind, LucideIcon> = {
  insight: Sparkles,
  compass: Compass,
  journal: BookOpen,
  postdate: Heart,
  win: Trophy,
  import: Upload,
};

const DEMO_STREAM: StreamItem[] = [
  {
    key: "demo-insight",
    kind: "insight",
    title: "Hinge · message history",
    detail: "Pattern read ready",
    href: "/insights",
    occurredAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    key: "demo-compass",
    kind: "compass",
    title: "Compass read on secure and direct",
    detail: "You scored a connection. Real signal on what draws you.",
    href: "/compatibility-compass",
    occurredAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
  {
    key: "demo-win",
    kind: "win",
    title: "Dating win logged",
    detail: "Sent the first message without overthinking it.",
    href: "/progress/wins",
    occurredAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    key: "demo-journal",
    kind: "journal",
    title: "What I actually want this year",
    detail: "A reflection folded into your Mirror.",
    href: "/mirror/journal",
    occurredAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    key: "demo-import",
    kind: "import",
    title: "Calendar import",
    detail: "A whole export folded into your picture.",
    href: "/imports",
    occurredAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
  },
];

function InsightStream({
  items,
  isLoading,
  isDemo,
}: {
  items: StreamItem[];
  isLoading: boolean;
  isDemo: boolean;
}) {
  const shown = items.slice(0, 8);
  return (
    <div data-testid="insight-stream">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h3 className="font-serif text-2xl font-bold text-foreground">Recent activity</h3>
            {isDemo && (
              <SampleDataBadge label="Sample view" tone="rose" size="xs" testId="insight-stream-sample" />
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
            The latest signals your second brain folded in, newest first.
          </p>
        </div>
        <Link
          href="/progress/feed"
          className="flex-shrink-0 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors inline-flex items-center gap-1.5 bg-white/50 px-4 py-2 rounded-full border border-white shadow-sm hover:bg-white"
          data-testid="link-insight-stream-all"
        >
          Open feed <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-[1.5rem] bg-white/40 animate-pulse border border-white/60" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div
          className="rounded-[1.5rem] border border-dashed border-black/10 bg-white/30 p-8 text-center"
          data-testid="insight-stream-empty"
        >
          <div className="mx-auto h-12 w-12 rounded-full bg-white/80 flex items-center justify-center shadow-sm mb-4">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-5 max-w-sm mx-auto">
            Nothing here yet. Feed your first signal and it shows up here right away.
          </p>
          <Button
            asChild
            variant="outline"
            className="rounded-full font-bold bg-white shadow-sm hover:shadow-md transition-shadow"
            data-testid="button-insight-stream-empty-cta"
          >
            <Link href="/scan">Feed my first signal</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((item, index) => {
            const Icon = STREAM_ICONS[item.kind];
            return (
              <motion.li
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={item.key}
                className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[1.5rem] border border-white/60 bg-white/40 px-5 py-4 hover:bg-white/60 transition-colors shadow-sm group"
                data-testid={`insight-stream-item-${item.key}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                    <Icon className="h-5 w-5 text-[#FF2D9B]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate mb-1">{item.title}</p>
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {item.detail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:border-l sm:border-black/5 sm:pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-white/60 px-2.5 py-1 rounded-full border border-white">
                    {daysAgo(item.occurredAt)}
                  </span>
                  <Link
                    href={item.href}
                    className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-[#3D35CC] hover:text-white hover:bg-[#3D35CC] shadow-sm transition-colors shrink-0"
                    data-testid={`insight-stream-open-${item.key}`}
                    aria-label={`Open ${item.title}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SelfHub() {
  useMeta(
    "Your Self Hub. MatchLab Club",
    "Everything we know about you, in one place. Your wellness profile completeness, signal trend, imports, compass reads, journal cadence, and one-tap data export.",
  );

  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const summary = useGetAccountSummary({
    query: { queryKey: getGetAccountSummaryQueryKey(), enabled: isAuthenticated },
  });
  const consent = useGetAiContentConsent({
    query: { queryKey: getGetAiContentConsentQueryKey(), enabled: isAuthenticated },
  });
  const wellness = useListWellnessAnswers(undefined, {
    query: { queryKey: getListWellnessAnswersQueryKey(), enabled: isAuthenticated },
  });
  const journal = useListJournalEntries(undefined, {
    query: { queryKey: getListJournalEntriesQueryKey(), enabled: isAuthenticated },
  });
  const postDate = useListPostDateNotes(undefined, {
    query: { queryKey: getListPostDateNotesQueryKey(), enabled: isAuthenticated },
  });
  const matchingState = useGetMatchingState({
    query: { queryKey: getGetMatchingStateQueryKey(), enabled: isAuthenticated },
  });
  const insights = useListInsights({
    query: { queryKey: getListInsightsQueryKey(), enabled: isAuthenticated },
  });
  const compassReads = useListCompassReads({
    query: { queryKey: getListCompassReadsQueryKey(), enabled: isAuthenticated },
  });
  const imports = useListImports({
    query: { queryKey: getListImportsQueryKey(), enabled: isAuthenticated },
  });
  const datingWins = useGetDatingWins({
    query: { queryKey: getGetDatingWinsQueryKey(), enabled: isAuthenticated },
  });
  const signalMap = useGetMySignalMap({
    query: { queryKey: getGetMySignalMapQueryKey(), enabled: isAuthenticated },
  });
  const mirrorPortrait = useGetMirrorPortrait({
    query: { queryKey: getGetMirrorPortraitQueryKey(), enabled: isAuthenticated, retry: false },
  });
  const myReferrals = useGetMyReferrals({
    query: { queryKey: getGetMyReferralsQueryKey(), enabled: isAuthenticated, retry: false },
  });
  
  const referrals = myReferrals.data;
  const referralInvitees = referrals?.invitees ?? [];

  const wellnessRows = (wellness.data?.answers ?? []) as Array<{ dimension?: string }>;
  const distinctDims = new Set(wellnessRows.map(r => r.dimension).filter(Boolean));
  const wellnessPct = Math.min(
    100,
    Math.round((distinctDims.size / WELLNESS_DIMENSION_COUNT) * 100),
  );

  const journalRows = (journal.data?.entries ?? []) as Array<{ createdAt?: string }>;
  const journalLast7 = journalRows.filter(j => {
    if (!j.createdAt) return false;
    return Date.now() - new Date(j.createdAt).getTime() < 7 * 86_400_000;
  }).length;
  const journalLast = journalRows[0]?.createdAt;

  const postDateRows = (postDate.data?.notes ?? []) as Array<{ createdAt?: string }>;
  const postDateLast = postDateRows[0]?.createdAt;

  const consentGranted = Boolean(consent.data?.granted);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setConsent = useSetAiContentConsent();
  const igPaste = useCreateInstagramPaste();
  const [igBio, setIgBio] = useState("");
  const [igCaptions, setIgCaptions] = useState("");

  const handleConsentToggle = (next: boolean) => {
    setConsent.mutate(
      { data: { granted: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAiContentConsentQueryKey() });
          toast({
            title: next ? "AI on your content is on" : "AI on your content is off",
            description: next
              ? "Your bios, messages, and pastes can now be sent to Claude for deeper analysis."
              : "We will stick to the deterministic baseline. You can switch this back on anytime.",
          });
        },
        onError: () => {
          toast({
            title: "Could not save your choice",
            description: "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleInstagramSubmit = () => {
    const bio = igBio.trim();
    const captions = igCaptions
      .split(/\r?\n/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .slice(0, 10);
      
    if (!bio) {
      toast({
        title: "Add a bio first",
        description: "Paste your Instagram bio so we have something to read.",
        variant: "destructive",
      });
      return;
    }
    igPaste.mutate(
      { data: { bio: bio.slice(0, 500), recentCaptions: captions.map(c => c.slice(0, 800)) } },
      {
        onSuccess: () => {
          setIgBio("");
          setIgCaptions("");
          queryClient.invalidateQueries({ queryKey: getGetMatchingStateQueryKey() });
          toast({
            title: "We got it",
            description: "Your tone read will be ready in a minute. It also moves your Match Readiness.",
          });
        },
        onError: () => {
          toast({
            title: "Could not save that paste",
            description: "Something went wrong on our end. Try again in a moment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <AppLayout>
        <HubTabs hub="mirror" />
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-3xl relative z-10">
          <div className="glass-strong rounded-[2rem] p-10 md:p-16 text-center space-y-8 relative overflow-hidden" data-testid="self-hub-signed-out">
            <div className="absolute top-0 right-0 p-12 opacity-40 pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-gradient-to-br from-[#3D35CC]/20 to-[#FF2D9B]/20 blur-3xl" />
            </div>
            <div className="absolute bottom-0 left-0 p-12 opacity-40 pointer-events-none">
              <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-[#3D35CC]/20 to-[#FF2D9B]/20 blur-3xl" />
            </div>
            
            <div className="relative z-10">
              <div className="mx-auto h-20 w-20 rounded-3xl bg-white shadow-md flex items-center justify-center mb-8">
                <Brain className="h-10 w-10 text-[#3D35CC]" />
              </div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground">Your Self Hub</h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto font-medium">
                The full picture of what we know about you, wellness completeness, signal trend, your imports and reads,
                journal cadence, in one place. Sign in to see yours.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                <Button
                  onClick={() => login()}
                  className="rounded-full px-8 h-14 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  data-testid="button-self-hub-signin"
                >
                  Sign in to see mine
                </Button>
                <Button asChild variant="outline" className="rounded-full px-8 h-14 font-bold text-base bg-white shadow-sm hover:shadow-md transition-shadow" data-testid="link-self-hub-try-free">
                  <Link href="/quizzes">Try a quiz first</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const summaryData = summary.data ?? { audits: 0, profiles: 0, messages: 0, insights: 0, journalEntries: 0, postDateNotes: 0 };
  const compassReadsCount = compassReads.data?.reads.length ?? 0;
  const importsCount = imports.data?.imports.length ?? 0;
  const winsCount = datingWins.data?.length ?? 0;
  
  const streamItems: StreamItem[] = [
    ...(insights.data ?? []).map((i) => ({
      key: `insight-${i.id}`,
      kind: "insight" as const,
      title: `${i.sourceApp ? `${i.sourceApp} · ` : ""}${i.sourceLabel}`,
      detail:
        i.status === "complete"
          ? "Pattern read ready"
          : i.status === "analyzing"
            ? "Analyzing your patterns"
            : "Queued for analysis",
      href: "/insights",
      occurredAt: i.createdAt,
    })),
    ...(compassReads.data?.reads ?? []).map((r) => ({
      key: `compass-${r.id}`,
      kind: "compass" as const,
      title: `Compass read on ${truncate(r.connectionStyle, 48)}`,
      detail: "You scored a connection. Real signal on what draws you.",
      href: "/compatibility-compass",
      occurredAt: r.createdAt,
    })),
    ...(journal.data?.entries ?? []).map((j) => ({
      key: `journal-${j.id}`,
      kind: "journal" as const,
      title: j.prompt ? truncate(j.prompt, 60) : "Journal entry",
      detail: "A reflection folded into your Mirror.",
      href: "/mirror/journal",
      occurredAt: j.createdAt,
    })),
    ...(postDate.data?.notes ?? []).map((n) => ({
      key: `postdate-${n.id}`,
      kind: "postdate" as const,
      title: n.personLabel
        ? `Post-date note on ${truncate(n.personLabel, 40)}`
        : "Post-date note",
      detail: "You logged how a date actually went.",
      href: "/mirror/dates",
      occurredAt: n.createdAt,
    })),
    ...(datingWins.data ?? []).map((w) => ({
      key: `win-${w.id}`,
      kind: "win" as const,
      title: "Dating win logged",
      detail: truncate(w.body, 90),
      href: "/progress/wins",
      occurredAt: w.createdAt,
    })),
    ...(imports.data?.imports ?? []).map((im) => ({
      key: `import-${im.id}`,
      kind: "import" as const,
      title: `${im.source} import`,
      detail:
        im.status === "complete"
          ? "A whole export folded into your picture."
          : `Import ${im.status}`,
      href: "/imports",
      occurredAt: im.uploadedAt,
    })),
  ].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  
  const shownStream =
    !insights.isLoading && !compassReads.isLoading && !journal.isLoading && !postDate.isLoading && streamItems.length === 0
      ? []
      : streamItems.length > 0
        ? streamItems
        : DEMO_STREAM;
  const streamIsDemo =
    streamItems.length === 0 && !insights.isLoading && !compassReads.isLoading;

  const shownPortrait = mirrorPortrait.data ?? DEMO_PORTRAIT;
  const isDemoPortrait = !mirrorPortrait.data;

  const shownSignalMap = signalMap.data ?? DEMO_SIGNAL_MAP;
  const isDemoSignalMap = !signalMap.data;

  return (
    <AppLayout>
      <HubTabs hub="mirror" />
      <div className="container mx-auto px-4 md:px-8 py-10 md:py-16 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="mb-12">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 border border-white shadow-sm mb-4 text-xs font-bold text-foreground">
              <UserPlus className="h-3.5 w-3.5 text-[#3D35CC]" />
              Me
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B]">Self Hub</span>
            </h1>
            <p className="mt-4 text-base md:text-lg font-medium text-muted-foreground leading-relaxed max-w-2xl">
              Everything we know about you, in one place. Your profile completeness, connected signals, imports, and controls.
            </p>
          </motion.div>
        </motion.div>

        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
          
          <motion.div variants={fadeUp}>
            <div className="glass-strong rounded-[2rem] p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-30 pointer-events-none">
                <div className="w-64 h-64 rounded-full bg-gradient-to-br from-[#3D35CC]/20 to-transparent blur-3xl" />
              </div>
              <div className="relative z-10">
                <CompletenessRing
                  pct={wellnessPct}
                  label="Wellness Profile"
                  sub="Your internal baseline. The more you answer, the better we can spot matches who align with your core values."
                />
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <motion.div variants={fadeUp} className="lg:col-span-8">
              <div className="glass-elevated rounded-[2rem] p-6 md:p-10 h-full" data-testid="card-mirror-hero">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Eye className="h-5 w-5 text-[#3D35CC]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Latest Mirror read</p>
                      <h2 className="font-serif text-2xl font-bold text-foreground">Your Mirror</h2>
                    </div>
                  </div>
                  <Link
                    href="/your-mirror"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3D35CC] hover:text-[#FF2D9B] transition-colors bg-white/60 px-4 py-2 rounded-full border border-white shadow-sm hover:bg-white shrink-0"
                    data-testid="mirror-hero-open"
                  >
                    Open Your Mirror <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                
                <div className="bg-white/40 rounded-2xl border border-white/60 p-6 shadow-sm mb-6">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="px-2.5 py-1 bg-[#3D35CC]/10 text-[#3D35CC] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#3D35CC]/20">
                      {shownPortrait.stageLabel}
                    </span>
                    <span className="px-2.5 py-1 bg-white text-muted-foreground text-[10px] font-bold uppercase tracking-widest rounded-full border border-black/5 shadow-sm">
                      {shownPortrait.coveragePercent}% of you mapped
                    </span>
                    {isDemoPortrait && (
                      <SampleDataBadge label="Sample view" tone="rose" size="xs" />
                    )}
                  </div>
                  <p className="font-serif text-xl md:text-2xl font-bold text-foreground leading-snug mb-3" data-testid="mirror-hero-headline">
                    {shownPortrait.headline}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {shownPortrait.stageBlurb}
                  </p>
                </div>
                
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  The full portrait, your blind spots, and the one move that sharpens you most live in Your Mirror. This card is just the latest snapshot.
                </p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col gap-6">
              <StatCard
                icon={Sparkles}
                label="Insights"
                value={summaryData.insights}
                sub={summaryData.insights === 0 ? "Extract your first insight" : "Deep reads extracted"}
                href="/insights"
                cta={summaryData.insights === 0 ? "Get an insight" : "View insights"}
                testId="stat-insights"
              />
              <StatCard
                icon={Compass}
                label="Compass"
                value={compassReadsCount}
                sub={compassReadsCount === 0 ? "Run your first read" : "Compatibility reads saved"}
                href="/compatibility-compass"
                cta={compassReadsCount === 0 ? "Try the compass" : "Open compass"}
                testId="stat-compass"
              />
            </motion.div>
          </div>

          <motion.div variants={fadeUp}>
            <div className="glass rounded-[2rem] p-6 md:p-10">
              <SignalDensityPanel
                sources={[
                  { key: "wellness", label: "Wellness", icon: ListChecks, active: wellnessRows.length > 0, state: "live", href: "/wellness" },
                  { key: "journal", label: "Journal", icon: BookOpen, active: summaryData.journalEntries > 0, state: "live", href: "/mirror/journal" },
                  { key: "postdate", label: "Post-date", icon: Heart, active: summaryData.postDateNotes > 0, state: "live", href: "/mirror/dates" },
                  { key: "compass", label: "Compass", icon: Compass, active: compassReadsCount > 0, state: "live", href: "/compatibility-compass" },
                  { key: "wins", label: "Wins", icon: Trophy, active: winsCount > 0, state: "live", href: "/progress/wins" },
                  { key: "imports", label: "Exports", icon: Upload, active: importsCount > 0, state: "live", href: "/imports" },
                  { key: "instagram", label: "Instagram", icon: Instagram, active: false, state: "live", href: "#instagram-paste" },
                  { key: "spotify", label: "Spotify", icon: Activity, active: false, state: "building" },
                ]}
              />
              
              <div className="mt-10 border-t border-black/5 pt-10">
                <SignalDensityMap map={shownSignalMap} isDemo={isDemoSignalMap} />
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div variants={fadeUp} className="h-full">
              <div className="glass rounded-[2rem] p-6 md:p-8 h-full">
                <InsightStream
                  items={shownStream}
                  isLoading={insights.isLoading || compassReads.isLoading || journal.isLoading || postDate.isLoading}
                  isDemo={streamIsDemo}
                />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-6">
                <StatCard
                  icon={BookOpen}
                  label="Journal"
                  value={summaryData.journalEntries}
                  sub={journalLast7 > 0 ? `${journalLast7} in last 7d · last ${daysAgo(journalLast)}` : "No recent entries"}
                  href="/mirror/journal"
                  cta={summaryData.journalEntries === 0 ? "Start journaling" : "Open journal"}
                  testId="stat-journal"
                />
                <StatCard
                  icon={Heart}
                  label="Post-date"
                  value={summaryData.postDateNotes}
                  sub={postDateLast ? `Last ${daysAgo(postDateLast)}` : "Log your next debrief"}
                  href="/mirror/dates"
                  cta={summaryData.postDateNotes === 0 ? "Log a debrief" : "Open debriefs"}
                  testId="stat-postdate"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <StatCard
                  icon={Upload}
                  label="Imports"
                  value={importsCount}
                  sub={importsCount === 0 ? "Hinge / Grindr / Feeld" : "Exports on file"}
                  href="/imports"
                  cta={importsCount === 0 ? "Import data" : "Manage imports"}
                  testId="stat-imports"
                />
                <StatCard
                  icon={Trophy}
                  label="Wins"
                  value={winsCount}
                  sub={winsCount === 0 ? "Log your first win" : "Moments worth keeping"}
                  href="/progress/wins"
                  cta={winsCount === 0 ? "Log a win" : "Open wins log"}
                  testId="stat-wins"
                />
              </div>
            </motion.div>
          </div>

          <motion.div variants={fadeUp}>
            <div className="glass rounded-[2rem] p-6 md:p-10 border border-indigo-500/20" data-testid="card-ai-consent">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    {consentGranted ? <Brain className="h-6 w-6 text-[#3D35CC]" /> : <Lock className="h-6 w-6 text-[#3D35CC]" />}
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Use AI on my content</h2>
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-xl">
                      When on, your bios, messages, and pastes can be sent to Claude for deeper analysis. Off by default. Switch anytime.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 sm:self-center ml-16 sm:ml-0">
                  <Button asChild variant="outline" className="rounded-full font-bold bg-white/60 border-white shadow-sm hover:bg-white" data-testid="link-consent-account">
                    <Link href="/account">Manage settings</Link>
                  </Button>
                  <Switch
                    checked={consentGranted}
                    onCheckedChange={handleConsentToggle}
                    disabled={consent.isLoading || setConsent.isPending}
                    aria-label="Use AI on my content"
                    data-testid="switch-ai-content-consent"
                    className="scale-110"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} id="instagram-paste">
            <div className="glass-strong rounded-[2rem] p-8 md:p-10" data-testid="card-instagram-paste">
              <div className="flex items-start gap-5 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-[#FF2D9B]/10 flex items-center justify-center shrink-0">
                  <Instagram className="h-6 w-6 text-[#FF2D9B]" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
                    Import from Instagram <span className="text-[10px] uppercase tracking-widest text-[#FF2D9B] bg-[#FF2D9B]/10 px-2 py-0.5 rounded-full ml-2 align-middle">Beta</span>
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">
                    Paste your bio and a handful of recent captions. We will use them to read your tone and write things that sound like you. Nothing leaves this account.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="ig-bio" className="text-sm font-bold text-foreground">
                    Your Instagram bio
                  </Label>
                  <Textarea
                    id="ig-bio"
                    value={igBio}
                    onChange={e => setIgBio(e.target.value.slice(0, 500))}
                    placeholder="Paste your bio here..."
                    rows={4}
                    maxLength={500}
                    className="resize-none rounded-2xl bg-white/60 border-white/80 shadow-sm focus-visible:ring-[#FF2D9B]/30"
                    data-testid="input-instagram-bio"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px] font-bold text-muted-foreground bg-white/50 px-2 py-0.5 rounded-full border border-white">{igBio.length}/500</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="ig-captions" className="text-sm font-bold text-foreground">
                    Recent captions
                  </Label>
                  <Textarea
                    id="ig-captions"
                    value={igCaptions}
                    onChange={e => setIgCaptions(e.target.value)}
                    placeholder="Paste 5 to 10 recent captions, one per line..."
                    rows={4}
                    className="resize-none rounded-2xl bg-white/60 border-white/80 shadow-sm focus-visible:ring-[#FF2D9B]/30"
                    data-testid="input-instagram-captions"
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end">
                <Button
                  onClick={handleInstagramSubmit}
                  disabled={igPaste.isPending || !igBio.trim()}
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                  data-testid="button-instagram-submit"
                >
                  <Sparkles className="mr-2 h-4.5 w-4.5" />
                  {igPaste.isPending ? "Analyzing tone..." : "Send to MatchLab"}
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <div className="glass rounded-[2rem] p-8" data-testid="card-data-controls">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-slate-500/10 flex items-center justify-center shrink-0">
                  <Database className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">Your data, your call</h2>
                  <p className="text-sm font-medium text-muted-foreground mt-1">
                    Download everything, manage individual rows, or wipe your account entirely.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 ml-14">
                <Button asChild variant="outline" className="rounded-full font-bold bg-white/60 border-white shadow-sm hover:bg-white" data-testid="link-data-export">
                  <Link href="/account">
                    <Download className="h-4 w-4 mr-2" /> Export everything
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full font-bold bg-white/60 border-white shadow-sm hover:bg-white" data-testid="link-data-vault">
                  <Link href="/user-control">Manage rows</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full font-bold bg-white/60 border-white shadow-sm hover:bg-white text-rose-600 hover:text-rose-700" data-testid="link-data-trash">
                  <Link href="/trash">Open Trash</Link>
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <div className="glass-elevated rounded-[2rem] p-8 md:p-10 border border-[#FF2D9B]/20 bg-gradient-to-br from-[#FF2D9B]/5 to-transparent">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-2xl font-bold text-foreground mb-3">Pull a friend in</h3>
                  <p className="text-base font-medium text-muted-foreground leading-relaxed max-w-xl">
                    The most useful thing here gets better when the people around you can read their own signals too. Send them a quiz, takes 2 minutes, no signup.
                  </p>
                </div>
                <ShareButton
                  surface="self-hub"
                  title="Read your dating signals, free in 2 minutes"
                  text={`I've been using MatchLab Club as a second brain for my dating life, quiz, audit, message coach, the whole thing. Try a quiz, see what your patterns actually say about you.`}
                  path="/quizzes"
                  ref={user?.id ? `user-${user.id}` : "self-hub"}
                  variant="primary"
                  label="Send a quiz to a friend"
                  className="rounded-full px-8 h-12 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all shrink-0"
                  testId="button-share-self-hub"
                />
              </div>

              {isAuthenticated && (
                <div className="mt-10 pt-10 border-t border-[#FF2D9B]/10" data-testid="card-referral-reflection">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-2xl bg-[#FF2D9B]/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-[#FF2D9B]" />
                    </div>
                    <h4 className="font-serif text-xl font-bold text-foreground">Who you've pulled in</h4>
                  </div>
                  
                  {referralInvitees.length === 0 ? (
                    <p className="text-sm font-medium text-muted-foreground leading-relaxed bg-white/40 p-6 rounded-2xl border border-white/50 text-center" data-testid="text-referral-empty">
                      No one has joined from your invites yet. Everyone you bring in near you grows the local pool, which is what makes a real match possible. Share your link above to get started.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="rounded-2xl bg-white/60 border border-white p-4 text-center shadow-sm" data-testid="stat-referral-joined">
                          <div className="font-serif text-3xl font-bold text-foreground mb-1">{referrals?.summary.joined ?? 0}</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Joined</div>
                        </div>
                        <div className="rounded-2xl bg-[#3D35CC]/5 border border-[#3D35CC]/10 p-4 text-center shadow-sm" data-testid="stat-referral-in-pool">
                          <div className="font-serif text-3xl font-bold text-[#3D35CC] mb-1">{referrals?.summary.inPool ?? 0}</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold text-[#3D35CC]/80">In the pool</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-4 text-center shadow-sm" data-testid="stat-referral-ready">
                          <div className="font-serif text-3xl font-bold text-emerald-600 mb-1">{referrals?.summary.ready ?? 0}</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-600/80">Ready to match</div>
                        </div>
                      </div>
                      <ul className="grid sm:grid-cols-2 gap-3" data-testid="list-referral-invitees">
                        {referralInvitees.map((invitee, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-white/60 border border-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                            data-testid={`row-referral-invitee-${i}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-bold text-foreground truncate">{invitee.displayName}</span>
                            </div>
                            <span className={referralStatusClass(invitee.status)} data-testid={`badge-referral-status-${i}`}>
                              {referralStatusLabel(invitee.status)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="text-xs font-medium text-muted-foreground mt-6 leading-relaxed max-w-2xl mx-auto text-center">
                    We only show you a first name and where each person is in the pool. We never share their contact details, and they control their own data the same way you control yours.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <Link
              href="/quizzes"
              className="glass rounded-[2rem] p-6 hover:-translate-y-1 transition-all duration-300 group shadow-sm hover:shadow-md border border-white/60 hover:border-white"
              data-testid="quick-action-quizzes"
            >
              <div className="h-12 w-12 rounded-2xl bg-[#FF2D9B]/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Sparkles className="h-6 w-6 text-[#FF2D9B]" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">Take a quiz</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">Each one adds a dimension to your profile.</p>
            </Link>
            <Link
              href="/coach"
              className="glass rounded-[2rem] p-6 hover:-translate-y-1 transition-all duration-300 group shadow-sm hover:shadow-md border border-white/60 hover:border-white"
              data-testid="quick-action-coach"
            >
              <div className="h-12 w-12 rounded-2xl bg-[#3D35CC]/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <MessageSquare className="h-6 w-6 text-[#3D35CC]" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">Coach a reply</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">Paste a thread, get 3 options + rationale.</p>
            </Link>
            <Link
              href="/compatibility-compass"
              className="glass rounded-[2rem] p-6 hover:-translate-y-1 transition-all duration-300 group shadow-sm hover:shadow-md border border-white/60 hover:border-white"
              data-testid="quick-action-compass"
            >
              <div className="h-12 w-12 rounded-2xl bg-[#131234]/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Compass className="h-6 w-6 text-[#131234]" />
              </div>
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">Run compass</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">Drop a match's profile, see the alignment.</p>
            </Link>
          </motion.div>

        </motion.div>
      </div>
    </AppLayout>
  );
}
