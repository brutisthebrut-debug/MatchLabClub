import { withAlpha } from "@/lib/brandColor";
import { useParams, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useCopyDurationPref, COPY_DURATION_MS } from "@/lib/copyDurationPref";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useGetAudit, useGenerateAuditReport, useGetEngineMeta, useListAuditReportVersions, getGetAuditQueryKey, getListAuditReportVersionsQueryKey, useCorrectAuditSourceApp } from "@workspace/api-client-react";
import {
  CheckCircle, XCircle, AlertCircle, ArrowRight, Copy, Check,
  Trophy, Calendar, Eye, Sparkles, MessageSquare, Camera,
  TrendingUp, Lightbulb, Heart, Zap, RefreshCw, History, ChevronDown, ChevronUp, GitCompare, CheckSquare, Square, Lock, Activity
} from "lucide-react";
import { CompareVersionsDialog } from "@/components/CompareVersionsDialog";
import { ShareButton } from "@/components/echo/ShareButton";

type ChangeSummary = {
  scoreDelta: number;
  previousScore: number;
  newScore: number;
  addedStrengths: string[];
  removedStrengths: string[];
  addedRisks: string[];
  removedRisks: string[];
};

function hasChanges(c: ChangeSummary): boolean {
  return (
    c.scoreDelta !== 0 ||
    c.addedStrengths.length > 0 ||
    c.removedStrengths.length > 0 ||
    c.addedRisks.length > 0 ||
    c.removedRisks.length > 0
  );
}

type VersionEntry = {
  id: number;
  readinessScore: number;
  generatedAt: string;
  changeSummary?: unknown;
  report?: unknown;
};

