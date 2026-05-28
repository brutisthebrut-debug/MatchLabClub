import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  Database,
  Download,
  FileText,
  Heart,
  ListChecks,
  Lock,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
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
} from "@workspace/api-client-react";

const WELLNESS_DIMENSION_COUNT = 18;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function daysAgo(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
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
    <div className="glass rounded-2xl p-5 md:p-6 flex flex-col h-full" data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-[hsl(248_62%_52%/0.10)] flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-[hsl(248_62%_52%)]" aria-hidden="true" />
        </div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="text-3xl md:text-4xl font-serif font-bold text-foreground leading-none mb-1.5" data-testid={`${testId}-value`}>
        {value}
      </div>
      {sub ? <p className="text-xs text-muted-foreground mb-4">{sub}</p> : <div className="mb-4" />}
      {href && cta && (
        <Link
          href={href}
          className="mt-auto text-xs font-semibold text-[hsl(248_62%_52%)] hover:underline inline-flex items-center gap-1"
          data-testid={`${testId}-cta`}
        >
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function CompletenessRing({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const circumference = 2 * Math.PI * 44;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(248 30% 90%)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#wellness-grad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
          <defs>
            <linearGradient id="wellness-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3D35CC" />
              <stop offset="100%" stopColor="#FF2D9B" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold text-foreground leading-none" data-testid="wellness-ring-pct">
            {pct}%
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">complete</span>
        </div>
      </div>
      <div>
        <h3 className="font-serif text-xl font-bold text-foreground mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{sub}</p>
        <Link
          href="/wellness"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(248_62%_52%)] hover:underline"
          data-testid="link-wellness-center"
        >
          Open Wellness Center <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default function SelfHub() {
  useMeta(
    "Your Self Hub — MatchLab Club",
    "Everything we know about you, in one place. Your wellness profile completeness, signal trend, imports, compass reads, journal cadence — and one-tap data export.",
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

  // Derive completeness: count distinct dimensions answered, out of 18.
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

  // Signed-out state
  if (!authLoading && !isAuthenticated) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24 max-w-2xl">
          <div className="glass rounded-3xl p-8 md:p-12 text-center space-y-5" data-testid="self-hub-signed-out">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-[hsl(248_62%_52%/0.10)] flex items-center justify-center">
              <Brain className="h-7 w-7 text-[hsl(248_62%_52%)]" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Your Self Hub</h1>
            <p className="text-muted-foreground leading-relaxed">
              The full picture of what we know about you — wellness completeness, signal trend, your imports and reads,
              journal cadence — in one place. Sign in to see yours.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                onClick={() => login()}
                className="rounded-full px-6 h-11 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] border-0 text-white font-semibold"
                data-testid="button-self-hub-signin"
              >
                Sign in to see mine
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6 h-11 font-semibold" data-testid="link-self-hub-try-free">
                <Link href="/quizzes">Try a quiz first</Link>
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const summaryData = summary.data ?? { audits: 0, profiles: 0, messages: 0, insights: 0, journalEntries: 0, postDateNotes: 0 };
  const compassReadsCount = 0; // Placeholder until T005/T006 ship the /compass/reads endpoint
  const importsCount = 0; // Placeholder until T007/T008 ship /imports

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-10 md:py-14 max-w-6xl">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-8 md:mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-widest text-[hsl(248_62%_52%)] font-bold">Self Hub</span>
            <span className="text-xs text-muted-foreground">· /me</span>
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Hi{user?.firstName ? `, ${user.firstName}` : ""}. Here&rsquo;s what we know about you.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            Your second brain, exposed. Everything below is yours, exportable, and deletable at any time.
            This page is the source of truth for what we have and what we&rsquo;ve done with it.
          </p>
        </motion.div>

        {/* Wellness completeness ring */}
        <motion.div {...fadeUp(0.05)} className="glass rounded-3xl p-6 md:p-8 mb-6 md:mb-8" data-testid="card-wellness-ring">
          <CompletenessRing
            pct={wellnessPct}
            label="Your wellness profile"
            sub={
              distinctDims.size === 0
                ? "You haven't answered any wellness questions yet. Start there — it's what powers everything else."
                : `You've covered ${distinctDims.size} of ${WELLNESS_DIMENSION_COUNT} dimensions. The more you cover, the sharper your compass reads and coaching become.`
            }
          />
        </motion.div>

        {/* Activity grid */}
        <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
          <StatCard
            icon={FileText}
            label="Audits"
            value={summaryData.audits}
            sub={summaryData.audits === 0 ? "Run your first one" : "Across your dating profile"}
            href={summaryData.audits === 0 ? "/start" : "/dashboard"}
            cta={summaryData.audits === 0 ? "Get my audit" : "Open dashboard"}
            testId="stat-audits"
          />
          <StatCard
            icon={MessageSquare}
            label="Message coaching"
            value={summaryData.messages}
            sub={summaryData.messages === 0 ? "Coach a thread" : "Sessions on file"}
            href="/coach"
            cta={summaryData.messages === 0 ? "Coach a reply" : "Open coach"}
            testId="stat-messages"
          />
          <StatCard
            icon={Sparkles}
            label="Insights"
            value={summaryData.insights}
            sub={summaryData.insights === 0 ? "Run your first" : "Pattern reads"}
            href="/insights"
            cta={summaryData.insights === 0 ? "Run insights" : "Open insights"}
            testId="stat-insights"
          />
          <StatCard
            icon={Compass}
            label="Compass reads"
            value={compassReadsCount}
            sub="Coming soon"
            href="/compatibility-compass"
            cta="Try the compass"
            testId="stat-compass"
          />
          <StatCard
            icon={Upload}
            label="Imported sources"
            value={importsCount}
            sub="Hinge / Tinder / Bumble — coming soon"
            testId="stat-imports"
          />
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
            label="Post-date notes"
            value={summaryData.postDateNotes}
            sub={postDateLast ? `Last ${daysAgo(postDateLast)}` : "Log your next debrief"}
            href="/mirror/dates"
            cta={summaryData.postDateNotes === 0 ? "Log a debrief" : "Open debriefs"}
            testId="stat-postdate"
          />
          <StatCard
            icon={ListChecks}
            label="Wellness answers"
            value={wellnessRows.length}
            sub={`${distinctDims.size} of ${WELLNESS_DIMENSION_COUNT} dimensions`}
            href="/wellness"
            cta="Continue wellness"
            testId="stat-wellness"
          />
        </motion.div>

        {/* AI consent posture */}
        <motion.div {...fadeUp(0.15)} className="glass rounded-3xl p-6 md:p-8 mb-6 md:mb-8" data-testid="card-ai-consent">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-[hsl(326_100%_60%/0.12)] flex items-center justify-center flex-shrink-0">
              {consentGranted ? <Brain className="h-5 w-5 text-[hsl(326_100%_60%)]" /> : <Lock className="h-5 w-5 text-[hsl(326_100%_60%)]" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-xl font-bold text-foreground">
                {consentGranted ? "Deep AI lane: on" : "Deep AI lane: off"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {consentGranted
                  ? "Anthropic Claude is layered on top of the deterministic baseline for tools that benefit from semantic depth (bio rewrites, compass synthesis, import summaries). You can turn this off at any time on the Account page."
                  : "You're on the deterministic baseline only — fast, free, and never rate-limited. Turn on Deep AI consent on Account to unlock the semantic layer for the tools that benefit from it."}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button asChild variant="outline" size="sm" className="rounded-full font-semibold" data-testid="link-consent-account">
                  <Link href="/account">{consentGranted ? "Manage AI consent" : "Turn on Deep AI"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Your data summary */}
        <motion.div {...fadeUp(0.2)} className="glass rounded-3xl p-6 md:p-8 mb-6 md:mb-8" data-testid="card-data-controls">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-10 w-10 rounded-xl bg-[hsl(248_62%_52%/0.12)] flex items-center justify-center flex-shrink-0">
              <Database className="h-5 w-5 text-[hsl(248_62%_52%)]" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-foreground">Your data, your call</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Download everything, manage individual rows, or wipe your account entirely.
                No customer-support back-and-forth required.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 ml-14">
            <Button asChild variant="outline" size="sm" className="rounded-full font-semibold" data-testid="link-data-export">
              <Link href="/account">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export everything
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full font-semibold" data-testid="link-data-vault">
              <Link href="/user-control">Manage rows</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full font-semibold" data-testid="link-data-trash">
              <Link href="/trash">Open Trash</Link>
            </Button>
          </div>
        </motion.div>

        {/* Quick actions footer */}
        <motion.div {...fadeUp(0.25)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/quizzes"
            className="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform group"
            data-testid="quick-action-quizzes"
          >
            <Sparkles className="h-5 w-5 text-[hsl(326_100%_60%)] mb-3" />
            <h3 className="font-serif font-bold text-foreground mb-1">Take another quiz</h3>
            <p className="text-xs text-muted-foreground">Each one adds a dimension to your profile.</p>
          </Link>
          <Link
            href="/coach"
            className="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform group"
            data-testid="quick-action-coach"
          >
            <MessageSquare className="h-5 w-5 text-[hsl(248_62%_52%)] mb-3" />
            <h3 className="font-serif font-bold text-foreground mb-1">Coach a reply</h3>
            <p className="text-xs text-muted-foreground">Paste a thread, get 3 options + rationale.</p>
          </Link>
          <Link
            href="/compatibility-compass"
            className="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform group"
            data-testid="quick-action-compass"
          >
            <Compass className="h-5 w-5 text-[hsl(43_65%_62%)] mb-3" />
            <h3 className="font-serif font-bold text-foreground mb-1">Run a compass read</h3>
            <p className="text-xs text-muted-foreground">Drop a match&rsquo;s profile, see the alignment.</p>
          </Link>
        </motion.div>

      </div>
    </AppLayout>
  );
}
