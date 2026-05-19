import { useParams, Link } from "wouter";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useGetAudit, useGenerateAuditReport, getGetAuditQueryKey } from "@workspace/api-client-react";
import {
  CheckCircle, XCircle, AlertCircle, ArrowRight, Copy, Check,
  Trophy, Calendar, Eye, Sparkles, MessageSquare, Camera,
  TrendingUp, Lightbulb, Heart, Zap
} from "lucide-react";

/* ─── Score Ring ─── */
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(142 55% 60%)" : score >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";
  const glow = score >= 75 ? "hsl(142 55% 60% / 0.4)" : score >= 55 ? "hsl(43 65% 65% / 0.3)" : "hsl(348 55% 65% / 0.3)";
  return (
    <div className="relative w-36 h-36 flex-shrink-0" data-testid="report-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" style={{ filter: `drop-shadow(0 0 18px ${glow})` }}>
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke="hsl(232 28% 20%)" fill="none" />
        <circle cx="64" cy="64" r={radius} strokeWidth="10" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground" data-testid="report-score-number">{score}</span>
        <span className="text-xs text-muted-foreground">Signal Score</span>
      </div>
    </div>
  );
}

/* ─── Copy Button ─── */
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

/* ─── Signal Spectrum Bar ─── */
function SpectrumBar({ dimension, value, color, desc, delay = 0 }: {
  dimension: string; value: number; color: string; desc: string; delay?: number;
}) {
  return (
    <div className="space-y-1.5" data-testid={`spectrum-${dimension.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{dimension}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="signal-bar-track">
        <div
          className="signal-bar-fill"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color.replace(")", " / 0.6)")}, ${color})`,
            animationDelay: `${delay}s`,
            boxShadow: `0 0 8px ${color.replace(")", " / 0.4)")}`,
          }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
    </div>
  );
}

/* ─── Demo data ─── */
const SIGNAL_SPECTRUM_DATA = [
  { dimension: "Warmth", value: 78, color: "hsl(348 55% 68%)", desc: "How emotionally open and inviting you come across" },
  { dimension: "Clarity", value: 62, color: "hsl(190 55% 62%)", desc: "How clearly your personality and intentions communicate" },
  { dimension: "Confidence", value: 72, color: "hsl(268 52% 72%)", desc: "Whether you seem at ease with who you are" },
  { dimension: "Playfulness", value: 55, color: "hsl(43 65% 67%)", desc: "Whether you seem fun and light to be around" },
  { dimension: "Availability", value: 81, color: "hsl(142 55% 62%)", desc: "How emotionally open and ready you seem" },
  { dimension: "Specificity", value: 50, color: "hsl(285 45% 67%)", desc: "How distinct and unique your profile feels vs generic" },
  { dimension: "Energy", value: 68, color: "hsl(43 65% 67%)", desc: "The vitality and forward momentum in your presence" },
  { dimension: "Approachability", value: 75, color: "hsl(190 55% 62%)", desc: "How easy it feels to start a conversation with you" },
];

const DEMO_REPORT = {
  auditId: 2,
  readinessScore: 78,
  overallGrade: "B",
  strengths: ["Genuine warmth comes through", "Clear intention about what you want", "Emotionally available"],
  risks: ["Generic phrases dilute the profile", "Opening line doesn't create intrigue", "Photo strategy needs curation"],
  bioAudit: "Jordan's profile has real personality underneath — but it's not on the surface yet. The opening line summarises rather than hooks. Phrases like 'loves hiking and cooking' and 'easy to talk to' appear in thousands of profiles and become invisible. The bio doesn't answer the question that actually matters: why would someone with options choose you specifically? The potential is there. The lens just needs sharpening.",
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
    { priority: 3, title: "Update your prompts to invite response", description: "Choose prompts that end with an implicit invitation to respond. Avoid lists and abstract value statements.", timeframe: "This week" },
    { priority: 4, title: "Change your opener strategy", description: "Reference something specific from their profile in every first message. Move away from generic conversation starters.", timeframe: "Ongoing" },
    { priority: 5, title: "Run a 2-week experiment", description: "Track matches per week, response rate, and date conversion rate. Your score should climb 10+ points at next audit.", timeframe: "2 weeks" },
  ],
  messagingStyle: "Your message sample shows genuine curiosity and warmth — both strong signals. You ask real questions and bring specificity. The growth area: you wait too long to suggest escalating to a date. The window closes faster than most people think. The highest-ROI change is suggesting a specific date sooner — something like 'This is a better conversation than 95% of these — want to actually meet?' converts at 3× the rate of staying in app.",
  messageTone: "Warm and curious — engaged but slightly passive at the close",
  messageNextAction: "Suggest a date. The rapport is already there — staying in app beyond 7–8 exchanges actively reduces your conversion rate.",
  messageReplies: [
    { style: "Warm", text: "This has been the most interesting conversation I've had on here in months — want to actually find out if we get along in person? I know a great spot.", rationale: "Acknowledges the connection genuinely and frames it as mutual curiosity rather than a formal ask." },
    { style: "Direct", text: "Are you free Thursday or Friday? Let's get a drink.", rationale: "Directness signals confidence. Specific days are 3× more likely to convert than open-ended suggestions." },
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just actually go. What does your week look like?", rationale: "Mirrors their language playfully and turns shared procrastination into a natural date suggestion." },
    { style: "Date Ask", text: "I feel like we've already had a better conversation than most first dates. Want to make it an actual one?", rationale: "Frames the conversation itself as evidence of chemistry. Confident without being presumptuous." },
    { style: "Graceful Exit", text: "I've actually really enjoyed talking with you — but I think we're looking for different things. I hope you find what you're after.", rationale: "When you realise the fit isn't there. Rare but powerful to do gracefully — it builds reputation." },
  ],
  messageExample: {
    original: "Not yet but I've been meaning to",
    coached: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?",
    rationale: "The original is passive and puts all weight on them. The coached version converts the shared reference into a natural date suggestion.",
  },
  coachingCta: "Ready to go deeper? Get your full Dating Reset — complete profile rewrite, conversation strategy, and a 7-day action plan built around your specific situation.",
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
});

