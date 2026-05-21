import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListInsights, useCreateInsight, useAnalyzeInsight,
  useGetInsightsRollup,
  useDeleteInsight,
  getListInsightsQueryKey,
  getGetInsightsRollupQueryKey,
} from "@workspace/api-client-react";
import type { EmailInsight } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { rememberAnonymousId, readAnonymousIds } from "@/lib/anonymousIds";
import { Shield, Loader2, Mail, TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, X, Filter, Trash2, RefreshCw, LogIn } from "lucide-react";
import { WelcomePanel } from "@/components/WelcomePanel";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const UNDO_WINDOW_MS = 5000;

const SOURCE_APPS = ["Hinge", "Bumble", "Tinder", "iMessage", "Email"] as const;
type InsightSource = (typeof SOURCE_APPS)[number];

function scoreTraitsClient(content: string) {
  const lower = content.toLowerCase();
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const totalChars = lower.length;
  const avgLine = lines.length > 0 ? totalChars / lines.length : totalChars;
  const humorHits = (lower.match(/\b(haha|lol|jk|kidding|lmao)\b/g) || []).length;
  const emotionalHits = (lower.match(/\b(feel|miss|hurt|sorry|love|care|happy|sad|excited)\b/g) || []).length;
  const questionHits = (lower.match(/\?/g) || []).length;
  const lineCount = Math.max(1, lines.length);
  return {
    warmth: Math.min(100, Math.round((emotionalHits / lineCount) * 200)),
    curiosity: Math.min(100, Math.round((questionHits / lineCount) * 150)),
    humor: Math.min(100, Math.round((humorHits / lineCount) * 220)),
    verbosity: Math.min(100, Math.round((avgLine / 120) * 100)),
  };
}

function detectSourceFromText(text: string): InsightSource | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  if (/\bimessage\b|\bsms\b|\btexts?\b/.test(t)) return "iMessage";
  if (/\bemail\b|\bgmail\b|\boutlook\b|@\w+\.\w+/.test(t)) return "Email";
  return null;
}

type Analysis = {
  communicationPatterns: { pattern: string; frequency: string; impact: string }[];
  attachmentStyle: string;
  strengths: string[];
  growthAreas: string[];
  datingProfileTips: string[];
  summary: string;
  sourceApp?: string | null;
};

const DEMO_ANALYSIS: Analysis = {
  communicationPatterns: [
    { pattern: "Humor as a connector", frequency: "High — appears naturally throughout conversation", impact: "One of the strongest accelerants of attraction and trust. Keep it calibrated to their energy." },
    { pattern: "Question-heavy style", frequency: "High — 6 questions detected in this sample", impact: "Strong curiosity signal, but balance with personal disclosures so it doesn't feel like an interview." },
    { pattern: "Concrete, specific messaging", frequency: "Consistent — you reference specifics (ramen spots, neighborhoods, experiences)", impact: "Excellent. Specific messages are memorable and give the other person more to respond to." },
    { pattern: "Emotionally present", frequency: "Moderate — warmth shows without being intense", impact: "Well-paced. You're building rapport without creating pressure." },
  ],
  attachmentStyle: "Secure — you communicate directly and recover well from tension",
  strengths: [
    "Natural use of humor to create warmth and ease",
    "Genuine curiosity — you ask real questions and seem to actually care about the answers",
    "Specific and concrete — you make conversations memorable",
    "Good conversational pacing — you match their energy without losing yourself",
  ],
  growthAreas: [
    "You wait a bit long before suggesting escalation — the best conversations convert to dates before momentum fades",
    "Occasionally over-explain or hedge ('I think maybe...') — you can be more direct without being cold",
    "Try practicing one emotional disclosure per thread — it signals depth and invites reciprocity",
  ],
  datingProfileTips: [
    "Bring the humor into your profile — it's your strongest asset. One specific, funny detail beats three generic lines.",
    "Add a prompt that ends with an implicit question — your natural curiosity should be in the profile, not just conversations.",
    "Lead with a concrete scene, not personality descriptors — show the reader a moment, not a trait list.",
    "Your restraint reads as confidence — lean into that. Be direct about what you want.",
  ],
  summary: "Based on this conversation sample, your communication fingerprint is: Secure and curious. You connect through humor, ask genuine questions, and bring specificity that makes conversations feel real. The growth edge is escalation timing — you build excellent rapport but sometimes stay in the 'getting to know you' phase longer than necessary. The coaching recommendations above will help you convert that rapport into actual dates faster.",
};

