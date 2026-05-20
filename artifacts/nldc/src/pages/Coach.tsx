import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { FallbackNotice } from "@/components/FallbackNotice";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListMessageCoachingSessions, useCreateMessageCoachingSession,
  useCoachMessage, getListMessageCoachingSessionsQueryKey,
  useGetCoachFollowUpStats, getGetCoachFollowUpStatsQueryKey,
  useGetCoachFollowUpTimeline, getGetCoachFollowUpTimelineQueryKey,
  useRecordCoachFollowUp,
  useExtractMessageScreenshot,
} from "@workspace/api-client-react";
import type { CoachFollowUpInputAnswer } from "@workspace/api-client-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { rememberAnonymousId } from "@/lib/anonymousIds";
import { MessageSquare, Loader2, Copy, Check, AlertTriangle, Lightbulb, Clock, ArrowRight, Sparkles, Send, Upload, X, AlertCircle, TrendingUp, TrendingDown, Minus, Moon, Sunrise } from "lucide-react";
import {
  useCoachNudgePrefs,
  buildWebSnoozeChips,
  buildTonightHourOptions,
  buildTomorrowMorningHourOptions,
} from "@/lib/coachPrefs";

const GOALS = ["Get a date", "Keep it going", "Recover from awkward", "Re-engage after ghosting"];
const SOURCE_APPS = ["Hinge", "Bumble", "Tinder"] as const;
type SourceApp = (typeof SOURCE_APPS)[number];

function detectAppFromText(text: string): SourceApp | null {
  const t = text.toLowerCase();
  if (/\bhinge\b/.test(t)) return "Hinge";
  if (/\bbumble\b/.test(t)) return "Bumble";
  if (/\btinder\b/.test(t)) return "Tinder";
  return null;
}

type CoachingResult = {
  analysis: string;
  suggestedReplies: { style: string; text: string; rationale: string }[];
  tone: string;
  redFlags: string[];
  coachTip: string;
};

const DEMO_RESULT: CoachingResult = {
  analysis: "This conversation has real momentum — you both found a specific, concrete point of interest (ramen). Your last message is passive though: 'I've been meaning to' puts the conversational weight entirely on them without a clear path forward. The goal of getting a date is very achievable here — you have built-in context for a suggestion.",
  suggestedReplies: [
    { style: "Playful", text: "Next time we're both 'meaning to' go, we should just go. What's your schedule like this week?", rationale: "Uses the shared 'meaning to' thread to naturally suggest a date. Playful and low-stakes — converts the existing joke into a moment." },
    { style: "Direct", text: "Let's fix that — are you free Thursday or Friday evening?", rationale: "Directness converts at 3× the rate of hinting. They clearly like you — just ask. The cost of asking is almost always lower than people think." },
    { style: "Warm", text: "The black garlic broth is worth the hype, I promise. We should go together — when are you free?", rationale: "Continues the food thread naturally, builds excitement, and ends with a date ask. Feels like the obvious next step." },
  ],
  tone: "Light and playful — this is working. Both sides are engaged.",
  redFlags: ["'I've been meaning to' is a non-answer — shows interest but gives them nothing to respond to", "Staying in app too long after real rapport builds reduces date conversion significantly"],
  coachTip: "You have everything you need here. After 5–7 messages of real rapport, it's time to ask. The best conversations end with plans — not more conversation.",
};

const DEMO_SESSION = {
  id: 1,
  matchName: "Alex",
  conversationContext: "conversation context",
  yourLastMessage: "Not yet but I've been meaning to",
  goal: "get a date",
  sourceApp: "Hinge",
  status: "complete" as const,
  createdAt: new Date(Date.now() - 86400000).toISOString(),
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[hsl(268_52%_68%)] transition-colors flex-shrink-0"
      data-testid="button-copy-reply"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const STYLE_COLORS: Record<string, string> = {
  Playful: "hsl(268 52% 68%)",
  Direct: "hsl(190 55% 60%)",
  Warm: "hsl(43 65% 65%)",
};

const STYLE_BG: Record<string, string> = {
  Playful: "hsl(268 52% 68% / 0.1)",
  Direct: "hsl(190 55% 60% / 0.1)",
  Warm: "hsl(43 65% 62% / 0.1)",
};

function fileToBase64(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader result"));
        return;
      }
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ dataUrl: result, base64 });
    };
    reader.readAsDataURL(file);
  });
}

