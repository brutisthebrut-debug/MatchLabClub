import { useParams, Link } from "wouter";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  useGetAudit, useGenerateAuditReport,
  getGetAuditQueryKey,
} from "@workspace/api-client-react";
import { CheckCircle, XCircle, AlertCircle, ArrowRight, Copy, Check, ChevronDown, ChevronUp, Trophy, Calendar } from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "#6B8E6B" : score >= 55 ? "#C9873A" : "#C94A4A";
  return (
    <div className="relative w-36 h-36" data-testid="report-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} strokeWidth="12" stroke="hsl(var(--secondary))" fill="none" />
        <circle cx="64" cy="64" r={radius} strokeWidth="12" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground" data-testid="report-score-number">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      data-testid="button-copy-text"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const DEMO_REPORT = {
  auditId: 2,
  readinessScore: 78,
  overallGrade: "B",
  strengths: ["Genuine warmth comes through", "Clear intention about what you want", "Active on multiple platforms"],
  risks: ["Generic phrases dilute the profile", "Opening line doesn't create immediate intrigue", "Photo strategy needs curation"],
  bioAudit: "Jordan's bio has genuine personality but is underselling the depth beneath the surface. The opening line doesn't create immediate intrigue — it reads like a summary rather than a hook. Phrases like 'love to travel' and 'big on authenticity' appear in thousands of other profiles and become invisible. The bio doesn't answer the only question that matters: why would someone who has options choose you specifically? The potential is real — it just needs a sharper lens.",
  rewrittenBio: "I make a genuinely great first date — I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to. Currently: too invested in my sourdough starter, rewatching things I've already seen, and trying to find someone worth getting off the couch for. If any of that sounds familiar, let's find out.",
  rewrittenPrompts: [
    { original: "The way to win me over is...", rewritten: "Remembering the weird specific thing I mentioned once. That's it. That's the whole thing.", tip: "Specificity beats sincerity. Readers fill in the blanks with their own version of you." },
    { original: "I'll never shut up about...", rewritten: "The last rabbit hole I went down was the history of competitive eating. Before that, underwater welding. I contain multitudes.", tip: "Prompts are conversation starters — give them something to respond to." },
    { original: "A green flag I look for...", rewritten: "When someone admits they don't know something. Confidence without ego is wildly attractive.", tip: "This reveals values without sounding like a therapist. Standards are attractive." },
  ],
  photoGuidance: [
    { category: "Lead photo", status: "needs_work" as const, advice: "Your first photo should be a clear, well-lit face shot where you're visibly enjoying yourself. Squinting at the sun or a group shot loses matches before they read a word." },
    { category: "Social proof shot", status: "missing" as const, advice: "Add one photo of you with friends or family. It signals social value and warmth — two of the top traits people screen for." },
    { category: "Action/lifestyle shot", status: "good" as const, advice: "You have a solid activity photo. These generate 3x more openers than static poses." },
    { category: "Full-body photo", status: "missing" as const, advice: "Including one honest full-body photo builds trust. It signals confidence." },
    { category: "Quality and lighting", status: "needs_work" as const, advice: "At least 3 of your photos should be taken in natural daylight. Phone cameras in good light beat DSLR cameras in bad light." },
  ],
  actionPlan: [
    { priority: 1, title: "Rewrite your opening line", description: "Replace the current bio opening with a specific, scene-setting hook. Make the reader picture you in a moment, not list your traits.", timeframe: "Today" },
    { priority: 2, title: "Update your lead photo", description: "Swap your lead photo for your most natural, well-lit face shot. Run it through Photofeeler for objective feedback.", timeframe: "This week" },
    { priority: 3, title: "Add two specific prompts", description: "Choose prompts that end with an implicit invitation to respond — avoid lists and abstract value statements.", timeframe: "This week" },
    { priority: 4, title: "Audit your opener strategy", description: "Move away from generic openers. Reference something specific from their profile in every first message.", timeframe: "Ongoing" },
    { priority: 5, title: "Run a 2-week experiment", description: "Implement all changes, then track matches per week, response rate, and date conversion rate.", timeframe: "2 weeks" },
  ],
  messagingStyle: "Your message sample shows genuine curiosity and warmth. You ask good questions but sometimes wait too long to suggest escalating to a date — the window closes faster than most people think. The single highest-ROI change: suggest a specific date sooner. Something like 'This is a better conversation than 95% of these — want to actually meet?' converts at 3x the rate of staying in the app.",
  coachingCta: "Ready to go deeper? Book a 1:1 coaching session and we'll rebuild your entire dating strategy — from photos to first messages to closing for dates. Most clients see a 2-3x improvement in meaningful matches within 30 days.",
};

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const auditId = parseInt(id ?? "0", 10);

  const { data: audit, isLoading: auditLoading } = useGetAudit(auditId, {
    query: { enabled: !!auditId, queryKey: getGetAuditQueryKey(auditId) }
  });

  const generateReport = useGenerateAuditReport();
  const [report, setReport] = useState<typeof DEMO_REPORT | null>(null);
  const [generating, setGenerating] = useState(false);

  async function fetchReport() {
    if (auditId && !generating) {
      setGenerating(true);
      try {
        const result = await generateReport.mutateAsync({ id: auditId });
        setReport(result as typeof DEMO_REPORT);
      } catch {
        setReport(DEMO_REPORT);
      } finally {
        setGenerating(false);
      }
    }
  }

  if (!report && !generating && auditId) {
    fetchReport();
  }

  const displayReport = report ?? (auditId ? null : DEMO_REPORT);
  const displayAudit = audit;

  const statusIcon = (status: "good" | "needs_work" | "missing") => {
    if (status === "good") return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status === "needs_work") return <AlertCircle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const statusLabel = (status: "good" | "needs_work" | "missing") => {
    if (status === "good") return "Good";
    if (status === "needs_work") return "Needs work";
    return "Missing";
  };

  if (auditLoading || generating) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background py-12 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const r = displayReport ?? DEMO_REPORT;
  const grade = r.readinessScore >= 85 ? "A" : r.readinessScore >= 72 ? "B" : r.readinessScore >= 58 ? "C" : r.readinessScore >= 42 ? "D" : "F";

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-card-border rounded-3xl p-8"
            data-testid="card-report-header"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <ScoreRing score={r.readinessScore} />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {displayAudit?.firstName ?? "Your"} Dating Readiness Report
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-5xl font-bold text-foreground" data-testid="report-grade">{grade}</span>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall grade</p>
                    <p className="text-xs text-muted-foreground">Score: {r.readinessScore} / 100</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.strengths.slice(0, 2).map((s, i) => (
                    <Badge key={i} variant="secondary" className="bg-green-50 text-green-700 border-green-100 text-xs" data-testid={`badge-report-strength-${i}`}>{s}</Badge>
                  ))}
                  {r.risks.slice(0, 1).map((risk, i) => (
                    <Badge key={i} variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-xs" data-testid={`badge-report-risk-${i}`}>{risk}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bio Audit */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="bg-card border border-card-border rounded-3xl p-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-4">Profile Audit</h2>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-bio-audit">{r.bioAudit}</p>
          </motion.div>

          {/* Bio Rewrite */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="bg-card border border-card-border rounded-3xl p-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-6">Rewritten Bio</h2>
            <Tabs defaultValue="rewritten">
              <TabsList className="mb-4">
                <TabsTrigger value="original">Original</TabsTrigger>
                <TabsTrigger value="rewritten" data-testid="tab-rewritten-bio">AI Rewrite</TabsTrigger>
              </TabsList>
              <TabsContent value="original">
                <div className="bg-secondary/30 rounded-2xl p-5">
                  <p className="text-muted-foreground leading-relaxed text-sm italic">{displayAudit?.bio || "No bio provided — see your rewrite below."}</p>
                </div>
              </TabsContent>
              <TabsContent value="rewritten">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 relative">
                  <p className="text-foreground leading-relaxed" data-testid="text-rewritten-bio">{r.rewrittenBio}</p>
                  <div className="mt-4 flex justify-end">
                    <CopyButton text={r.rewrittenBio} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <h3 className="text-base font-semibold text-foreground mt-8 mb-4">Rewritten Prompts</h3>
            <div className="space-y-4">
              {r.rewrittenPrompts.map((prompt, i) => (
                <div key={i} className="border border-border rounded-2xl overflow-hidden" data-testid={`card-prompt-rewrite-${i}`}>
                  <div className="bg-secondary/30 px-5 py-3">
                    <p className="text-xs text-muted-foreground font-medium">Original</p>
                    <p className="text-sm text-foreground italic mt-0.5">{prompt.original}</p>
                  </div>
                  <div className="bg-primary/5 px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-primary font-semibold mb-0.5">Rewritten</p>
                        <p className="text-sm text-foreground">{prompt.rewritten}</p>
                      </div>
                      <CopyButton text={prompt.rewritten} />
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-card border-t border-border">
                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Coach tip:</span> {prompt.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Photo Guidance */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className="bg-card border border-card-border rounded-3xl p-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-6">Photo Guidance Checklist</h2>
            <div className="space-y-4">
              {r.photoGuidance.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-border" data-testid={`card-photo-guidance-${i}`}>
                  <div className="mt-0.5">{statusIcon(item.status)}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-foreground">{item.category}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.status === "good" ? "bg-green-50 text-green-700" : item.status === "needs_work" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.advice}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Strengths & Risks */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="grid sm:grid-cols-2 gap-6"
          >
            <div className="bg-card border border-card-border rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-foreground">Strengths</h3>
              </div>
              <ul className="space-y-2">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-strength-${i}`}>
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-card-border rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-foreground">Growth Areas</h3>
              </div>
              <ul className="space-y-2">
                {r.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-risk-${i}`}>
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Messaging Style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            className="bg-card border border-card-border rounded-3xl p-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-4">Messaging Style Analysis</h2>
            <p className="text-muted-foreground leading-relaxed" data-testid="text-messaging-style">{r.messagingStyle}</p>
          </motion.div>

          {/* Action Plan */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="bg-card border border-card-border rounded-3xl p-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-6">Your Action Plan</h2>
            <div className="space-y-4">
              {r.actionPlan.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-border" data-testid={`card-action-item-${i}`}>
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {item.priority}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <Calendar className="w-3 h-3" /> {item.timeframe}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="bg-primary rounded-3xl p-8 text-primary-foreground text-center"
            data-testid="card-report-cta"
          >
            <h3 className="text-2xl font-serif font-bold mb-3">Ready to go deeper?</h3>
            <p className="opacity-80 mb-6 max-w-lg mx-auto text-sm leading-relaxed">{r.coachingCta}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="secondary" className="rounded-full text-primary font-bold" data-testid="button-view-pricing">
                <Link href="/pricing">View Coaching Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-coach-messages">
                <Link href="/coach">Coach My Messages</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
