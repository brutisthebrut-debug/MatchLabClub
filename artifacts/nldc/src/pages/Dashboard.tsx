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
  ChevronRight, FlaskConical, Stethoscope, Zap
} from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const glowColor = score >= 75 ? "hsl(142 55% 60% / 0.4)" : score >= 55 ? "hsl(43 65% 65% / 0.3)" : "hsl(348 55% 65% / 0.3)";
  return (
    <div className="relative w-40 h-40 mx-auto" data-testid="score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" style={{ filter: `drop-shadow(0 0 18px ${glowColor})` }}>
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke="hsl(232 28% 20%)" fill="none" />
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground" data-testid="score-number">{score}</span>
        <span className="text-xs text-muted-foreground font-medium">Signal Score</span>
      </div>
    </div>
  );
}

const SIGNAL_BARS = [
  { label: "Warmth", value: 78, color: "hsl(348 55% 65%)" },
  { label: "Confidence", value: 72, color: "hsl(268 52% 68%)" },
  { label: "Specificity", value: 50, color: "hsl(285 45% 65%)" },
  { label: "Playfulness", value: 55, color: "hsl(43 65% 65%)" },
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
  { label: "You come across as...", values: ["Genuine", "Thoughtful", "Warm"], color: "tag-strength border" },
  { label: "You may unintentionally project...", values: ["Slightly guarded", "Generic (pre-audit)"], color: "tag-risk border" },
  { label: "Your conversation energy is...", values: ["Curious", "Attentive", "Measured"], color: "tag-violet border" },
];