function normalizeAppName(value: string | null | undefined): SourceApp | "" {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("hinge")) return "Hinge";
  if (lower.includes("bumble")) return "Bumble";
  if (lower.includes("tinder")) return "Tinder";
  return "";
}

type SpeakerTurn = { speaker: "them" | "you"; text: string };

function speakerTurnsToContext(turns: SpeakerTurn[], name: string): string {
  const theirLabel = name.trim() || "Them";
  return turns
    .map((t) => `${t.speaker === "them" ? theirLabel : "Me"}: ${t.text}`)
    .join("\n");
}

function flipSpeakers(turns: SpeakerTurn[]): SpeakerTurn[] {
  return turns.map((t) => ({ ...t, speaker: t.speaker === "them" ? "you" : "them" }));
}

export default function Coach() {
  useMeta("Message Coach", "Paste any dating app conversation and get three personalised reply options — Playful, Direct, and Warm — with coaching rationale for each.");
  const [matchName, setMatchName] = useState("");
  const [context, setContext] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [sourceApp, setSourceApp] = useState<SourceApp | "">("");
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [resultApp, setResultApp] = useState<SourceApp | null>(null);
  const [resultSessionId, setResultSessionId] = useState<number | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState<CoachFollowUpInputAnswer | null>(null);
  const [snoozeExpanded, setSnoozeExpanded] = useState(false);
  const [nudgePrefs, updateNudgePrefs] = useCoachNudgePrefs();
  const snoozeChips = buildWebSnoozeChips(nudgePrefs);
  const tonightHourOptions = buildTonightHourOptions();
  const tomorrowMorningHourOptions = buildTomorrowMorningHourOptions();
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotTurns, setScreenshotTurns] = useState<SpeakerTurn[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detectedApp = sourceApp || detectAppFromText(`${context}\n${lastMessage}`) || "";
  const queryClient = useQueryClient();
  const extractScreenshot = useExtractMessageScreenshot();

  const { isAuthenticated } = useAuth();
  const { data: sessions, isLoading: sessionsLoading } = useListMessageCoachingSessions();
  const { data: followUpStats } = useGetCoachFollowUpStats({
    query: { enabled: isAuthenticated, queryKey: getGetCoachFollowUpStatsQueryKey() },
  });
  const { data: followUpTimeline } = useGetCoachFollowUpTimeline({
    query: { enabled: isAuthenticated, queryKey: getGetCoachFollowUpTimelineQueryKey() },
  });
  const createSession = useCreateMessageCoachingSession();
  const coachMessage = useCoachMessage();
  const recordFollowUp = useRecordCoachFollowUp();
  const isLoading = createSession.isPending || coachMessage.isPending;
  const hasSessions = !!(sessions && sessions.length > 0);
  const isBrandNewUser = isAuthenticated && !sessionsLoading && !hasSessions && !result;

  async function processScreenshotFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScreenshotError("That doesn't look like an image. Try a PNG or JPEG.");
      return;
    }
    setScreenshotError(null);
    try {
      const img = await fileToBase64(file);
      setScreenshotPreview(img.dataUrl);
      const res = await extractScreenshot.mutateAsync({
        data: { imageBase64: img.base64 },
      });
      if (res.speakerTurns && res.speakerTurns.length > 0) {
        const turns = res.speakerTurns as SpeakerTurn[];
        setScreenshotTurns(turns);
        const formatted = speakerTurnsToContext(turns, matchName);
        setContext((prev) => (prev.trim() ? `${prev}\n${formatted}` : formatted));
      } else if (res.conversationText) {
        setContext((prev) => (prev.trim() ? `${prev}\n${res.conversationText}` : res.conversationText));
      }
      const detected = normalizeAppName(res.sourceApp);
      if (detected) setSourceApp(detected);
    } catch (err) {
      setScreenshotError(
        err instanceof Error && err.message
          ? "Couldn't read that screenshot. Try a clearer image."
          : "Couldn't read that screenshot. Try a clearer image.",
      );
    }
  }

  function clearScreenshot() {
    setScreenshotPreview(null);
    setScreenshotError(null);
    setScreenshotTurns(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFlipSpeakers() {
    if (!screenshotTurns) return;
    const flipped = flipSpeakers(screenshotTurns);
    setScreenshotTurns(flipped);
    setContext(speakerTurnsToContext(flipped, matchName));
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void processScreenshotFile(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCoach() {
    const appForRequest =
      sourceApp || detectAppFromText(`${context}\n${lastMessage}`) || null;
    setIsFallback(false);
    try {
      const session = await createSession.mutateAsync({
        data: { matchName: matchName || "My match", conversationContext: context, yourLastMessage: lastMessage, goal: goal || null, sourceApp: appForRequest },
      });
      rememberAnonymousId("messageSessions", session.id);
      const coaching = await coachMessage.mutateAsync({ id: session.id });
      setResult(coaching as CoachingResult);
      setResultApp(appForRequest);
      setResultSessionId(session.id);
      setFollowUpAnswer(null);
      setSnoozeExpanded(false);
      queryClient.invalidateQueries({ queryKey: getListMessageCoachingSessionsQueryKey() });
    } catch {
      setResult(DEMO_RESULT);
      setResultApp(appForRequest);
      setResultSessionId(null);
      setFollowUpAnswer(null);
      setIsFallback(true);
      toast({ title: "Using example output", description: "Couldn't reach the coaching service — showing a sample result instead.", variant: "default" });
    }
  }

  async function handleFollowUp(answer: CoachFollowUpInputAnswer) {
    if (followUpAnswer || recordFollowUp.isPending) return;
    setFollowUpAnswer(answer);
    try {
      const recorded = await recordFollowUp.mutateAsync({
        data: { answer, sessionId: resultSessionId },
      });
      if (!isAuthenticated) {
        rememberAnonymousId("followUps", recorded.followUpId);
      }
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: getGetCoachFollowUpStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCoachFollowUpTimelineQueryKey() });
      }
    } catch {
      setFollowUpAnswer(null);
    }
  }

  const displaySessions = hasSessions ? sessions! : (isAuthenticated ? [] : [DEMO_SESSION]);
  const showResult = result ?? ((!isLoading && !isAuthenticated) ? DEMO_RESULT : null);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
        <div className="max-w-3xl mx-auto relative z-10">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">AI-Powered</p>
            <h1 className="text-3xl font-bold text-foreground">Message Coach</h1>
            <p className="text-muted-foreground mt-2">Paste a conversation, get 3 expertly-crafted reply options — each with coaching rationale.</p>
          </motion.div>

          {isBrandNewUser && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
              className="mb-6"
              data-testid="coach-empty-state"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 text-center overflow-hidden shimmer"
                style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.12), hsl(285 45% 60% / 0.08))" }}>
                <div className="absolute inset-0 border border-[hsl(268_52%_68%/0.2)] rounded-3xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(285_45%_62%/0.15)] border border-[hsl(285_45%_62%/0.25)] mx-auto mb-4 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[hsl(285_52%_78%)]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[hsl(285_60%_82%)] mb-2">Welcome to Message Coach</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Coach your first message</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm leading-relaxed">
                    Paste any dating app conversation below and we'll deliver three calibrated reply options — Playful, Direct, and Warm — each with the rationale a real coach would give.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Screenshot upload */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="mb-5"
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void processScreenshotFile(file);
              }}
              className={`glass border rounded-3xl p-5 transition-colors ${isDragOver ? "border-[hsl(268_52%_68%/0.6)] bg-[hsl(268_52%_68%/0.06)]" : "border-white/8"}`}
              data-testid="card-coach-screenshot"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void processScreenshotFile(e.target.files?.[0])}
                data-testid="input-coach-screenshot"
              />
              {screenshotPreview ? (
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <img
                    src={screenshotPreview}
                    alt="Chat screenshot preview"
                    className="w-full sm:w-40 max-h-48 object-contain rounded-xl border border-white/8 bg-black/30"
                    data-testid="img-coach-screenshot-preview"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                      {extractScreenshot.isPending ? "Reading screenshot…" : "Conversation auto-filled below"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {extractScreenshot.isPending
                        ? "We're pulling the text and detecting which app this is from."
                        : "Tidy anything that looks wrong, set your last message, and run the coach."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearScreenshot}
                      className="rounded-full"
                      data-testid="button-coach-screenshot-clear"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[hsl(285_45%_62%)] to-[hsl(268_52%_58%)] flex items-center justify-center shrink-0">
                    <Upload className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Drop a chat screenshot</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Drag it here, paste it (⌘V / Ctrl+V), or pick a file. We'll OCR the conversation and auto-detect the app.
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extractScreenshot.isPending}
                    size="sm"
                    className="rounded-full"
                    data-testid="button-coach-screenshot-choose"
                  >
                    {extractScreenshot.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Reading…</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5 mr-1.5" /> Choose screenshot</>
                    )}
                  </Button>
                </div>
              )}
              {screenshotError ? (
                <div
                  className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  data-testid="text-coach-screenshot-error"
                >
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{screenshotError}</span>
                </div>
              ) : null}
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="md:col-span-2 glass border border-white/8 rounded-3xl p-7 space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Match's name</Label>
                  <Input
                    data-testid="input-match-name"
                    placeholder="Alex"
                    value={matchName}
                    onChange={e => setMatchName(e.target.value)}
                    className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Goal</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GOALS.map(g => (
                      <button
                        key={g}
                        data-testid={`button-goal-${g.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setGoal(prev => prev === g ? "" : g)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goal === g ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                  Source app
                  {!sourceApp && detectedApp ? (
                    <span className="ml-2 normal-case tracking-normal text-[10px] text-muted-foreground" data-testid="text-source-app-detected">
                      detected: {detectedApp}
                    </span>
                  ) : null}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCE_APPS.map(a => (
                    <button
                      key={a}
                      type="button"
                      data-testid={`button-source-app-${a.toLowerCase()}`}
                      onClick={() => setSourceApp(prev => prev === a ? "" : a)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${sourceApp === a ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_60%_82%)] border-[hsl(268_52%_68%/0.4)]" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Conversation so far</Label>
                  {screenshotTurns && screenshotTurns.length > 0 && (
                    <button
                      type="button"
                      data-testid="button-flip-speakers"
                      onClick={handleFlipSpeakers}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors border border-white/10 hover:border-white/20 rounded-full px-2 py-0.5"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-70"><path d="M1 3.5L3.5 1M3.5 1L6 3.5M3.5 1V7M9 6.5L6.5 9M6.5 9L4 6.5M6.5 9V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Flip speaker order
                    </button>
                  )}
                </div>
                <Textarea
                  data-testid="textarea-conversation"
                  placeholder={"Alex: I love that little ramen place on 5th\nMe: Oh nice, which one?\nAlex: The one with the black garlic broth!\nMe: I've been meaning to try it"}
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  className="min-h-[140px] resize-none font-mono text-xs bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/40"
                />
                <p className="text-xs text-muted-foreground">
                  Format: Name: message — each on a new line. Use "Me:" for your messages.
                  {screenshotTurns && screenshotTurns.length > 0 && (
                    <span className="ml-1 text-[hsl(268_52%_68%)]">Speaker order auto-detected — tap "Flip" if the first message is yours.</span>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">Your last message</Label>
                <Input
                  data-testid="input-last-message"
                  placeholder="Not yet but I've been meaning to"
                  value={lastMessage}
                  onChange={e => setLastMessage(e.target.value)}
                  className="bg-[hsl(232_28%_14%)] border-white/10 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <Button
                onClick={handleCoach}
                disabled={isLoading || !lastMessage.trim()}
                className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 glow-pulse disabled:opacity-50"
                data-testid="button-get-coaching"
              >
                {isLoading ? <><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analyzing...</> : <><Sparkles className="mr-2 h-4 w-4" /> Get Coaching Advice</>}
              </Button>
            </motion.div>

            <div className="space-y-5">
            {/* Send-through stats */}
            {isAuthenticated && followUpStats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                className="glass border border-white/8 rounded-3xl p-5"
                data-testid="card-send-through-stats"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-4 h-4 text-[hsl(190_55%_60%)]" />
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Send-through</p>
                </div>
                {followUpStats.totalPrompts === 0 ? (
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="stats-empty-state">
                    Answer the "did you send it?" prompt after each coaching result and we'll track how often your coached replies actually go out.
                  </p>
                ) : (
                  <>
                    {(() => {
                      const buckets = followUpTimeline?.buckets ?? [];
                      const weeksWithData = buckets.filter((b) => b.total > 0).length;
                      const chartData = buckets.map((b) => ({
                        weekStart: b.weekStart,
                        label: new Date(b.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                        rate: b.sendThroughRate == null ? 0 : Math.round(b.sendThroughRate * 100),
                        hasData: b.total > 0,
                        sent: b.sentCount,
                        notSent: b.notSentCount,
                      }));
                      if (weeksWithData < 2) {
                        return (
                          <div
                            className="mb-3 rounded-2xl border border-dashed border-white/10 bg-[hsl(232_28%_14%/0.5)] px-3 py-3 text-center"
                            data-testid="timeline-empty-state"
                          >
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weekly trend</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Keep answering prompts — we'll plot your weekly send-through rate once there are at least two weeks of data.
                            </p>
                          </div>
                        );
                      }
                      const withData = buckets.filter((b) => b.total > 0);
                      const latest = withData[withData.length - 1];
                      const prior = withData[withData.length - 2];
                      const latestRate = latest && latest.sendThroughRate != null ? Math.round(latest.sendThroughRate * 100) : null;
                      const priorRate = prior && prior.sendThroughRate != null ? Math.round(prior.sendThroughRate * 100) : null;
                      const baselineBuckets = withData.slice(-5, -1);
                      const avgRate = baselineBuckets.length > 0
                        ? Math.round(
                            (baselineBuckets.reduce((s, b) => s + (b.sendThroughRate ?? 0), 0) / baselineBuckets.length) * 100,
                          )
                        : null;
                      let callout: { text: string; tone: "up" | "down" | "flat" } | null = null;
                      if (latestRate != null) {
                        if (priorRate != null) {
                          const delta = latestRate - priorRate;
                          if (delta === 0) {
                            callout = { text: "Flat vs. last week", tone: "flat" };
                          } else if (priorRate === 0) {
                            callout = { text: `Up from 0% last week to ${latestRate}%`, tone: "up" };
                          } else if (latestRate === 0) {
                            callout = { text: `Down from ${priorRate}% last week to 0%`, tone: "down" };
                          } else {
                            const pct = Math.round((Math.abs(delta) / priorRate) * 100);
                            callout = {
                              text: `${delta > 0 ? "Up" : "Down"} ${pct}% from last week`,
                              tone: delta > 0 ? "up" : "down",
                            };
                          }
                        } else if (avgRate != null && baselineBuckets.length >= 2) {
                          const delta = latestRate - avgRate;
                          if (delta === 0) {
                            callout = { text: `Matches your ${baselineBuckets.length}-week average`, tone: "flat" };
                          } else {
                            callout = {
                              text: `${delta > 0 ? "Up from" : "Down from"} your ${baselineBuckets.length}-week average of ${avgRate}%`,
                              tone: delta > 0 ? "up" : "down",
                            };
                          }
                        }
                      }
                      const toneStyles =
                        callout?.tone === "up"
                          ? { color: "hsl(142 55% 70%)", background: "hsl(142 55% 60% / 0.12)" }
                          : callout?.tone === "down"
                            ? { color: "hsl(0 65% 72%)", background: "hsl(0 55% 60% / 0.12)" }
                            : { color: "hsl(0 0% 75%)", background: "hsl(232 28% 22%)" };
                      const ToneIcon = callout?.tone === "up" ? TrendingUp : callout?.tone === "down" ? TrendingDown : Minus;
                      return (
                        <div className="mb-3" data-testid="timeline-chart">
                          <div className="flex items-baseline justify-between mb-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Weekly send-through</p>
                            <p className="text-[10px] text-muted-foreground">last {buckets.length}w</p>
                          </div>
                          {callout && (
                            <div
                              className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
                              style={toneStyles}
                              data-testid="timeline-callout"
                              data-tone={callout.tone}
                            >
                              <ToneIcon className="w-3 h-3" />
                              <span>{callout.text}</span>
                            </div>
                          )}
                          <div className="h-24">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 9, fill: "hsl(0 0% 60%)" }}
                                  axisLine={false}
                                  tickLine={false}
                                  interval="preserveStartEnd"
                                />
                                <YAxis hide domain={[0, 100]} />
                                <Tooltip
                                  cursor={{ fill: "hsl(232 28% 22% / 0.5)" }}
                                  contentStyle={{
                                    background: "hsl(232 28% 12%)",
                                    border: "1px solid hsl(0 0% 100% / 0.08)",
                                    borderRadius: "0.5rem",
                                    fontSize: "11px",
                                  }}
                                  labelStyle={{ color: "hsl(0 0% 80%)" }}
                                  formatter={(value: number, _name, item) => {
                                    const p = item.payload as { hasData: boolean; sent: number; notSent: number };
                                    if (!p.hasData) return ["No prompts", "Rate"];
                                    return [`${value}% (${p.sent}/${p.sent + p.notSent})`, "Sent"];
                                  }}
                                />
                                <Bar dataKey="rate" fill="hsl(142 55% 60%)" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground" data-testid="stats-total-prompts">{followUpStats.totalPrompts}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Prompts</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[hsl(142_55%_60%)]" data-testid="stats-sent-count">{followUpStats.sentCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-muted-foreground" data-testid="stats-not-sent-count">{followUpStats.notSentCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Skipped</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 pt-3 border-t border-white/8">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[hsl(220_55%_70%)]" data-testid="stats-snooze-count">{followUpStats.snoozeCount ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Snoozed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[hsl(0_55%_65%)]" data-testid="stats-dismiss-count">{followUpStats.dismissCount ?? 0}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Dismissed</p>
                      </div>
                    </div>
                    {followUpStats.lastAnswer && followUpStats.lastAnsweredAt && (
                      <div className="pt-3 border-t border-white/8">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last answer</p>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: followUpStats.lastAnswer === "sent" ? "hsl(142 55% 60% / 0.15)" : "hsl(232 28% 22%)",
                              color: followUpStats.lastAnswer === "sent" ? "hsl(142 55% 70%)" : "hsl(0 0% 70%)",
                            }}
                            data-testid="stats-last-answer"
                          >
                            {followUpStats.lastAnswer === "sent" ? "Sent" : "Not sent"}
                          </span>
                          <span className="text-xs text-muted-foreground" data-testid="stats-last-answered-at">
                            {new Date(followUpStats.lastAnsweredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* Recent Sessions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass border border-white/8 rounded-3xl p-5"
            >
              <p className="font-semibold text-foreground text-sm mb-4 uppercase tracking-wider text-xs text-muted-foreground">Recent Sessions</p>
              {displaySessions.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="sessions-empty-state">
                  Your coached conversations will appear here once you analyze your first one.
                </p>
              ) : (
              <div className="space-y-3">
                {displaySessions.slice().reverse().slice(0, 5).map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-white/8 bg-[hsl(232_28%_14%/0.5)]" data-testid={`card-session-${s.id}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{s.matchName}</p>
                      {s.sourceApp ? (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(268_52%_68%/0.12)] text-[hsl(268_60%_78%)] border border-[hsl(268_52%_68%/0.3)]"
                          data-testid={`badge-session-${s.id}-app`}
                        >
                          {s.sourceApp}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.yourLastMessage}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span className="ml-auto text-xs tag-strength border px-2 py-0.5 rounded-full">{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </motion.div>

            {/* Nudge hour settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass border border-white/8 rounded-3xl p-5"
              data-testid="card-nudge-settings"
            >
              <div className="flex items-center gap-2 mb-3">
                <Moon className="w-4 h-4 text-[hsl(268_52%_68%)]" />
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Nudge hours</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                When you snooze a follow-up, the "Tonight" and "Tomorrow morning" times reflect these.
              </p>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="label-tonight-hour">
                  <span className="flex items-center gap-1.5">
                    <Moon className="w-3 h-3" />
                    Tonight
                  </span>
                  <select
                    value={nudgePrefs.tonightHour}
                    onChange={(e) =>
                      updateNudgePrefs({ ...nudgePrefs, tonightHour: Number(e.target.value) })
                    }
                    className="bg-[hsl(232_28%_14%)] border border-white/10 rounded-md px-2 py-1 text-xs text-foreground"
                    data-testid="select-tonight-hour"
                  >
                    {tonightHourOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="label-tomorrow-morning-hour">
                  <span className="flex items-center gap-1.5">
                    <Sunrise className="w-3 h-3" />
                    Tomorrow morning
                  </span>
                  <select
                    value={nudgePrefs.tomorrowMorningHour}
                    onChange={(e) =>
                      updateNudgePrefs({ ...nudgePrefs, tomorrowMorningHour: Number(e.target.value) })
                    }
                    className="bg-[hsl(232_28%_14%)] border border-white/10 rounded-md px-2 py-1 text-xs text-foreground"
                    data-testid="select-tomorrow-morning-hour"
                  >
                    {tomorrowMorningHourOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </motion.div>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`mt-6 space-y-5 ${!result ? "opacity-60" : ""}`}
                data-testid="section-coaching-results"
              >
                {!result && !isFallback && (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground font-medium">Example coaching output — fill in the form above to get yours</p>
                  </div>
                )}
                {isFallback && (
                  <FallbackNotice
                    label="coaching result"
                    onRetry={() => { void handleCoach(); }}
                    loading={isLoading}
                  />
                )}

                {/* Analysis */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <h2 className="text-lg font-bold text-foreground">Conversation Analysis</h2>
                    {(result ? resultApp : (DEMO_SESSION.sourceApp as SourceApp)) ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(268_52%_68%/0.12)] text-[hsl(268_60%_78%)] border border-[hsl(268_52%_68%/0.3)]"
                        data-testid="badge-source-app"
                      >
                        {result ? resultApp : DEMO_SESSION.sourceApp}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-sm" data-testid="text-coaching-analysis">{showResult.analysis}</p>
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(232_28%_16%)] border border-white/8 text-sm font-medium text-foreground">
                    <span className="w-2 h-2 rounded-full bg-[hsl(268_52%_68%)]" />
                    Tone: {showResult.tone}
                  </div>
                </div>

                {/* 3 Reply Options */}
                <div className="glass border border-white/8 rounded-3xl p-7">
                  <h2 className="text-lg font-bold text-foreground mb-5">3 Suggested Replies</h2>
                  <div className="space-y-4">
                    {showResult.suggestedReplies.map((reply, i) => (
                      <div
                        key={i}
                        className="border border-white/8 rounded-2xl overflow-hidden card-hover"
                        data-testid={`card-reply-${i}`}
                        style={{ borderColor: `${STYLE_COLORS[reply.style] || "hsl(268 52% 68%)"} / 0.2` }}
                      >
                        <div className="flex items-center justify-between px-5 py-3" style={{ background: STYLE_BG[reply.style] || "hsl(268 52% 68% / 0.08)" }}>
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: STYLE_COLORS[reply.style] || "hsl(268 52% 68%)" }}>
                            {reply.style}
                          </span>
                          <CopyButton text={reply.text} />
                        </div>
                        {/* Chat bubble */}
                        <div className="px-5 py-4">
                          <div className="flex justify-end mb-3">
                            <div
                              className="max-w-xs text-sm px-4 py-3 rounded-2xl rounded-br-md text-white font-medium"
                              style={{ background: `linear-gradient(135deg, ${STYLE_COLORS[reply.style] || "hsl(268 52% 68%)"}, hsl(285 45% 55%))` }}
                              data-testid={`text-reply-${i}`}
                            >
                              {reply.text}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{reply.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Did you send it? */}
                {result && resultSessionId != null && (
                  <div
                    className="glass border border-white/8 rounded-3xl p-6"
                    data-testid="card-follow-up-prompt"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="w-4 h-4 text-[hsl(190_55%_60%)]" />
                      <p className="font-semibold text-foreground text-sm">Did you send a coached reply?</p>
                    </div>
                    {followUpAnswer ? (
                      <p
                        className="text-xs text-muted-foreground leading-relaxed"
                        data-testid="text-follow-up-thanks"
                      >
                        Thanks — we'll fold this into your send-through stats.
                      </p>
                    ) : snoozeExpanded ? (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          When should we remind you to follow up?
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4" data-testid="snooze-options">
                          {snoozeChips.map((chip) => (
                            <button
                              key={chip.kind === "duration" ? `dur-${chip.seconds}` : chip.kind}
                              type="button"
                              disabled={recordFollowUp.isPending}
                              onClick={() => void handleFollowUp("snoozed")}
                              data-testid={`button-snooze-${chip.kind === "duration" ? `${chip.seconds}s` : chip.kind}`}
                              className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              {chip.kind === "tonight" && <Moon className="w-3 h-3" />}
                              {chip.kind === "tomorrowMorning" && <Sunrise className="w-3 h-3" />}
                              {chip.label}
                              {chip.sublabel && (
                                <span className="opacity-60">{chip.sublabel}</span>
                              )}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSnoozeExpanded(false)}
                            className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all"
                            data-testid="button-snooze-back"
                          >
                            ← Back
                          </button>
                        </div>
                        {/* Nudge hour pickers inline when snooze is expanded */}
                        <div className="border-t border-white/8 pt-3 mt-1 space-y-2" data-testid="nudge-hour-pickers">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customize nudge hours</p>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="label-tonight-hour">
                              <Moon className="w-3 h-3 flex-shrink-0" />
                              Tonight
                              <select
                                value={nudgePrefs.tonightHour}
                                onChange={(e) =>
                                  updateNudgePrefs({ ...nudgePrefs, tonightHour: Number(e.target.value) })
                                }
                                className="ml-1 bg-[hsl(232_28%_14%)] border border-white/10 rounded-md px-2 py-0.5 text-xs text-foreground"
                                data-testid="select-tonight-hour"
                              >
                                {tonightHourOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="label-tomorrow-morning-hour">
                              <Sunrise className="w-3 h-3 flex-shrink-0" />
                              Morning
                              <select
                                value={nudgePrefs.tomorrowMorningHour}
                                onChange={(e) =>
                                  updateNudgePrefs({ ...nudgePrefs, tomorrowMorningHour: Number(e.target.value) })
                                }
                                className="ml-1 bg-[hsl(232_28%_14%)] border border-white/10 rounded-md px-2 py-0.5 text-xs text-foreground"
                                data-testid="select-tomorrow-morning-hour"
                              >
                                {tomorrowMorningHourOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                          Tell us what happened so we can track how often your coached replies actually go out.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { value: "sent", label: "I sent it" },
                            { value: "not_sent", label: "Didn't send" },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={recordFollowUp.isPending}
                              onClick={() => void handleFollowUp(opt.value)}
                              data-testid={`button-follow-up-${opt.value}`}
                              className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all disabled:opacity-50"
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={recordFollowUp.isPending}
                            onClick={() => setSnoozeExpanded(true)}
                            data-testid="button-follow-up-snoozed"
                            className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            <Moon className="w-3 h-3" />
                            Snooze
                          </button>
                          <button
                            type="button"
                            disabled={recordFollowUp.isPending}
                            onClick={() => void handleFollowUp("dismissed")}
                            data-testid="button-follow-up-dismissed"
                            className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-muted-foreground hover:border-white/20 hover:text-foreground transition-all disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Red Flags + Coach Tip */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="glass border border-white/8 rounded-3xl p-6" data-testid="card-red-flags">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-[hsl(43_65%_65%)]" />
                      <p className="font-semibold text-foreground text-sm">Watch out for</p>
                    </div>
                    <ul className="space-y-2.5">
                      {showResult.redFlags.map((flag, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(43_65%_65%)] mt-2 flex-shrink-0" />
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-3xl p-6 border" style={{ background: "hsl(268 52% 68% / 0.07)", borderColor: "hsl(268 52% 68% / 0.2)" }} data-testid="card-coach-tip">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-[hsl(268_52%_68%)]" />
                      <p className="font-semibold text-foreground text-sm">Coach Tip</p>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{showResult.coachTip}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