const REPLY_STYLES: Record<string, { gradient: string; emoji: string; border: string }> = {
  "Warm":          { gradient: "linear-gradient(135deg, hsl(348 55% 58%), hsl(268 52% 55%))", emoji: "💜", border: "hsl(348 55% 58% / 0.3)" },
  "Direct":        { gradient: "linear-gradient(135deg, hsl(43 65% 52%), hsl(43 55% 42%))",   emoji: "→",  border: "hsl(43 65% 52% / 0.3)" },
  "Playful":       { gradient: "linear-gradient(135deg, hsl(285 45% 58%), hsl(268 52% 65%))", emoji: "😄", border: "hsl(285 45% 58% / 0.3)" },
  "Date Ask":      { gradient: "linear-gradient(135deg, hsl(142 55% 42%), hsl(190 55% 48%))", emoji: "✦",  border: "hsl(142 55% 42% / 0.3)" },
  "Graceful Exit": { gradient: "linear-gradient(135deg, hsl(228 25% 40%), hsl(232 28% 32%))", emoji: "🤍", border: "hsl(228 25% 50% / 0.25)" },
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

  if (!report && !generating && auditId) fetchReport();

  const r = report ?? (auditId ? null : DEMO_REPORT) ?? DEMO_REPORT;
  const grade = r.readinessScore >= 85 ? "A" : r.readinessScore >= 72 ? "B" : r.readinessScore >= 58 ? "C" : r.readinessScore >= 42 ? "D" : "F";
  const scoreColor = r.readinessScore >= 75 ? "hsl(142 55% 60%)" : r.readinessScore >= 55 ? "hsl(43 65% 65%)" : "hsl(348 55% 65%)";

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

  const statusIcon = (s: "good" | "needs_work" | "missing") =>
    s === "good" ? <CheckCircle className="w-5 h-5 text-[hsl(142_55%_60%)] flex-shrink-0" />
    : s === "needs_work" ? <AlertCircle className="w-5 h-5 text-[hsl(43_65%_65%)] flex-shrink-0" />
    : <XCircle className="w-5 h-5 text-[hsl(348_55%_65%)] flex-shrink-0" />;

  const statusLabel = (s: "good" | "needs_work" | "missing") => ({
    good: { label: "Good", cls: "tag-strength border" },
    needs_work: { label: "Needs work", cls: "tag-risk border" },
    missing: { label: "Missing", cls: "bg-[hsl(348_55%_65%/0.1)] text-[hsl(348_55%_72%)] border border-[hsl(348_55%_65%/0.2)]" },
  })[s];

  const replies = (r as typeof DEMO_REPORT).messageReplies ?? DEMO_REPORT.messageReplies;

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-50 pointer-events-none" />
        <div className="orb orb-plum fixed w-[300px] h-[300px] bottom-40 -left-20 opacity-40 pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10 space-y-5">

          {/* ── Score Header ── */}
          <motion.div {...fadeUp(0)} className="mirror-card rounded-3xl p-8 shimmer" data-testid="card-report-header">
            <div className="line-accent mb-6" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <ScoreRing score={r.readinessScore} />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {audit?.firstName ?? "Your"} · Profile Signal Audit
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-5xl font-bold" style={{ color: scoreColor }} data-testid="report-grade">{grade}</span>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall grade</p>
                    <p className="text-xs text-muted-foreground">Signal Score: {r.readinessScore} / 100</p>
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

          {/* ── Signal Spectrum ── */}
          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-8" data-testid="card-signal-spectrum">
            <div className="flex items-center gap-2.5 mb-2">
              <Zap className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">Signal Spectrum</h2>
              <span className="ml-auto text-xs text-muted-foreground">8 dimensions</span>
            </div>
            <p className="text-sm text-muted-foreground mb-7 leading-relaxed">How your profile reads across the dimensions that actually drive attraction and connection.</p>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
              {SIGNAL_SPECTRUM_DATA.map((item, i) => (
                <SpectrumBar key={i} {...item} delay={i * 0.08} />
              ))}
            </div>
            <div className="line-accent mt-7" />
            <div className="flex flex-wrap gap-3 mt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(142_55%_60%)]" /> Strong (75+)
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(43_65%_65%)]" /> Developing (50–74)
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(348_55%_65%)]" /> Needs work (&lt;50)
              </div>
            </div>
          </motion.div>

          {/* ── What You're Showing / How It's Received / What to Improve ── */}
          <motion.div {...fadeUp(0.1)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-6">
              <Eye className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">How You're Coming Across</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm mb-7">{r.bioAudit}</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="panel-show rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(268_52%_72%)] mb-3">You're showing</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.strengths.map((s, i) => <span key={i} className="tag-strength border px-2.5 py-1 rounded-full text-xs" data-testid={`item-strength-${i}`}>{s}</span>)}
                </div>
              </div>
              <div className="panel-received rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(190_55%_65%)] mb-3">How it may be received</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Genuine and warm, but similar to many others. The surface impression is positive — but not yet memorable.</p>
              </div>
              <div className="panel-improve rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_67%)] mb-3">What to improve</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.risks.map((risk, i) => <span key={i} className="tag-risk border px-2.5 py-1 rounded-full text-xs" data-testid={`item-risk-${i}`}>{risk}</span>)}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Your Dating Blueprint — Bio ── */}
          <motion.div {...fadeUp(0.14)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-2">
              <Sparkles className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">Your Dating Blueprint</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Before and after — your profile, rewritten with specificity and signal.</p>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="rounded-2xl p-5 bg-[hsl(232_28%_14%)] border border-white/6">
                <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wider">Your original bio</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic">{audit?.bio || "Software engineer who loves hiking and cooking. Big foodie. Looking for someone who is adventurous and loves to have fun. I'm told I'm easy to talk to and have a great sense of humor."}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["⚠ Generic", "⚠ No hook", "⚠ Cliché phrases"].map((t, i) => (
                    <span key={i} className="tag-risk border text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-5 border border-[hsl(268_52%_68%/0.3)] bg-[hsl(268_52%_68%/0.07)] shimmer">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-[hsl(268_60%_78%)] font-semibold uppercase tracking-wider">Rewritten ✦</p>
                  <CopyButton text={r.rewrittenBio} />
                </div>
                <p className="text-sm text-foreground leading-relaxed" data-testid="text-rewritten-bio">{r.rewrittenBio}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["✓ Specific", "✓ Memorable", "✓ Scene-setting"].map((t, i) => (
                    <span key={i} className="tag-strength border text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Rewritten Prompts */}
            <div className="flex items-center gap-2 mb-4">
              <div className="line-accent flex-1" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3">Prompts Rewritten</p>
              <div className="line-accent flex-1" />
            </div>
            <div className="space-y-4">
              {r.rewrittenPrompts.map((prompt, i) => (
                <div key={i} className="border border-white/8 rounded-2xl overflow-hidden" data-testid={`card-prompt-rewrite-${i}`}>
                  <div className="bg-[hsl(232_28%_14%)] px-5 py-3.5">
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Prompt</p>
                    <p className="text-sm text-muted-foreground italic">{prompt.original}</p>
                  </div>
                  <div className="bg-[hsl(268_52%_68%/0.07)] px-5 py-3.5 border-t border-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-[hsl(268_60%_78%)] font-semibold mb-1">Rewritten ✦</p>
                        <p className="text-sm text-foreground">{prompt.rewritten}</p>
                      </div>
                      <CopyButton text={prompt.rewritten} />
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-[hsl(232_34%_11%)] border-t border-white/6">
                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Coach note: </span>{prompt.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Chemistry Lab — Messaging ── */}
          <motion.div {...fadeUp(0.18)} className="glass border border-white/8 rounded-3xl p-8" data-testid="card-messaging">
            <div className="flex items-center gap-2.5 mb-2">
              <MessageSquare className="w-5 h-5 text-[hsl(190_55%_60%)]" />
              <h2 className="text-xl font-bold text-foreground">Chemistry Lab</h2>
              <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(190_55%_60%/0.1)] text-[hsl(190_55%_70%)] border border-[hsl(190_55%_60%/0.2)]">Messaging Analysis</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm mb-6" data-testid="text-messaging-style">{r.messagingStyle}</p>

            {/* Tone + Next Action */}
            <div className="grid sm:grid-cols-2 gap-4 mb-7">
              <div className="panel-show rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[hsl(268_52%_72%)] mb-2">Tone detected</p>
                <p className="text-sm text-foreground font-medium">{(r as typeof DEMO_REPORT).messageTone ?? DEMO_REPORT.messageTone}</p>
              </div>
              <div className="panel-improve rounded-2xl p-5">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_67%)] mb-1">Recommended next action</p>
                    <p className="text-sm text-foreground leading-relaxed">{(r as typeof DEMO_REPORT).messageNextAction ?? DEMO_REPORT.messageNextAction}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Reply Options */}
            <div className="flex items-center gap-2 mb-5">
              <div className="line-accent flex-1" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3">5 Ways to Reply</p>
              <div className="line-accent flex-1" />
            </div>
            <div className="space-y-4">
              {replies.map((reply, i) => {
                const style = REPLY_STYLES[reply.style] ?? REPLY_STYLES["Warm"];
                return (
                  <div key={i} className="border border-white/8 rounded-2xl overflow-hidden card-hover" data-testid={`card-reply-${i}`}>
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: style.gradient.replace("gradient(135deg,", "linear-gradient(135deg, ").replace(/, /, ", ").replace(/linear-linear/, "linear").replace("linear-linear-gradient", "linear-gradient"), backgroundColor: "transparent", borderBottom: `1px solid ${style.border}` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{style.emoji}</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-white">{reply.style}</span>
                      </div>
                      <CopyButton text={reply.text} />
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex justify-end">
                        <div
                          className="max-w-sm text-sm px-4 py-3 rounded-2xl rounded-br-sm text-white font-medium leading-relaxed"
                          style={{ background: style.gradient, boxShadow: `0 4px 16px ${style.border}` }}
                        >
                          {reply.text}
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-[hsl(232_28%_14%/0.5)] rounded-xl p-3">
                        <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-[hsl(268_52%_68%)]" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{reply.rationale}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Before / After example */}
            {r.messageExample && (
              <div className="mt-7 pt-6 border-t border-white/6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Quick before / after</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 bg-[hsl(232_28%_14%)] border border-white/8">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Original message</p>
                    <div className="inline-block bg-[hsl(232_28%_20%)] text-muted-foreground text-sm px-4 py-2.5 rounded-2xl rounded-bl-md max-w-full">{r.messageExample.original}</div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {["⚠ Passive", "⚠ No path forward"].map((t, i) => <span key={i} className="text-xs tag-risk border px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </div>
                  <div className="rounded-2xl p-4 bg-[hsl(268_52%_68%/0.06)] border border-[hsl(268_52%_68%/0.2)]">
                    <p className="text-xs font-semibold text-[hsl(268_60%_78%)] mb-2">Coached version ✦</p>
                    <div className="inline-block bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_60%)] text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-md max-w-full">{r.messageExample.coached}</div>
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

          {/* ── Photo Guidance ── */}
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

          {/* ── 7-Day Action Plan ── */}
          <motion.div {...fadeUp(0.26)} className="glass border border-white/8 rounded-3xl p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <Trophy className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              <h2 className="text-xl font-bold text-foreground">Your 7-Day Action Plan</h2>
            </div>
            <div className="space-y-4">
              {r.actionPlan.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border border-white/8 bg-[hsl(232_28%_14%/0.5)] card-hover" data-testid={`card-action-item-${i}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: "linear-gradient(135deg, hsl(268 52% 65%), hsl(285 45% 58%))", boxShadow: "0 0 12px hsl(268 52% 68% / 0.35)" }}>
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

          {/* ── CTA ── */}
          <motion.div {...fadeUp(0.3)} className="relative rounded-3xl p-8 text-center overflow-hidden shimmer" data-testid="card-report-cta"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.14), hsl(285 45% 60% / 0.1))" }}>
            <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
            <div className="orb orb-violet absolute w-64 h-64 -right-20 -top-20 opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <Heart className="w-8 h-8 text-[hsl(268_52%_78%)] mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-3">Ready for your full Dating Reset?</h3>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto text-sm leading-relaxed">{r.coachingCta}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse" data-testid="button-view-pricing">
                  <Link href="/pricing">The Dating Reset — $97 <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5" data-testid="button-coach-messages">
                  <Link href="/lab">Open Chemistry Lab</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