const QUICK_ACTIONS = [
  { icon: FileText,     label: "New Audit",          desc: "Reanalyze your profile",        href: "/start",        color: "hsl(268 52% 68%)" },
  { icon: Zap,          label: "Signal Check",        desc: "3-minute quick read",           href: "/signal-check", color: "hsl(43 65% 65%)" },
  { icon: FlaskConical, label: "Chemistry Lab",       desc: "Analyse a message",             href: "/lab",          color: "hsl(190 55% 60%)" },
  { icon: MessageSquare,label: "Message Coach",       desc: "Get 5 reply options",           href: "/coach",        color: "hsl(285 45% 62%)" },
  { icon: Stethoscope,  label: "Dating Diagnosis",    desc: "Find your pattern",             href: "/diagnosis",    color: "hsl(348 55% 65%)" },
  { icon: Mail,         label: "Import Patterns",     desc: "Communication style analysis",  href: "/insights",     color: "hsl(142 55% 58%)" },
  { icon: Settings,     label: "Integrations",        desc: "Manage connections",            href: "/integrations", color: "hsl(228 18% 55%)" },
  { icon: Eye,          label: "Platform Vision",     desc: "See what's coming",             href: "/roadmap",      color: "hsl(43 65% 60%)" },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Dashboard() {
  useMeta("Your Dashboard", "Your Signal Score history, recent audits, coaching sessions, and quick actions — all in one place.");
  const { data: audits, isLoading: auditsLoading } = useListAudits();
  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary({
    query: { queryKey: getGetAuditSummaryQueryKey() }
  });

  const displayAudits = (audits && audits.length > 0) ? audits : DEMO_AUDITS;
  const displaySummary = summary ?? DEMO_SUMMARY;
  const latestScore = displaySummary.latestScore ?? 0;
  const grade = latestScore >= 85 ? "A" : latestScore >= 72 ? "B" : latestScore >= 58 ? "C" : latestScore >= 42 ? "D" : "F";
  const gradeColor = latestScore >= 75 ? "hsl(142 55% 60%)" : latestScore >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const scoreDelta = (displaySummary.latestScore ?? 0) - (displaySummary.scoreHistory[0]?.score ?? 0);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-50 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-40 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-10">
            <p className="text-sm text-muted-foreground font-medium mb-1">Welcome back</p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Your Dating Blueprint</h1>
          </motion.div>

          {/* Signal Score + History */}
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Score Card */}
            <motion.div {...fadeUp(0.05)}
              className="mirror-card rounded-3xl p-8 flex flex-col items-center text-center shimmer"
              data-testid="card-readiness-score">
              <div className="line-accent w-full mb-5" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Signal Score</p>
              {summaryLoading ? <Skeleton className="w-40 h-40 rounded-full" /> : <ScoreRing score={latestScore} />}
              <p className="text-5xl font-bold mt-4" style={{ color: gradeColor }} data-testid="grade-letter">{grade}</p>
              <p className="text-xs text-muted-foreground mt-1">Profile grade</p>
              {scoreDelta > 0 && (
                <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-[hsl(142_55%_45%/0.12)] border border-[hsl(142_55%_45%/0.2)]">
                  <TrendingUp className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" />
                  <span className="text-xs font-semibold text-[hsl(142_55%_60%)]">+{scoreDelta} pts from last audit</span>
                </div>
              )}
            </motion.div>

            {/* Score History */}
            <motion.div {...fadeUp(0.1)} className="glass border border-white/8 rounded-3xl p-6 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-foreground">Score History</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your progress over time</p>
                </div>
                {scoreDelta > 0 && (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(142_55%_60%)]">
                    <TrendingUp className="w-4 h-4" /> +{scoreDelta} pts
                  </div>
                )}
              </div>
              {summaryLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={130}>
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

              {/* Mini signal bars */}
              <div className="mt-4 pt-4 border-t border-white/6">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Top Signal Dimensions</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
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
          <motion.div {...fadeUp(0.13)} className="glass border border-white/8 rounded-3xl p-6 mb-5">
            <div className="flex items-center gap-2.5 mb-5">
              <Eye className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="font-semibold text-foreground">How You're Coming Across</h2>
              <span className="ml-auto text-xs text-muted-foreground">Based on latest audit</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {HOW_YOU_COME_ACROSS.map((group, i) => (
                <div key={i}>
                  <p className="text-xs text-muted-foreground mb-2.5 font-medium">{group.label}</p>
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
            <motion.div {...fadeUp(0.16)} className="glass border border-white/8 rounded-3xl p-6">
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

            <motion.div {...fadeUp(0.19)} className="glass border border-white/8 rounded-3xl p-6">
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

          {/* Quick Actions — 8 tools */}
          <motion.div {...fadeUp(0.22)} className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-foreground text-sm">Your Tools</p>
              <Link href="/roadmap">
                <span className="text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex items-center gap-1">
                  Platform vision <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action, i) => (
                <Link key={i} href={action.href} data-testid={`card-quick-action-${action.label.toLowerCase().replace(/ /g, "-")}`}>
                  <div className="glass border border-white/8 rounded-2xl p-4 hover:border-[hsl(268_52%_68%/0.3)] hover:shadow-[0_8px_30px_rgb(0_0_0/0.4)] transition-all cursor-pointer h-full card-hover">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${action.color.replace(")", " / 0.12)")}` }}>
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    </div>
                    <p className="font-semibold text-foreground text-xs leading-tight">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Audits */}
          <motion.div {...fadeUp(0.26)} className="glass border border-white/8 rounded-3xl p-6 mb-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-foreground">Recent Audits</h2>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" data-testid="button-new-audit">
                <Link href="/start">New Audit <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            {auditsLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
            ) : displayAudits.length === 0 ? (
              <div className="text-center py-12">
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
                  const bg = score >= 75 ? "hsl(142 55% 45% / 0.12)" : score >= 55 ? "hsl(43 65% 55% / 0.12)" : "hsl(348 55% 55% / 0.12)";
                  const date = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <Link key={audit.id} href={`/report/${audit.id}`} data-testid={`row-audit-${audit.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/6 hover:border-[hsl(268_52%_68%/0.25)] hover:bg-white/2 transition-all cursor-pointer card-hover">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: bg, color }}>
                            {score}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{audit.firstName}'s Profile Signal Audit</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3" /> {date} · {audit.currentApps?.join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${audit.status === "complete" ? "tag-strength border" : "tag-risk border"}`}>{audit.status}</span>
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
            className="relative rounded-3xl p-8 text-center overflow-hidden shimmer"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.15), hsl(285 45% 60% / 0.1), hsl(43 65% 62% / 0.08))" }}
            data-testid="card-upgrade-cta">
            <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
            <div className="orb orb-violet absolute w-64 h-64 -right-20 -top-20 opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <div className="line-accent max-w-xs mx-auto mb-5" />
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-3">Unlock Everything</p>
              <h3 className="text-2xl font-bold text-foreground mb-3">Ready for The Dating Reset?</h3>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm leading-relaxed">
                Complete profile rewrite, Signal Spectrum, Dating Diagnosis, Chemistry Lab, and a 7-day action plan. One payment. Everything included.
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
