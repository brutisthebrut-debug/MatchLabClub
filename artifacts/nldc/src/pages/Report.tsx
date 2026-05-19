import { useParams, Link } from "wouter";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useGetAudit, useGenerateAuditReport, getGetAuditQueryKey } from "@workspace/api-client-react";
import { CheckCircle, XCircle, AlertCircle, ArrowRight, Copy, Check, Trophy, Calendar, Eye, Sparkles, MessageSquare, Camera } from "lucide-react";

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const glow = score >= 75 ? "hsl(142 55% 60% / 0.4)" : score >= 55 ? "hsl(43 65% 65% / 0.3)" : "hsl(348 55% 65% / 0.3)";
  return (
    <div className="relative w-36 h-36 flex-shrink-0" data-testid="report-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" style={{ filter: `drop-shadow(0 0 14px ${glow})` }}>
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke="hsl(232 28% 20%)" fill="none" />
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
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
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex-shrink-0"
      data-testid="button-copy-text"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const DEMO_REPORT = {
  auditId: 2,
  readinessScore: 78,
  overallGrade: "B",
  strengths: ["Genuine warmth comes through", "Clear intention about what you want", "Active on multiple platforms"],
  risks: ["Generic phrases dilute the profile", "Opening line doesn't create intrigue", "Photo strategy needs curation"],
  bioAudit: "Jordan's profile has real personality underneath the surface — but it's not on the surface yet. The opening line is a summary, not a hook. Phrases like 'loves hiking and cooking' and 'easy to talk to' appear in thousands of profiles and become invisible. The bio doesn't answer the only question that matters: why would someone who has options choose you specifically? The potential is real — this just needs a sharper lens.",
  rewrittenBio: "I make a genuinely great first date — I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to. Currently: too invested in my sourdough starter, rewatching things I've already seen, trying to find someone worth getting off the couch for. If any of that sounds familiar, let's find out.",
  rewrittenPrompts: [
    { original: "The way to win me over is...", rewritten: "Remembering the weird specific thing I mentioned once. That's it. That's the whole thing.", tip: "Specificity beats sincerity here. Readers fill in the blanks with their own version of you." },
    { original: "I'll never shut up about...", rewritten: "The last rabbit hole I went down was the history of competitive eating. Before that, underwater welding. I contain multitudes.", tip: "Prompts are conversation starters — give them something to respond to." },
    { original: "A green flag I look for...", rewritten: "When someone admits they don't know something. Confidence without ego is wildly attractive.", tip: "This reveals values without sounding like a therapist. Standards signal emotional health." },
  ],
  photoGuidance: [
    { category: "Lead photo", status: "needs_work" as const, advice: "Your first photo should be a clear, well-lit face shot where you're visibly enjoying yourself. A group shot or squinting photo loses matches before they read a word." },
    { category: "Social proof shot", status: "missing" as const, advice: "Add one photo of you with friends or family. It signals social value and warmth — two top traits people screen for." },
    { category: "Action / lifestyle shot", status: "good" as const, advice: "You have a solid activity photo. These generate 3× more openers than static poses — keep it." },
    { category: "Full-body photo", status: "missing" as const, advice: "Including one honest full-body photo builds trust and signals confidence. Its absence creates questions." },
    { category: "Lighting quality", status: "needs_work" as const, advice: "At least 3 photos should be in natural daylight. Phone cameras in good light beat DSLR in bad light every time." },
  ],
  actionPlan: [
    { priority: 1, title: "Rewrite your opening line today", description: "Replace the current opener with a specific, scene-setting hook. Make the reader picture you in a moment, not read a list of traits.", timeframe: "Today" },
    { priority: 2, title: "Swap your lead photo this week", description: "Use your most natural, well-lit face shot where you're clearly enjoying yourself. Run it through Photofeeler for objective feedback.", timeframe: "This week" },
    { priority: 3, title: "Update your prompts", description: "Choose prompts that end with an implicit invitation to respond. Avoid lists and abstract value statements.", timeframe: "This week" },
    { priority: 4, title: "Change your opener strategy", description: "Reference something specific from their profile in every first message. Move away from generic conversation starters.", timeframe: "Ongoing" },
    { priority: 5, title: "Run a 2-week experiment", description: "Track matches per week, response rate, and date conversion rate. Your score should climb 10+ points at next audit.", timeframe: "2 weeks" },
  ],
  messagingStyle: "Your message sample shows genuine curiosity and warmth. You ask real questions and bring specificity — both strong signals. The growth area: you wait too long to suggest escalating to a date. The window closes faster than most people think. The highest-ROI change: suggest a specific date sooner. Something like 'This is a better conversation than 95% of these — want to actually meet?' converts at 3× the rate of staying in app.",
  messageExample: {
    original: "Not yet but I've been meaning to",
    coached: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?",
    rationale: "The original is passive and puts all conversational weight on them. The coached version converts the shared joke into a natural date suggestion.",
  },
  coachingCta: "Ready to go deeper? Book a coaching session and we'll rebuild your entire dating strategy — from photos to first messages to closing for dates. Most clients see 2–3× more meaningful matches within 30 days.",
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
});

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

  const r = report ?? (auditId ? null : DEMO_REPORT) ?? DEMO_REPORT;
  const grade = r.readinessScore >= 85 ? "A" : r.readinessScore >= 72 ? "B" : r.readinessScore >= 58 ? "C" : r.readinessScore >= 42 ? "D" : "F";

  if (auditLoading || generating) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg py-12 px-4">
          <div className="max-w-3xl mx-auto space-y-5">
            <Skeleton className="h-48 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
            <Skeleton className="h-64 w-full rounded-3xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const statusIcon = (status: "good" | "needs_work" | "missing") => {
    if (status === "good") return <CheckCircle className="w-5 h-5 text-[hsl(142_55%_60%)] flex-shrink-0" />;
    if (status === "needs_work") return <AlertCircle className="w-5 h-5 text-[hsl(43_65%_65%)] flex-shrink-0" />;
    return <XCircle className="w-5 h-5 text-[hsl(348_55%_65%)] flex-shrink-0" />;
  };

  const statusLabel = (status: "good" | "needs_work" | "missing") => ({
    good: { label: "Good", cls: "tag-strength border" },
    needs_work: { label: "Needs work", cls: "tag-risk border" },
    missing: { label: "Missing", cls: "bg-[hsl(348_55%_65%/0.1)] text-[hsl(348_55%_72%)] border border-[hsl(348_55%_65%/0.2)]" },
  })[status];

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-50 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10 space-y-5">

          {/* Score Header */}
          <motion.div {...fadeUp(0)} className="glass border border-white/8 rounded-3xl p-8 shimmer" data-testid="card-report-header">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <ScoreRing score={r.readinessScore} />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {audit?.firstName ?? "Your"} Dating Blueprint Report
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-5xl font-bold" style={{ color: r.readinessScore >= 75 ? "hsl(142 55% 60%)" : r.readinessScore >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)" }} data-testid="report-grade">{grade}</span>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall grade</p>
                    <p className="text-xs text-muted-foreground">Readiness Score: {r.readinessScore} / 100</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.strengths.slice(0, 2).map((s, i) => (
                    <span key={i} className="tag-strength border px-2.5 py-1 rounded-full text-xs font-medium" data-testid={`badge-report-strength-${i}`}>{s}</span>
                  ))}
                  {r.risks.slice(0, 1).map((risk, i) => (
                    <span key={i} className="tag-risk border px-2.5 py-1 rounded-full text-xs font-medium" data-testid={`badge-report-risk-${i}`}>{risk}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* How You're Coming Across */}
          <motion.div {...fadeUp(0.07)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <Eye className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">How You're Coming Across</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm mb-5">{r.bioAudit}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">You're projecting</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.strengths.map((s, i) => <span key={i} className="tag-strength border px-2.5 py-1 rounded-full text-xs" data-testid={`item-strength-${i}`}>{s}</span>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Unintentional signals</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.risks.map((risk, i) => <span key={i} className="tag-risk border px-2.5 py-1 rounded-full text-xs" data-testid={`item-risk-${i}`}>{risk}</span>)}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Build My Better Bio */}
          <motion.div {...fadeUp(0.12)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <Sparkles className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">Build My Better Bio</h2>
            </div>
            <Tabs defaultValue="rewritten">
              <TabsList className="mb-5 bg-[hsl(232_28%_16%)] border border-white/6">
                <TabsTrigger value="original" className="data-[state=active]:bg-[hsl(232_34%_20%)] data-[state=active]:text-foreground text-muted-foreground">Original</TabsTrigger>
                <TabsTrigger value="rewritten" className="data-[state=active]:bg-[hsl(268_52%_68%/0.2)] data-[state=active]:text-[hsl(268_60%_82%)] text-muted-foreground" data-testid="tab-rewritten-bio">Rewritten ✦</TabsTrigger>
              </TabsList>
              <TabsContent value="original">
                <div className="rounded-2xl p-5 bg-[hsl(232_28%_14%)] border border-white/6">
                  <p className="text-muted-foreground leading-relaxed text-sm italic">{audit?.bio || "No original bio provided — see your AI rewrite below."}</p>
                </div>
              </TabsContent>
              <TabsContent value="rewritten">
                <div className="rounded-2xl p-5 border-violet-glow bg-[hsl(268_52%_68%/0.06)] shimmer" style={{ borderColor: "hsl(268 52% 68% / 0.25)" }}>
                  <p className="text-foreground leading-relaxed" data-testid="text-rewritten-bio">{r.rewrittenBio}</p>
                  <div className="mt-4 flex justify-end">
                    <CopyButton text={r.rewrittenBio} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <h3 className="font-semibold text-foreground mt-8 mb-4 text-base">Rewritten Prompts</h3>
            <div className="space-y-4">
              {r.rewrittenPrompts.map((prompt, i) => (
                <div key={i} className="border border-white/8 rounded-2xl overflow-hidden" data-testid={`card-prompt-rewrite-${i}`}>
                  <div className="bg-[hsl(232_28%_14%)] px-5 py-3">
                    <p className="text-xs text-muted-foreground font-medium">Original</p>
                    <p className="text-sm text-muted-foreground italic mt-0.5">{prompt.original}</p>
                  </div>
                  <div className="bg-[hsl(268_52%_68%/0.07)] px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-[hsl(268_60%_78%)] font-semibold mb-0.5">Rewritten ✦</p>
                        <p className="text-sm text-foreground">{prompt.rewritten}</p>
                      </div>
                      <CopyButton text={prompt.rewritten} />
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-[hsl(232_34%_11%)] border-t border-white/6">
                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Coach note:</span> {prompt.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Message Coaching Example */}
          <motion.div {...fadeUp(0.17)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <MessageSquare className="w-5 h-5 text-[hsl(190_55%_60%)]" />
              <h2 className="text-xl font-bold text-foreground">Messaging Style Analysis</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm mb-6" data-testid="text-messaging-style">{r.messagingStyle}</p>

            {r.messageExample && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Before / After example</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 bg-[hsl(232_28%_14%)] border border-white/8">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Your original message</p>
                    <div className="inline-block bg-[hsl(232_28%_20%)] text-muted-foreground text-sm px-4 py-2.5 rounded-2xl rounded-bl-md max-w-full">
                      {r.messageExample.original}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {["⚠ Passive", "⚠ No path forward"].map((t, i) => <span key={i} className="text-xs tag-risk border px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </div>
                  <div className="rounded-2xl p-4 bg-[hsl(268_52%_68%/0.06)] border border-[hsl(268_52%_68%/0.2)]">
                    <p className="text-xs font-semibold text-[hsl(268_60%_78%)] mb-2">Coached version ✦</p>
                    <div className="inline-block bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_60%)] text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-md max-w-full">
                      {r.messageExample.coached}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {["✓ Specific", "✓ Date ask", "✓ Natural"].map((t, i) => <span key={i} className="text-xs tag-strength border px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed bg-[hsl(232_28%_14%)] p-3 rounded-xl border border-white/6">
                  <span className="font-semibold text-foreground">Why this works: </span>{r.messageExample.rationale}
                </p>
              </div>
            )}
          </motion.div>

          {/* Photo Guidance */}
          <motion.div {...fadeUp(0.22)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <Camera className="w-5 h-5 text-[hsl(43_65%_65%)]" />
              <h2 className="text-xl font-bold text-foreground">Photo Guidance Checklist</h2>
            </div>
            <div className="space-y-3">
              {r.photoGuidance.map((item, i) => {
                const sl = statusLabel(item.status);
                return (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-white/8 bg-[hsl(232_28%_14%/0.5)]" data-testid={`card-photo-guidance-${i}`}>
                    <div className="mt-0.5">{statusIcon(item.status)}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{item.category}</p>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${sl.cls}`}>{sl.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.advice}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* 3-Step Action Plan */}
          <motion.div {...fadeUp(0.27)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <Trophy className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">Your Action Plan</h2>
            </div>
            <div className="space-y-4">
              {r.actionPlan.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-white/8 bg-[hsl(232_28%_14%/0.5)] card-hover" data-testid={`card-action-item-${i}`}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: `linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))`, boxShadow: "0 0 12px hsl(268 52% 68% / 0.35)" }}
                  >
                    {item.priority}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-sm">{item.title}</p>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <Calendar className="w-3 h-3" /> {item.timeframe}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            {...fadeUp(0.32)}
            className="relative rounded-3xl p-8 text-center overflow-hidden shimmer"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.14) 0%, hsl(285 45% 60% / 0.1) 100%)" }}
            data-testid="card-report-cta"
          >
            <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-foreground mb-3">Ready to go deeper?</h3>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm leading-relaxed">{r.coachingCta}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse" data-testid="button-view-pricing">
                  <Link href="/pricing">View Coaching Plans <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5" data-testid="button-coach-messages">
                  <Link href="/coach">Coach My Messages</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
