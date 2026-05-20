import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useListAudits, useGetAuditSummary, getGetAuditSummaryQueryKey } from "@workspace/api-client-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  ArrowRight, FileText, MessageSquare, Mail, Settings,
  TrendingUp, AlertTriangle, Clock, Sparkles, Trophy, Eye,
  ChevronRight, FlaskConical, Stethoscope, Zap,
  Wand2, ScanFace, BarChart2, Heart, Compass, BookOpen,
  MessageCircle, User, Map, Brain, Rss, Shield, Users, BarChart, Lightbulb, Layers
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

const QUICK_ACTIONS = [
  { icon: FileText,      label: "New Audit",           desc: "Reanalyze your profile",        href: "/start",                 color: "hsl(268 52% 68%)" },
  { icon: Zap,           label: "Signal Check",         desc: "3-minute quick read",           href: "/signal-check",          color: "hsl(43 65% 65%)"  },
  { icon: FlaskConical,  label: "Chemistry Lab",        desc: "Analyse a message",             href: "/lab",                   color: "hsl(190 55% 60%)" },
  { icon: MessageSquare, label: "Message Coach",        desc: "Get 5 reply options",           href: "/coach",                 color: "hsl(285 45% 62%)" },
  { icon: Stethoscope,   label: "Dating Diagnosis",     desc: "Find your pattern",             href: "/diagnosis",             color: "hsl(348 55% 65%)" },
  { icon: Mail,          label: "Import Patterns",      desc: "Communication style analysis",  href: "/insights",              color: "hsl(142 55% 58%)" },
  { icon: Wand2,         label: "Profile Glow-Up",      desc: "10 rewrites for any platform",  href: "/glow-up",               color: "hsl(268 52% 68%)" },
  { icon: User,          label: "Profile Reader",       desc: "Decode someone's profile",      href: "/profile-reader",        color: "hsl(190 55% 60%)" },
  { icon: MessageCircle, label: "Next Message",         desc: "7 copy-ready options",          href: "/next-message",          color: "hsl(285 45% 62%)" },
  { icon: BarChart2,     label: "Style Map",            desc: "9 dimensions of your style",    href: "/style-map",             color: "hsl(43 65% 65%)"  },
  { icon: BookOpen,      label: "Dating Blueprint",     desc: "Your personalized action plan", href: "/blueprint",             color: "hsl(142 55% 58%)" },
  { icon: ScanFace,      label: "Mirror Profile",       desc: "See yourself as others do",     href: "/mirror",                color: "hsl(268 52% 68%)" },
  { icon: Sparkles,      label: "Dating Archetype",     desc: "6-question shareable quiz",     href: "/archetype",             color: "hsl(43 65% 65%)"  },
  { icon: Heart,         label: "Post-Meeting Reflect", desc: "Pursue / pause / pass read",    href: "/reflection",            color: "hsl(348 55% 65%)" },
  { icon: Eye,           label: "Connection Style",     desc: "Your attachment pattern",       href: "/connection-style",      color: "hsl(285 45% 65%)" },
  { icon: Compass,       label: "Compat. Compass",      desc: "Dynamics that support you",     href: "/compatibility-compass", color: "hsl(142 55% 60%)" },
  { icon: Heart,         label: "Wellness Center",      desc: "8 dimensions of readiness",     href: "/wellness",              color: "hsl(43 65% 65%)"  },
  { icon: Shield,        label: "User Control",         desc: "Approve, edit, export, delete", href: "/user-control",          color: "hsl(142 55% 60%)" },
  { icon: Layers,        label: "Life Context",         desc: "Your approved insights",        href: "/life-context",          color: "hsl(268 52% 68%)" },
  { icon: Eye,           label: "Future Connections",   desc: "Sources we'd consider next",    href: "/future-connections",    color: "hsl(190 55% 60%)" },
  { icon: Settings,      label: "Integrations",         desc: "Manage connections",            href: "/integrations",          color: "hsl(228 18% 55%)" },
  { icon: Map,           label: "Platform Vision",      desc: "See what's coming",             href: "/roadmap",               color: "hsl(43 65% 60%)"  },
  { icon: Clock,         label: "My Timeline",          desc: "Log wins, patterns, questions", href: "/progress/timeline",     color: "hsl(190 55% 60%)" },
  { icon: Brain,         label: "Pattern Board",        desc: "Recurring themes from entries", href: "/progress/patterns",     color: "hsl(268 52% 68%)" },
  { icon: FlaskConical,  label: "Experiments",          desc: "Try it, track it, learn",       href: "/progress/experiments",  color: "hsl(43 65% 65%)"  },
  { icon: MessageSquare, label: "Follow-Up Check",      desc: "Questions tied to your notes",  href: "/progress/followup",     color: "hsl(285 45% 65%)" },
  { icon: BarChart,      label: "Progress Scorecard",   desc: "7 growth dimension meters",     href: "/progress/scorecard",    color: "hsl(142 55% 60%)" },
  { icon: Rss,           label: "Learning Feed",        desc: "Observations from your log",    href: "/progress/feed",         color: "hsl(268 52% 68%)" },
  { icon: Shield,        label: "Control Center",       desc: "Your data, your toggles",       href: "/progress/control",      color: "hsl(228 18% 55%)" },
  { icon: Map,           label: "Insights Roadmap",     desc: "What's being built + controls", href: "/progress/insights-roadmap", color: "hsl(43 65% 65%)" },
  { icon: Heart,         label: "Readiness Guide",      desc: "Goal-based readiness read",     href: "/progress/readiness",    color: "hsl(348 55% 65%)" },
  { icon: Users,         label: "Companion Workspace",  desc: "Copy-ready situation guidance", href: "/progress/companion",    color: "hsl(190 55% 60%)" },
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

export default function Dashboard() {
  useMeta("Your Dashboard", "Your Signal Score history, recent audits, coaching sessions, and quick actions — all in one place.");
  const { data: audits, isLoading: auditsLoading } = useListAudits();
  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary({
    query: { queryKey: getGetAuditSummaryQueryKey() }
  });

  const hasRealAudits = !!(audits && audits.length > 0);
  const displayAudits = hasRealAudits ? audits : DEMO_AUDITS;
  const displaySummary = summary ?? DEMO_SUMMARY;
  const latestScore = displaySummary.latestScore ?? 0;
  const grade = latestScore >= 85 ? "A" : latestScore >= 72 ? "B" : latestScore >= 58 ? "C" : latestScore >= 42 ? "D" : "F";
  const gradeColor = latestScore >= 75 ? "hsl(142 55% 60%)" : latestScore >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const scoreDelta = (displaySummary.latestScore ?? 0) - (displaySummary.scoreHistory[0]?.score ?? 0);
  const nextAction = getNextBestAction(latestScore, hasRealAudits);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-50 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-40 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-6">
            <p className="text-sm text-muted-foreground font-medium mb-1">Welcome back</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Your Dating Blueprint</h1>
          </motion.div>

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

          {/* Signal Score + History */}
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

          {/* Quick Actions */}
          <motion.div {...fadeUp(0.22)} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-foreground text-sm">Your Tools</p>
              <Link href="/roadmap">
                <span className="text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex items-center gap-1">
                  Platform vision <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action, i) => (
                <Link key={i} href={action.href} data-testid={`card-quick-action-${action.label.toLowerCase().replace(/ /g, "-")}`}>
                  <div className="glass border border-white/8 rounded-2xl p-3 sm:p-4 hover:border-[hsl(268_52%_68%/0.3)] hover:shadow-[0_8px_30px_rgb(0_0_0/0.4)] transition-all cursor-pointer h-full card-hover">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center mb-2.5" style={{ background: `${action.color.replace(")", " / 0.12)")}` }}>
                      <action.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: action.color }} />
                    </div>
                    <p className="font-semibold text-foreground text-xs leading-tight">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Audits */}
          <motion.div {...fadeUp(0.26)} className="glass border border-white/8 rounded-3xl p-5 sm:p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-foreground text-sm">Recent Audits</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" data-testid="button-new-audit">
                <Link href="/start">New Audit <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            {auditsLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
            ) : displayAudits.length === 0 ? (
              <div className="text-center py-10">
                <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">No audits yet</p>
                <p className="text-sm text-muted-foreground mb-5">Complete the intake to generate your Dating Blueprint.</p>
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0" data-testid="button-start-first-audit">
                  <Link href="/start">Get My Free Signal Audit</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayAudits.slice().reverse().map((audit) => {
                  const score = audit.readinessScore ?? 0;
                  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
                  const bg    = score >= 75 ? "hsl(142 55% 45% / 0.12)" : score >= 55 ? "hsl(43 65% 55% / 0.12)" : "hsl(348 55% 55% / 0.12)";
                  const date  = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  const reportHref = hasRealAudits ? `/report/${audit.id}` : "/start";
                  return (
                    <Link key={audit.id} href={reportHref} data-testid={`row-audit-${audit.id}`}>
                      <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-white/6 hover:border-[hsl(268_52%_68%/0.25)] hover:bg-white/2 transition-all cursor-pointer card-hover gap-3">
                        <div className="flex items-center gap-3 min-w-0">
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
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium hidden sm:block ${audit.status === "complete" ? "tag-strength border" : "tag-risk border"}`}>{audit.status}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>

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
