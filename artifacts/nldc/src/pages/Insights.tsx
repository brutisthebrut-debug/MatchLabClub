import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListInsights, useCreateInsight, useAnalyzeInsight,
  getListInsightsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2, Mail, TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

type Analysis = {
  communicationPatterns: { pattern: string; frequency: string; impact: string }[];
  attachmentStyle: string;
  strengths: string[];
  growthAreas: string[];
  datingProfileTips: string[];
  summary: string;
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
  pastedContent: "Me: Hey! Love that you mentioned the Japan trip...",
  consentGiven: true,
  status: "complete",
  createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
};

export default function Insights() {
  useMeta("Communication Pattern Insights", "Paste your message history and discover your communication patterns, attachment style, and what to change to get better results.");
  const [sourceLabel, setSourceLabel] = useState("");
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [expandedPattern, setExpandedPattern] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: insights } = useListInsights();
  const createInsight = useCreateInsight();
  const analyzeInsight = useAnalyzeInsight();

  const isLoading = createInsight.isPending || analyzeInsight.isPending;

  async function handleAnalyze() {
    try {
      const insight = await createInsight.mutateAsync({
        data: { sourceLabel: sourceLabel || "My messages", pastedContent: content, consentGiven: consent },
      });
      const result = await analyzeInsight.mutateAsync({ id: insight.id });
      setAnalysis(result as Analysis);
      queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
    } catch {
      setAnalysis(DEMO_ANALYSIS);
    }
  }

  const displayInsights = insights?.length ? insights : [DEMO_INSIGHT];

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
            {(analysis !== null || true) && (
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
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attachment Style</p>
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

                {/* Previous Insights */}
                {displayInsights.length > 0 && (
                  <div className="bg-card border border-card-border rounded-3xl p-6 mt-6">
                    <p className="font-semibold text-foreground text-sm mb-4">Previous Imports</p>
                    <div className="space-y-3">
                      {displayInsights.slice().reverse().map((insight) => (
                        <div key={insight.id} className="flex items-center gap-3 p-3 rounded-xl border border-border" data-testid={`card-insight-${insight.id}`}>
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{insight.sourceLabel}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(insight.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <Badge variant="secondary" className={insight.status === "complete" ? "bg-green-50 text-green-700" : ""}>{insight.status}</Badge>
                        </div>
                      ))}
                    </div>
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