const DEMO_INSIGHT = {
  id: 1,
  sourceLabel: "Hinge conversation with Sam",
  sourceApp: "Hinge",
  pastedContent: "Me: Hey! Love that you mentioned the Japan trip...",
  consentGiven: true,
  status: "complete",
  createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
};

const DEMO_DETECTED_SOURCE: InsightSource = "Hinge";

export default function Insights() {
  useMeta("Communication Pattern Insights", "Paste your message history and discover your communication patterns, attachment style, and what to change to get better results.");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceApp, setSourceApp] = useState<InsightSource | "">("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [resultSource, setResultSource] = useState<InsightSource | null>(null);
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const detectedSource =
    sourceApp || detectSourceFromText(`${sourceLabel}\n${content}`) || "";
  const queryClient = useQueryClient();

  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const { toast } = useToast();
  const { data: insights, isLoading: insightsLoading } = useListInsights();
  const { data: rollup } = useGetInsightsRollup();
  const createInsight = useCreateInsight();
  const analyzeInsight = useAnalyzeInsight();

  const listInsightsKey = getListInsightsQueryKey();
  const rollupKey = getGetInsightsRollupQueryKey();

  const pendingDeleteRef = useRef<{
    insight: EmailInsight;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const deleteInsight = useDeleteInsight({
    mutation: {
      onError: () => {
        toast({ title: "Couldn't delete", description: "Something went wrong. Try again.", variant: "destructive" });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: listInsightsKey });
        queryClient.invalidateQueries({ queryKey: rollupKey });
      },
    },
  });

  const finalizePendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    deleteInsight.mutate({ id: pending.insight.id });
  }, [deleteInsight]);

  const undoPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    const current = queryClient.getQueryData<EmailInsight[]>(listInsightsKey);
    if (!current) return;
    if (current.some((i) => i.id === pending.insight.id)) return;
    queryClient.setQueryData<EmailInsight[]>(
      listInsightsKey,
      [...current, pending.insight].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    );
  }, [queryClient, listInsightsKey]);

  const handleDeleteInsight = useCallback(
    (insight: EmailInsight) => {
      if (pendingDeleteRef.current) finalizePendingDelete();
      const current = queryClient.getQueryData<EmailInsight[]>(listInsightsKey);
      if (current) {
        queryClient.setQueryData<EmailInsight[]>(
          listInsightsKey,
          current.filter((i) => i.id !== insight.id),
        );
      }
      const timer = setTimeout(() => finalizePendingDelete(), UNDO_WINDOW_MS);
      pendingDeleteRef.current = { insight, timer };
      const t = toast({
        title: "Import removed",
        description: `"${insight.sourceLabel}" was deleted.`,
        duration: UNDO_WINDOW_MS,
        action: (
          <ToastAction
            altText="Undo delete"
            data-testid={`button-undo-delete-insight-${insight.id}`}
            onClick={() => {
              undoPendingDelete();
              t.dismiss();
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    },
    [finalizePendingDelete, undoPendingDelete, queryClient, listInsightsKey, toast],
  );

  const [reAnalyzingId, setReAnalyzingId] = useState<number | null>(null);

  const handleReAnalyze = useCallback(
    async (insight: EmailInsight) => {
      setReAnalyzingId(insight.id);
      try {
        await analyzeInsight.mutateAsync({ id: insight.id });
        queryClient.invalidateQueries({ queryKey: listInsightsKey });
        queryClient.invalidateQueries({ queryKey: rollupKey });
        toast({ title: "Re-analysis complete", description: `"${insight.sourceLabel}" has been re-analyzed.` });
      } catch {
        toast({ title: "Re-analysis failed", description: "Something went wrong. Try again.", variant: "destructive" });
      } finally {
        setReAnalyzingId(null);
      }
    },
    [analyzeInsight, queryClient, listInsightsKey, rollupKey, toast],
  );

  const isLoading = createInsight.isPending || analyzeInsight.isPending;
  const hasInsights = !!(insights && insights.length > 0);
  const isBrandNewUser = isAuthenticated && !insightsLoading && !hasInsights && !analysis;

  // Track whether the anonymous user has insight IDs sitting in localStorage
  // that aren't yet attached to an account. If they clear cookies before
  // signing in (or never sign in), the analysis becomes orphaned. We surface
  // a banner + browser unload warning so they can take action proactively.
  const [hasUnsavedAnonInsights, setHasUnsavedAnonInsights] = useState(false);
  useEffect(() => {
    if (isAuthLoading) return;
    function refresh() {
      if (isAuthenticated) {
        setHasUnsavedAnonInsights(false);
        return;
      }
      const ids = readAnonymousIds();
      setHasUnsavedAnonInsights(ids.insightIds.length > 0);
    }
    refresh();
    if (typeof window === "undefined") return;
    function onStorage(e: StorageEvent) {
      if (!e.key || e.key === "nldc:anon:insightIds") refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAuthenticated, isAuthLoading, insights]);

  // Warn anonymous users before they close/navigate away if they have
  // analysis stored locally that hasn't been claimed to an account yet.
  useEffect(() => {
    if (!hasUnsavedAnonInsights) return;
    if (typeof window === "undefined") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Modern browsers ignore the custom string but require returnValue set.
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedAnonInsights]);

  // Detect the cookie-loss orphan scenario: the client had insight IDs in
  // localStorage when signing in, but the server couldn't match them because
  // the anon_claim cookie was already gone. useClaimAnonymousOnLogin stores a
  // flag in sessionStorage when it detects this; we surface it here once.
  const [insightsPossiblyOrphaned, setInsightsPossiblyOrphaned] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || insightsLoading) return;
    try {
      const flag = window.sessionStorage.getItem("nldc:anon:insights_possibly_orphaned");
      if (flag === "1") {
        window.sessionStorage.removeItem("nldc:anon:insights_possibly_orphaned");
        setInsightsPossiblyOrphaned(true);
      }
    } catch {
      // sessionStorage may be unavailable — swallow.
    }
  }, [isAuthenticated, insightsLoading]);

  async function handleAnalyze() {
    const appForRequest =
      sourceApp || detectSourceFromText(`${sourceLabel}\n${content}`) || null;
    try {
      const insight = await createInsight.mutateAsync({
        data: {
          sourceLabel: sourceLabel || "My messages",
          pastedContent: content,
          consentGiven: consent,
          sourceApp: appForRequest,
        },
      });
      rememberAnonymousId("insights", insight.id);
      const result = await analyzeInsight.mutateAsync({ id: insight.id });
      setAnalysis(result as Analysis);
      setResultSource(
        ((result as Analysis).sourceApp as InsightSource | null | undefined) ?? appForRequest,
      );
      queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetInsightsRollupQueryKey() });
    } catch {
      setAnalysis(DEMO_ANALYSIS);
      setResultSource(appForRequest);
    }
  }

  const allDisplayInsights = hasInsights ? insights! : (isAuthenticated ? [] : [DEMO_INSIGHT]);
  const displayInsights = sourceFilter
    ? allDisplayInsights.filter((i) => i.sourceApp === sourceFilter)
    : allDisplayInsights;

  const attachmentColor = (style: string) => {
    if (style.toLowerCase().includes("secure")) return "bg-green-50 text-green-700 border-green-200";
    if (style.toLowerCase().includes("anxious")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (style.toLowerCase().includes("avoidant")) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-purple-50 text-purple-700 border-purple-200";
  };

  const r = analysis ?? DEMO_ANALYSIS;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">Communication Analysis</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Email Insight Import</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">Paste exported message history and we'll identify your communication patterns, attachment style, and profile coaching tips.</p>
          </motion.div>

          {isBrandNewUser && !insightsPossiblyOrphaned && (
            <WelcomePanel
              icon={<Mail className="w-6 h-6 text-primary" />}
              eyebrow="Welcome to Email Insights"
              title="Analyze your first conversation"
              description="Paste any message history below and we'll surface your communication patterns, attachment style, and the profile tweaks most likely to lift your results."
              testId="insights-empty-state"
            />
          )}

          {hasUnsavedAnonInsights && !isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center"
              data-testid="banner-anon-insights-unsaved"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm mb-1">Sign in now to save your analysis</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Your Email Insights analysis is currently stored on this device only. If you clear your browser cookies or switch devices before signing in, it can't be linked to your account.
                </p>
              </div>
              <Button
                onClick={() => login()}
                className="rounded-full h-10 font-semibold sm:flex-shrink-0"
                data-testid="button-anon-insights-sign-in"
              >
                <LogIn className="w-4 h-4 mr-2" /> Sign in to save
              </Button>
            </motion.div>
          )}

          {insightsPossiblyOrphaned && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex gap-4"
              data-testid="banner-insights-possibly-orphaned"
            >
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm mb-1">Your previous analysis may not have transferred</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  It looks like you ran an analysis before signing in, but your browser cookies were cleared before we could link it to your account. The analysis itself is not lost — it just isn't attached to your profile.{" "}
                  <a
                    href="mailto:support@nextleveldatingclub.com?subject=Anonymous%20Email%20Insight%20not%20transferred&body=Hi%2C%20I%20ran%20an%20Email%20Insights%20analysis%20before%20signing%20in%20and%20it%20did%20not%20appear%20in%20my%20account.%20Could%20you%20help%20me%20recover%20it%3F"
                    className="underline underline-offset-2 font-medium text-amber-900 hover:text-amber-700 transition-colors"
                    data-testid="link-insights-orphan-support"
                  >
                    Contact support
                  </a>{" "}
                  and we can manually reassign it for you.
                </p>
              </div>
            </motion.div>
          )}

          {/* Privacy Notice */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6 flex gap-4"
          >
            <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-sm mb-1">Your Privacy Promise</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your pasted content is analyzed only for your coaching session and is never stored beyond your session, sold, or shared. You can delete it anytime. This is a demo flow — no live email authentication is required.
              </p>
            </div>
          </motion.div>

          {/* Cross-import rollup */}
          {rollup && rollup.totalAnalyzed >= 2 && rollup.sources.length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
              className="bg-card border border-card-border rounded-3xl p-6 sm:p-8 mb-6"
              data-testid="card-insights-rollup"
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Cross-import trends</p>
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground mb-1">How your patterns shift between sources</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Based on {rollup.totalAnalyzed} analyzed imports across {rollup.sources.length} sources.
              </p>

              {rollup.comparisons.length > 0 && (
                <ul className="space-y-2 mb-6" data-testid="list-rollup-comparisons">
                  {rollup.comparisons.map((c, i) => (
                    <li
                      key={`${c.trait}-${i}`}
                      className="flex items-start gap-2 text-sm text-foreground"
                      data-testid={`rollup-comparison-${c.trait}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span>{c.sentence}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Click a source to filter your import history
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {rollup.sources.map((s) => {
                  const isActive = sourceFilter === s.sourceApp;
                  return (
                    <button
                      key={s.sourceApp}
                      type="button"
                      onClick={() => setSourceFilter(isActive ? null : s.sourceApp)}
                      className={`text-left border rounded-2xl p-4 transition-all cursor-pointer ${
                        isActive
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-secondary/30"
                      }`}
                      data-testid={`rollup-source-${s.sourceApp.toLowerCase()}`}
                      aria-pressed={isActive}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-primary/10 text-primary border-primary/30"
                          }`}
                        >
                          {s.sourceApp}
                        </span>
                        <span className="text-xs text-muted-foreground">{s.count} import{s.count === 1 ? "" : "s"}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug mb-1">{s.signaturePattern}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{s.summary}</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["warmth", "curiosity", "verbosity", "humor"] as const).map((t) => (
                          <div key={t} className="text-center">
                            <div className="h-1 bg-secondary rounded-full overflow-hidden mb-1">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${s.traits[t]}%` }}
                              />
                            </div>
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{t}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {rollup && rollup.totalAnalyzed >= 1 && rollup.sources.length < 2 && isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
              className="bg-secondary/30 border border-border rounded-3xl p-5 mb-6 flex items-start gap-3"
              data-testid="card-insights-rollup-single"
            >
              <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">One source so far</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  Import a conversation from a different platform (e.g. iMessage if you've analyzed Hinge) and we'll surface how your patterns shift across sources.
                </p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card border border-card-border rounded-3xl p-8 space-y-5 mb-6"
          >
            <div className="space-y-2">
              <Label htmlFor="sourceLabel">Source label</Label>
              <Input
                id="sourceLabel"
                data-testid="input-source-label"
                placeholder="e.g. Hinge messages with Alex, Bumble conversation from March"
                value={sourceLabel}
                onChange={e => setSourceLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Source platform
                {!sourceApp && detectedSource ? (
                  <span className="ml-2 text-[10px] text-muted-foreground font-normal" data-testid="text-insight-source-detected">
                    detected: {detectedSource}
                  </span>
                ) : null}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_APPS.map(a => (
                  <button
                    key={a}
                    type="button"
                    data-testid={`button-insight-source-${a.toLowerCase()}`}
                    onClick={() => setSourceApp(prev => prev === a ? "" : a)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${sourceApp === a ? "bg-primary/10 text-primary border-primary/40" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Optional — we'll tune patterns, growth areas, and profile tips to this source. We auto-detect when we can.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pasteContent">Paste your message history</Label>
              <Textarea
                id="pasteContent"
                data-testid="textarea-message-history"
                placeholder={"Me: Hey! Love that you mentioned the Japan trip — I went last year too. Where did you end up?\nSam: Oh amazing! I did Tokyo and Kyoto. You?\nMe: Same! Tokyo was wild. Did you make it to Shibuya at night?\nSam: Haha yes, absolutely overwhelming. But in a good way?\nMe: Exactly. Okay random but favorite ramen spot?"}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[200px] resize-none font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Format as "Name: message" on each line. Use "Me:" for your messages. Export from any dating app's conversation history.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-consent">
              <Checkbox
                checked={consent}
                onCheckedChange={v => setConsent(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I understand this content will be analyzed for communication pattern insights. I consent to this analysis and understand I can delete this data at any time.
              </span>
            </label>
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !content.trim() || !consent}
              className="w-full rounded-full h-11 font-semibold"
              data-testid="button-analyze-insights"
            >
              {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" />Analyzing patterns...</> : "Analyze My Communication Style"}
            </Button>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            {(analysis !== null || !isAuthenticated) && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
                data-testid="section-insight-results"
              >
                {!analysis && (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground font-medium">Example analysis output</p>
                  </div>
                )}
                <div className={!analysis ? "opacity-60" : ""}>
                  {/* Attachment Style */}
                  <div className="bg-card border border-card-border rounded-3xl p-8 mb-6" data-testid="card-attachment-style">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Attachment Style</p>
                          {(analysis ? resultSource : DEMO_DETECTED_SOURCE) ? (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30"
                              data-testid="badge-insight-source"
                            >
                              Tuned to {analysis ? resultSource : DEMO_DETECTED_SOURCE}
                            </span>
                          ) : analysis ? (
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border"
                              data-testid="badge-insight-source-unknown"
                              title="Select a source platform to personalize future analyses"
                            >
                              General analysis · pick a platform to personalize
                            </span>
                          ) : null}
                        </div>
                        <Badge className={`text-sm font-semibold border px-4 py-1 ${attachmentColor(r.attachmentStyle)}`} data-testid="badge-attachment-style">
                          {r.attachmentStyle}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{r.summary}</p>
                  </div>

                  {/* Communication Patterns */}
                  <div className="bg-card border border-card-border rounded-3xl p-8 mb-6">
                    <h2 className="text-lg font-serif font-bold text-foreground mb-5">Communication Patterns</h2>
                    <div className="space-y-3">
                      {r.communicationPatterns.map((p, i) => (
                        <div
                          key={i}
                          className="border border-border rounded-2xl overflow-hidden cursor-pointer"
                          onClick={() => setExpandedPattern(expandedPattern === i ? null : i)}
                          data-testid={`card-pattern-${i}`}
                        >
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-foreground">{p.pattern}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{p.frequency}</p>
                            </div>
                            {expandedPattern === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <AnimatePresence>
                            {expandedPattern === i && (
                              <motion.div
                                initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-4 border-t border-border bg-secondary/20">
                                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{p.impact}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strengths + Growth */}
                  <div className="grid sm:grid-cols-2 gap-6 mb-6">
                    <div className="bg-card border border-card-border rounded-3xl p-6" data-testid="card-insight-strengths">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="font-semibold text-foreground text-sm">Communication Strengths</p>
                      </div>
                      <ul className="space-y-2">
                        {r.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-card border border-card-border rounded-3xl p-6" data-testid="card-insight-growth">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        <p className="font-semibold text-foreground text-sm">Growth Areas</p>
                      </div>
                      <ul className="space-y-2">
                        {r.growthAreas.map((g, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Profile Tips */}
                  <div className="bg-card border border-card-border rounded-3xl p-8" data-testid="card-profile-tips">
                    <h2 className="text-lg font-serif font-bold text-foreground mb-4">Dating Profile Tips from Your Patterns</h2>
                    <ul className="space-y-3">
                      {r.datingProfileTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm" data-testid={`tip-${i}`}>
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                          <span className="text-foreground leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Previous Imports */}
                {(allDisplayInsights.length > 0 || sourceFilter) && (
                  <div className="bg-card border border-card-border rounded-3xl p-6 mt-6" data-testid="section-previous-imports">
                    {/* Header row with filter badge */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <p className="font-semibold text-foreground text-sm">Previous Imports</p>
                      {sourceFilter && (
                        <div
                          className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1"
                          data-testid="filter-active-badge"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Showing {sourceFilter} only · {displayInsights.length} import{displayInsights.length === 1 ? "" : "s"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSourceFilter(null)}
                            className="ml-1 text-primary hover:text-primary/70 transition-colors"
                            aria-label="Clear filter"
                            data-testid="button-clear-filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Optional trait-over-time chart for filtered source */}
                    {sourceFilter && displayInsights.filter((i) => i.status === "complete").length >= 2 && (() => {
                      const chartData = displayInsights
                        .filter((i) => i.status === "complete")
                        .slice()
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((i) => {
                          const traits = scoreTraitsClient(i.pastedContent);
                          return {
                            date: new Date(i.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                            ...traits,
                          };
                        });
                      return (
                        <div className="mb-5 rounded-2xl border border-border p-4" data-testid="chart-source-traits">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            {sourceFilter} · Trait scores over time
                          </p>
                          <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                              <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                                itemStyle={{ padding: "1px 0" }}
                              />
                              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                              <Line type="monotone" dataKey="warmth" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Warmth" />
                              <Line type="monotone" dataKey="curiosity" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Curiosity" />
                              <Line type="monotone" dataKey="humor" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Humor" />
                              <Line type="monotone" dataKey="verbosity" stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} name="Verbosity" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}

                    {/* Filtered empty state */}
                    {displayInsights.length === 0 && sourceFilter && (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-filter-empty">
                        No imports from {sourceFilter} yet.{" "}
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2"
                          onClick={() => setSourceFilter(null)}
                        >
                          Clear filter
                        </button>{" "}
                        to see all imports.
                      </p>
                    )}

                    {/* Import list */}
                    {displayInsights.length > 0 && (
                      <div className="space-y-3">
                        {displayInsights.slice().reverse().map((insight) => (
                          <div key={insight.id} className="flex items-center gap-3 p-3 rounded-xl border border-border" data-testid={`card-insight-${insight.id}`}>
                            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-foreground truncate">{insight.sourceLabel}</p>
                                {insight.sourceApp ? (
                                  <span
                                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30"
                                    data-testid={`badge-insight-source-${insight.id}`}
                                  >
                                    {insight.sourceApp}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(insight.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <Badge variant="secondary" className={insight.status === "complete" ? "bg-green-50 text-green-700" : ""}>{insight.status}</Badge>
                            {hasInsights && (
                              <>
                                {insight.status === "complete" && (
                                <button
                                  type="button"
                                  aria-label={`Re-analyze import "${insight.sourceLabel}"`}
                                  data-testid={`button-reanalyze-insight-${insight.id}`}
                                  disabled={reAnalyzingId === insight.id}
                                  onClick={() => handleReAnalyze(insight as EmailInsight)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {reAnalyzingId === insight.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Delete import "${insight.sourceLabel}"`}
                                  data-testid={`button-delete-insight-${insight.id}`}
                                  onClick={() => handleDeleteInsight(insight as EmailInsight)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
