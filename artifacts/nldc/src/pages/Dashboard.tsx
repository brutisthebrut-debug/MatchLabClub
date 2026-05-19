import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useListAudits, useGetAuditSummary, getGetAuditSummaryQueryKey } from "@workspace/api-client-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowRight, FileText, MessageSquare, Mail, Settings, Trophy, TrendingUp, AlertTriangle, Clock } from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#6B8E6B" : score >= 55 ? "#C9873A" : "#C94A4A";

  return (
    <div className="relative w-40 h-40 mx-auto" data-testid="score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} strokeWidth="12" stroke="hsl(var(--secondary))" fill="none" />
        <circle
          cx="64" cy="64" r={radius} strokeWidth="12"
          stroke={color} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-foreground" data-testid="score-number">{score}</span>
        <span className="text-xs text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

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
    "Clear intention about what you're looking for",
    "Consistency and follow-through in conversations",
  ],
  topRisks: [
    "Generic bio language reduces visibility",
    "Opening messages lack specificity",
    "Photo selection needs strategic curation",
  ],
};

const DEMO_AUDITS = [
  { id: 1, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 61, status: "complete", createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
  { id: 2, firstName: "Jordan", datingGoal: "find a relationship", readinessScore: 78, status: "complete", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), currentApps: ["Hinge", "Bumble", "The League"], bio: "", prompts: null, recentMessageSample: null, photoCount: null, relationshipHistory: null, biggestChallenge: "not getting matches", age: 31, gender: "Man", orientation: "Straight" },
];

export default function Dashboard() {
  const { data: audits, isLoading: auditsLoading } = useListAudits();
  const { data: summary, isLoading: summaryLoading } = useGetAuditSummary({
    query: { queryKey: getGetAuditSummaryQueryKey() }
  });

  const displayAudits = (audits && audits.length > 0) ? audits : DEMO_AUDITS;
  const displaySummary = summary ?? DEMO_SUMMARY;
  const latestScore = displaySummary.latestScore ?? 0;

  const gradeColor = latestScore >= 75 ? "text-green-600" : latestScore >= 55 ? "text-amber-600" : "text-red-600";
  const grade = latestScore >= 85 ? "A" : latestScore >= 72 ? "B" : latestScore >= 58 ? "C" : latestScore >= 42 ? "D" : "F";

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <p className="text-sm text-muted-foreground font-medium mb-1">Welcome back</p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Your Coaching Hub</h1>
          </motion.div>

          {/* Score + Summary Row */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-card border border-card-border rounded-3xl p-8 flex flex-col items-center text-center col-span-1"
              data-testid="card-readiness-score"
            >
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">Dating Readiness Score</p>
              {summaryLoading ? (
                <Skeleton className="w-40 h-40 rounded-full" />
              ) : (
                <ScoreRing score={latestScore} />
              )}
              <p className={`text-5xl font-bold mt-4 ${gradeColor}`} data-testid="grade-letter">{grade}</p>
              <p className="text-sm text-muted-foreground mt-1">Overall grade</p>
            </motion.div>

            {/* Score Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-card border border-card-border rounded-3xl p-6 md:col-span-2"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-foreground">Score History</p>
                  <p className="text-sm text-muted-foreground">Track your progress over time</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{(displaySummary.latestScore ?? 0) - (displaySummary.scoreHistory[0]?.score ?? 0)} pts</span>
                </div>
              </div>
              {summaryLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={displaySummary.scoreHistory} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {displaySummary.scoreHistory.length < 2 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Complete another audit to track progress</p>
              )}
            </motion.div>
          </div>

          {/* Strengths + Risks */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-card border border-card-border rounded-3xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-foreground">Your Strengths</p>
              </div>
              {summaryLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySummary.topStrengths.map((s, i) => (
                    <Badge key={i} variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs font-medium" data-testid={`badge-strength-${i}`}>
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card border border-card-border rounded-3xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <p className="font-semibold text-foreground">Growth Areas</p>
              </div>
              {summaryLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySummary.topRisks.map((r, i) => (
                    <Badge key={i} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium" data-testid={`badge-risk-${i}`}>
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10"
          >
            {[
              { icon: FileText, label: "New Audit", desc: "Reanalyze your profile", href: "/start", color: "text-primary" },
              { icon: MessageSquare, label: "Message Coach", desc: "Get reply suggestions", href: "/coach", color: "text-blue-600" },
              { icon: Mail, label: "Email Insights", desc: "Analyze your patterns", href: "/insights", color: "text-purple-600" },
              { icon: Settings, label: "Integrations", desc: "Manage data connections", href: "/integrations", color: "text-muted-foreground" },
            ].map((action, i) => (
              <Link key={i} href={action.href} data-testid={`card-quick-action-${action.label.toLowerCase().replace(/ /g, "-")}`}>
                <div className="bg-card border border-card-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                  <action.icon className={`w-6 h-6 ${action.color} mb-3`} />
                  <p className="font-semibold text-foreground text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
              </Link>
            ))}
          </motion.div>

          {/* Recent Audits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card border border-card-border rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Audits</h2>
              <Button asChild variant="ghost" size="sm" data-testid="button-new-audit">
                <Link href="/start">New Audit <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            {auditsLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : displayAudits.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-foreground mb-1">No audits yet</p>
                <p className="text-sm text-muted-foreground mb-4">Complete the intake wizard to generate your first report.</p>
                <Button asChild data-testid="button-start-first-audit">
                  <Link href="/start">Get My Free Audit</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayAudits.slice().reverse().map((audit) => {
                  const score = audit.readinessScore ?? 0;
                  const scoreColor = score >= 75 ? "text-green-600 bg-green-50" : score >= 55 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
                  const date = new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <Link key={audit.id} href={`/report/${audit.id}`} data-testid={`row-audit-${audit.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-primary/30 hover:bg-secondary/20 transition-all cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm ${scoreColor}`}>
                            {score}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{audit.firstName}'s Profile Audit</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3" /> {date} · {audit.currentApps?.join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className={audit.status === "complete" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}>
                            {audit.status}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Upgrade CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="mt-6 bg-primary rounded-3xl p-8 text-primary-foreground text-center"
            data-testid="card-upgrade-cta"
          >
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-2">Unlock Everything</p>
            <h3 className="text-2xl font-serif font-bold mb-3">Ready for your Full Dating Reset?</h3>
            <p className="opacity-80 mb-6 max-w-lg mx-auto">
              Unlimited audits, rewritten bios, message coaching, and direct access to a real dating coach. Most clients see 2-3x more meaningful matches within 30 days.
            </p>
            <Button asChild variant="secondary" className="rounded-full px-8 text-primary font-bold" data-testid="button-upgrade-cta">
              <Link href="/pricing">View Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