function summarizeVersion(v: VersionEntry, idx: number, total: number): string {
  const cs = v.changeSummary as ChangeSummary | null | undefined;
  if (!cs) {
    return idx === total - 1 ? "First generation" : `Score ${v.readinessScore}`;
  }
  const bits: string[] = [];
  if (cs.addedStrengths?.length) bits.push(`+${cs.addedStrengths.length} strength${cs.addedStrengths.length === 1 ? "" : "s"}`);
  if (cs.removedStrengths?.length) bits.push(`−${cs.removedStrengths.length} strength${cs.removedStrengths.length === 1 ? "" : "s"}`);
  if (cs.addedRisks?.length) bits.push(`+${cs.addedRisks.length} risk${cs.addedRisks.length === 1 ? "" : "s"}`);
  if (cs.removedRisks?.length) bits.push(`−${cs.removedRisks.length} risk${cs.removedRisks.length === 1 ? "" : "s"}`);
  if (bits.length === 0) return cs.scoreDelta === 0 ? "Re-run, no changes" : `Score ${cs.scoreDelta > 0 ? "+" : ""}${cs.scoreDelta}`;
  return bits.join(" · ");
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "earlier";
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STALE_REPORT_DAYS = 30;

function ageInDays(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function formatStaleAge(iso: string): string {
  const days = ageInDays(iso);
  if (days === null) return "a while ago";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 2) {
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks ago`;
  }
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(var(--brand-green))" : score >= 55 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";
  const glow = score >= 75 ? "hsl(var(--brand-green) / 0.5)" : score >= 55 ? "hsl(var(--brand-gold) / 0.4)" : "hsl(var(--brand-rose) / 0.4)";
  return (
    <div className="relative w-40 h-40 flex-shrink-0 mx-auto" data-testid="report-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 144 144" style={{ filter: `drop-shadow(0 0 24px ${glow})` }}>
        <circle cx="72" cy="72" r={radius} strokeWidth="12" stroke="hsl(248 40% 90%)" fill="none" className="dark:stroke-white/10" />
        <circle cx="72" cy="72" r={radius} strokeWidth="12" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.8s cubic-bezier(0.16, 1, 0.3, 1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-foreground tracking-tighter" data-testid="report-score-number">{score}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Signal Score</span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [copyDuration] = useCopyDurationPref();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopied(false), COPY_DURATION_MS[copyDuration]);
      }}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground transition-all flex-shrink-0 shadow-sm border border-white/10"
      data-testid="button-copy-text"
      aria-label="Copy text"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SpectrumBar({ dimension, value, color, desc, delay = 0 }: {
  dimension: string; value: number; color: string; desc: string; delay?: number;
}) {
  return (
    <div className="space-y-2" data-testid={`spectrum-${dimension.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">{dimension}</span>
        <span className="text-xs font-black tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${withAlpha(color, 0.4)}, ${color})`,
            boxShadow: `0 0 10px ${withAlpha(color, 0.5)}`,
          }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
    </div>
  );
}

const SIGNAL_SPECTRUM_DATA = [
  { dimension: "Warmth", value: 78, color: "hsl(348 55% 68%)", desc: "How emotionally open and inviting you come across" },
  { dimension: "Clarity", value: 62, color: "hsl(190 55% 62%)", desc: "How clearly your personality and intentions communicate" },
  { dimension: "Confidence", value: 72, color: "hsl(var(--brand-indigo))", desc: "Whether you seem at ease with who you are" },
  { dimension: "Playfulness", value: 55, color: "hsl(var(--brand-gold))", desc: "Whether you seem fun and light to be around" },
  { dimension: "Availability", value: 81, color: "hsl(142 55% 62%)", desc: "How emotionally open and ready you seem" },
  { dimension: "Specificity", value: 50, color: "hsl(326 100% 67%)", desc: "How distinct and unique your profile feels vs generic" },
  { dimension: "Energy", value: 68, color: "hsl(var(--brand-gold))", desc: "The vitality and forward momentum in your presence" },
  { dimension: "Approachability", value: 75, color: "hsl(190 55% 62%)", desc: "How easy it feels to start a conversation with you" },
];

const DEMO_REPORT = {
  auditId: 2,
  readinessScore: 78,
  overallGrade: "B",
  strengths: ["Genuine warmth comes through", "Clear intention about what you want", "Emotionally available"],
  risks: ["Generic phrases dilute the profile", "Opening line doesn't create intrigue", "Photo strategy needs curation"],
  bioAudit: "Jordan's profile has real personality underneath, but it's not on the surface yet. The opening line summarises rather than hooks. Phrases like 'loves hiking and cooking' and 'easy to talk to' appear in thousands of profiles and become invisible. The bio doesn't answer the question that actually matters: why would someone with options choose you specifically? The potential is there. The lens just needs sharpening.",
  rewrittenBio: "I make a genuinely great first date. I'll pick somewhere unexpected, actually listen, and probably make you laugh at something you didn't expect to. Currently: too invested in my sourdough starter, rewatching things I've already seen, trying to find someone worth getting off the couch for. If any of that sounds familiar, let's find out.",
  rewrittenPrompts: [
    { original: "The way to win me over is...", rewritten: "Remembering the weird specific thing I mentioned once. That's it. That's the whole thing.", tip: "Specificity beats sincerity here. Readers fill in the blanks with their own version of you." },
    { original: "I'll never shut up about...", rewritten: "The last rabbit hole I went down was the history of competitive eating. Before that, underwater welding. I contain multitudes.", tip: "Prompts are conversation starters, give them something to respond to." },
    { original: "A green flag I look for...", rewritten: "When someone admits they don't know something. Confidence without ego is wildly attractive.", tip: "This reveals values without sounding like a therapist. Standards signal emotional health." },
  ],
  photoGuidance: [
    { category: "Lead photo", status: "needs_work" as const, advice: "Your first photo should be a clear, well-lit face shot where you're visibly enjoying yourself. A group shot or squinting photo loses matches before they read a word." },
    { category: "Social proof shot", status: "missing" as const, advice: "Add one photo of you with friends or family. It signals social value and warmth, two top traits people screen for." },
    { category: "Action / lifestyle shot", status: "good" as const, advice: "You have a solid activity photo. These generate 3× more openers than static poses, keep it." },
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
  messagingStyle: "Your message sample shows genuine curiosity and warmth, both strong signals. You ask real questions and bring specificity. The growth area: you wait too long to suggest escalating to a date. The window closes faster than most people think. The highest-ROI change is suggesting a specific date sooner, something like 'This is a better conversation than 95% of these, want to actually meet?' converts at 3× the rate of staying in app.",
  messageTone: "Warm and curious, engaged but slightly passive at the close",
  messageNextAction: "Suggest a date. The rapport is already there, staying in app beyond 7–8 exchanges actively reduces your conversion rate.",
  messageReplies: [
    { style: "Warm", text: "This has been the most interesting conversation I've had on here in months, want to actually find out if we get along in person? I know a great spot.", rationale: "Acknowledges the connection genuinely and frames it as mutual curiosity rather than a formal ask." },
    { style: "Direct", text: "Are you free Thursday or Friday? Let's get a drink.", rationale: "Directness signals confidence. Specific days are 3× more likely to convert than open-ended suggestions." },
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just actually go. What does your week look like?", rationale: "Mirrors their language playfully and turns shared procrastination into a natural date suggestion." },
    { style: "Date Ask", text: "I feel like we've already had a better conversation than most first dates. Want to make it an actual one?", rationale: "Frames the conversation itself as evidence of chemistry. Confident without being presumptuous." },
    { style: "Graceful Exit", text: "I've actually really enjoyed talking with you, but I think we're looking for different things. I hope you find what you're after.", rationale: "When you realise the fit isn't there. Rare but powerful to do gracefully, it builds reputation." },
  ],
  messageExample: {
    original: "Not yet but I've been meaning to",
    coached: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?",
    rationale: "The original is passive and puts all weight on them. The coached version converts the shared reference into a natural date suggestion.",
  },
  coachingCta: "Ready to go deeper? Get your full Dating Reset, complete profile rewrite, conversation strategy, and a 7-day action plan built around your specific situation.",
};

type PhotoAnalysisShape = {
  summary: string;
  observations: { aspect: string; assessment: "strong" | "okay" | "needs_work"; detail: string }[];
  topFix: string;
};
type ReportShape = typeof DEMO_REPORT & { photoAnalysis?: PhotoAnalysisShape | null };

function receptionRead(report: { readinessScore: number; risks: string[] }): string {
  const s = report.readinessScore;
  const topRisk = report.risks?.[0];
  const suffix = topRisk ? ` The main signal gap: ${topRisk.toLowerCase().replace(/\.$/, "")}.` : "";
  if (s >= 75) return `Strong signal, specific, authentic, and memorable. Your profile reads as someone worth a closer look.${suffix}`;
  if (s >= 60) return `Genuine and warm, but similar to many others. The surface impression is positive, not yet memorable.${suffix}`;
  if (s >= 45) return `The impression lands as pleasant but generic. The warmth is real, the specificity isn't there yet.${suffix}`;
  return `The profile reads as surface-level right now. Nothing off-putting, but nothing that stands out from the feed yet.${suffix}`;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

const REPLY_STYLES: Record<string, { gradient: string; emoji: string; border: string }> = {
  "Warm": { gradient: "linear-gradient(135deg, hsl(348 55% 58%), hsl(var(--brand-indigo)))", emoji: "💜", border: "hsl(348 55% 58% / 0.4)" },
  "Direct": { gradient: "linear-gradient(135deg, hsl(43 65% 52%), hsl(43 55% 42%))", emoji: "→", border: "hsl(43 65% 52% / 0.4)" },
  "Playful": { gradient: "linear-gradient(135deg, hsl(var(--brand-pink)), hsl(var(--brand-indigo)))", emoji: "😄", border: "hsl(var(--brand-pink) / 0.4)" },
  "Date Ask": { gradient: "linear-gradient(135deg, hsl(142 55% 42%), hsl(190 55% 48%))", emoji: "✦", border: "hsl(142 55% 42% / 0.4)" },
  "Graceful Exit": { gradient: "linear-gradient(135deg, hsl(228 25% 40%), hsl(248 40% 32%))", emoji: "🤍", border: "hsl(228 25% 50% / 0.4)" },
};

const SOURCE_APPS = ["Hinge", "Bumble", "Tinder", "Grindr", "Feeld", "HER", "OkCupid", "CoffeeMeetsBagel"] as const;

function SourceAppPicker({
  current,
  saving,
  onSelect,
  onConfirm,
  onCancel,
}: {
  current: string | null;
  saving: boolean;
  onSelect: (app: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="source-app-picker">
      {SOURCE_APPS.map((app) => (
        <button
          key={app}
          onClick={() => onSelect(app)}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
            current === app
              ? "bg-[hsl(248_62%_52%/0.25)] text-[hsl(248_62%_62%)] border-[hsl(248_62%_52%/0.6)] shadow-[0_0_10px_hsl(248_62%_52%/0.2)]"
              : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30 hover:text-foreground hover:bg-white/10"
          }`}
          data-testid={`picker-app-${app.toLowerCase()}`}
        >
          {app}
        </button>
      ))}
      <button
        onClick={() => onSelect(null)}
        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
          current === null
            ? "bg-[hsl(248_62%_52%/0.25)] text-[hsl(248_62%_62%)] border-[hsl(248_62%_52%/0.6)] shadow-[0_0_10px_hsl(248_62%_52%/0.2)]"
            : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/30 hover:text-foreground hover:bg-white/10"
        }`}
        data-testid="picker-app-unknown"
      >
        Unknown
      </button>
      <div className="w-px h-6 bg-white/20 mx-1" />
      <button
        onClick={onConfirm}
        disabled={saving}
        className="text-[11px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-[hsl(248_62%_55%)] text-white border border-[hsl(248_62%_52%/0.8)] hover:bg-[hsl(248_62%_60%)] disabled:opacity-50 transition-all shadow-[0_4px_10px_hsl(248_62%_52%/0.4)]"
        data-testid="button-confirm-source-app"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
        data-testid="button-cancel-source-app"
      >
        Cancel
      </button>
    </span>
  );
}

function ShareReportBtn({ score }: { score?: number | null }) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const scoreLine = typeof score === "number" ? ` (Signal Score: ${score})` : "";
  return (
    <ShareButton
      surface="audit-report"
      variant="pill"
      title="My MatchLab Signal Report"
      text={`Just ran my dating profile through MatchLab Club${scoreLine}. Brutal but useful.`}
      path={pathname}
      ref="audit-share"
      label="Share Report"
      copiedLabel="Copied!"
      testId="button-share-report"
      className="bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-semibold px-4 py-2 text-sm shadow-sm transition-all rounded-full"
    />
  );
}

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const auditId = parseInt(id ?? "0", 10);
  useMeta("Signal Report", "Your full audit. Signal Score, bio critique, AI rewrite, prompt rewrites, photo checklist, and 7-day action plan.");

  const { isAuthenticated, login } = useAuth();
  const queryClient = useQueryClient();
  const { data: audit, isLoading: auditLoading } = useGetAudit(auditId, {
    query: { enabled: !!auditId, queryKey: getGetAuditQueryKey(auditId) }
  });

  const { data: engineMeta } = useGetEngineMeta();
  const currentEngineVersion = engineMeta?.engineVersion ?? null;

  const generateReport = useGenerateAuditReport();
  const [report, setReport] = useState<typeof DEMO_REPORT | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [viewingVersionId, setViewingVersionId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [sourceAppPickerOpen, setSourceAppPickerOpen] = useState(false);
  const [pendingSourceApp, setPendingSourceApp] = useState<string | null>(null);
  const [sourceAppCorrected, setSourceAppCorrected] = useState(false);
  const correctSourceApp = useCorrectAuditSourceApp();

  const versionsQuery = useListAuditReportVersions(auditId, {
    query: { enabled: !!auditId, queryKey: getListAuditReportVersionsQueryKey(auditId) },
  });
  const versions = versionsQuery.data?.versions ?? [];

  const storedReport = audit?.report ?? null;

  useEffect(() => {
    if (!storedReport || report) return;
    setReport(storedReport as unknown as typeof DEMO_REPORT);
  }, [storedReport, report]);

  useEffect(() => {
    if (!auditId || report || generating) return;
    if (!audit) return;
    if (audit.report) return;
    setGenerating(true);
    generateReport
      .mutateAsync({ id: auditId })
      .then((result) => {
        setReport(result as typeof DEMO_REPORT);
        queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
      })
      .catch(() => {
        setReport(DEMO_REPORT);
      })
      .finally(() => {
        setGenerating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, audit]);

  async function regenerate() {
    if (!auditId || regenerating) return;
    setRegenerating(true);
    try {
      const result = await generateReport.mutateAsync({ id: auditId });
      setReport(result as typeof DEMO_REPORT);
      setViewingVersionId(null);
      queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
      queryClient.invalidateQueries({ queryKey: getListAuditReportVersionsQueryKey(auditId) });
    } finally {
      setRegenerating(false);
    }
  }

  function viewVersion(versionId: number) {
    const v = versions.find((x) => x.id === versionId);
    if (!v) return;
    setViewingVersionId(versionId);
    setReport(v.report as unknown as typeof DEMO_REPORT);
  }

  function viewLatest() {
    setViewingVersionId(null);
    if (storedReport) setReport(storedReport as unknown as typeof DEMO_REPORT);
  }

  const r: ReportShape = (report ?? (auditId ? null : DEMO_REPORT) ?? DEMO_REPORT) as ReportShape;
  const changeSummary: ChangeSummary | null =
    (report as unknown as { changeSummary?: ChangeSummary | null } | null)
      ?.changeSummary ??
    (storedReport as unknown as { changeSummary?: ChangeSummary | null } | null)
      ?.changeSummary ??
    null;
  const viewingVersion = viewingVersionId != null
    ? versions.find((v) => v.id === viewingVersionId) ?? null
    : null;
  const showChangeSummary = !!auditId && !!changeSummary && hasChanges(changeSummary) && !viewingVersion;
  const grade = r.readinessScore >= 85 ? "A" : r.readinessScore >= 72 ? "B" : r.readinessScore >= 58 ? "C" : r.readinessScore >= 42 ? "D" : "F";
  const scoreColor = r.readinessScore >= 75 ? "hsl(var(--brand-green))" : r.readinessScore >= 55 ? "hsl(var(--brand-gold))" : "hsl(var(--brand-rose))";

  if (auditLoading || generating) {
    return (
      <AppLayout>
        <div className="min-h-screen mesh-bg py-12 px-4">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-64 w-full rounded-3xl opacity-50" />
            <Skeleton className="h-96 w-full rounded-3xl opacity-30" />
            <Skeleton className="h-96 w-full rounded-3xl opacity-20" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const statusIcon = (s: "good" | "needs_work" | "missing") =>
    s === "good" ? <CheckCircle className="w-5 h-5 text-[hsl(142_55%_60%)] flex-shrink-0" />
    : s === "needs_work" ? <AlertCircle className="w-5 h-5 text-[hsl(43_65%_65%)] flex-shrink-0" />
    : <XCircle className="w-5 h-5 text-[hsl(348_55%_65%)] flex-shrink-0" />;

  const statusLabel = (s: "good" | "needs_work" | "missing") =>
    s === "good" ? { label: "Strong", cls: "bg-[hsl(142_55%_60%/0.1)] text-[hsl(142_55%_65%)] border-[hsl(142_55%_60%/0.2)]" }
    : s === "needs_work" ? { label: "Needs work", cls: "bg-[hsl(43_65%_65%/0.1)] text-[hsl(43_65%_65%)] border-[hsl(43_65%_65%/0.2)]" }
    : { label: "Missing", cls: "bg-[hsl(348_55%_65%/0.1)] text-[hsl(348_55%_65%)] border-[hsl(348_55%_65%/0.2)]" };

  const replies = r.messageReplies ?? DEMO_REPORT.messageReplies;

  const handleSourceAppConfirm = async () => {
    if (!pendingSourceApp && pendingSourceApp !== null) return;
    await correctSourceApp.mutateAsync({
      id: auditId,
      data: { correctedApp: pendingSourceApp },
    });
    setSourceAppPickerOpen(false);
    setSourceAppCorrected(true);
    queryClient.invalidateQueries({ queryKey: getGetAuditQueryKey(auditId) });
  };

  const reportEngineVersion = (r as { engineVersion?: string | null }).engineVersion ?? null;
  const isStaleEngine = !!auditId && !viewingVersion && currentEngineVersion && reportEngineVersion && reportEngineVersion !== currentEngineVersion;
  const isStaleTime = !!auditId && !viewingVersion && audit?.reportGeneratedAt && ageInDays(audit.reportGeneratedAt)! >= STALE_REPORT_DAYS;
  const shouldShowStaleWarning = isStaleEngine || isStaleTime;

  return (
    <AppLayout>
      <div className="min-h-[100dvh] mesh-bg pt-12 pb-24 px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* ── Top Bar & Actions ── */}
          <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2" data-testid="card-report-header">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground font-bold shadow-sm">
                  {audit?.firstName?.charAt(0).toUpperCase() || "A"}
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Signal Report</h1>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    For {audit?.firstName || "Alex"} • {audit?.age || "28"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {auditId ? (
                <Button
                  onClick={regenerate}
                  disabled={regenerating}
                  variant="outline"
                  className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 font-medium"
                  data-testid="button-regenerate-report"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
                  {regenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              ) : (
                <div className="bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_65%)] border border-[hsl(248_62%_52%/0.3)] px-4 py-2 rounded-full text-xs font-bold tracking-wider flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Demo Mode
                </div>
              )}
              {audit?.previousReport ? (
                <Button
                  onClick={() => setShowPrevious(true)}
                  variant="outline"
                  className="rounded-full bg-white/5 border-white/10 hover:bg-white/10 font-medium"
                  data-testid="button-view-previous-version"
                >
                  <History className="w-4 h-4 mr-2" />
                  View previous version
                </Button>
              ) : null}
              <ShareReportBtn score={r.readinessScore} />
            </div>
          </motion.div>

          {/* ── Stale Warning ── */}
          {shouldShowStaleWarning && (
            <motion.div {...fadeUp(0.05)} className="rounded-2xl p-5 border border-[hsl(43_65%_65%/0.3)] bg-[hsl(43_65%_65%/0.08)] flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-[hsl(43_65%_65%)] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground mb-1">
                  {isStaleEngine ? "New AI model available" : "This report is getting old"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isStaleEngine
                    ? "The MatchLab engine has been upgraded since this report was generated. Regenerate to run your profile through the latest model."
                    : `This report was generated ${formatStaleAge(audit?.reportGeneratedAt ?? "")}. Profiles naturally decay as the app algorithms cycle. It's time for a fresh read.`}
                </p>
              </div>
              <Button onClick={regenerate} disabled={regenerating} className="shrink-0 rounded-full font-bold bg-[hsl(43_65%_65%)] hover:bg-[hsl(43_65%_60%)] text-[hsl(43_65%_15%)]" size="sm">
                Regenerate
              </Button>
            </motion.div>
          )}

          {/* ── Version Header ── */}
          {viewingVersion && (
            <motion.div {...fadeUp(0.06)} className="rounded-2xl p-4 border border-[hsl(43_65%_65%/0.3)] bg-[hsl(43_65%_65%/0.08)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-[hsl(43_65%_65%)]" />
                <div>
                  <p className="text-sm font-bold text-foreground">Viewing Past Version</p>
                  <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-viewing-version-date">
                    Generated {formatGeneratedAt(viewingVersion.generatedAt)}
                  </p>
                </div>
              </div>
              <Button onClick={viewLatest} variant="outline" size="sm" className="rounded-full bg-white/5 border-white/10" data-testid="button-return-latest">
                Back to Current
              </Button>
            </motion.div>
          )}

          {/* ── Main Score Card ── */}
          <motion.div {...fadeUp(0.1)} className="glass-elevated border border-[hsl(248_62%_52%/0.2)] rounded-[2rem] p-8 md:p-10 relative overflow-hidden" data-testid="card-signal-score">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(248_62%_62%/0.5)] to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(248_62%_52%/0.03)] to-transparent pointer-events-none" />

            <div className="grid md:grid-cols-2 gap-10 items-center relative z-10">
              <div className="flex flex-col items-center justify-center text-center">
                <ScoreRing score={r.readinessScore} />
                <div className="mt-6 space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">Signal Score</h2>
                  <p className="text-sm font-medium text-muted-foreground">Top {(100 - r.readinessScore + 5).toFixed(0)}% of profiles</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-[hsl(248_62%_62%)]" />
                    <h3 className="text-lg font-bold text-foreground tracking-tight">Signal Analysis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-report-grade-summary">
                    {r.readinessScore >= 75 ? "Your profile sends a clear, specific, and compelling signal. You're positioned well above average."
                    : r.readinessScore >= 55 ? "There's good raw material here, but the signal is diluted by generic framing or weak photos. Huge potential for quick wins."
                    : "The signal is currently getting lost. We need to rebuild the narrative and upgrade the visuals to get you seen."}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-[hsl(142_55%_60%/0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(142_55%_60%)] mb-2">Key Strength</p>
                    <p className="text-sm font-medium text-foreground leading-snug">{r.strengths[0]}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-br from-[hsl(43_65%_60%/0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(43_65%_65%)] mb-2">Biggest Risk</p>
                    <p className="text-sm font-medium text-foreground leading-snug">{r.risks[0]}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Deep Analysis Grid ── */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left Column: What you're showing */}
            <motion.div {...fadeUp(0.15)} className="space-y-6">
              
              <div className="glass border border-white/8 rounded-[2rem] p-8 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(248_62%_52%/0.1)] flex items-center justify-center border border-[hsl(248_62%_52%/0.2)]">
                    <Activity className="w-5 h-5 text-[hsl(248_62%_62%)]" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">How You're Received</h3>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
                  {r.bioAudit}
                </p>

                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)] mb-3">What's Working</p>
                    <div className="flex flex-col gap-2">
                      {r.strengths.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                           <Check className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
                           <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-[hsl(348_55%_60%/0.05)] rounded-2xl p-5 border border-[hsl(348_55%_60%/0.15)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(348_55%_65%)] mb-3">What Needs Fixing</p>
                    <div className="flex flex-col gap-2">
                      {r.risks.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                           <XCircle className="w-4 h-4 text-[hsl(348_55%_65%)] flex-shrink-0 mt-0.5" />
                           <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>

            {/* Right Column: Signal Spectrum */}
            <motion.div {...fadeUp(0.2)} className="glass border border-white/8 rounded-[2rem] p-8 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-foreground">Signal Spectrum</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/10">Under the hood</span>
              </div>
              
              <div className="space-y-5">
                {SIGNAL_SPECTRUM_DATA.map((item, i) => (
                  <SpectrumBar key={i} {...item} delay={0.2 + (i * 0.05)} />
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">The read:</strong> Your lowest dimensions are the invisible friction points losing you matches. The action plan below targets these specifically.
                </p>
              </div>
            </motion.div>
          </div>

          {/* ── Your Dating Blueprint (Bio & Prompts) ── */}
          <motion.div {...fadeUp(0.25)} className="glass-strong border border-white/10 rounded-[2rem] p-8 md:p-10 relative overflow-hidden" data-testid="card-blueprint">
             <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(248_62%_52%/0.15)] rounded-full blur-[100px] pointer-events-none" />
             <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(326_100%_59%/0.1)] rounded-full blur-[100px] pointer-events-none" />
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Your Dating Blueprint</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-8">Before and after. Your profile rewritten for maximum signal clarity.</p>

                {/* Bio Comparison */}
                <div className="grid md:grid-cols-2 gap-6 mb-10">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Original Bio</p>
                    <p className="text-sm text-muted-foreground italic leading-relaxed flex-1">
                      "{audit?.bio || "Software engineer who loves hiking and cooking. Big foodie. Looking for someone who is adventurous and loves to have fun. I'm told I'm easy to talk to and have a great sense of humor."}"
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-b from-[hsl(248_62%_52%/0.1)] to-[hsl(248_62%_52%/0.02)] rounded-2xl p-6 border border-[hsl(248_62%_52%/0.3)] shadow-[0_8px_30px_hsl(248_62%_52%/0.1)] relative group flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">Rewritten Bio ✦</p>
                      <CopyButton text={r.rewrittenBio} />
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed flex-1" data-testid="text-rewritten-bio">
                      {r.rewrittenBio}
                    </p>
                    <div className="absolute inset-0 border-2 border-[hsl(248_62%_52%/0.0)] group-hover:border-[hsl(248_62%_52%/0.4)] rounded-2xl transition-all pointer-events-none" />
                  </div>
                </div>

                {/* Prompts Comparison */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prompts Rewritten</p>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    {r.rewrittenPrompts.map((prompt, i) => (
                      <div key={i} className="flex flex-col bg-white/5 rounded-2xl border border-white/10 overflow-hidden group hover:border-[hsl(248_62%_52%/0.3)] transition-all" data-testid={`card-prompt-rewrite-${i}`}>
                        <div className="p-5 border-b border-white/5 bg-black/20 flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Original</p>
                          <p className="text-xs text-muted-foreground italic leading-relaxed">{prompt.original}</p>
                        </div>
                        <div className="p-5 bg-gradient-to-b from-[hsl(248_62%_52%/0.05)] to-transparent flex-1 relative">
                           <div className="flex justify-between items-start mb-2">
                             <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(248_62%_62%)]">Rewrite</p>
                             <div className="-mt-1 -mr-1"><CopyButton text={prompt.rewritten} /></div>
                           </div>
                           <p className="text-sm font-medium text-foreground leading-relaxed">{prompt.rewritten}</p>
                        </div>
                        <div className="p-4 bg-[hsl(248_62%_52%/0.1)] border-t border-[hsl(248_62%_52%/0.2)]">
                           <p className="text-[10px] text-[hsl(248_62%_70%)] leading-snug"><span className="font-bold">Coach Note:</span> {prompt.tip}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          </motion.div>

          {/* ── Photo Guidance ── */}
          <motion.div {...fadeUp(0.3)} className="glass border border-white/8 rounded-[2rem] p-8 md:p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground shadow-sm">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                 <h2 className="text-xl font-bold text-foreground">Photo Strategy</h2>
                 <p className="text-sm text-muted-foreground mt-0.5">The visual checklist to build trust instantly.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {r.photoGuidance.map((item, i) => {
                const sl = statusLabel(item.status);
                return (
                  <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/10 transition-colors" data-testid={`card-photo-guidance-${i}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(item.status)}
                        <span className="font-bold text-sm text-foreground">{item.category}</span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${sl.cls}`}>
                        {sl.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                      {item.advice}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
          
          {/* ── Chemistry Lab (Messaging) ── */}
          <motion.div {...fadeUp(0.35)} className="glass border border-white/8 rounded-[2rem] p-8 md:p-10" data-testid="card-messaging">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[hsl(190_55%_60%/0.15)] border border-[hsl(190_55%_60%/0.3)] flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-5 h-5 text-[hsl(190_55%_60%)]" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-foreground">Chemistry Lab</h2>
                   <p className="text-sm text-muted-foreground mt-0.5">Messaging analysis & conversation strategy.</p>
                </div>
             </div>

             <p className="text-sm text-muted-foreground leading-relaxed mb-8 bg-white/5 p-5 rounded-2xl border border-white/10" data-testid="text-messaging-style">
                {r.messagingStyle}
             </p>

             <div className="grid md:grid-cols-2 gap-8 mb-10">
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Detected Tone</p>
                   <p className="text-lg font-bold text-foreground">{(r as typeof DEMO_REPORT).messageTone ?? DEMO_REPORT.messageTone}</p>
                </div>
                <div className="bg-[hsl(43_65%_65%/0.1)] border border-[hsl(43_65%_65%/0.2)] rounded-2xl p-5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp className="w-12 h-12 text-[hsl(43_65%_65%)]" /></div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(43_65%_65%)] mb-2 relative z-10">Recommended Next Action</p>
                   <p className="text-sm font-medium text-foreground leading-relaxed relative z-10">{(r as typeof DEMO_REPORT).messageNextAction ?? DEMO_REPORT.messageNextAction}</p>
                </div>
             </div>

             <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">5 Ways to Reply</p>
                <div className="grid sm:grid-cols-2 gap-4">
                   {replies.slice(0,4).map((reply, i) => {
                      const style = REPLY_STYLES[reply.style] ?? REPLY_STYLES["Warm"];
                      return (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors flex flex-col group" data-testid={`card-reply-${i}`}>
                           <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                               <span className="text-xl">{style.emoji}</span>
                               <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: style.gradient.split(',')[1] }}>{reply.style}</span>
                             </div>
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyButton text={reply.text} /></div>
                           </div>
                           <p className="text-sm font-medium text-foreground mb-4 flex-1">"{reply.text}"</p>
                           <div className="pt-3 border-t border-white/5">
                              <p className="text-[11px] text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">Why:</span> {reply.rationale}</p>
                           </div>
                        </div>
                      )
                   })}
                </div>
             </div>
          </motion.div>

          {/* ── 7-Day Action Plan ── */}
          <motion.div {...fadeUp(0.4)} className="glass-elevated border border-[hsl(248_62%_52%/0.3)] rounded-[2rem] p-8 md:p-10 shadow-[0_10px_40px_hsl(248_62%_52%/0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(248_62%_52%/0.2)] rounded-full blur-[80px] pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center text-white shadow-lg">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-foreground tracking-tight">7-Day Action Plan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your roadmap to a higher Signal Score.</p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              {r.actionPlan.map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-start gap-5 hover:bg-white/10 hover:border-white/20 transition-all group" data-testid={`card-action-item-${i}`}>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0 group-hover:bg-[hsl(248_62%_52%)] group-hover:text-white transition-colors">
                    {item.priority}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full w-fit">
                          <Calendar className="w-3 h-3" /> {item.timeframe}
                        </span>
                        <CopyButton text={`${item.title}: ${item.description}`} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── CTA ── */}
          <motion.div {...fadeUp(0.45)} className="relative rounded-[2rem] p-10 text-center overflow-hidden" data-testid="card-report-cta"
            style={{ background: "linear-gradient(135deg, hsl(248 55% 10%), hsl(248 62% 20%))" }}>
            <div className="absolute inset-0 border border-white/10 rounded-[2rem] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-30" />
            
            <div className="relative z-10 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_59%)] flex items-center justify-center text-white mx-auto mb-6 shadow-[0_0_30px_hsl(326_100%_59%/0.5)]">
                 <Zap className="w-8 h-8 fill-current" />
              </div>
              <h3 className="text-3xl font-extrabold text-white tracking-tight mb-4">Want the unfair advantage?</h3>
              <p className="text-[hsl(248_20%_80%)] mb-8 text-sm leading-relaxed">{r.coachingCta}</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                 <Link href="/pricing"
                   className="block p-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 transition-all"
                   data-testid="button-view-pricing">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(326_100%_65%)] mb-2">Most Popular</p>
                    <p className="text-xl font-bold text-white mb-1">Dating Reset</p>
                    <p className="text-[11px] text-[hsl(248_20%_70%)]">Unlimited audits & coaching</p>
                 </Link>
                 <Link href="/checkout/wingman"
                   className="block p-5 rounded-2xl bg-[hsl(248_62%_52%/0.2)] hover:bg-[hsl(248_62%_52%/0.3)] border border-[hsl(248_62%_52%/0.5)] transition-all relative overflow-hidden"
                   data-testid="cta-tier-wingman">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[hsl(248_62%_62%/0.4)] blur-[30px] rounded-full" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[hsl(248_62%_75%)] mb-2 relative z-10">Premium</p>
                    <p className="text-xl font-bold text-white mb-1 relative z-10">Wingman</p>
                    <p className="text-[11px] text-[hsl(248_20%_80%)] relative z-10">Human coach, weekly</p>
                 </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
      
      {/* ── Compare versions dialog ── */}
      {compareOpen && compareIds.length === 2 ? (() => {
      const idA = compareIds[0]!;
      const idB = compareIds[1]!;
      const vA = versions.find((v: VersionEntry) => v.id === idA) ?? null;
      const vB = versions.find((v: VersionEntry) => v.id === idB) ?? null;
      const [olderV, newerV] = vA && vB
      ? new Date(vA.generatedAt) <= new Date(vB.generatedAt)
      ? [vA, vB]
      : [vB, vA]
      : [vA, vB];
      return (
      <CompareVersionsDialog
      open={compareOpen}
      onOpenChange={setCompareOpen}
      versionA={olderV}
      versionB={newerV}
      />
      );
      })() : null}

      <Dialog open={showPrevious} onOpenChange={setShowPrevious}>
      <DialogContent
      className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[hsl(248_40%_96%)] border-white/10"
      data-testid="dialog-previous-version"
      >
      <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-foreground">
      <Eye className="w-5 h-5 text-[hsl(248_62%_62%)]" />
      Previous version
      </DialogTitle>
      <DialogDescription className="text-muted-foreground" data-testid="text-previous-version-generated-at">
      {audit?.previousReportGeneratedAt
      ? `Generated ${formatGeneratedAt(audit.previousReportGeneratedAt)}`
      : "Earlier audit"}
      </DialogDescription>
      </DialogHeader>
      {audit?.previousReport ? (
      <PreviousReportView
      report={audit.previousReport as unknown as typeof DEMO_REPORT}
      generatedAt={audit.previousReportGeneratedAt ?? null}
      />
      ) : null}
      </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function PreviousReportView({
  report: pr,
  generatedAt,
}: {
  report: typeof DEMO_REPORT;
  generatedAt: string | null;
}) {
  const scoreColor =
  pr.readinessScore >= 75
  ? "hsl(var(--brand-green))"
  : pr.readinessScore >= 55
  ? "hsl(var(--brand-gold))"
  : "hsl(var(--brand-rose))";
  const grade =
  pr.readinessScore >= 85
  ? "A"
  : pr.readinessScore >= 72
  ? "B"
  : pr.readinessScore >= 58
  ? "C"
  : pr.readinessScore >= 42
  ? "D"
  : "F";
  return (
  <div className="space-y-5" data-testid="previous-version-content">
  <div className="flex items-center gap-5 p-5 rounded-2xl border border-white/10 bg-[hsl(248_40%_160%)]">
  <ScoreRing score={pr.readinessScore} />
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
  Previous Signal Score
  </p>
  <div className="flex items-center gap-3">
  <span className="text-4xl font-bold" style={{ color: scoreColor }}>
  {grade}
  </span>
  <p className="text-sm text-muted-foreground">
  {pr.readinessScore} / 100
  {generatedAt ? ` · ${formatGeneratedAt(generatedAt)}` : ""}
  </p>
  </div>
  </div>
  </div>

  <div className="grid sm:grid-cols-2 gap-3">
  <div className="panel-show rounded-2xl p-4">
  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(248_62%_58%)] mb-2">
  Strengths then
  </p>
  <div className="flex flex-wrap gap-1.5">
  {pr.strengths.map((s, i) => (
  <span key={i} className="tag-strength border px-2.5 py-1 rounded-full text-xs">
  {s}
  </span>
  ))}
  </div>
  </div>
  <div className="panel-improve rounded-2xl p-4">
  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(43_65%_67%)] mb-2">
  Risks then
  </p>
  <div className="flex flex-wrap gap-1.5">
  {pr.risks.map((s, i) => (
  <span key={i} className="tag-risk border px-2.5 py-1 rounded-full text-xs">
  {s}
  </span>
  ))}
  </div>
  </div>
  </div>

  <div className="rounded-2xl p-4 border border-white/10 bg-[hsl(248_40%_160%)]">
  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
  Bio audit (previous)
  </p>
  <p className="text-sm text-muted-foreground leading-relaxed">{pr.bioAudit}</p>
  </div>

  <div className="rounded-2xl p-4 border border-[hsl(248_62%_52%/0.25)] bg-[hsl(248_62%_52%/0.05)]">
  <div className="flex items-center justify-between mb-2">
  <p className="text-xs font-bold uppercase tracking-wider text-[hsl(248_62%_62%)]">
  Rewritten Bio then
  </p>
  <CopyButton text={pr.rewrittenBio} />
  </div>
  <p className="text-sm text-foreground leading-relaxed" data-testid="text-previous-rewritten-bio">{pr.rewrittenBio}</p>
  </div>

  {pr.rewrittenPrompts.length > 0 && (
  <div className="space-y-3">
  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prompts then</p>
  {pr.rewrittenPrompts.map((prompt, i) => (
  <div key={i} className="rounded-2xl p-4 border border-white/10 bg-[hsl(248_40%_160%)]" data-testid={`prev-prompt-${i}`}>
  <div className="flex items-start justify-between gap-3 mb-2">
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{prompt.original}</p>
  <CopyButton text={prompt.rewritten} />
  </div>
  <p className="text-sm text-foreground leading-relaxed">{prompt.rewritten}</p>
  </div>
  ))}
  </div>
  )}

  {pr.actionPlan.length > 0 && (
  <div className="space-y-3">
  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Action plan then</p>
  {pr.actionPlan.map((item, i) => (
  <div key={i} className="rounded-2xl p-4 border border-white/10 bg-[hsl(248_40%_160%)] flex items-start justify-between gap-3" data-testid={`prev-action-${i}`}>
  <div>
  <p className="text-sm font-bold text-foreground">{item.title}</p>
  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{item.description}</p>
  </div>
  <CopyButton text={`${item.title}: ${item.description}`} />
  </div>
  ))}
  </div>
  )}
  </div>
  );
}
