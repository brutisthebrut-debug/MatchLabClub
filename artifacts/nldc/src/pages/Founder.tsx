import { withAlpha } from "@/lib/brandColor";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import {
  getFounderStats, getLeads, setLeadStatus, getPurchaseInterestList, getAiMetrics,
  getAiThresholds, updateAiThresholds, getAiMetricsTrends, getAiThresholdChanges, undoAiThresholdChange,
  getRollupHeartbeat, getOcrMismatches, getBackgroundJobs, purgeTrashNow, refreshGeoip, setUserTier,
  getOcrLearnedRules, runOcrLearn, clearOcrLearnedRules, deleteOcrRule, patchOcrRule, getOcrMismatchesTrends,
  getOcrPendingRules, approveOcrRule, rejectOcrRule, getOcrRuleReviewLog,
  getAlertSettings, updateAlertSettings, resetAlertSettings,
  getMatchingQueue, getMatchingPool, setMatchingProposalStatus, addMatchingProposalNote,
  getReferralAttribution, getEchoUserSignals, getFounderFunnel, getJourneyEvents,
  getBrainControls, updateBrainControls, resetBrainControls, getBrainMap,
  getReweighting, getReweightingImpact, getCuration, saveCuration,
  type BrainControls, type BrainControlsResponse, type BrainMapResponse,
  type ReweightingMode, type ReweightingResponse,
  type ReweightingImpactResponse, type CurationEntry,
  type MatchingQueueItem, type MatchingPoolItem,
  type ReferralAttributionResponse, type EchoUserSignalsResponse, type FounderFunnelResponse,
  type JourneyEventsResponse,
  type FounderStats, type Lead, type PurchaseInterest, type AiMetricsResponse,
  type AiThresholdsResponse, type AiPerToolThreshold, type AiMetricsTrendsResponse,
  type AiThresholdChange, type RollupHeartbeatResponse,
  type BackgroundJobStatus, type BackgroundJobsResponse,
  type OcrMismatchesResponse, type OcrMismatchesSort, type OcrMismatchesWindow,
  type OcrCorrectionField,
  type OcrLearnedRule, type OcrLearnResult, type OcrRuleReviewLogEntry,
  type OcrMismatchesTrendsResponse, type OcrMismatchTrendEntry,
  type AlertSettingsResponse,
  type AiToolCooldownState,
} from "@/lib/apiClient";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Bar } from "recharts";
import { useListAudits, useGetWaitlistStats, useGetCoachFollowUpTimeline, useGetFounderReferrals } from "@workspace/api-client-react";
import { Lock, LogOut, Users, ShoppingBag, BarChart3, Inbox, ListChecks, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, Loader2, Send, Mail, Copy, ClipboardCheck, Circle, Moon, XCircle, Download, ScanLine, Clock, Share2, Heart, MapPin, Brain, SlidersHorizontal, RotateCcw, ThumbsUp, ThumbsDown, Activity, Save, Gauge, TrendingUp } from "lucide-react";
import { buildAiContext, readSavedProgressEntries, readSavedGoals } from "@/lib/contextBuilder";
import { EchoPlaybookPanel } from "@/components/founder/EchoPlaybookPanel";
import {
  nextStepForUser,
  whatEchoWouldNotDo,
  voiceNoteForTomorrow,
  pricingNudgeForUser,
  conciergeFlagForUser,
  type EchoDecision,
  type EchoUserSignals,
} from "@workspace/echo";
import { toast } from "@/hooks/use-toast";

type AiMode = "live" | "fallback" | "setup-needed";
interface AiStatusData {
  mode: AiMode;
  keyDetected: boolean;
  provider: string | null;
  source: "direct" | "replit-proxy" | "none";
  model: string;
  message: string;
}
interface AiTestData {
  mode: AiMode;
  isFallback: boolean;
  output: string;
  durationMs: number;
  error?: string;
  model?: string;
}

const STATUS_STYLES: Record<AiMode, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  live: { label: "Live AI connected", color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.12)", border: "hsl(var(--brand-green) / 0.35)", Icon: CheckCircle2 },
  fallback: { label: "Fallback mode", color: "hsl(var(--brand-gold))", bg: "hsl(var(--brand-gold) / 0.12)", border: "hsl(var(--brand-gold) / 0.35)", Icon: Sparkles },
  "setup-needed": { label: "Setup needed", color: "hsl(var(--brand-rose))", bg: "hsl(var(--brand-rose) / 0.12)", border: "hsl(var(--brand-rose) / 0.35)", Icon: AlertTriangle },
};

function AiStatusPanel() {
  const [status, setStatus] = useState<AiStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [sample, setSample] = useState("Say hello to a podcast listener checking out the app for the first time.");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AiTestData | null>(null);

  const loadStatus = async () => {
  setStatusLoading(true);
  try {
  const res = await fetch("/api/ai/status");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = (await res.json()) as AiStatusData;
  setStatus(data);
  } catch {
  setStatus({
  mode: "setup-needed",
  keyDetected: false,
  provider: null,
  source: "none",
  model: "unknown",
  message: "Could not reach the API server.",
  });
  } finally {
  setStatusLoading(false);
  }
  };

  useEffect(() => { void loadStatus(); }, []);

  const runTest = async () => {
  if (!sample.trim() || testing) return;
  setTesting(true);
  setResult(null);
  try {
  const context = buildAiContext({
  toolName: "Founder · AI Diagnostic Test",
  goals: readSavedGoals(),
  progressEntries: readSavedProgressEntries(),
  extras: { source: "founder-dashboard" },
  });
  const res = await fetch("/api/ai/test", {
  method: "POST",
  headers: {
  "Content-Type": "application/json",
  "x-founder-key": FOUNDER_KEY,
  },
  body: JSON.stringify({ sample: sample.slice(0, 2000), context }),
  });
  const data = (await res.json()) as AiTestData;
  setResult(data);
  void loadStatus();
  } catch (err) {
  setResult({
  mode: "setup-needed",
  isFallback: true,
  output: "",
  durationMs: 0,
  error: err instanceof Error ? err.message : "Network error",
  });
  } finally {
  setTesting(false);
  }
  };

  const effectiveMode: AiMode = status?.mode ?? "fallback";
  const s = STATUS_STYLES[effectiveMode];

  return (
  <div className="glass rounded-2xl p-6 space-y-5">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div className="flex items-center gap-3">
  <div
  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
  style={{ background: s.bg, border: `1px solid ${s.border}` }}
  >
  <s.Icon className="w-5 h-5" style={{ color: s.color }} />
  </div>
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">AI Integration</p>
  <p className="text-base font-semibold text-foreground" style={{ color: s.color }}>
  {statusLoading ? "Checking…" : s.label}
  </p>
  </div>
  </div>
  <div className="text-xs text-muted-foreground/70 sm:text-right">
  {status && (
  <>
  <p>Model: <span className="text-foreground/80">{status.model}</span></p>
  <p>Source: <span className="text-foreground/80">{status.source}</span></p>
  </>
  )}
  </div>
  </div>

  {status && (
  <p className="text-sm text-muted-foreground leading-relaxed">{status.message}</p>
  )}

  <div className="space-y-2">
  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
  Safe test prompt
  </label>
  <textarea
  value={sample}
  onChange={(e) => setSample(e.target.value)}
  rows={3}
  maxLength={2000}
  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm outline-none focus:border-[hsl(248_62%_52%/0.5)] transition-colors resize-none font-mono"
  placeholder="Type a short sample message…"
  />
  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
  <button
  onClick={runTest}
  disabled={testing || !sample.trim()}
  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
  >
  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
  {testing ? "Sending…" : "Run safe AI test"}
  </button>
  <p className="text-xs text-muted-foreground/60">
  Sends one short message through the server-side AI helper. Never exposes the key in the browser.
  </p>
  </div>
  </div>

  {result && (
  <div
  className="rounded-xl p-4 space-y-2 border"
  style={{
  background: STATUS_STYLES[result.mode].bg,
  borderColor: STATUS_STYLES[result.mode].border,
  }}
  >
  <div className="flex items-center justify-between text-xs">
  <span className="font-semibold" style={{ color: STATUS_STYLES[result.mode].color }}>
  {STATUS_STYLES[result.mode].label}
  {result.isFallback && result.mode !== "fallback" ? " · using fallback" : ""}
  </span>
  <span className="text-muted-foreground/60">{result.durationMs}ms</span>
  </div>
  {result.error && (
  <p className="text-xs text-muted-foreground/80 italic">Error: {result.error}</p>
  )}
  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{result.output || "-"}</p>
  </div>
  )}
  </div>
  );
}

function AlertThresholdEditor({
  data,
  onSaved,
  reloadKey,
}: {
  data: AiMetricsResponse;
  onSaved: () => void;
  reloadKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [thresholds, setThresholds] = useState<AiThresholdsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [globalWindow, setGlobalWindow] = useState(50);
  const [globalMin, setGlobalMin] = useState(10);
  const [globalRate, setGlobalRate] = useState(70);

  const [overrides, setOverrides] = useState<AiPerToolThreshold[]>([]);
  const [newTool, setNewTool] = useState<string>("");

  const [alertSettings, setAlertSettings] = useState<AlertSettingsResponse | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [savingCooldown, setSavingCooldown] = useState(false);
  const [cooldownSaved, setCooldownSaved] = useState(false);

  const load = async () => {
  setLoading(true);
  setErr(null);
  try {
  const [t, s] = await Promise.all([
  getAiThresholds(FOUNDER_KEY),
  getAlertSettings(FOUNDER_KEY),
  ]);
  setThresholds(t);
  setGlobalWindow(t.global.windowSize);
  setGlobalMin(t.global.minSample);
  setGlobalRate(Math.round(t.global.firstTrySuccessRate * 100));
  setOverrides(t.perTool);
  setAlertSettings(s);
  setCooldownMinutes(s.rebreachCooldownMinutes);
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to load");
  } finally {
  setLoading(false);
  }
  };

  useEffect(() => {
  if (open && !thresholds) void load();
  }, [open]);

  useEffect(() => {
  if (open && reloadKey !== undefined) void load();
  }, [reloadKey]);

  const knownTools = data.perTool.map((t) => t.toolName);
  const availableForOverride = knownTools.filter(
  (n) => !overrides.some((o) => o.toolName === n),
  );

  const setOverrideField = (
  toolName: string,
  field: "windowSize" | "minSample" | "firstTrySuccessRate",
  value: number,
  ) => {
  setOverrides((prev) =>
  prev.map((o) =>
  o.toolName === toolName ? {...o, [field]: value } : o,
  ),
  );
  };

  const addOverride = () => {
  if (!newTool) return;
  setOverrides((prev) => [
...prev,
  {
  toolName: newTool,
  windowSize: globalWindow,
  minSample: globalMin,
  firstTrySuccessRate: globalRate / 100,
  },
  ]);
  setNewTool("");
  };

  const removeOverride = (toolName: string) => {
  setOverrides((prev) => prev.filter((o) => o.toolName !== toolName));
  };

  const save = async () => {
  setSaving(true);
  setErr(null);
  try {
  const originalNames = new Set(thresholds?.perTool.map((t) => t.toolName) ?? []);
  const currentNames = new Set(overrides.map((o) => o.toolName));
  const removeToolNames = Array.from(originalNames).filter((n) => !currentNames.has(n));
  await updateAiThresholds(FOUNDER_KEY, {
  global: {
  windowSize: globalWindow,
  minSample: globalMin,
  firstTrySuccessRate: globalRate / 100,
  },
  perTool: overrides,
  removeToolNames,
  });
  await load();
  onSaved();
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to save");
  } finally {
  setSaving(false);
  }
  };

  const resetToDefaults = async () => {
  setSaving(true);
  setErr(null);
  try {
  const removeToolNames = (thresholds?.perTool ?? []).map((t) => t.toolName);
  await updateAiThresholds(FOUNDER_KEY, {
  resetGlobal: true,
  removeToolNames,
  });
  await load();
  onSaved();
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to reset");
  } finally {
  setSaving(false);
  }
  };

  const saveCooldown = async () => {
  const clamped = Math.max(1, Math.min(1440, Math.round(cooldownMinutes)));
  setSavingCooldown(true);
  setErr(null);
  try {
  const updated = await updateAlertSettings(FOUNDER_KEY, clamped);
  setAlertSettings(updated);
  setCooldownMinutes(updated.rebreachCooldownMinutes);
  setCooldownSaved(true);
  setTimeout(() => setCooldownSaved(false), 2000);
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to save cooldown");
  } finally {
  setSavingCooldown(false);
  }
  };

  const resetCooldown = async () => {
  setSavingCooldown(true);
  setErr(null);
  try {
  const updated = await resetAlertSettings(FOUNDER_KEY);
  setAlertSettings(updated);
  setCooldownMinutes(updated.rebreachCooldownMinutes);
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to reset cooldown");
  } finally {
  setSavingCooldown(false);
  }
  };

  if (!open) {
  return (
  <button
  onClick={() => setOpen(true)}
  className="text-xs font-semibold text-muted-foreground/80 hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-white/10 bg-white/5"
  >
  Tune alert thresholds
  </button>
  );
  }

  return (
  <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
  <div className="flex items-center justify-between gap-2">
  <p className="text-sm font-semibold text-foreground">Alert thresholds</p>
  <button
  onClick={() => setOpen(false)}
  className="text-xs text-muted-foreground/70 hover:text-foreground"
  >
  Close
  </button>
  </div>

  {loading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
  </div>
  )}

  {err && <p className="text-xs text-red-400">{err}</p>}

  {!loading && (
  <>
  <div>
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
  Global defaults
  </p>
  <div className="grid grid-cols-3 gap-3">
  <label className="block">
  <span className="text-[10px] text-muted-foreground/70">Window</span>
  <input
  type="number"
  min={1}
  max={10000}
  value={globalWindow}
  onChange={(e) => setGlobalWindow(Math.max(1, Number(e.target.value) || 1))}
  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(248_62%_52%/0.5)]"
  />
  </label>
  <label className="block">
  <span className="text-[10px] text-muted-foreground/70">Min samples</span>
  <input
  type="number"
  min={1}
  max={10000}
  value={globalMin}
  onChange={(e) => setGlobalMin(Math.max(1, Number(e.target.value) || 1))}
  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(248_62%_52%/0.5)]"
  />
  </label>
  <label className="block">
  <span className="text-[10px] text-muted-foreground/70">Threshold %</span>
  <input
  type="number"
  min={0}
  max={100}
  value={globalRate}
  onChange={(e) => setGlobalRate(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(248_62%_52%/0.5)]"
  />
  </label>
  </div>
  </div>

  <div className="pt-2 border-t border-white/8">
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
  Re-alert cooldown
  </p>
  <p className="text-[11px] text-muted-foreground/60 mb-3">
  Minimum healthy time after a recovery before the same tool can trigger another breach email.
  </p>
  <div className="flex items-center gap-3 flex-wrap">
  <label className="flex items-center gap-2">
  <input
  type="number"
  min={1}
  max={1440}
  value={cooldownMinutes}
  onChange={(e) => setCooldownMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))}
  className="w-24 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(248_62%_52%/0.5)]"
  />
  <span className="text-xs text-muted-foreground/70">minutes</span>
  </label>
  <button
  onClick={() => void saveCooldown()}
  disabled={savingCooldown}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] hover:opacity-90 transition-opacity disabled:opacity-50"
  >
  {savingCooldown && <Loader2 className="w-3 h-3 animate-spin" />}
  {cooldownSaved ? "Saved!" : "Save"}
  </button>
  {alertSettings?.isOverridden && (
  <button
  onClick={() => void resetCooldown()}
  disabled={savingCooldown}
  className="text-xs text-muted-foreground/70 hover:text-foreground px-3 py-1.5 rounded-lg border border-white/10"
  >
  Reset to {alertSettings.envMinutes === alertSettings.defaultMinutes
  ? `default (${alertSettings.defaultMinutes}m)`
  : `env (${alertSettings.envMinutes}m)`}
  </button>
  )}
  {alertSettings && !alertSettings.isOverridden && (
  <span className="text-[10px] text-muted-foreground/50">
  Using {alertSettings.envMinutes !== alertSettings.defaultMinutes
  ? `env var (${alertSettings.envMinutes}m)`
  : `default (${alertSettings.defaultMinutes}m)`}
  </span>
  )}
  </div>
  </div>

  <div>
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
  Per-tool overrides
  </p>
  {overrides.length === 0 && (
  <p className="text-xs text-muted-foreground/60 italic mb-2">
  No overrides, every tool uses the global defaults.
  </p>
  )}
  <div className="space-y-2">
  {overrides.map((o) => (
  <div
  key={o.toolName}
  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center"
  >
  <span
  className="text-xs text-foreground/85 truncate"
  title={o.toolName}
  >
  {o.toolName}
  </span>
  <input
  type="number"
  min={1}
  max={10000}
  value={o.windowSize}
  onChange={(e) =>
  setOverrideField(o.toolName, "windowSize", Math.max(1, Number(e.target.value) || 1))
  }
  title="Window"
  className="w-20 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-foreground outline-none"
  />
  <input
  type="number"
  min={1}
  max={10000}
  value={o.minSample}
  onChange={(e) =>
  setOverrideField(o.toolName, "minSample", Math.max(1, Number(e.target.value) || 1))
  }
  title="Min samples"
  className="w-20 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-foreground outline-none"
  />
  <input
  type="number"
  min={0}
  max={100}
  value={Math.round(o.firstTrySuccessRate * 100)}
  onChange={(e) =>
  setOverrideField(
  o.toolName,
  "firstTrySuccessRate",
  Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100,
  )
  }
  title="Threshold %"
  className="w-20 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-foreground outline-none"
  />
  <button
  onClick={() => removeOverride(o.toolName)}
  className="text-xs text-muted-foreground/60 hover:text-red-400 px-2"
  >
  Remove
  </button>
  </div>
  ))}
  </div>

  {availableForOverride.length > 0 && (
  <div className="flex items-center gap-2 mt-3">
  <select
  value={newTool}
  onChange={(e) => setNewTool(e.target.value)}
  className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground outline-none"
  >
  <option value="">Add override for…</option>
  {availableForOverride.map((n) => (
  <option key={n} value={n}>
  {n}
  </option>
  ))}
  </select>
  <button
  onClick={addOverride}
  disabled={!newTool}
  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
  >
  Add
  </button>
  </div>
  )}
  </div>

  <div className="flex items-center gap-2 pt-2 border-t border-white/8">
  <button
  onClick={save}
  disabled={saving}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[hsl(248_62%_55%)] to-[hsl(326_100%_59%)] hover:opacity-90 transition-opacity disabled:opacity-50"
  >
  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
  Save thresholds
  </button>
  <button
  onClick={resetToDefaults}
  disabled={saving}
  className="text-xs text-muted-foreground/70 hover:text-foreground px-3 py-2 rounded-lg border border-white/10"
  >
  Reset to defaults
  </button>
  {thresholds && (
  <span className="text-[10px] text-muted-foreground/50 ml-auto">
  Defaults: {thresholds.defaults.windowSize} / {thresholds.defaults.minSample} /{" "}
  {Math.round(thresholds.defaults.firstTrySuccessRate * 100)}%
  </span>
  )}
  </div>
  </>
  )}
  </div>
  );
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ThresholdChangeLog({
  refreshKey,
  onUndone,
}: {
  refreshKey: number;
  onUndone?: () => void;
}) {
  const [changes, setChanges] = useState<AiThresholdChange[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [undoneIds, setUndoneIds] = useState<Set<number>>(new Set());
  const [bump, setBump] = useState(0);

  useEffect(() => {
  setLoading(true);
  setErr(null);
  getAiThresholdChanges(FOUNDER_KEY, 10)
.then((r) => setChanges(r.changes))
.catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
.finally(() => setLoading(false));
  }, [refreshKey, bump]);

  const handleUndo = async (id: number) => {
  setUndoingId(id);
  setErr(null);
  try {
  await undoAiThresholdChange(FOUNDER_KEY, id);
  setUndoneIds((prev) => {
  const next = new Set(prev);
  next.add(id);
  return next;
  });
  setBump((x) => x + 1);
  onUndone?.();
  } catch (e: unknown) {
  setErr(e instanceof Error ? e.message : "Failed to undo");
  } finally {
  setUndoingId(null);
  }
  };

  const fmtCfg = (
  w: number | null,
  m: number | null,
  r: number | null,
  ): string => {
  if (w === null && m === null && r === null) return "-";
  const pct = r === null ? "-" : `${Math.round(r * 100)}%`;
  return `${w ?? "-"} / ${m ?? "-"} / ${pct}`;
  };

  const actionColor = (a: string) => {
  if (a === "remove" || a === "reset") return "hsl(348 55% 70%)";
  if (a === "create") return "hsl(142 55% 65%)";
  return "hsl(43 65% 70%)";
  };

  return (
  <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3 mt-3">
  <div className="flex items-center justify-between">
  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
  Recent threshold changes
  </p>
  {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/60" />}
  </div>
  {err && <p className="text-xs text-red-400">{err}</p>}
  {!loading && !err && changes && changes.length === 0 && (
  <p className="text-xs text-muted-foreground/60 italic">
  No changes recorded yet, saved threshold edits will show up here.
  </p>
  )}
  {changes && changes.length > 0 && (
  <ul className="space-y-2">
  {changes.map((c) => (
  <li
  key={c.id}
  data-testid={`threshold-change-row-${c.id}`}
  className="text-xs text-foreground/85 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0"
  >
  <div className="flex items-center gap-2 min-w-0">
  <span
  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border"
  style={{
  color: actionColor(c.action),
  borderColor: `${actionColor(c.action)}55`,
  background: `${actionColor(c.action)}14`,
  }}
  >
  {c.action}
  </span>
  <span className="font-mono text-foreground/80 truncate" title={c.toolName}>
  {c.toolName === "__global__" ? "(global)" : c.toolName}
  </span>
  </div>
  <div className="flex items-center gap-2 text-muted-foreground/80 font-mono shrink-0">
  <span title="window / min samples / threshold">
  {fmtCfg(c.oldWindowSize, c.oldMinSample, c.oldFirstTrySuccessRate)}
  </span>
  <span aria-hidden>→</span>
  <span>
  {fmtCfg(c.newWindowSize, c.newMinSample, c.newFirstTrySuccessRate)}
  </span>
  <span className="text-muted-foreground/60 ml-2" title={c.createdAt}>
  {formatRelativeTime(c.createdAt)}
  </span>
  <button
  type="button"
  onClick={() => handleUndo(c.id)}
  disabled={undoingId !== null || undoneIds.has(c.id)}
  data-testid={`undo-threshold-change-${c.id}`}
  className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/15 bg-white/5 text-foreground/80 font-sans text-[11px] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  title={
  undoneIds.has(c.id)
  ? "Already undone, refresh to apply a new undo"
  : "Restore the previous values for this tool"
  }
  >
  {undoingId === c.id ? (
  <Loader2 className="w-3 h-3 animate-spin" />
  ) : (
  <RefreshCw className="w-3 h-3" />
  )}
  {undoneIds.has(c.id) ? "Undone" : "Undo"}
  </button>
  </div>
  </li>
  ))}
  </ul>
  )}
  </div>
  );
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

const JOB_NAME_OVERRIDES: Record<string, string> = {
  geoip_update: "GeoIP data",
};

function formatJobName(jobName: string): string {
  const override = JOB_NAME_OVERRIDES[jobName];
  if (override) return override;
  return jobName
.split("_")
.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
.join(" ");
}

function formatThreshold(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

function GeoipRefreshPanel({ founderKey }: { founderKey: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRefresh = async () => {
  if (running) return;
  setRunning(true);
  setResult(null);
  try {
  const res = await refreshGeoip(founderKey);
  setResult(res);
  } catch (e) {
  setResult({
  success: false,
  message: e instanceof Error ? e.message : "Refresh failed.",
  });
  } finally {
  setRunning(false);
  }
  };

  const okColor = "hsl(var(--brand-green))";
  const warnColor = "hsl(348 65% 70%)";
  const resultColor = result?.success ? okColor : warnColor;

  return (
  <div
  className="glass rounded-2xl p-6 space-y-4"
  data-testid="geoip-refresh-panel"
  >
  <div className="flex items-center justify-between flex-wrap gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  GeoIP Data
  </p>
  <p className="text-base font-semibold text-foreground">
  Refresh sign-in location lookups
  </p>
  <p className="text-xs text-muted-foreground/70 mt-1 max-w-md">
  Pulls the latest MaxMind GeoLite2 dataset and rewrites the local geoip-lite
  files. Use after rotating the license key or if locations look stale.
  </p>
  </div>
  <button
  type="button"
  onClick={handleRefresh}
  disabled={running}
  data-testid="geoip-refresh-button"
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 bg-white/5 text-foreground hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
  >
  {running ? (
  <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
  <RefreshCw className="w-4 h-4" />
  )}
  {running ? "Refreshing…" : "Refresh GeoIP data"}
  </button>
  </div>

  {result && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-xs"
  data-testid="geoip-refresh-result"
  style={{
  background: `${withAlpha(resultColor, 0.07)}`,
  borderColor: `${withAlpha(resultColor, 0.30)}`,
  color: resultColor,
  }}
  >
  {result.success ? (
  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
  ) : (
  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
  )}
  <span className="leading-snug">{result.message}</span>
  </div>
  )}
  </div>
  );
}

function BackgroundJobsPanel({ refreshKey, founderKey }: { refreshKey: number; founderKey: string }) {
  const [data, setData] = useState<BackgroundJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
  setLoading(true);
  setErr(null);
  getBackgroundJobs(founderKey)
.then(setData)
.catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
.finally(() => setLoading(false));
  }, [refreshKey, founderKey]);

  const okColor = "hsl(var(--brand-green))";
  const warnColor = "hsl(348 65% 70%)";
  const staleCount = data?.jobs.filter((j) => j.stale).length ?? 0;
  const totalCount = data?.jobs.length ?? 0;
  const allHealthy = data !== null && staleCount === 0;

  return (
  <div
  className="glass rounded-2xl p-6 space-y-4"
  data-testid="background-jobs-panel"
  >
  <div className="flex items-center justify-between flex-wrap gap-2">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Background Jobs
  </p>
  <p className="text-base font-semibold text-foreground">
  Scheduled job heartbeats
  </p>
  </div>
  <div className="flex items-center gap-2">
  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />}
  {!loading && data && (
  <span
  className="text-xs font-semibold px-2 py-0.5 rounded-full"
  style={{
  color: allHealthy ? okColor : warnColor,
  background: allHealthy ? "hsl(var(--brand-green) / 0.12)" : "hsl(348 65% 70% / 0.12)",
  }}
  >
  {allHealthy ? "All healthy" : `${staleCount}/${totalCount} stale`}
  </span>
  )}
  </div>
  </div>

  {err && (
  <p className="text-xs text-red-400">Could not load job status: {err}</p>
  )}

  {data && (
  <ul className="space-y-2">
  {data.jobs.map((job: BackgroundJobStatus) => {
  const color = job.stale ? warnColor : okColor;
  const Icon = job.stale ? AlertTriangle : CheckCircle2;
  return (
  <li
  key={job.jobName}
  className="rounded-xl p-3 border flex items-start gap-3"
  style={{
  background: `${withAlpha(color, 0.07)}`,
  borderColor: `${withAlpha(color, 0.30)}`,
  }}
  >
  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
  <div className="min-w-0 flex-1 space-y-0.5">
  <p className="text-sm font-medium text-foreground leading-tight">
  {formatJobName(job.jobName)}
  </p>
  <p className="text-xs text-muted-foreground/70">
  {job.lastSuccessAt
  ? `Last ran ${formatAge(job.ageMs ?? 0)} · stale after ${formatThreshold(job.staleThresholdMs)}`
  : `Never run · stale after ${formatThreshold(job.staleThresholdMs)}`}
  </p>
  </div>
  <span
  className="text-xs font-semibold shrink-0 mt-0.5"
  style={{ color }}
  >
  {job.stale ? "Stale" : "OK"}
  </span>
  </li>
  );
  })}
  </ul>
  )}
  </div>
  );
}

function RollupHeartbeatPanel({ refreshKey, founderKey }: { refreshKey: number; founderKey: string }) {
  const [data, setData] = useState<RollupHeartbeatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
  setLoading(true);
  setErr(null);
  getRollupHeartbeat(founderKey)
.then(setData)
.catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
.finally(() => setLoading(false));
  }, [refreshKey, founderKey]);

  const stale = data?.stale ?? false;
  const thresholdHours = data ? Math.round(data.staleThresholdMs / (60 * 60 * 1000)) : 36;
  const okColor = "hsl(var(--brand-green))";
  const warnColor = "hsl(348 65% 70%)";
  const color = stale ? warnColor : okColor;
  const Icon = stale ? AlertTriangle : CheckCircle2;

  return (
  <div
  className="glass rounded-2xl p-6 space-y-3"
  data-testid="rollup-heartbeat-panel"
  >
  <div className="flex items-center justify-between flex-wrap gap-2">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Nightly Rollup Heartbeat
  </p>
  <p className="text-base font-semibold text-foreground">
  Last successful AI reliability rollup
  </p>
  </div>
  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />}
  </div>

  {err && (
  <p className="text-xs text-red-400">Could not load heartbeat: {err}</p>
  )}

  {data && (
  <div
  className="rounded-xl p-4 border flex items-start gap-3"
  style={{
  background: `${withAlpha(color, 0.10)}`,
  borderColor: `${withAlpha(color, 0.40)}`,
  }}
  >
  <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
  <div className="min-w-0 space-y-1">
  <p className="text-sm font-semibold" style={{ color }}>
  {stale
  ? data.lastSuccessAt
  ? `Stale, last ran ${formatAge(data.ageMs ?? 0)}`
  : "Never run on this database"
  : `Healthy, last ran ${formatAge(data.ageMs ?? 0)}`}
  </p>
  <p className="text-xs text-muted-foreground/80">
  {data.lastSuccessAt
  ? `Heartbeat at ${new Date(data.lastSuccessAt).toLocaleString()}.`
  : "No heartbeat recorded yet, the rollup job may not have completed since deploy."}
  {" "}Alerts when older than ~{thresholdHours} hours.
  </p>
  </div>
  </div>
  )}
  </div>
  );
}

function TrashPurgePanel({ founderKey, onPurged }: { founderKey: string; onPurged: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
  if (running) return;
  setRunning(true);
  setResult(null);
  setErr(null);
  try {
  const res = await purgeTrashNow(founderKey);
  setResult(res);
  onPurged();
  toast({
  title: "Trash purge complete",
  description: `${res.deleted} ${res.deleted === 1 ? "audit was" : "audits were"} permanently deleted.`,
  });
  } catch (e) {
  const message = e instanceof Error ? e.message : "Failed to purge trash";
  setErr(message);
  toast({
  title: "Trash purge failed",
  description: message,
  variant: "destructive",
  });
  } finally {
  setRunning(false);
  }
  };

  return (
  <div
  className="glass rounded-2xl p-6 space-y-3"
  data-testid="trash-purge-panel"
  >
  <div className="flex items-center justify-between flex-wrap gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Manual Trash Purge
  </p>
  <p className="text-base font-semibold text-foreground">
  Permanently delete soft-deleted audits past retention
  </p>
  <p className="text-xs text-muted-foreground/80 mt-1">
  Runs the same job as the scheduled timer, immediately. Useful after tuning the retention window.
  </p>
  </div>
  <button
  type="button"
  onClick={run}
  disabled={running}
  data-testid="button-purge-trash-now"
  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[hsl(348_55%_58%/0.2)] text-[hsl(348_55%_78%)] border border-[hsl(348_55%_58%/0.4)] hover:bg-[hsl(348_55%_58%/0.3)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
  >
  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
  {running ? "Purging…" : "Purge now"}
  </button>
  </div>

  {result && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(var(--brand-green) / 0.10)",
  borderColor: "hsl(var(--brand-green) / 0.40)",
  color: "hsl(142 55% 70%)",
  }}
  data-testid="trash-purge-success"
  >
  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
  <span>
  Purge complete, {result.deleted} {result.deleted === 1 ? "audit" : "audits"} permanently deleted.
  </span>
  </div>
  )}

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="trash-purge-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>Could not purge trash: {err}</span>
  </div>
  )}
  </div>
  );
}

function TierFlipPanel({ founderKey }: { founderKey: string }) {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"free" | "reset" | "wingman" | "">("wingman");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ email: string | null; tier: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
  if (running) return;
  if (!email.trim() || !email.includes("@")) {
  setErr("Enter a valid email.");
  return;
  }
  setRunning(true);
  setResult(null);
  setErr(null);
  try {
  const res = await setUserTier(founderKey, email.trim(), tier === "" ? null : tier);
  setResult({ email: res.user.email, tier: res.user.tier });
  toast({
  title: "Tier updated",
  description: `${res.user.email} is now ${res.user.tier ?? "unpaid (free)"}.`,
  });
  } catch (e) {
  const message = e instanceof Error ? e.message : "Failed to set tier";
  setErr(message);
  toast({ title: "Tier update failed", description: message, variant: "destructive" });
  } finally {
  setRunning(false);
  }
  };

  return (
  <div className="glass rounded-2xl p-6 space-y-3" data-testid="tier-flip-panel">
  <div className="space-y-1">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Set paid tier
  </p>
  <p className="text-base font-semibold text-foreground">
  Mark a user as Reset, Wingman, or clear back to free
  </p>
  <p className="text-xs text-muted-foreground/80">
  After a Stripe payment lands, flip the customer here. Wingman customers who opt into the matching pool get auto-routed to concierge-only review. Until the Stripe webhook ships, this is the manual lever.
  </p>
  </div>
  <div className="flex flex-wrap items-end gap-3">
  <div className="flex-1 min-w-[220px]">
  <label className="block text-xs text-muted-foreground/80 mb-1" htmlFor="tier-flip-email">
  Customer email
  </label>
  <input
  id="tier-flip-email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="paid@example.com"
  data-testid="input-tier-flip-email"
  className="w-full rounded-xl px-3 py-2 text-sm bg-background/40 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
  />
  </div>
  <div>
  <label className="block text-xs text-muted-foreground/80 mb-1" htmlFor="tier-flip-tier">
  Tier
  </label>
  <select
  id="tier-flip-tier"
  value={tier}
  onChange={(e) => setTier(e.target.value as "free" | "reset" | "wingman" | "")}
  data-testid="select-tier-flip"
  className="rounded-xl px-3 py-2 text-sm bg-background/40 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
  >
  <option value="wingman">wingman ($197/mo)</option>
  <option value="reset">reset ($97)</option>
  <option value="free">free (paid label)</option>
  <option value="">clear (back to unpaid)</option>
  </select>
  </div>
  <button
  type="button"
  onClick={run}
  disabled={running}
  data-testid="button-set-tier"
  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[hsl(348_55%_58%/0.2)] text-[hsl(348_55%_78%)] border border-[hsl(348_55%_58%/0.4)] hover:bg-[hsl(348_55%_58%/0.3)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
  >
  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
  {running ? "Updating…" : "Set tier"}
  </button>
  </div>
  {result && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(var(--brand-green) / 0.10)",
  borderColor: "hsl(var(--brand-green) / 0.40)",
  color: "hsl(142 55% 70%)",
  }}
  data-testid="tier-flip-success"
  >
  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
  <span>
  {result.email} is now {result.tier ?? "unpaid (free)"}.
  </span>
  </div>
  )}
  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="tier-flip-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>{err}</span>
  </div>
  )}
  </div>
  );
}

function EchoCopilotPanel({ founderKey }: { founderKey: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState<EchoUserSignals | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
  if (loading) return;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
  setErr("Enter a valid email.");
  setSignals(null);
  return;
  }
  setLoading(true);
  setErr(null);
  setSignals(null);
  try {
  const res: EchoUserSignalsResponse = await getEchoUserSignals(founderKey, trimmed);
  setSignals(res.signals);
  } catch (e) {
  setErr(e instanceof Error ? e.message : "Failed to load user signals.");
  } finally {
  setLoading(false);
  }
  };

  const decisions: Array<{ key: string; label: string; decision: EchoDecision | null }> = signals
  ? [
  { key: "next", label: "Next step Echo would take", decision: nextStepForUser(signals) },
  { key: "not", label: "What Echo would NOT do", decision: whatEchoWouldNotDo(signals) },
  { key: "voice", label: "Voice note for tomorrow", decision: voiceNoteForTomorrow(signals) },
  { key: "pricing", label: "Pricing read", decision: pricingNudgeForUser(signals) },
  { key: "concierge", label: "Concierge flag", decision: conciergeFlagForUser(signals) },
  ]
  : [];

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="echo-copilot-panel">
  <div className="space-y-1">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Echo copilot
  </p>
  <p className="text-base font-semibold text-foreground">
  What Echo would do
  </p>
  <p className="text-xs text-muted-foreground/80">
  Look up a user by email. Echo reads their signals and tells you the next step, what to avoid, and a paste-ready voice note. Read-only. You decide and act elsewhere.
  </p>
  </div>

  <div className="flex flex-wrap items-end gap-3">
  <div className="flex-1 min-w-[220px]">
  <label className="block text-xs text-muted-foreground/80 mb-1" htmlFor="echo-copilot-email">
  User email
  </label>
  <input
  id="echo-copilot-email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="user@example.com"
  data-testid="input-echo-copilot-email"
  onKeyDown={(e) => {
  if (e.key === "Enter") {
  e.preventDefault();
  void run();
  }
  }}
  className="w-full rounded-xl px-3 py-2 text-sm bg-background/40 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
  />
  </div>
  <button
  type="button"
  onClick={() => void run()}
  disabled={loading}
  data-testid="button-echo-copilot-read"
  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_72%)] border border-[hsl(248_62%_52%/0.4)] hover:bg-[hsl(248_62%_52%/0.3)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
  >
  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
  {loading ? "Reading…" : "Read this user"}
  </button>
  </div>

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="echo-copilot-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>{err}</span>
  </div>
  )}

  {signals && (
  <div className="space-y-4">
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="echo-copilot-signals">
  <div className="glass rounded-xl p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Tier</p>
  <p className="text-sm font-bold text-foreground mt-1">{signals.tier ?? "unpaid"}</p>
  </div>
  <div className="glass rounded-xl p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Age (days)</p>
  <p className="text-sm font-bold text-foreground mt-1">{signals.ageDays ?? "-"}</p>
  </div>
  <div className="glass rounded-xl p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Audits</p>
  <p className="text-sm font-bold text-foreground mt-1">{signals.auditCount}</p>
  </div>
  <div className="glass rounded-xl p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Wellness answers</p>
  <p className="text-sm font-bold text-foreground mt-1">{signals.wellnessAnswerCount}</p>
  </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
  {decisions.map(({ key, label, decision }) => {
  if (!decision) {
  return (
  <div
  key={key}
  className="glass rounded-xl p-4 space-y-2 opacity-60"
  data-testid={`echo-copilot-card-${key}`}
  >
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
  {label}
  </p>
  <p className="text-sm text-muted-foreground/70">Echo has nothing to say here right now.</p>
  </div>
  );
  }
  return (
  <div
  key={key}
  className="glass rounded-xl p-4 space-y-2"
  data-testid={`echo-copilot-card-${key}`}
  >
  <div className="flex items-start justify-between gap-2">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
  {label}
  </p>
  <span
  className="text-[9px] uppercase tracking-wider text-muted-foreground/50 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 font-mono"
  data-testid={`echo-copilot-fn-${key}`}
  >
  {decision.fn}
  </span>
  </div>
  <p className="text-sm font-semibold text-foreground">{decision.title}</p>
  <p className="text-xs text-muted-foreground/80 leading-relaxed">{decision.body}</p>
  </div>
  );
  })}
  </div>
  </div>
  )}
  </div>
  );
}

function ReferralAttributionPanel({ founderKey }: { founderKey: string }) {
  const [data, setData] = useState<ReferralAttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setErr(null);
  getReferralAttribution(founderKey)
.then((res) => {
  if (!cancelled) setData(res);
  })
.catch((e) => {
  if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load attribution");
  })
.finally(() => {
  if (!cancelled) setLoading(false);
  });
  return () => {
  cancelled = true;
  };
  }, [founderKey, reloadKey]);

  const totals = data?.totals;
  const topReferrers = data?.topReferrers ?? [];
  const topSurfaces = data?.topSurfaces ?? [];
  const maxSurfaceCount = topSurfaces.reduce((m, s) => Math.max(m, s.count), 0);
  const invitersWithConversion = topReferrers.filter((r) => r.paidConversions > 0).length;
  const overallPct = totals ? Math.round(totals.overallConversionRate * 1000) / 10 : 0;

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="referral-attribution-panel">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div className="space-y-1">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Referral attribution
  </p>
  <p className="text-base font-semibold text-foreground">
  Who brings paying customers in
  </p>
  <p className="text-xs text-muted-foreground/80">
  Paid means tier is reset or wingman. Surfaces show where the share link was tapped before signup.
  </p>
  </div>
  <button
  type="button"
  onClick={() => setReloadKey((k) => k + 1)}
  disabled={loading}
  data-testid="button-refresh-referral-attribution"
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-60"
  >
  {loading ? "Loading…" : "Refresh"}
  </button>
  </div>

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="referral-attribution-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>{err}</span>
  </div>
  )}

  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  <div className="glass rounded-xl p-3" data-testid="stat-referral-total">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Total referrals</p>
  <p className="text-xl font-bold text-foreground mt-1">{totals?.totalReferrals ?? "0"}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="stat-referral-inviters-converting">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Inviters converting</p>
  <p className="text-xl font-bold text-foreground mt-1">{data ? invitersWithConversion : "0"}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="stat-referral-paid-converts">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Paid converts</p>
  <p className="text-xl font-bold text-foreground mt-1">{totals?.totalPaidConverts ?? "0"}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="stat-referral-conversion-rate">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Overall conversion</p>
  <p className="text-xl font-bold text-foreground mt-1">{totals ? `${overallPct}%` : "0%"}</p>
  </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <div className="glass rounded-xl p-4 space-y-3" data-testid="referral-top-inviters">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">Top inviters</p>
  {loading && !data ? (
  <p className="text-xs text-muted-foreground/70">Loading…</p>
  ) : topReferrers.length === 0 ? (
  <p className="text-xs text-muted-foreground/70">No referrals yet.</p>
  ) : (
  <div className="overflow-x-auto">
  <table className="w-full text-xs">
  <thead>
  <tr className="text-left text-muted-foreground/60">
  <th className="py-1.5 pr-3 font-medium">#</th>
  <th className="py-1.5 pr-3 font-medium">Inviter</th>
  <th className="py-1.5 pr-3 font-medium text-right">Invited</th>
  <th className="py-1.5 pr-3 font-medium text-right">Paid</th>
  <th className="py-1.5 font-medium text-right">Rate</th>
  </tr>
  </thead>
  <tbody>
  {topReferrers.map((r, idx) => {
  const ratePct = Math.round(r.conversionRate * 1000) / 10;
  const label = r.inviterFirstName
  ? `${r.inviterFirstName} (${r.inviterEmail || "no email"})`
  : r.inviterEmail || r.inviterUserId;
  return (
  <tr
  key={r.inviterUserId}
  className="border-t border-white/5"
  data-testid={`referral-inviter-row-${r.inviterUserId}`}
  >
  <td className="py-1.5 pr-3 text-muted-foreground/70">{idx + 1}</td>
  <td className="py-1.5 pr-3 text-foreground truncate max-w-[220px]" title={label}>{label}</td>
  <td className="py-1.5 pr-3 text-right text-foreground">{r.inviteeCount}</td>
  <td className="py-1.5 pr-3 text-right text-foreground">{r.paidConversions}</td>
  <td className="py-1.5 text-right text-foreground">{ratePct}%</td>
  </tr>
  );
  })}
  </tbody>
  </table>
  </div>
  )}
  </div>

  <div className="glass rounded-xl p-4 space-y-3" data-testid="referral-top-surfaces">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">Surfaces driving referrals</p>
  {loading && !data ? (
  <p className="text-xs text-muted-foreground/70">Loading…</p>
  ) : topSurfaces.length === 0 ? (
  <p className="text-xs text-muted-foreground/70">No surface data yet.</p>
  ) : (
  <ul className="space-y-2">
  {topSurfaces.map((s) => {
  const pct = maxSurfaceCount > 0 ? (s.count / maxSurfaceCount) * 100 : 0;
  return (
  <li
  key={s.surface}
  className="space-y-1"
  data-testid={`referral-surface-row-${s.surface}`}
  >
  <div className="flex items-center justify-between text-xs">
  <span className="text-foreground truncate pr-3">{s.surface}</span>
  <span className="text-muted-foreground/80 tabular-nums">{s.count}</span>
  </div>
  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
  <div
  className="h-full rounded-full"
  style={{ width: `${pct}%`, background: "hsl(var(--brand-indigo))" }}
  />
  </div>
  </li>
  );
  })}
  </ul>
  )}
  </div>
  </div>
  </div>
  );
}

const JOURNEY_EVENT_LABELS: Record<string, string> = {
  visit: "Visits",
  signal_fed: "Signals fed",
  readiness_gained: "Readiness gained",
  tool_completed: "Tools completed",
  match_step: "Match steps",
  purchase: "Purchases",
};

// Demo fallback so the Activity panel is never blank before any real event lands.
const DEMO_JOURNEY_EVENTS: JourneyEventsResponse = {
  counts: [
    { eventType: "visit", today: 42, last7d: 318, last30d: 1294 },
    { eventType: "signal_fed", today: 9, last7d: 71, last30d: 286 },
    { eventType: "readiness_gained", today: 6, last7d: 48, last30d: 192 },
    { eventType: "tool_completed", today: 7, last7d: 55, last30d: 221 },
    { eventType: "match_step", today: 2, last7d: 14, last30d: 53 },
    { eventType: "purchase", today: 1, last7d: 5, last30d: 18 },
  ],
  totals: { today: 67, last7d: 511, last30d: 2064 },
  recent: [
    { id: 3, eventType: "purchase", userId: "demo", anonId: null, props: { via: "stripe_reconcile" }, createdAt: new Date().toISOString() },
    { id: 2, eventType: "readiness_gained", userId: "demo", anonId: null, props: { score: 64, delta: 8 }, createdAt: new Date().toISOString() },
    { id: 1, eventType: "signal_fed", userId: null, anonId: "demo", props: { source: "quiz" }, createdAt: new Date().toISOString() },
  ],
};

function describeJourneyProps(props: Record<string, unknown> | null): string {
  if (!props) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    parts.push(`${k}: ${String(v)}`);
  }
  return parts.join(", ");
}

function ActivityPanel({ founderKey }: { founderKey: string }) {
  const [data, setData] = useState<JourneyEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    getJourneyEvents(founderKey)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [founderKey, reloadKey]);

  // Show real data when any event exists; otherwise fall back to the demo set so
  // the panel reads as intentional rather than broken before traffic arrives.
  const hasReal = Boolean(data && data.totals.last30d > 0);
  const view = hasReal ? data! : DEMO_JOURNEY_EVENTS;
  const isDemo = !loading && !hasReal && !err;

  return (
    <div className="glass rounded-2xl p-6 space-y-4" data-testid="activity-panel">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
            First-party activity
          </p>
          <p className="text-base font-semibold text-foreground">
            What people are doing, as it happens
          </p>
          <p className="text-xs text-muted-foreground/80">
            Journey events recorded directly by our own server and client: visits, signals fed, readiness gained, tools completed, match steps, and purchases.
            {isDemo && " Showing sample data until the first real event lands."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          data-testid="button-refresh-activity"
          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err && (
        <div
          className="rounded-xl p-3 border flex items-start gap-2 text-sm"
          style={{
            background: "hsl(348 55% 58% / 0.10)",
            borderColor: "hsl(348 55% 58% / 0.40)",
            color: "hsl(348 55% 78%)",
          }}
          data-testid="activity-error"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {view.counts.map((c) => (
          <div key={c.eventType} className="glass rounded-xl p-3" data-testid={`activity-count-${c.eventType}`}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              {JOURNEY_EVENT_LABELS[c.eventType] ?? c.eventType}
            </p>
            <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{c.today}</p>
            <p className="text-[11px] text-muted-foreground/70 tabular-nums">
              {c.last7d} / 7d · {c.last30d} / 30d
            </p>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-4 space-y-2" data-testid="activity-feed">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
          Recent events
        </p>
        {view.recent.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {view.recent.map((e) => {
              const detail = describeJourneyProps(e.props);
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0"
                  data-testid={`activity-event-${e.id}`}
                >
                  <span className="text-foreground shrink-0">
                    {JOURNEY_EVENT_LABELS[e.eventType] ?? e.eventType}
                  </span>
                  <span className="text-muted-foreground/70 truncate text-right">
                    {detail}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function FunnelPanel({ founderKey }: { founderKey: string }) {
  const [data, setData] = useState<FounderFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setErr(null);
  getFounderFunnel(founderKey)
.then((res) => {
  if (!cancelled) setData(res);
  })
.catch((e) => {
  if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load funnel");
  })
.finally(() => {
  if (!cancelled) setLoading(false);
  });
  return () => {
  cancelled = true;
  };
  }, [founderKey, reloadKey]);

  const stages = data?.stages ?? [];
  const topCount = stages.reduce((m, s) => Math.max(m, s.count), 0);
  const overallPct = data ? Math.round(data.overallConversionRate * 1000) / 10 : 0;

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="funnel-panel">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div className="space-y-1">
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Readiness to revenue funnel
  </p>
  <p className="text-base font-semibold text-foreground">
  Where people drop off on the way to a purchase
  </p>
  <p className="text-xs text-muted-foreground/80">
  Distinct users at each stage: account, fed a signal, gained readiness, entered the pool, got a match intro, then purchased. Anonymous visits are tracked client side.
  </p>
  </div>
  <button
  type="button"
  onClick={() => setReloadKey((k) => k + 1)}
  disabled={loading}
  data-testid="button-refresh-funnel"
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-60"
  >
  {loading ? "Loading…" : "Refresh"}
  </button>
  </div>

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="funnel-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>{err}</span>
  </div>
  )}

  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
  <div className="glass rounded-xl p-3" data-testid="stat-funnel-overall">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Account to purchase</p>
  <p className="text-xl font-bold text-foreground mt-1">{data ? `${overallPct}%` : "0%"}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="stat-funnel-threshold">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Readiness gate</p>
  <p className="text-xl font-bold text-foreground mt-1">{data?.readinessThreshold ?? "—"}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="stat-funnel-purchase-interest">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Paid via Stripe</p>
  <p className="text-xl font-bold text-foreground mt-1">{data?.paidViaPurchaseInterest ?? "0"}</p>
  </div>
  </div>

  <div className="glass rounded-xl p-4 space-y-3" data-testid="funnel-stages">
  {loading && !data ? (
  <p className="text-xs text-muted-foreground/70">Loading…</p>
  ) : stages.length === 0 ? (
  <p className="text-xs text-muted-foreground/70">No funnel data yet.</p>
  ) : (
  <ul className="space-y-3">
  {stages.map((s) => {
  const pct = topCount > 0 ? (s.count / topCount) * 100 : 0;
  const convPct =
  s.conversionFromPrev === null
  ? null
  : Math.round(s.conversionFromPrev * 1000) / 10;
  return (
  <li
  key={s.key}
  className="space-y-1"
  data-testid={`funnel-stage-${s.key}`}
  >
  <div className="flex items-center justify-between text-xs">
  <span className="text-foreground truncate pr-3">{s.label}</span>
  <span className="text-muted-foreground/80 tabular-nums shrink-0">
  {s.count}
  {convPct !== null && (
  <span className="text-muted-foreground/50"> · {convPct}% from prev</span>
  )}
  </span>
  </div>
  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
  <div
  className="h-full rounded-full"
  style={{ width: `${pct}%`, background: "linear-gradient(90deg, hsl(var(--brand-indigo)), hsl(var(--brand-gold)))" }}
  />
  </div>
  </li>
  );
  })}
  </ul>
  )}
  </div>
  </div>
  );
}

function formatCooldownRemaining(ms: number): string {
  if (ms <= 0) return "0m";
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useLiveCountdown(endsAt: string): number {
  const endsAtMs = new Date(endsAt).getTime();
  const [remaining, setRemaining] = useState(() => Math.max(0, endsAtMs - Date.now()));
  useEffect(() => {
  const tick = () => {
  const r = Math.max(0, endsAtMs - Date.now());
  setRemaining(r);
  return r;
  };
  if (tick() <= 0) return;
  const id = setInterval(() => {
  if (tick() <= 0) clearInterval(id);
  }, 1000);
  return () => clearInterval(id);
  }, [endsAtMs]);
  return remaining;
}

function CooldownBadge({ state }: { state: AiToolCooldownState }) {
  const remainingMs = useLiveCountdown(state.cooldownEndsAt);
  const remaining = formatCooldownRemaining(remainingMs);
  return (
  <span
  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
  style={{
  background: "hsl(var(--brand-gold) / 0.15)",
  color: "hsl(43 65% 78%)",
  border: "1px solid hsl(var(--brand-gold) / 0.40)",
  }}
  title={`Re-alert cooldown active, next alert allowed after ${new Date(state.cooldownEndsAt).toLocaleTimeString()}`}
  >
  <Clock className="w-3 h-3" />
  {remaining} left
  </span>
  );
}

function CooldownCountdownText({ cooldown }: { cooldown: AiToolCooldownState }) {
  const remainingMs = useLiveCountdown(cooldown.cooldownEndsAt);
  return <>{formatCooldownRemaining(remainingMs)}</>;
}

function AiMetricsPanel({ refreshKey, founderKey }: { refreshKey: number; founderKey: string }) {
  const [data, setData] = useState<AiMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
  setLoading(true);
  setErr(null);
  getAiMetrics(founderKey)
.then(setData)
.catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
.finally(() => setLoading(false));
  }, [refreshKey, bump, founderKey]);

  const hasActiveCooldowns = (data?.perTool ?? []).some(
  (t) => t.inCooldown && (t.cooldownRemainingMs ?? 0) > 0,
  );

  useEffect(() => {
  if (!hasActiveCooldowns) return;
  const id = setInterval(() => setBump((x) => x + 1), 30_000);
  return () => clearInterval(id);
  }, [hasActiveCooldowns]);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const overall = data?.overall;

  return (
  <div className="glass rounded-2xl p-6 space-y-5">
  <div className="flex items-center justify-between flex-wrap gap-2">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">AI Reliability</p>
  <p className="text-base font-semibold text-foreground">First-try success and fallback rates</p>
  </div>
  <div className="flex items-center gap-2">
  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />}
  {data && <AlertThresholdEditor data={data} onSaved={() => setBump((x) => x + 1)} reloadKey={bump} />}
  </div>
  </div>

  {err && (
  <p className="text-xs text-red-400">Could not load AI metrics: {err}</p>
  )}

  {overall && overall.total === 0 && (
  <p className="text-sm text-muted-foreground/70 italic">
  No AI requests recorded yet. Run a tool or the safe AI test above to start collecting data.
  </p>
  )}

  {data && data.alerts.length > 0 && (
  <div
  className="rounded-xl p-4 border space-y-2"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  }}
  >
  <div className="flex items-center gap-2">
  <AlertTriangle className="w-4 h-4" style={{ color: "hsl(348 65% 70%)" }} />
  <p className="text-sm font-semibold" style={{ color: "hsl(348 65% 78%)" }}>
  {data.alerts.length === 1
  ? "1 tool is below the reliability threshold"
  : `${data.alerts.length} tools are below the reliability threshold`}
  </p>
  </div>
  <p className="text-xs text-muted-foreground/80">
  First-try success rate fell below {pct(data.alertThreshold.firstTrySuccessRate)} over the
  last {data.alertThreshold.windowSize} requests (min {data.alertThreshold.minSample} samples).
  </p>
  <ul className="text-xs text-foreground/85 space-y-1.5 pl-1">
  {data.alerts.map((a) => {
  const cooldown = data.cooldownStates?.find((c) => c.toolName === a.toolName);
  return (
  <li key={a.toolName} className="flex items-start justify-between gap-3">
  <div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5 flex-wrap">
  <p className="truncate font-medium">{a.toolName}</p>
  {a.suppressedByCooldown && cooldown && (
  <span
  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
  style={{
  background: "hsl(var(--brand-gold) / 0.15)",
  color: "hsl(43 65% 78%)",
  border: "1px solid hsl(var(--brand-gold) / 0.40)",
  }}
  title={`Re-alert suppressed, email held until cooldown expires at ${new Date(cooldown.cooldownEndsAt).toLocaleTimeString()}`}
  >
  <Clock className="w-3 h-3" />
  Re-alert suppressed (cooldown · <CooldownCountdownText cooldown={cooldown} /> left)
  </span>
  )}
  </div>
  <p className="text-[11px] text-muted-foreground/70 truncate">{a.reason}</p>
  </div>
  <span className="text-muted-foreground/70 shrink-0">
  {pct(a.recentFirstTrySuccessRate)} · last {a.recentTotal}
  </span>
  </li>
  );
  })}
  </ul>
  </div>
  )}

  {data && (data.cooldownStates ?? []).filter((c) => !c.rebreachedDuringCooldown).length > 0 && (
  <div
  className="rounded-xl p-4 border space-y-2"
  style={{
  background: "hsl(var(--brand-gold) / 0.07)",
  borderColor: "hsl(var(--brand-gold) / 0.30)",
  }}
  >
  <div className="flex items-center gap-2">
  <Clock className="w-4 h-4" style={{ color: "hsl(43 65% 78%)" }} />
  <p className="text-sm font-semibold" style={{ color: "hsl(43 65% 78%)" }}>
  Re-alert cooldown active
  </p>
  </div>
  <p className="text-xs text-muted-foreground/80">
  These tools recently recovered. Re-breach emails are suppressed until the cooldown expires.
  </p>
  <ul className="text-xs text-foreground/85 space-y-1.5 pl-1">
  {(data.cooldownStates ?? [])
.filter((c) => !c.rebreachedDuringCooldown)
.map((c) => (
  <li key={c.toolName} className="flex items-center justify-between gap-3">
  <span className="truncate font-medium">{c.toolName}</span>
  <CooldownBadge state={c} />
  </li>
  ))}
  </ul>
  </div>
  )}

  {data && data.mailerHealth.length > 0 && (
  <div
  className="rounded-xl p-4 border space-y-2"
  style={{
  background: "hsl(27 80% 52% / 0.10)",
  borderColor: "hsl(27 80% 52% / 0.40)",
  }}
  >
  <div className="flex items-center gap-2">
  <Mail className="w-4 h-4" style={{ color: "hsl(27 90% 65%)" }} />
  <p className="text-sm font-semibold" style={{ color: "hsl(27 90% 72%)" }}>
  Alert delivery degraded
  </p>
  </div>
  <p className="text-xs text-muted-foreground/80">
  Breach / recovery emails are failing for the following{" "}
  {data.mailerHealth.length === 1 ? "tool" : `${data.mailerHealth.length} tools`}.
  Alerts will resume once the mailer recovers.
  </p>
  <ul className="text-xs text-foreground/85 space-y-2 pl-1">
  {data.mailerHealth.map((h) => (
  <li key={h.toolName} className="space-y-0.5">
  <div className="flex items-center justify-between gap-3">
  <p className="truncate font-medium">{h.toolName}</p>
  <span className="text-muted-foreground/70 shrink-0">
  {h.consecutiveSendFailures} consecutive failure{h.consecutiveSendFailures !== 1 ? "s" : ""}
  </span>
  </div>
  {h.lastSendFailureAt && (
  <p className="text-[11px] text-muted-foreground/60">
  Last failed {new Date(h.lastSendFailureAt).toLocaleString()}
  {h.lastSendFailureMessage ? `, ${h.lastSendFailureMessage}` : ""}
  </p>
  )}
  </li>
  ))}
  </ul>
  </div>
  )}

  {overall && overall.total > 0 && (
  <>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
  <p className="text-2xl font-bold text-foreground">{pct(overall.firstTrySuccessRate)}</p>
  <p className="text-xs text-muted-foreground">First-try success</p>
  </div>
  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
  <p className="text-2xl font-bold text-foreground">{pct(overall.overallSuccessRate)}</p>
  <p className="text-xs text-muted-foreground">Overall success (incl. retry)</p>
  </div>
  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
  <p className="text-2xl font-bold text-foreground">{overall.avgAttempts.toFixed(2)}</p>
  <p className="text-xs text-muted-foreground">Avg attempts</p>
  </div>
  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
  <p className="text-2xl font-bold text-foreground">{overall.fallbacks}</p>
  <p className="text-xs text-muted-foreground">Fallback responses · {overall.total} total</p>
  </div>
  </div>

  <div className="overflow-x-auto rounded-xl border border-white/8">
  <table className="w-full text-sm">
  <thead>
  <tr className="border-b border-white/8 bg-white/3">
  {["Tool", "Total", "1st-try ok", "Retried ok", "Fallbacks", "1st-try %", "Fallback 24h", "Fallback 7d", "Recent window", "Avg attempts", "Avg ms"].map((h) => (
  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
  {h}
  </th>
  ))}
  </tr>
  </thead>
  <tbody>
  {data!.perTool.map((row) => (
  <tr key={row.toolName} className="border-b border-white/5 hover:bg-white/3 transition-colors">
  <td className="px-4 py-3 text-foreground/90 max-w-[260px]">
  <div className="flex items-center gap-2 flex-wrap">
  <span className="truncate">{row.toolName}</span>
  {row.alert && (
  <span
  title={`Recent first-try success ${pct(row.recent.firstTrySuccessRate)} over last ${row.recent.total} (threshold ${pct(data!.alertThreshold.firstTrySuccessRate)})`}
  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
  style={{
  background: "hsl(348 55% 58% / 0.18)",
  color: "hsl(348 65% 78%)",
  border: "1px solid hsl(348 55% 58% / 0.45)",
  }}
  >
  <AlertTriangle className="w-3 h-3" />
  Low
  </span>
  )}
  {row.inCooldown && row.cooldownRemainingMs != null && (
  <span
  title={`Re-alert cooldown active, next breach email allowed after ${row.cooldownEndsAt ? new Date(row.cooldownEndsAt).toLocaleTimeString() : "cooldown expires"}`}
  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
  style={{
  background: "hsl(var(--brand-gold) / 0.15)",
  color: "hsl(43 65% 78%)",
  border: "1px solid hsl(var(--brand-gold) / 0.40)",
  }}
  >
  <Clock className="w-3 h-3" />
  Cooldown · {formatCooldownRemaining(row.cooldownRemainingMs)} left
  </span>
  )}
  </div>
  </td>
  <td className="px-4 py-3 text-muted-foreground">{row.total}</td>
  <td className="px-4 py-3 text-muted-foreground">{row.firstTryOk}</td>
  <td className="px-4 py-3 text-muted-foreground">{row.retriedOk}</td>
  <td className="px-4 py-3 text-muted-foreground">{row.fallbacks}</td>
  <td className="px-4 py-3 text-muted-foreground">{pct(row.firstTrySuccessRate)}</td>
  <td
  className={`px-4 py-3 ${
  row.last24h.total > 0 && row.last24h.fallbackRate >= 0.3
  ? "text-[hsl(348_65%_78%)] font-semibold"
  : "text-muted-foreground"
  }`}
  title={`${row.last24h.fallbacks} of ${row.last24h.total} answers in the last 24h used the backup`}
  >
  {row.last24h.total > 0
  ? `${pct(row.last24h.fallbackRate)} (${row.last24h.fallbacks}/${row.last24h.total})`
  : ", "}
  </td>
  <td
  className={`px-4 py-3 ${
  row.last7d.total > 0 && row.last7d.fallbackRate >= 0.3
  ? "text-[hsl(348_65%_78%)] font-semibold"
  : "text-muted-foreground"
  }`}
  title={`${row.last7d.fallbacks} of ${row.last7d.total} answers in the last 7 days used the backup`}
  >
  {row.last7d.total > 0
  ? `${pct(row.last7d.fallbackRate)} (${row.last7d.fallbacks}/${row.last7d.total})`
  : ", "}
  </td>
  <td className={`px-4 py-3 ${row.alert ? "text-[hsl(348_65%_78%)] font-semibold" : "text-muted-foreground"}`}>
  {row.recent.total > 0 ? `${pct(row.recent.firstTrySuccessRate)} (${row.recent.total})` : ", "}
  </td>
  <td className="px-4 py-3 text-muted-foreground">{row.avgAttempts.toFixed(2)}</td>
  <td className="px-4 py-3 text-muted-foreground">{Math.round(row.avgDurationMs)}</td>
  </tr>
  ))}
  </tbody>
  </table>
  </div>
  </>
  )}

  <ThresholdChangeLog refreshKey={bump + refreshKey} onUndone={() => setBump((x) => x + 1)} />
  </div>
  );
}

const FOUNDER_KEY =
  (import.meta.env as Record<string, string>).VITE_FOUNDER_KEY || "nldc2024";

const FOUNDER_KEY_STORAGE_KEY = "founder_key";

function StatCard({ label, value, icon: Icon, color, "data-testid": testId }: { label: string; value: number | string; icon: React.ElementType; color: string; "data-testid"?: string }) {
  return (
  <div className="glass rounded-2xl p-5 flex items-center gap-4" data-testid={testId}>
  <div
  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
  style={{ background: `${color}20`, border: `1px solid ${color}40` }}
  >
  <Icon className="w-5 h-5" style={{ color }} />
  </div>
  <div>
  <p className="text-2xl font-bold text-foreground">{value}</p>
  <p className="text-xs text-muted-foreground">{label}</p>
  </div>
  </div>
  );
}

function TableShell({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  if (rows.length === 0) {
  return <p className="text-sm text-muted-foreground/60 italic py-6 text-center">No records yet.</p>;
  }
  return (
  <div className="overflow-x-auto rounded-xl border border-white/8">
  <table className="w-full text-sm">
  <thead>
  <tr className="border-b border-white/8 bg-white/3">
  {headers.map((h) => (
  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
  {h}
  </th>
  ))}
  </tr>
  </thead>
  <tbody>
  {rows.map((row, i) => (
  <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
  {row.map((cell, j) => (
  <td key={j} className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
  {cell ?? <span className="text-muted-foreground/30 italic">-</span>}
  </td>
  ))}
  </tr>
  ))}
  </tbody>
  </table>
  </div>
  );
}

const TREND_DAY_OPTIONS = [30, 90, 180] as const;
type TrendDays = (typeof TREND_DAY_OPTIONS)[number];
type TrendMetric = "firstTrySuccessRate" | "fallbackRate";

const TREND_COLORS = [
  "hsl(var(--brand-indigo))",
  "hsl(var(--brand-green))",
  "hsl(var(--brand-gold))",
  "hsl(190 55% 60%)",
  "hsl(var(--brand-rose))",
  "hsl(228 40% 65%)",
  "hsl(310 50% 68%)",
  "hsl(95 45% 60%)",
];

function fmtTrendDay(day: string) {
  const d = new Date(day + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getIsoWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function groupTrendByWeek(series: OcrMismatchTrendEntry[]): OcrMismatchTrendEntry[] {
  const buckets = new Map<string, OcrMismatchTrendEntry>();
  for (const entry of series) {
  const weekStart = getIsoWeekStart(entry.day);
  const existing = buckets.get(weekStart);
  if (existing) {
  existing.firstName += entry.firstName;
  existing.age += entry.age;
  existing.sourceApp += entry.sourceApp;
  existing.bio += entry.bio;
  existing.prompts += entry.prompts;
  existing.total += entry.total;
  } else {
  buckets.set(weekStart, {...entry, day: weekStart });
  }
  }
  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function AiReliabilityTrendsPanel({ refreshKey, founderKey }: { refreshKey: number; founderKey: string }) {
  const [days, setDays] = useState<TrendDays>(90);
  const [metric, setMetric] = useState<TrendMetric>("firstTrySuccessRate");
  const [data, setData] = useState<AiMetricsTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [focusedTool, setFocusedTool] = useState<string | null>(null);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setErr(null);
  getAiMetricsTrends(founderKey, days)
.then((res) => { if (!cancelled) setData(res); })
.catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load"); })
.finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
  }, [days, refreshKey, founderKey]);

  const { chartRows, toolNames, focusedRows, focusedTotals } = (() => {
  if (!data) {
  return {
  chartRows: [] as Array<Record<string, number | string>>,
  toolNames: [] as string[],
  focusedRows: [] as Array<Record<string, number | string>>,
  focusedTotals: { total: 0, firstTryOk: 0, fallbacks: 0, validationFailures: 0 },
  };
  }
  const byDay = new Map<string, Record<string, number | string>>();
  const toolTotals = new Map<string, number>();
  const focusedByDay = new Map<string, Record<string, number | string>>();
  const totals = { total: 0, firstTryOk: 0, fallbacks: 0, validationFailures: 0 };
  for (const p of data.series) {
  toolTotals.set(p.toolName, (toolTotals.get(p.toolName) ?? 0) + p.total);
  let row = byDay.get(p.day);
  if (!row) {
  row = { day: p.day };
  byDay.set(p.day, row);
  }
  const value = metric === "firstTrySuccessRate" ? p.firstTrySuccessRate : p.fallbackRate;
  row[p.toolName] = Math.round(value * 1000) / 10;
  if (focusedTool && p.toolName === focusedTool) {
  focusedByDay.set(p.day, {
  day: p.day,
  firstTryPct: Math.round(p.firstTrySuccessRate * 1000) / 10,
  fallbackPct: Math.round(p.fallbackRate * 1000) / 10,
  total: p.total,
  });
  totals.total += p.total;
  totals.firstTryOk += p.firstTryOk;
  totals.fallbacks += p.fallbacks;
  totals.validationFailures += p.validationFailures;
  }
  }
  const tools = [...toolTotals.entries()]
.sort((a, b) => b[1] - a[1])
.map(([name]) => name);
  const rows = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const fRows = [...focusedByDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return { chartRows: rows, toolNames: tools, focusedRows: fRows, focusedTotals: totals };
  })();

  // If the focused tool drops out of the available list (e.g. days window changes),
  // clear the focus.
  useEffect(() => {
  if (focusedTool && data && !toolNames.includes(focusedTool)) {
  setFocusedTool(null);
  }
  }, [focusedTool, data, toolNames]);

  const hasData = chartRows.length > 0 && toolNames.length > 0;
  const isFocused = focusedTool !== null && toolNames.includes(focusedTool);
  const hasFocusData = isFocused && focusedRows.length > 0;
  const focusedColor = isFocused
  ? TREND_COLORS[Math.max(0, toolNames.indexOf(focusedTool!)) % TREND_COLORS.length]
  : TREND_COLORS[0];
  const focusFirstTryPct = focusedTotals.total > 0
  ? Math.round((focusedTotals.firstTryOk / focusedTotals.total) * 1000) / 10
  : 0;
  const focusFallbackPct = focusedTotals.total > 0
  ? Math.round((focusedTotals.fallbacks / focusedTotals.total) * 1000) / 10
  : 0;
  const canExport = !!data && data.series.length > 0;

  const downloadCsv = () => {
  if (!data) return;
  const headers = [
  "day",
  "toolName",
  "total",
  "firstTryOk",
  "retriedOk",
  "fallbacks",
  "validationFailures",
  "firstTrySuccessRate",
  "fallbackRate",
  "avgAttempts",
  "avgDurationMs",
  ];
  const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rowsToExport = focusedTool && isFocused
  ? data.series.filter((p) => p.toolName === focusedTool)
  : data.series;
  const rows = [...rowsToExport]
.sort((a, b) => (a.day === b.day ? a.toolName.localeCompare(b.toolName) : a.day.localeCompare(b.day)))
.map((p) => [
  p.day,
  p.toolName,
  p.total,
  p.firstTryOk,
  p.retriedOk,
  p.fallbacks,
  p.validationFailures,
  p.firstTrySuccessRate.toFixed(4),
  p.fallbackRate.toFixed(4),
  p.avgAttempts.toFixed(3),
  Math.round(p.avgDurationMs),
  ].map(esc).join(","));
  const csv = [headers.join(","),...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = focusedTool && isFocused
  ? `-${focusedTool.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
  : "";
  a.download = `ai-reliability-trends-${days}d${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  };

  return (
  <div className="glass rounded-2xl p-6 space-y-5">
  <div className="flex items-start justify-between flex-wrap gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">AI Reliability Trends</p>
  <p className="text-base font-semibold text-foreground">
  {isFocused
  ? `Focused on ${focusedTool}`
  : `${metric === "firstTrySuccessRate" ? "First-try success rate" : "Fallback rate"} per tool over time`}
  </p>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
  {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />}
  <button
  type="button"
  onClick={downloadCsv}
  disabled={!canExport}
  title="Download daily per-tool reliability rollups as CSV"
  data-testid="button-download-trends-csv"
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
  <Download className="w-3.5 h-3.5" />
  Download CSV
  </button>
  <select
  value={focusedTool ?? ""}
  onChange={(e) => setFocusedTool(e.target.value === "" ? null : e.target.value)}
  data-testid="select-trend-focus-tool"
  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-foreground outline-none focus:border-[hsl(248_62%_52%/0.5)] max-w-[180px]"
  >
  <option value="">All tools</option>
  {toolNames.map((name) => (
  <option key={name} value={name}>{name}</option>
  ))}
  </select>
  {!isFocused && (
  <div className="flex rounded-lg border border-white/10 overflow-hidden">
  {(["firstTrySuccessRate", "fallbackRate"] as TrendMetric[]).map((m) => (
  <button
  key={m}
  type="button"
  onClick={() => setMetric(m)}
  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
  metric === m
  ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)]"
  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
  }`}
  >
  {m === "firstTrySuccessRate" ? "First-try %" : "Fallback %"}
  </button>
  ))}
  </div>
  )}
  <div className="flex rounded-lg border border-white/10 overflow-hidden">
  {TREND_DAY_OPTIONS.map((d) => (
  <button
  key={d}
  type="button"
  onClick={() => setDays(d)}
  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
  days === d
  ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)]"
  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
  }`}
  >
  {d}d
  </button>
  ))}
  </div>
  </div>
  </div>

  {err && <p className="text-xs text-red-400">Could not load AI metrics trends: {err}</p>}

  {!err && !loading && !hasData && (
  <p className="text-sm text-muted-foreground/70 italic">
  No daily AI metrics recorded in the last {days} days yet.
  </p>
  )}

  {isFocused && hasFocusData && (
  <div
  className="grid grid-cols-2 sm:grid-cols-4 gap-3"
  data-testid="trend-focus-summary"
  >
  <div className="rounded-lg border border-white/10 bg-white/3 p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">First-try %</p>
  <p className="text-lg font-semibold text-foreground">{focusFirstTryPct.toFixed(1)}%</p>
  </div>
  <div className="rounded-lg border border-white/10 bg-white/3 p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Fallback %</p>
  <p className="text-lg font-semibold text-foreground">{focusFallbackPct.toFixed(1)}%</p>
  </div>
  <div className="rounded-lg border border-white/10 bg-white/3 p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Requests</p>
  <p className="text-lg font-semibold text-foreground">{focusedTotals.total.toLocaleString()}</p>
  </div>
  <div className="rounded-lg border border-white/10 bg-white/3 p-3">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Validation fails</p>
  <p className="text-lg font-semibold text-foreground">{focusedTotals.validationFailures.toLocaleString()}</p>
  </div>
  </div>
  )}

  {isFocused && !hasFocusData && !loading && !err && (
  <p className="text-sm text-muted-foreground/70 italic">
  No daily metrics for {focusedTool} in the last {days} days.
  </p>
  )}

  {!isFocused && hasData && (
  <div className="w-full" style={{ height: 320 }}>
  <ResponsiveContainer width="100%" height="100%">
  <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
  <XAxis
  dataKey="day"
  tickFormatter={fmtTrendDay}
  stroke="hsl(var(--muted-foreground) / 0.7)"
  fontSize={11}
  minTickGap={24}
  />
  <YAxis
  domain={[0, 100]}
  tickFormatter={(v) => `${v}%`}
  stroke="hsl(var(--muted-foreground) / 0.7)"
  fontSize={11}
  width={40}
  />
  <Tooltip
  contentStyle={{
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  }}
  labelFormatter={(label) => fmtTrendDay(String(label))}
  formatter={(value: number | string, name) => [
  typeof value === "number" ? `${value.toFixed(1)}%` : value,
  name,
  ]}
  />
  <Legend
  wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
  onClick={(entry) => {
  const e = entry as { dataKey?: unknown; value?: unknown };
  const name = typeof e?.dataKey === "string"
  ? e.dataKey
  : typeof e?.value === "string"
  ? e.value
  : null;
  if (name && toolNames.includes(name)) setFocusedTool(name);
  }}
  />
  {toolNames.map((name, i) => (
  <Line
  key={name}
  type="monotone"
  dataKey={name}
  stroke={TREND_COLORS[i % TREND_COLORS.length]}
  strokeWidth={2}
  dot={false}
  connectNulls
  isAnimationActive={false}
  />
  ))}
  </LineChart>
  </ResponsiveContainer>
  </div>
  )}

  {isFocused && hasFocusData && (
  <div className="w-full" style={{ height: 320 }} data-testid="trend-focus-chart">
  <ResponsiveContainer width="100%" height="100%">
  <ComposedChart data={focusedRows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
  <XAxis
  dataKey="day"
  tickFormatter={fmtTrendDay}
  stroke="hsl(var(--muted-foreground) / 0.7)"
  fontSize={11}
  minTickGap={24}
  />
  <YAxis
  yAxisId="pct"
  domain={[0, 100]}
  tickFormatter={(v) => `${v}%`}
  stroke="hsl(var(--muted-foreground) / 0.7)"
  fontSize={11}
  width={40}
  />
  <YAxis
  yAxisId="vol"
  orientation="right"
  allowDecimals={false}
  stroke="hsl(var(--muted-foreground) / 0.7)"
  fontSize={11}
  width={40}
  />
  <Tooltip
  contentStyle={{
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  }}
  labelFormatter={(label) => fmtTrendDay(String(label))}
  formatter={(value: number | string, name) => {
  if (name === "Requests") {
  return [typeof value === "number" ? value.toLocaleString() : value, name];
  }
  return [typeof value === "number" ? `${value.toFixed(1)}%` : value, name];
  }}
  />
  <Legend wrapperStyle={{ fontSize: 11 }} />
  <Bar
  yAxisId="vol"
  dataKey="total"
  name="Requests"
  fill="hsl(var(--muted-foreground) / 0.25)"
  isAnimationActive={false}
  />
  <Line
  yAxisId="pct"
  type="monotone"
  dataKey="firstTryPct"
  name="First-try %"
  stroke={focusedColor}
  strokeWidth={2}
  dot={false}
  connectNulls
  isAnimationActive={false}
  />
  <Line
  yAxisId="pct"
  type="monotone"
  dataKey="fallbackPct"
  name="Fallback %"
  stroke="hsl(var(--brand-rose))"
  strokeWidth={2}
  strokeDasharray="4 3"
  dot={false}
  connectNulls
  isAnimationActive={false}
  />
  </ComposedChart>
  </ResponsiveContainer>
  </div>
  )}

  {isFocused && (
  <button
  type="button"
  onClick={() => setFocusedTool(null)}
  data-testid="button-trend-clear-focus"
  className="text-xs font-semibold text-muted-foreground/80 hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-white/10 bg-white/5"
  >
  ← Back to all tools
  </button>
  )}
  </div>
  );
}

const OCR_WINDOW_OPTIONS: { value: OcrMismatchesWindow; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: null, label: "All time" },
];

const OCR_SORT_OPTIONS: { value: OcrMismatchesSort; label: string }[] = [
  { value: "total", label: "By total volume" },
  { value: "top", label: "By top single diff" },
];

const OCR_FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  age: "Age",
  sourceApp: "Source app",
  bio: "Bio",
  prompts: "Prompts",
  total: "Total",
};

const OCR_FILTER_FIELDS: OcrCorrectionField[] = ["firstName", "age", "sourceApp", "bio", "prompts"];

const OCR_FIELD_COLORS: Record<string, string> = {
  firstName: "hsl(var(--brand-indigo))",
  age: "hsl(var(--brand-green))",
  sourceApp: "hsl(var(--brand-gold))",
  bio: "hsl(190 55% 60%)",
  prompts: "hsl(var(--brand-rose))",
};

function OcrMismatchesPanel({ refreshKey }: { refreshKey: number }) {
  const [windowDays, setWindowDays] = useState<OcrMismatchesWindow>(() => {
  const saved = localStorage.getItem("ocr-windowDays");
  if (saved === "7") return 7 as OcrMismatchesWindow;
  if (saved === "90") return 90 as OcrMismatchesWindow;
  if (saved === "all") return null as OcrMismatchesWindow;
  return 30 as OcrMismatchesWindow;
  });
  const [sort, setSort] = useState<OcrMismatchesSort>(() => {
  const saved = localStorage.getItem("ocr-sort");
  if (saved === "top") return "top" as OcrMismatchesSort;
  return "total" as OcrMismatchesSort;
  });
  const [data, setData] = useState<OcrMismatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OcrCorrectionField | "all">("all");
  const [trendData, setTrendData] = useState<OcrMismatchesTrendsResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"day" | "week">(() => {
  const saved = localStorage.getItem("ocr-trend-groupBy");
  return saved === "week" ? "week" : "day";
  });

  const handleSetGroupBy = (value: "day" | "week") => {
  localStorage.setItem("ocr-trend-groupBy", value);
  setGroupBy(value);
  };

  const handleSetWindowDays = (value: OcrMismatchesWindow) => {
  localStorage.setItem("ocr-windowDays", value === null ? "all" : String(value));
  setWindowDays(value);
  };

  const handleSetSort = (value: OcrMismatchesSort) => {
  localStorage.setItem("ocr-sort", value);
  setSort(value);
  };

  const trendDays = windowDays === null ? 90 : windowDays;

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  getOcrMismatches(FOUNDER_KEY, { window: windowDays ?? undefined, sort })
.then((res) => { if (!cancelled) setData(res); })
.catch((err: unknown) => {
  if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
  })
.finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
  }, [windowDays, sort, refreshKey]);

  useEffect(() => {
  let cancelled = false;
  setTrendLoading(true);
  setTrendError(null);
  getOcrMismatchesTrends(FOUNDER_KEY, { days: trendDays })
.then((res) => { if (!cancelled) setTrendData(res); })
.catch((err: unknown) => {
  if (!cancelled) setTrendError(err instanceof Error ? err.message : "Failed to load trends");
  })
.finally(() => { if (!cancelled) setTrendLoading(false); });
  return () => { cancelled = true; };
  }, [trendDays, refreshKey]);

  const filteredRecent = data && filter !== "all"
  ? data.recent.filter((r) => r.field === filter)
  : data?.recent ?? [];

  const exportOcrCsv = () => {
  if (!data) return;
  const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const windowLabel = windowDays === null ? "all-time" : `${windowDays}d`;
  const lines: string[] = [];

  lines.push("## Per-Field Summary");
  const maxDiffs = Math.max(0,...data.perField.map((f) => f.topDiffs.length));
  const exampleHeaders = Array.from({ length: maxDiffs }, (_, i) => [`topExample${i + 1}`, `topExample${i + 1}Count`]).flat();
  lines.push(["field", "label", "correctionsCount", "topDiffCount",...exampleHeaders].map(esc).join(","));
  for (const f of data.perField) {
  const exampleCols: (string | number)[] = [];
  for (let i = 0; i < maxDiffs; i++) {
  exampleCols.push(f.topDiffs[i]?.example ?? "");
  exampleCols.push(f.topDiffs[i]?.count ?? "");
  }
  lines.push([f.field, OCR_FIELD_LABELS[f.field] ?? f.field, f.correctionsCount, f.topDiffCount,...exampleCols].map(esc).join(","));
  }

  lines.push("");
  lines.push("## Recent Corrections");
  lines.push(["auditId", "field", "label", "raw", "corrected", "date"].map(esc).join(","));
  for (const r of data.recent) {
  lines.push([r.auditId, r.field, OCR_FIELD_LABELS[r.field] ?? r.field, r.raw, r.corrected, r.createdAt].map(esc).join(","));
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ocr-mismatches-${windowLabel}-sort-${sort}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  };

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="ocr-mismatches-panel">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <h2 className="font-semibold text-foreground">OCR Mismatches</h2>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  Where the screenshot parser most often needs correcting. Use this to prioritize OCR rule work.
  </p>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
  <select
  data-testid="select-ocr-window"
  value={windowDays === null ? "all" : String(windowDays)}
  onChange={(e) => {
  const v = e.target.value;
  handleSetWindowDays(v === "all" ? null : (Number(v) as OcrMismatchesWindow));
  }}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-foreground hover:border-white/20"
  >
  {OCR_WINDOW_OPTIONS.map((o) => (
  <option key={String(o.value)} value={o.value === null ? "all" : String(o.value)}>
  {o.label}
  </option>
  ))}
  </select>
  <select
  data-testid="select-ocr-sort"
  value={sort}
  onChange={(e) => handleSetSort(e.target.value as OcrMismatchesSort)}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-foreground hover:border-white/20"
  >
  {OCR_SORT_OPTIONS.map((o) => (
  <option key={o.value} value={o.value}>{o.label}</option>
  ))}
  </select>
  <button
  type="button"
  onClick={exportOcrCsv}
  disabled={!data || loading}
  data-testid="button-export-ocr-csv"
  title="Export per-field counts, top diffs, and recent corrections as CSV"
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
  <Download className="w-3.5 h-3.5" />
  Export CSV
  </button>
  </div>
  </div>

  {loading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
  </div>
  )}
  {error && !loading && (
  <p className="text-xs text-[hsl(348_55%_68%)]">Could not load OCR mismatches: {error}</p>
  )}

  {data && !loading && (
  <>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ocr-summary-cards">
  <div className="glass rounded-xl p-3" data-testid="ocr-summary-total-screenshots">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Screenshot audits</p>
  <p className="text-lg font-semibold text-foreground">{data.summary.totalScreenshotAudits}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="ocr-summary-with-raw">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">With raw OCR</p>
  <p className="text-lg font-semibold text-foreground">{data.summary.auditsWithRawOcr}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="ocr-summary-with-corrections">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">With corrections</p>
  <p className="text-lg font-semibold text-foreground">{data.summary.auditsWithCorrections}</p>
  </div>
  <div className="glass rounded-xl p-3" data-testid="ocr-summary-sample-size">
  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Sample size</p>
  <p className="text-lg font-semibold text-foreground">{data.summary.sampleSize}</p>
  </div>
  </div>

  <div className="glass rounded-xl p-4 space-y-3" data-testid="ocr-trend-chart">
  <div className="flex items-center justify-between gap-3 flex-wrap">
  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
  Corrections per {groupBy}, last {trendDays} days
  </h3>
  <div
  className="flex items-center rounded-lg overflow-hidden border border-white/10 text-xs"
  data-testid="ocr-trend-groupby-toggle"
  >
  {(["day", "week"] as const).map((opt) => (
  <button
  key={opt}
  data-testid={`ocr-trend-groupby-${opt}`}
  onClick={() => handleSetGroupBy(opt)}
  className={[
  "px-3 py-1 capitalize transition-colors",
  groupBy === opt
  ? "bg-white/10 text-foreground font-medium"
  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
  ].join(" ")}
  >
  {opt === "day" ? "Day" : "Week"}
  </button>
  ))}
  </div>
  </div>
  {trendLoading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Loader2 className="w-3 h-3 animate-spin" /> Loading trend…
  </div>
  )}
  {trendError && !trendLoading && (
  <p className="text-xs text-[hsl(348_55%_68%)]">{trendError}</p>
  )}
  {trendData && !trendLoading && (() => {
  const chartSeries = groupBy === "week"
  ? groupTrendByWeek(trendData.series)
  : trendData.series;
  const hasAnyData = chartSeries.some((s) => s.total > 0);
  if (!hasAnyData) {
  return (
  <p className="text-xs text-muted-foreground/50 italic py-6 text-center" data-testid="ocr-trend-empty">
  No correction data in this window yet, the chart will populate as OCR mismatches are recorded.
  </p>
  );
  }
  return (
  <ResponsiveContainer width="100%" height={200}>
  <LineChart data={chartSeries} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
  <XAxis
  dataKey="day"
  tickFormatter={fmtTrendDay}
  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }}
  tickLine={false}
  axisLine={false}
  interval="preserveStartEnd"
  />
  <YAxis
  allowDecimals={false}
  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }}
  tickLine={false}
  axisLine={false}
  width={24}
  />
  <Tooltip
  content={({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const dayLabel = groupBy === "week"
  ? `Week of ${fmtTrendDay(String(label))}`
  : fmtTrendDay(String(label));
  const fields = payload
.filter((p) => p.dataKey !== "total")
.map((p) => ({
  key: String(p.dataKey),
  label: OCR_FIELD_LABELS[String(p.dataKey)] ?? String(p.dataKey),
  value: Number(p.value ?? 0),
  color: String(p.color ?? "#fff"),
  }))
.sort((a, b) => b.value - a.value);
  const totalEntry = payload.find((p) => p.dataKey === "total");
  const total = totalEntry ? Number(totalEntry.value ?? 0) : fields.reduce((s, f) => s + f.value, 0);
  return (
  <div style={{
  background: "hsl(268 30% 12%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 11,
  padding: "8px 12px",
  minWidth: 160,
  }}>
  <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 6, fontWeight: 600 }}>{dayLabel}</p>
  {fields.map((f) => (
  <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
  <span style={{ color: f.color, opacity: 0.9 }}>{f.label}</span>
  <span style={{ color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
  </div>
  ))}
  <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between", gap: 16 }}>
  <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Total</span>
  <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{total}</span>
  </div>
  </div>
  );
  }}
  />
  <Legend
  wrapperStyle={{ fontSize: 10, opacity: 0.7 }}
  formatter={(name: string) => OCR_FIELD_LABELS[name] ?? name}
  />
  {OCR_FILTER_FIELDS.map((field) => (
  <Line
  key={field}
  type="monotone"
  dataKey={field}
  stroke={OCR_FIELD_COLORS[field]}
  strokeWidth={1.5}
  dot={false}
  activeDot={{ r: 3 }}
  />
  ))}
  <Line
  type="monotone"
  dataKey="total"
  stroke="rgba(255,255,255,0.85)"
  strokeWidth={2.5}
  dot={false}
  activeDot={{ r: 4 }}
  />
  </LineChart>
  </ResponsiveContainer>
  );
  })()}
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="ocr-per-field-cards">
  {data.perField.map((f) => (
  <div
  key={f.field}
  className="glass rounded-xl p-4 space-y-2"
  data-testid={`ocr-field-card-${f.field}`}
  >
  <div className="flex items-baseline justify-between gap-2">
  <h3 className="text-sm font-semibold text-foreground">
  {OCR_FIELD_LABELS[f.field] ?? f.field}
  </h3>
  <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
  <span data-testid={`ocr-field-count-${f.field}`}>
  {f.correctionsCount} total
  </span>
  <span data-testid={`ocr-field-${f.field}-top`}>
  top {f.topDiffCount}
  </span>
  </div>
  </div>
  {f.topDiffs.length === 0 ? (
  <p className="text-xs text-muted-foreground/50 italic">No corrections in window.</p>
  ) : (
  <ul className="space-y-1">
  {f.topDiffs.slice(0, 5).map((d, i) => (
  <li key={i} className="text-xs text-muted-foreground flex items-center justify-between gap-2">
  <span className="font-mono truncate">{d.example}</span>
  <span className="text-[10px] text-muted-foreground/60 shrink-0">×{d.count}</span>
  </li>
  ))}
  </ul>
  )}
  </div>
  ))}
  </div>

  <div className="space-y-3" data-testid="ocr-recent-section">
  <div className="flex items-start justify-between gap-3 flex-wrap">
  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
  Recent corrections
  </h3>
  <div className="flex flex-wrap gap-1.5" data-testid="ocr-filter-chips">
  <button
  type="button"
  onClick={() => setFilter("all")}
  data-testid="ocr-filter-chip-all"
  className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors ${
  filter === "all"
  ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_62%)]"
  : "border-white/10 text-muted-foreground hover:text-foreground"
  }`}
  >
  All ({data.recent.length})
  </button>
  {OCR_FILTER_FIELDS.map((field) => {
  const count = data.recent.filter((r) => r.field === field).length;
  return (
  <button
  key={field}
  type="button"
  onClick={() => setFilter(field)}
  data-testid={`ocr-filter-chip-${field}`}
  className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors ${
  filter === field
  ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_62%)]"
  : "border-white/10 text-muted-foreground hover:text-foreground"
  }`}
  >
  {OCR_FIELD_LABELS[field] ?? field} ({count})
  </button>
  );
  })}
  </div>
  </div>
  <div data-testid="ocr-recent-row-count" className="text-xs text-muted-foreground/70">
  Showing {filteredRecent.length} of {data.recent.length}
  </div>
  <div className="overflow-x-auto">
  <table className="w-full text-sm" data-testid="ocr-recent-table">
  <thead>
  <tr className="text-left text-xs text-muted-foreground/60 border-b border-white/5">
  <th className="py-2 pr-3">Audit</th>
  <th className="py-2 pr-3">Field</th>
  <th className="py-2 pr-3">Raw</th>
  <th className="py-2 pr-3">Corrected</th>
  <th className="py-2 pr-3">Date</th>
  </tr>
  </thead>
  <tbody data-testid="ocr-recent-tbody">
  {filteredRecent.length === 0 ? (
  <tr data-testid="ocr-recent-empty">
  <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground/60 italic">
  No diffs for this field.
  </td>
  </tr>
  ) : (
  filteredRecent.map((r, i) => (
  <tr key={`${r.auditId}-${r.field}-${i}`} data-testid="ocr-recent-row" data-field={r.field} className="border-b border-white/5">
  <td className="py-2 pr-3 font-mono text-xs">#{r.auditId}</td>
  <td className="py-2 pr-3 text-xs">{OCR_FIELD_LABELS[r.field] ?? r.field}</td>
  <td className="py-2 pr-3 font-mono text-xs text-red-300/80 truncate max-w-[200px]">{r.raw}</td>
  <td className="py-2 pr-3 font-mono text-xs text-emerald-300/80 truncate max-w-[200px]">{r.corrected}</td>
  <td className="py-2 pr-3 text-xs text-muted-foreground/70">{fmtDate(r.createdAt)}</td>
  </tr>
  ))
  )}
  </tbody>
  </table>
  </div>
  </div>
  </>
  )}
  </div>
  );
}

function OcrRulesPanel({ refreshKey }: { refreshKey: number }) {
  const [rules, setRules] = useState<OcrLearnedRule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<OcrLearnResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<{ deleted: number; preserved: number } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [sincePreset, setSincePreset] = useState<"all" | "24h" | "7d" | "30d" | "custom">("all");
  const [sinceCustom, setSinceCustom] = useState<string>("");

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  getOcrLearnedRules(FOUNDER_KEY)
.then((res) => { if (!cancelled) setRules(res.rules); })
.catch((err: unknown) => {
  if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
  })
.finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
  }, [refreshKey, reloadTick]);

  const resolveSinceIso = (): string | undefined => {
  const now = Date.now();
  if (sincePreset === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (sincePreset === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (sincePreset === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  if (sincePreset === "custom" && sinceCustom) {
  const parsed = new Date(sinceCustom);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
  };

  const handleRun = async () => {
  const since = resolveSinceIso();
  if (sincePreset === "custom" && !since) {
  setActionError("Pick a valid date for the custom 'since' value.");
  return;
  }
  setRunning(true);
  setActionError(null);
  try {
  const result = await runOcrLearn(FOUNDER_KEY, since);
  setLastRun(result);
  setReloadTick((t) => t + 1);
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to run learning");
  } finally {
  setRunning(false);
  }
  };

  const handleClear = async () => {
  const approvedCount = rules?.filter((r) => r.status === "approved").length ?? 0;
  const msg = approvedCount > 0
  ? `Clear all non-approved OCR rules? ${approvedCount} approved rule${approvedCount === 1 ? "" : "s"} will be preserved. This cannot be undone.`
  : "Clear all learned OCR rules? This cannot be undone.";
  if (!window.confirm(msg)) return;
  setClearing(true);
  setActionError(null);
  setClearResult(null);
  try {
  const result = await clearOcrLearnedRules(FOUNDER_KEY);
  setClearResult(result);
  setLastRun(null);
  setReloadTick((t) => t + 1);
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to clear rules");
  } finally {
  setClearing(false);
  }
  };

  const handleToggleApprove = async (id: string) => {
  setTogglingIds((prev) => new Set(prev).add(id));
  setActionError(null);
  try {
  const res = await patchOcrRule(FOUNDER_KEY, id);
  setRules((prev) =>
  prev ? prev.map((r) => (r.id === id ? res.rule : r)) : prev,
  );
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to update rule");
  } finally {
  setTogglingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }
  };

  const handleDeleteRule = async (id: string) => {
  setDeletingIds((prev) => new Set(prev).add(id));
  setActionError(null);
  try {
  await deleteOcrRule(FOUNDER_KEY, id);
  setRules((prev) => prev ? prev.filter((r) => r.id !== id) : prev);
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to delete rule");
  } finally {
  setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }
  };

  const grouped: Record<string, OcrLearnedRule[]> = {};
  for (const rule of rules ?? []) {
  if (!grouped[rule.kind]) grouped[rule.kind] = [];
  grouped[rule.kind].push(rule);
  }
  const kinds = Object.keys(grouped).sort();

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="panel-ocr-rules">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <h2 className="font-semibold text-foreground">Learned OCR Rules</h2>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  Patterns the parser has learned from founder corrections. Run learning to mine new rules from recent audits.
  </p>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
  <div
  className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground/60"
  data-testid="ocr-learn-since-presets"
  >
  <span className="mr-1">Since:</span>
  {(["all", "24h", "7d", "30d", "custom"] as const).map((preset) => (
  <button
  key={preset}
  data-testid={`btn-ocr-learn-since-${preset}`}
  onClick={() => setSincePreset(preset)}
  disabled={running || clearing}
  className={`px-2 py-1 rounded-md border text-[10px] uppercase tracking-widest disabled:opacity-50 ${
  sincePreset === preset
  ? "border-[hsl(248_62%_52%/0.5)] bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_65%)]"
  : "border-white/10 bg-transparent text-muted-foreground hover:border-white/20"
  }`}
  >
  {preset === "all" ? "All time" : preset === "custom" ? "Custom" : `Last ${preset}`}
  </button>
  ))}
  {sincePreset === "custom" && (
  <input
  data-testid="input-ocr-learn-since-custom"
  type="date"
  value={sinceCustom}
  onChange={(e) => setSinceCustom(e.target.value)}
  disabled={running || clearing}
  className="ml-1 px-2 py-1 rounded-md border border-white/10 bg-transparent text-foreground text-[11px] disabled:opacity-50"
  />
  )}
  </div>
  <button
  data-testid="btn-ocr-learn-run"
  onClick={handleRun}
  disabled={running || clearing}
  className="text-xs px-3 py-1.5 rounded-lg border border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.15)] text-[hsl(248_62%_62%)] hover:bg-[hsl(248_62%_52%/0.25)] disabled:opacity-50 flex items-center gap-1.5"
  >
  {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
  Run learning now
  </button>
  <button
  data-testid="btn-ocr-rules-clear"
  onClick={handleClear}
  disabled={running || clearing || (rules?.length ?? 0) === 0}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-muted-foreground hover:border-[hsl(348_55%_68%/0.4)] hover:text-[hsl(348_55%_78%)] disabled:opacity-50 flex items-center gap-1.5"
  >
  {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
  Clear all rules
  </button>
  </div>
  </div>

  {lastRun && (
  <div
  data-testid="ocr-learn-result"
  className="text-xs rounded-xl border border-[hsl(142_55%_50%/0.25)] bg-[hsl(142_55%_50%/0.08)] px-3 py-2 text-foreground/80 flex flex-wrap gap-4"
  >
  <span><strong className="text-foreground">{lastRun.scannedAudits}</strong> audits scanned</span>
  <span><strong className="text-foreground">{lastRun.candidates}</strong> candidates</span>
  <span><strong className="text-foreground">{lastRun.persisted}</strong> persisted</span>
  </div>
  )}
  {clearResult && (
  <div
  data-testid="ocr-clear-result"
  className="text-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-foreground/70 flex flex-wrap gap-4"
  >
  <span><strong className="text-foreground">{clearResult.deleted}</strong> rule{clearResult.deleted === 1 ? "" : "s"} cleared</span>
  {clearResult.preserved > 0 && (
  <span className="text-[hsl(142_55%_70%)]">
  <strong>{clearResult.preserved}</strong> approved rule{clearResult.preserved === 1 ? "" : "s"} preserved
  </span>
  )}
  </div>
  )}
  {actionError && (
  <p className="text-xs text-[hsl(348_55%_68%)]" data-testid="ocr-rules-action-error">{actionError}</p>
  )}

  {loading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
  </div>
  )}
  {error && !loading && (
  <p className="text-xs text-[hsl(348_55%_68%)]">Could not load OCR rules: {error}</p>
  )}

  {rules && !loading && rules.length === 0 && (
  <p className="text-xs text-muted-foreground/60 italic py-4" data-testid="ocr-rules-empty">
  No learned rules yet. Run learning to mine patterns from founder corrections.
  </p>
  )}

  {rules && !loading && rules.length > 0 && (
  <div className="space-y-4" data-testid="ocr-rules-list">
  {kinds.map((kind) => (
  <div key={kind} className="space-y-2" data-testid={`ocr-rules-group-${kind}`}>
  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
  {kind} <span className="text-muted-foreground/40">({grouped[kind].length})</span>
  </h3>
  <div className="space-y-1.5">
  {grouped[kind].map((rule) => {
  const isDeleting = deletingIds.has(rule.id);
  const statusStyle =
  rule.status === "approved"
  ? "text-[hsl(142_55%_70%)] border-[hsl(142_55%_50%/0.35)] bg-[hsl(142_55%_50%/0.1)]"
  : rule.status === "rejected"
  ? "text-[hsl(348_55%_68%)] border-[hsl(348_55%_65%/0.3)] bg-[hsl(348_55%_65%/0.1)]"
  : "text-[hsl(43_65%_75%)] border-[hsl(43_65%_65%/0.35)] bg-[hsl(43_65%_65%/0.1)]";
  return (
  <div
  key={rule.id}
  data-testid={`ocr-rule-${rule.id}`}
  className="glass rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap text-xs"
  >
  <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${statusStyle}`}>
  {rule.status}
  </span>
  <code className="font-mono text-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10">
  {rule.pattern}
  </code>
  <span className="text-muted-foreground/50">→</span>
  <code className="font-mono text-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10">
  {rule.replacement}
  </code>
  {rule.scope && (
  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
  scope: {rule.scope}
  </span>
  )}
  <span className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/60">
  <span><strong className="text-foreground/80">{rule.occurrences}</strong> seen</span>
  <span>{fmtDate(rule.learnedAt)}</span>
  <button
  data-testid={`btn-ocr-rule-approve-${rule.id}`}
  onClick={() => handleToggleApprove(rule.id)}
  disabled={togglingIds.has(rule.id) || clearing}
  title={rule.status === "approved" ? "Unapprove this rule (set back to pending)" : "Approve this rule (protect from learning runs and clear)"}
  className={`p-0.5 rounded disabled:opacity-40 transition-colors ${
  rule.status === "approved"
  ? "text-[hsl(142_55%_60%)] hover:text-[hsl(142_55%_45%)] hover:bg-[hsl(142_55%_50%/0.1)]"
  : "text-muted-foreground/40 hover:text-[hsl(142_55%_60%)] hover:bg-[hsl(142_55%_50%/0.1)]"
  }`}
  >
  {togglingIds.has(rule.id)
  ? <Loader2 className="w-3 h-3 animate-spin" />
  : <CheckCircle2 className="w-3 h-3" />}
  </button>
  <button
  data-testid={`btn-ocr-rule-delete-${rule.id}`}
  onClick={() => handleDeleteRule(rule.id)}
  disabled={isDeleting || clearing}
  title="Delete this rule"
  className="p-0.5 rounded text-muted-foreground/40 hover:text-[hsl(348_55%_68%)] hover:bg-[hsl(348_55%_68%/0.1)] disabled:opacity-40 transition-colors"
  >
  {isDeleting
  ? <Loader2 className="w-3 h-3 animate-spin" />
  : <XCircle className="w-3 h-3" />}
  </button>
  </span>
  </div>
  );
  })}
  </div>
  </div>
  ))}
  </div>
  )}
  </div>
  );
}

function OcrPendingRulesPanel({ refreshKey, onApproved }: { refreshKey: number; onApproved?: () => void }) {
  const [pending, setPending] = useState<OcrLearnedRule[] | null>(null);
  const [log, setLog] = useState<OcrRuleReviewLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  Promise.all([
  getOcrPendingRules(FOUNDER_KEY),
  getOcrRuleReviewLog(FOUNDER_KEY, 30),
  ])
.then(([pendingRes, logRes]) => {
  if (!cancelled) {
  setPending(pendingRes.rules);
  setLog(logRes.log);
  }
  })
.catch((err: unknown) => {
  if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
  })
.finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
  }, [refreshKey, reloadTick]);

  const handleApprove = async (id: string) => {
  setActing(id);
  setActionError(null);
  try {
  await approveOcrRule(FOUNDER_KEY, id);
  setReloadTick((t) => t + 1);
  onApproved?.();
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to approve");
  } finally {
  setActing(null);
  }
  };

  const handleReject = async (id: string) => {
  setActing(id);
  setActionError(null);
  try {
  await rejectOcrRule(FOUNDER_KEY, id);
  setReloadTick((t) => t + 1);
  } catch (err: unknown) {
  setActionError(err instanceof Error ? err.message : "Failed to reject");
  } finally {
  setActing(null);
  }
  };

  const pendingCount = pending?.length ?? 0;

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="panel-ocr-pending-rules">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <div className="flex items-center gap-2">
  <h2 className="font-semibold text-foreground">OCR Rule Review Queue</h2>
  {pendingCount > 0 && (
  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(43_65%_65%/0.2)] border border-[hsl(43_65%_65%/0.4)] text-[hsl(43_65%_75%)]">
  {pendingCount} pending
  </span>
  )}
  </div>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  Approve or reject each candidate before it affects live OCR parsing.
  </p>
  </div>
  <div className="flex items-center gap-2">
  <button
  data-testid="btn-ocr-pending-refresh"
  onClick={() => setReloadTick((t) => t + 1)}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-muted-foreground hover:border-white/20 hover:text-foreground flex items-center gap-1.5"
  >
  <RefreshCw className="w-3 h-3" /> Refresh
  </button>
  <button
  data-testid="btn-ocr-pending-toggle-log"
  onClick={() => setShowLog((s) => !s)}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-muted-foreground hover:border-white/20 hover:text-foreground"
  >
  {showLog ? "Hide log" : "View audit log"}
  </button>
  </div>
  </div>

  {actionError && (
  <p className="text-xs text-[hsl(348_55%_68%)]" data-testid="ocr-pending-action-error">{actionError}</p>
  )}

  {loading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
  </div>
  )}
  {error && !loading && (
  <p className="text-xs text-[hsl(348_55%_68%)]">Could not load pending rules: {error}</p>
  )}

  {pending && !loading && pending.length === 0 && (
  <p className="text-xs text-muted-foreground/60 italic py-4" data-testid="ocr-pending-empty">
  No pending candidates. Run OCR learning to mine new patterns from corrections.
  </p>
  )}

  {pending && !loading && pending.length > 0 && (
  <div className="space-y-2" data-testid="ocr-pending-list">
  {pending.map((rule) => {
  const isActing = acting === rule.id;
  return (
  <div
  key={rule.id}
  data-testid={`ocr-pending-rule-${rule.id}`}
  className="glass rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap text-xs border border-[hsl(43_65%_65%/0.2)]"
  >
  <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 pr-1">{rule.kind}</span>
  <code className="font-mono text-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
  {rule.pattern}
  </code>
  <span className="text-muted-foreground/50 shrink-0">→</span>
  <code className="font-mono text-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
  {rule.replacement}
  </code>
  <span className="text-muted-foreground/50 shrink-0">
  <strong className="text-foreground/80">{rule.occurrences}</strong> seen
  </span>
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">
  <button
  data-testid={`btn-approve-${rule.id}`}
  onClick={() => void handleApprove(rule.id)}
  disabled={isActing}
  className="text-xs px-3 py-1.5 rounded-lg border border-[hsl(142_55%_50%/0.35)] bg-[hsl(142_55%_50%/0.12)] text-[hsl(142_55%_70%)] hover:bg-[hsl(142_55%_50%/0.22)] disabled:opacity-50 flex items-center gap-1"
  >
  {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
  Approve
  </button>
  <button
  data-testid={`btn-reject-${rule.id}`}
  onClick={() => void handleReject(rule.id)}
  disabled={isActing}
  className="text-xs px-3 py-1.5 rounded-lg border border-[hsl(348_55%_65%/0.3)] bg-transparent text-muted-foreground hover:border-[hsl(348_55%_65%/0.5)] hover:text-[hsl(348_55%_75%)] disabled:opacity-50 flex items-center gap-1"
  >
  {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
  Reject
  </button>
  </div>
  </div>
  );
  })}
  </div>
  )}

  {showLog && log && (
  <div className="space-y-2 pt-2 border-t border-white/8" data-testid="ocr-review-log">
  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Audit log</h3>
  {log.length === 0 && (
  <p className="text-xs text-muted-foreground/50 italic">No review actions yet.</p>
  )}
  {log.map((entry) => (
  <div
  key={entry.id}
  data-testid={`ocr-log-entry-${entry.id}`}
  className="text-xs flex items-center gap-3 flex-wrap py-1.5 border-b border-white/5 last:border-0"
  >
  <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
  entry.action === "approved"
  ? "text-[hsl(142_55%_70%)] border-[hsl(142_55%_50%/0.3)] bg-[hsl(142_55%_50%/0.1)]"
  : "text-[hsl(348_55%_68%)] border-[hsl(348_55%_65%/0.3)] bg-[hsl(348_55%_65%/0.1)]"
  }`}>
  {entry.action}
  </span>
  <span className="text-muted-foreground/50 text-[10px] uppercase tracking-wider">{entry.kind}</span>
  <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{entry.pattern}</code>
  <span className="text-muted-foreground/40">→</span>
  <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{entry.replacement}</code>
  <span className="ml-auto text-muted-foreground/40">{fmtDate(entry.reviewedAt)}</span>
  </div>
  ))}
  </div>
  )}
  </div>
  );
}

function fmtDate(iso: string) {
  try {
  return new Date(iso).toLocaleDateString("en-US", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  } catch {
  return iso;
  }
}

const LEAD_STATUS_OPTIONS = [
  "New",
  "Needs Review",
  "Reviewed",
  "Follow-Up Sent",
  "Converted",
  "Testimonial Requested",
  "Archived",
] as const;

type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<LeadStatus, { color: string; bg: string }> = {
  "New": { color: "hsl(var(--brand-indigo))", bg: "hsl(var(--brand-indigo) / 0.12)" },
  "Needs Review": { color: "hsl(var(--brand-gold))", bg: "hsl(var(--brand-gold) / 0.12)" },
  "Reviewed": { color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.12)" },
  "Follow-Up Sent": { color: "hsl(228 40% 65%)", bg: "hsl(228 40% 65% / 0.12)" },
  "Converted": { color: "hsl(var(--brand-green))", bg: "hsl(var(--brand-green) / 0.12)" },
  "Testimonial Requested":{ color: "hsl(var(--brand-rose))", bg: "hsl(var(--brand-rose) / 0.12)" },
  "Archived": { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.3)" },
};

// Founder triage status is persisted server-side (PATCH /founder/leads/:id/status).
// We keep an optimistic local override so the dropdown feels instant, falling back
// to the value the server returned with each lead and reverting on failure.
function useLeadStatuses(leads: Lead[]) {
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  // Once the server-refetched lead reflects an override, drop the override so the
  // server stays the source of truth (e.g. another teammate changes the same row).
  useEffect(() => {
    setOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of leads) {
        const key = String(l.id);
        if (key in next && next[key] === ((l.status as LeadStatus) || "New")) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leads]);
  const statusFor = (l: Lead): LeadStatus =>
    overrides[String(l.id)] ?? ((l.status as LeadStatus) || "New");
  const setStatus = (id: string | number, s: LeadStatus) => {
    const key = String(id);
    setOverrides((prev) => ({ ...prev, [key]: s }));
    void setLeadStatus(FOUNDER_KEY, Number(id), s).catch(() => {
      // Revert the optimistic value so the row reflects the persisted truth.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  };
  return { statusFor, setStatus };
}

function LeadsStatusTable({ leads }: { leads: Lead[] }) {
  const { statusFor, setStatus } = useLeadStatuses(leads);
  if (!leads.length) return <p className="text-sm text-muted-foreground/60 italic py-6 text-center">No leads yet.</p>;
  return (
  <div className="space-y-2">
  {leads.map((l) => {
  const currentStatus = statusFor(l);
  const sc = STATUS_COLORS[currentStatus];
  return (
  <div key={l.id} className="glass border border-white/8 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3">
  <div className="flex-1 min-w-0 space-y-1">
  <div className="flex items-center gap-2 flex-wrap">
  <span className="font-semibold text-sm text-foreground">{l.firstName}</span>
  {l.email && <span className="text-xs text-muted-foreground/60">{l.email}</span>}
  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ml-auto sm:ml-0"
  style={{ color: sc.color, borderColor: withAlpha(sc.color, 0.3), background: sc.bg }}>
  {currentStatus}
  </span>
  </div>
  <div className="flex items-center gap-3 flex-wrap">
  <span className="text-[10px] text-muted-foreground/50 font-mono">{l.source}</span>
  {l.interest && <span className="text-xs text-muted-foreground/60 truncate max-w-[240px]">{l.interest}</span>}
  <span className="text-[10px] text-muted-foreground/35">{fmtDate(l.createdAt)}</span>
  </div>
  </div>
  <div className="flex-shrink-0">
  <select
  value={currentStatus}
  onChange={e => setStatus(l.id, e.target.value as LeadStatus)}
  className="text-xs rounded-lg border border-white/10 bg-white/5 text-muted-foreground px-2 py-1.5 outline-none focus:border-[hsl(248_62%_52%/0.4)] cursor-pointer"
  >
  {LEAD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
  </div>
  </div>
  );
  })}
  </div>
  );
}

type FollowUpSeries = "sentCount" | "notSentCount" | "snoozeCount" | "dismissCount";

const FOLLOW_UP_SERIES_CONFIG: {
  key: FollowUpSeries;
  label: string;
  color: string;
}[] = [
  { key: "sentCount", label: "Sent", color: "hsl(var(--brand-green))" },
  { key: "notSentCount", label: "Not sent", color: "hsl(var(--brand-gold))" },
  { key: "snoozeCount", label: "Snoozed", color: "hsl(220 55% 65%)" },
  { key: "dismissCount", label: "Dismissed", color: "hsl(0 55% 60%)" },
];

function FollowUpTrendsPanel() {
  const { data, isLoading, isError } = useGetCoachFollowUpTimeline();
  const [visible, setVisible] = useState<Set<FollowUpSeries>>(
  new Set(["sentCount", "notSentCount", "snoozeCount", "dismissCount"]),
  );

  const toggle = (key: FollowUpSeries) => {
  setVisible((prev) => {
  const next = new Set(prev);
  if (next.has(key)) {
  if (next.size > 1) next.delete(key);
  } else {
  next.add(key);
  }
  return next;
  });
  };

  const chartRows = (data?.buckets ?? []).map((b) => ({
  week: b.weekStart.slice(5),
  sentCount: b.sentCount,
  notSentCount: b.notSentCount,
  snoozeCount: b.snoozeCount,
  dismissCount: b.dismissCount,
  }));

  const hasActivity = chartRows.some(
  (r) => r.sentCount + r.notSentCount + r.snoozeCount + r.dismissCount > 0,
  );

  return (
  <div className="glass rounded-2xl p-6 space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Follow-up Trends
  </p>
  <p className="text-sm text-muted-foreground/70 mt-0.5">
  Weekly sent · not-sent · snoozed · dismissed, last 8 weeks
  </p>
  </div>
  <div className="flex flex-wrap gap-2">
  {FOLLOW_UP_SERIES_CONFIG.map(({ key, label, color }) => {
  const active = visible.has(key);
  return (
  <button
  key={key}
  onClick={() => toggle(key)}
  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
  style={
  active
  ? { color, borderColor: withAlpha(color, 0.4), background: withAlpha(color, 0.1) }
  : { color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))", background: "transparent", opacity: 0.5 }
  }
  >
  <span
  className="w-2 h-2 rounded-full flex-shrink-0"
  style={{ background: active ? color : "currentColor" }}
  />
  {label}
  </button>
  );
  })}
  </div>
  </div>

  {isLoading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-6 justify-center">
  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
  </div>
  )}

  {isError && (
  <p className="text-xs text-red-400 py-4 text-center">Failed to load timeline data.</p>
  )}

  {!isLoading && !isError && !hasActivity && (
  <p className="text-xs text-muted-foreground/50 italic py-4 text-center">
  No follow-up events recorded yet. Data will appear here once users interact with coaching prompts.
  </p>
  )}

  {!isLoading && !isError && hasActivity && (
  <ResponsiveContainer width="100%" height={220}>
  <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
  <XAxis
  dataKey="week"
  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
  tickLine={false}
  axisLine={false}
  />
  <YAxis
  allowDecimals={false}
  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
  tickLine={false}
  axisLine={false}
  />
  <Tooltip
  contentStyle={{
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  }}
  labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
  />
  {FOLLOW_UP_SERIES_CONFIG.map(({ key, label, color }) =>
  visible.has(key) ? (
  <Line
  key={key}
  type="monotone"
  dataKey={key}
  name={label}
  stroke={color}
  strokeWidth={2}
  dot={false}
  activeDot={{ r: 4, strokeWidth: 0 }}
  />
  ) : null,
  )}
  </LineChart>
  </ResponsiveContainer>
  )}
  </div>
  );
}

function LockedView({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (value === FOUNDER_KEY) {
  onSubmit(value);
  } else {
  setError(true);
  }
  };

  return (
  <div className="min-h-[60vh] flex items-center justify-center">
  <div className="glass rounded-2xl p-10 max-w-sm w-full text-center space-y-6">
  <div className="w-14 h-14 rounded-full bg-[hsl(248_62%_52%/0.15)] flex items-center justify-center mx-auto">
  <Lock className="w-7 h-7 text-[hsl(248_62%_52%)]" />
  </div>
  <div>
  <h1 className="font-serif text-xl font-bold text-foreground">Founder Dashboard</h1>
  <p className="text-sm text-muted-foreground mt-2">Enter your founder key to continue.</p>
  </div>
  <form onSubmit={handleSubmit} className="space-y-3">
  <input
  type="password"
  value={value}
  onChange={(e) => { setValue(e.target.value); setError(false); }}
  placeholder="Founder key"
  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm outline-none focus:border-[hsl(248_62%_52%/0.5)] transition-colors"
  />
  {error && <p className="text-xs text-red-400">Incorrect key.</p>}
  <button
  type="submit"
  className="w-full py-3 bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
  >
  Open Dashboard
  </button>
  </form>
  <p className="text-xs text-muted-foreground/40">
  Set <code className="font-mono">VITE_FOUNDER_KEY</code> to configure a custom key.
  </p>
  </div>
  </div>
  );
}

type Tab = "overview" | "leads" | "audits" | "purchases" | "waitlist" | "emails" | "testing" | "ocr-mismatches" | "referrals" | "matching" | "brain";


function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<FounderStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: audits } = useListAudits();
  const { data: waitlistStats } = useGetWaitlistStats();

  useEffect(() => {
  setLoading(true);
  Promise.all([
  getFounderStats(FOUNDER_KEY).then(setStats).catch(() => {}),
  getLeads().then(setLeads).catch(() => {}),
  getPurchaseInterestList(FOUNDER_KEY).then(setPurchases).catch(() => {}),
  ]).finally(() => setLoading(false));
  }, [refreshKey]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "leads", label: `Leads (${leads.length})`, icon: Inbox },
  { id: "audits", label: `Audits (${audits?.length ?? 0})`, icon: ListChecks },
  { id: "purchases", label: `Purchase Interest (${purchases.length})`, icon: ShoppingBag },
  { id: "waitlist", label: `Waitlist (${waitlistStats?.totalCount ?? 0})`, icon: Users },
  { id: "emails", label: "Email Templates", icon: Mail },
  { id: "testing", label: "Testing Checklist", icon: ClipboardCheck },
  { id: "ocr-mismatches", label: "OCR Mismatches", icon: ScanLine },
  { id: "referrals", label: "Referrals", icon: Share2 },
  { id: "matching", label: "Matching", icon: Heart },
  { id: "brain", label: "Brain", icon: Brain },
  ];

  return (
  <div className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
  <div className="flex items-center justify-between mb-8">
  <div>
  <h1 className="font-serif text-2xl font-bold text-foreground">Founder Dashboard</h1>
  <p className="text-sm text-muted-foreground mt-1">Live data, your app, your numbers.</p>
  </div>
  <div className="flex items-center gap-2">
  <button
  onClick={() => setRefreshKey((k) => k + 1)}
  className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
  Refresh
  </button>
  <button
  onClick={onSignOut}
  className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
  data-testid="founder-sign-out"
  >
  <LogOut className="w-3.5 h-3.5" />
  Sign out
  </button>
  </div>
  </div>

  {/* Tab nav */}
  <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
  {TABS.map(({ id, label, icon: Icon }) => (
  <button
  key={id}
  onClick={() => setTab(id)}
  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
  tab === id
  ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)]"
  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
  }`}
  >
  <Icon className="w-3.5 h-3.5" />
  {label}
  </button>
  ))}
  </div>

  {/* Overview */}
  {tab === "overview" && (
  <div className="space-y-8">
  <AiStatusPanel />
  <WellnessCompletionPanel founderKey={FOUNDER_KEY} />
  <BackgroundJobsPanel refreshKey={refreshKey} founderKey={FOUNDER_KEY} />
  <TrashPurgePanel founderKey={FOUNDER_KEY} onPurged={() => setRefreshKey((k) => k + 1)} />
  <TierFlipPanel founderKey={FOUNDER_KEY} />
  <FunnelPanel founderKey={FOUNDER_KEY} />
  <ActivityPanel founderKey={FOUNDER_KEY} />
  <ReferralAttributionPanel founderKey={FOUNDER_KEY} />
  <EchoCopilotPanel founderKey={FOUNDER_KEY} />
  <GeoipRefreshPanel founderKey={FOUNDER_KEY} />
  <OcrMismatchesPanel refreshKey={refreshKey} />
  <AiMetricsPanel refreshKey={refreshKey} founderKey={FOUNDER_KEY} />
  <AiReliabilityTrendsPanel refreshKey={refreshKey} founderKey={FOUNDER_KEY} />
  <EchoPlaybookPanel />
  <OcrPendingRulesPanel refreshKey={refreshKey} onApproved={() => setRefreshKey((k) => k + 1)} />
  <OcrRulesPanel refreshKey={refreshKey} />
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  <StatCard label="Leads captured" value={stats?.leads ?? "-"} icon={Inbox} color="hsl(var(--brand-indigo))" />
  <StatCard label="Purchase interest" value={stats?.purchaseInterest ?? "-"} icon={ShoppingBag} color="hsl(348 55% 58%)" />
  <StatCard label="Audits completed" value={stats?.audits ?? "-"} icon={ListChecks} color="hsl(142 55% 50%)" />
  <StatCard label="Waitlist signups" value={stats?.waitlist ?? "-"} icon={Users} color="hsl(43 65% 52%)" />
  <StatCard label="Message sessions" value={stats?.messages ?? "-"} icon={BarChart3} color="hsl(190 55% 52%)" />
  </div>

  <div className="grid grid-cols-2 md:grid-cols-2 gap-4" data-testid="card-follow-up-engagement">
  <StatCard
  label="Follow-ups snoozed"
  value={stats?.followUpSnoozeCount ?? "-"}
  icon={Moon}
  color="hsl(220 55% 65%)"
  data-testid="stat-follow-up-snoozed"
  />
  <StatCard
  label="Follow-ups dismissed"
  value={stats?.followUpDismissCount ?? "-"}
  icon={XCircle}
  color="hsl(0 55% 60%)"
  data-testid="stat-follow-up-dismissed"
  />
  </div>

  <FollowUpTrendsPanel />

  <div className="glass rounded-2xl p-6 space-y-3">
  <h2 className="font-semibold text-sm text-foreground">Recent leads</h2>
  <TableShell
  headers={["Name", "Email", "Source", "Interest", "Date"]}
  rows={leads.slice(0, 5).map((l) => [l.firstName, l.email, l.source, l.interest, fmtDate(l.createdAt)])}
  />
  </div>
  </div>
  )}

  {/* Leads */}
  {tab === "leads" && (
  <div className="glass rounded-2xl p-6 space-y-4">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <h2 className="font-semibold text-foreground">All leads ({leads.length})</h2>
  <p className="text-xs text-muted-foreground/50 mt-0.5">Set a status per lead, saved in browser. Export the list with the button below.</p>
  </div>
  <button
  onClick={() => {
  const csv = [
  ["ID", "Name", "Email", "Source", "Interest", "Date"].join(","),
...leads.map(l => [l.id, l.firstName, l.email, l.source, `"${(l.interest ?? "").replace(/"/g, '""')}"`, fmtDate(l.createdAt)].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
  }}
  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
  >
  Export CSV
  </button>
  </div>
  <div className="flex flex-wrap gap-1.5 mb-2">
  {LEAD_STATUS_OPTIONS.map(s => {
  const sc = STATUS_COLORS[s];
  return (
  <span key={s} className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
  style={{ color: sc.color, borderColor: withAlpha(sc.color, 0.3), background: sc.bg }}>
  {s}
  </span>
  );
  })}
  </div>
  <LeadsStatusTable leads={leads} />
  </div>
  )}

  {/* Audits */}
  {tab === "audits" && (
  <div className="glass rounded-2xl p-6 space-y-4">
  <h2 className="font-semibold text-foreground">All audits ({audits?.length ?? 0})</h2>
  <TableShell
  headers={["ID", "Name", "Age", "Goal", "Score", "Status", "Date"]}
  rows={(audits ?? []).map((a) => [
  a.id, a.firstName, a.age, a.datingGoal,
  a.readinessScore ?? "", a.status, fmtDate(a.createdAt),
  ])}
  />
  </div>
  )}

  {/* Purchase interest */}
  {tab === "purchases" && (
  <div className="glass rounded-2xl p-6 space-y-4">
  <h2 className="font-semibold text-foreground">Purchase interest ({purchases.length})</h2>
  <TableShell
  headers={["ID", "Name", "Email", "Product", "Amount", "Promo", "Source", "Status", "Date"]}
  rows={purchases.map((p) => [
  p.id, p.firstName, p.email, p.product,
  p.amountCents ? `$${(p.amountCents / 100).toFixed(0)}` : "Free",
  p.promoCode ?? "",
  p.source, p.status, fmtDate(p.createdAt),
  ])}
  />
  </div>
  )}

  {/* Waitlist */}
  {tab === "waitlist" && (
  <div className="glass rounded-2xl p-6 space-y-4">
  <h2 className="font-semibold text-foreground">Waitlist ({waitlistStats?.totalCount ?? 0} signups)</h2>
  <div className="grid grid-cols-3 gap-4 mb-4">
  <div className="glass rounded-xl p-4 text-center">
  <p className="text-2xl font-bold text-foreground">{waitlistStats?.totalCount ?? 0}</p>
  <p className="text-xs text-muted-foreground">Total signups</p>
  </div>
  <div className="glass rounded-xl p-4 text-center">
  <p className="text-2xl font-bold text-foreground">{waitlistStats?.spotsRemaining ?? 0}</p>
  <p className="text-xs text-muted-foreground">Spots remaining</p>
  </div>
  <div className="glass rounded-xl p-4 text-center">
  <p className="text-2xl font-bold text-foreground">{waitlistStats?.nextMilestone ?? 0}</p>
  <p className="text-xs text-muted-foreground">Next milestone</p>
  </div>
  </div>
  <p className="text-xs text-muted-foreground/50 italic">Detailed waitlist list view coming soon.</p>
  </div>
  )}

  {/* Email Templates */}
  {tab === "emails" && <EmailTemplatesPanel />}

  {/* OCR Mismatches */}
  {tab === "ocr-mismatches" && <OcrMismatchesPanel refreshKey={refreshKey} />}

  {/* Testing Checklist */}
  {tab === "testing" && <TestingChecklistPanel />}

  {/* Referrals */}
  {tab === "referrals" && <ReferralsPanel founderKey={FOUNDER_KEY} refreshKey={refreshKey} />}

  {/* Matching Review Queue */}
  {tab === "matching" && (
  <div className="space-y-6" data-testid="matching-tab">
  <ProposalsQueuePanel founderKey={FOUNDER_KEY} refreshKey={refreshKey} />
  <PoolReadyPanel founderKey={FOUNDER_KEY} refreshKey={refreshKey} />
  </div>
  )}

  {tab === "brain" && <BrainTab founderKey={FOUNDER_KEY} refreshKey={refreshKey} />}

  <p className="text-xs text-muted-foreground/30 mt-12 text-center">
  Founder demo mode · Full auth + multi-user coming in V3
  </p>
  </div>
  );
}

/* ─── Brain: control center + brain map + re-weighting ──────────────── */

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full glass rounded-xl px-3 py-2 text-sm text-foreground bg-transparent border border-white/10 focus:border-[hsl(248_62%_52%/0.5)] focus:outline-none"
      />
    </label>
  );
}

function BrainTab({ founderKey, refreshKey }: { founderKey: string; refreshKey: number }) {
  const [resp, setResp] = useState<BrainControlsResponse | null>(null);
  const [draft, setDraft] = useState<BrainControls | null>(null);
  const [map, setMap] = useState<BrainMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    Promise.all([getBrainControls(founderKey), getBrainMap(founderKey)])
      .then(([controls, brainMap]) => {
        if (cancelled) return;
        setResp(controls);
        setDraft(controls.controls);
        setMap(brainMap);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load brain.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [founderKey, refreshKey, reloadKey]);

  function patch(p: Partial<BrainControls>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    setNotice(null);
    try {
      const next = await updateBrainControls(founderKey, draft);
      setResp(next);
      setDraft(next.controls);
      setNotice("Controls saved.");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    setSaving(true);
    setErr(null);
    setNotice(null);
    try {
      const next = await resetBrainControls(founderKey);
      setResp(next);
      setDraft(next.controls);
      setNotice("Controls reset to defaults.");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading brain.
      </div>
    );
  }

  if (err && !resp) {
    return (
      <div className="glass rounded-2xl p-6 text-sm text-[hsl(0_70%_70%)] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        {err}
      </div>
    );
  }

  if (!resp || !draft) return null;

  const overrides = draft.signalWeightOverrides ?? {};

  return (
    <div className="space-y-8" data-testid="brain-tab">
      {(err || notice) && (
        <div
          className={`glass rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
            err ? "text-[hsl(0_70%_70%)]" : "text-[hsl(150_60%_65%)]"
          }`}
        >
          {err ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {err || notice}
        </div>
      )}

      {/* Control Center */}
      <section className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[hsl(248_62%_62%)]" />
            Control Center
          </h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full ${
              resp.overridden
                ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)]"
                : "bg-white/5 text-muted-foreground"
            }`}
          >
            {resp.overridden ? "Custom" : "Defaults"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          The live knobs behind readiness and matching. Day one defaults match the signal registry exactly.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <NumberField
            label="Readiness threshold"
            hint="Score a user needs to enter the matching pool."
            value={draft.readinessThreshold}
            min={0}
            max={100}
            onChange={(n) => patch({ readinessThreshold: n })}
          />
          <NumberField
            label="Matching radius (miles)"
            hint="How far we look for candidate matches."
            value={draft.matchingRadiusMiles}
            min={1}
            max={500}
            onChange={(n) => patch({ matchingRadiusMiles: n })}
          />
          <NumberField
            label="Cohort minimum size"
            hint="Smallest viable matching cohort."
            value={draft.cohortMinSize}
            min={1}
            max={1000}
            onChange={(n) => patch({ cohortMinSize: n })}
          />
          <NumberField
            label="Anon daily AI cap"
            hint="Claude calls per day for anonymous visitors."
            value={draft.anonDailyCap}
            min={0}
            max={10000}
            onChange={(n) => patch({ anonDailyCap: n })}
          />
          <NumberField
            label="Free daily AI cap"
            hint="Claude calls per day for free accounts."
            value={draft.freeDailyCap}
            min={0}
            max={100000}
            onChange={(n) => patch({ freeDailyCap: n })}
          />
        </div>

        {/* Re-weighting mode */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <span className="text-sm font-medium text-foreground">Re-weighting mode</span>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Hold keeps base weights for everyone. Shadow computes the outcome tilt and reports its impact, but still serves the base score so nothing a user sees changes. Applied serves the tilt, but only to the rollout cohort below.
          </p>
          <div className="flex gap-2">
            {(["hold", "shadow", "applied"] as const).map((m) => (
              <button
                key={m}
                onClick={() => patch({ reweightingMode: m })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  draft.reweightingMode === m
                    ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10"
                }`}
              >
                {m === "hold" ? "Hold" : m === "shadow" ? "Shadow" : "Applied"}
              </button>
            ))}
          </div>
          {draft.reweightingMode === "applied" && (
            <div className="mt-4">
              <NumberField
                label="Rollout cohort percent"
                hint="Share of users (0-100) whose live score uses the tilt, bucketed deterministically by user id. 100 is everyone, 0 is no one. Ramp this up while watching the impact panel."
                value={draft.reweightingCohortPercent}
                min={0}
                max={100}
                onChange={(n) => patch({ reweightingCohortPercent: n })}
              />
            </div>
          )}
          <ReweightingImpactPanel
            founderKey={founderKey}
            mode={draft.reweightingMode}
            cohortPercent={draft.reweightingCohortPercent}
          />
        </div>

        {/* Confidence weighting */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <span className="text-sm font-medium text-foreground">Confidence weighting</span>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Hold treats every signal's weight as-is. Applied leans the score toward the lanes we trust most, scaling each weight by its confidence and re-normalizing.
          </p>
          <div className="flex gap-2">
            {(["hold", "applied"] as const).map((m) => (
              <button
                key={m}
                onClick={() => patch({ confidenceWeighting: m })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  draft.confidenceWeighting === m
                    ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10"
                }`}
              >
                {m === "hold" ? "Hold" : "Applied"}
              </button>
            ))}
          </div>
        </div>

        {/* Freshness decay */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <span className="text-sm font-medium text-foreground">Freshness decay</span>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Hold keeps coverage at full strength forever. Applied fades a time-sensitive lane by its half-life since the user last fed it, so stale signal cools off and the lane resurfaces as a next step.
          </p>
          <div className="flex gap-2">
            {(["hold", "applied"] as const).map((m) => (
              <button
                key={m}
                onClick={() => patch({ decayMode: m })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  draft.decayMode === m
                    ? "bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10"
                }`}
              >
                {m === "hold" ? "Hold" : "Applied"}
              </button>
            ))}
          </div>
        </div>

        {/* Connector toggles */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <span className="text-sm font-medium text-foreground">Connectors</span>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Enable or disable each data source the machine can draw on.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {resp.connectorCatalog.map((c) => {
              const enabled = draft.connectorToggles[c.id] !== false;
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    patch({
                      connectorToggles: { ...draft.connectorToggles, [c.id]: !enabled },
                    })
                  }
                  className="flex items-center justify-between glass rounded-xl px-4 py-3 border border-white/10 hover:border-white/20 transition-colors text-left"
                >
                  <span>
                    <span className="text-sm text-foreground block">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{c.status}</span>
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full ${
                      enabled
                        ? "bg-[hsl(150_60%_45%/0.2)] text-[hsl(150_60%_65%)]"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {enabled ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Signal weight overrides */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <span className="text-sm font-medium text-foreground">Signal weights</span>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Override a raw weight to change how much a signal counts. Blank uses the registry default. Weights are normalized to sum to one.
          </p>
          <div className="space-y-2">
            {resp.signalCatalog.map((s) => {
              const effective = resp.effectiveBaseWeights[s.id] ?? 0;
              const raw = overrides[s.id];
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 glass rounded-xl px-4 py-2.5 border border-white/10"
                >
                  <span>
                    <span className="text-sm text-foreground block">{s.label}</span>
                    <span className="text-xs text-muted-foreground">
                      default {(s.defaultWeight * 100).toFixed(1)}% · effective {(effective * 100).toFixed(1)}%
                    </span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={s.defaultWeight.toFixed(2)}
                    value={raw ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const nextOverrides = { ...overrides };
                      if (v === "") delete nextOverrides[s.id];
                      else nextOverrides[s.id] = Number(v);
                      patch({
                        signalWeightOverrides: Object.keys(nextOverrides).length
                          ? nextOverrides
                          : null,
                      });
                    }}
                    className="w-24 glass rounded-lg px-2 py-1.5 text-sm text-foreground bg-transparent border border-white/10 focus:border-[hsl(248_62%_52%/0.5)] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const nextOverrides = { ...overrides };
                      delete nextOverrides[s.id];
                      patch({
                        signalWeightOverrides: Object.keys(nextOverrides).length
                          ? nextOverrides
                          : null,
                      });
                    }}
                    disabled={raw === undefined}
                    className="text-xs px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Default
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-6 border-t border-white/10">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[hsl(248_62%_52%)] text-white hover:bg-[hsl(248_62%_46%)] disabled:opacity-50 transition-colors"
            data-testid="brain-save"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save controls
          </button>
          <button
            onClick={resetAll}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium glass border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </button>
        </div>
      </section>

      {/* Re-weighting decision */}
      <ReweightingPanel founderKey={founderKey} mode={draft.reweightingMode} />

      {/* Brain Map */}
      {map && <BrainMapPanel founderKey={founderKey} map={map} onCurated={() => setReloadKey((k) => k + 1)} />}
    </div>
  );
}

function ReweightingImpactPanel({
  founderKey,
  mode,
  cohortPercent,
}: {
  founderKey: string;
  mode: ReweightingMode;
  cohortPercent: number;
}) {
  const [data, setData] = useState<ReweightingImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      setData(await getReweightingImpact(founderKey));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Impact lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 glass rounded-xl px-4 py-4 border border-white/10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-sm font-medium text-foreground">
            Rollout impact, before and after
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compares every scored user's base score against the would-be tilted score, computed regardless of the current mode so you can see the impact before flipping the switch.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Activity className="w-4 h-4" />
          )}
          Measure impact
        </button>
      </div>

      {err && (
        <div className="text-sm text-[hsl(0_70%_70%)] flex items-center gap-2 mt-3">
          <AlertTriangle className="w-4 h-4" />
          {err}
        </div>
      )}

      {data && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ImpactStat label="Scored users" value={String(data.scoredUsers)} />
          <ImpactStat
            label={`In cohort (${
              mode === "applied" ? `${cohortPercent}%` : "n/a"
            })`}
            value={String(data.cohortUsers)}
          />
          <ImpactStat label="Would change" value={String(data.changedUsers)} />
          <ImpactStat
            label="Avg shift"
            value={`${data.averageAbsDelta} pts`}
          />
          <ImpactStat
            label="Range"
            value={`${data.maxDecrease} / +${data.maxIncrease}`}
          />
          <ImpactStat
            label={`Crosses ${data.threshold}`}
            value={`+${data.thresholdCrossingsUp} / -${data.thresholdCrossingsDown}`}
          />
          {data.laneTilt.length > 0 && (
            <div className="col-span-full">
              <span className="text-xs text-muted-foreground block mb-2">
                Leaning into, across the sample
              </span>
              <div className="flex flex-wrap gap-2">
                {data.laneTilt.map((lane) => (
                  <span
                    key={lane.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(248_62%_52%/0.3)] bg-[hsl(248_62%_52%/0.12)] px-3 py-1 text-xs font-medium text-[hsl(248_62%_62%)]"
                    data-testid={`impact-lane-${lane.id}`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {lane.label}
                    <span className="text-muted-foreground">{lane.users}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.recommendation && (
            <div
              className="col-span-full glass rounded-xl px-4 py-3 border border-[hsl(248_62%_52%/0.2)]"
              data-testid="impact-recommendation"
            >
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Read
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {data.recommendation}
              </p>
            </div>
          )}
          {data.truncated && (
            <p className="col-span-full text-xs text-muted-foreground">
              Sampled the first {data.scoredUsers} scored users.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-3 py-2 border border-white/10">
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ReweightingPanel({
  founderKey,
  mode,
}: {
  founderKey: string;
  mode: ReweightingMode;
}) {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<ReweightingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    const e = email.trim();
    if (!e) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      setData(await getReweighting(founderKey, e));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2 mb-1">
        <Gauge className="w-5 h-5 text-[hsl(248_62%_62%)]" />
        Re-weighting decision
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Bounded, outcome-driven weight proposals for one user. These are a preview. They only tilt live scoring when the mode above is set to Applied.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && run()}
          placeholder="user@email.com"
          className="flex-1 glass rounded-xl px-3 py-2 text-sm text-foreground bg-transparent border border-white/10 focus:border-[hsl(248_62%_52%/0.5)] focus:outline-none"
          data-testid="reweighting-email"
        />
        <button
          onClick={run}
          disabled={loading || !email.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Preview
        </button>
      </div>

      {err && (
        <div className="text-sm text-[hsl(0_70%_70%)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {err}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-foreground font-medium">{data.user.email}</span>
            <span className="text-muted-foreground">Readiness {data.readinessScore}</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full ${
                data.preview.applied
                  ? "bg-[hsl(150_60%_45%/0.2)] text-[hsl(150_60%_65%)]"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              {data.preview.applied
                ? "Applied: tilting this user's live score"
                : mode === "applied"
                  ? "Held back: user is outside the rollout cohort"
                  : mode === "shadow"
                    ? "Shadow: preview only, live score unchanged"
                    : "Hold: preview only"}
            </span>
          </div>
          <div className="glass rounded-xl px-4 py-3 border border-white/10 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Base score{" "}
              <span className="text-foreground font-medium">{data.preview.baseScore}</span>
            </span>
            <span className="text-muted-foreground">
              Tilted score{" "}
              <span className="text-foreground font-medium">{data.preview.tiltedScore}</span>
            </span>
            <span
              className={`font-medium ${
                data.preview.delta > 0
                  ? "text-[hsl(150_60%_65%)]"
                  : data.preview.delta < 0
                    ? "text-[hsl(0_70%_70%)]"
                    : "text-muted-foreground"
              }`}
            >
              {data.preview.delta > 0 ? "+" : ""}
              {data.preview.delta} pts
            </span>
            <span className="text-xs text-muted-foreground">
              {data.preview.inCohort ? "In cohort" : "Outside cohort"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{data.outcome.headline}</p>
          {data.adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No adjustments proposed for this user yet.</p>
          ) : (
            <div className="space-y-2">
              {data.adjustments.map((a) => {
                const delta = a.adjustedWeight - a.defaultWeight;
                return (
                  <div key={a.id} className="glass rounded-xl px-4 py-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{a.label}</span>
                      <span
                        className={`text-sm font-medium ${
                          delta > 0
                            ? "text-[hsl(150_60%_65%)]"
                            : delta < 0
                              ? "text-[hsl(0_70%_70%)]"
                              : "text-muted-foreground"
                        }`}
                      >
                        {(a.defaultWeight * 100).toFixed(1)}% → {(a.adjustedWeight * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BrainMapPanel({
  founderKey,
  map,
  onCurated,
}: {
  founderKey: string;
  map: BrainMapResponse;
  onCurated: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function curate(id: string, verdict: "good" | "bad") {
    setBusyId(id);
    try {
      await saveCuration(founderKey, { entityType: "signal", entityId: id, verdict });
      onCurated();
    } catch {
      // surfaced via reload; keep panel quiet
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2 mb-1">
        <Brain className="w-5 h-5 text-[hsl(248_62%_62%)]" />
        Brain map
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        What the machine is doing right now: the jobs that keep it fresh, the signals it weighs, and where readiness stands.
      </p>

      {/* Readiness aggregate */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Scored users", value: map.readiness.scoredUsers },
          { label: "Average score", value: map.readiness.averageScore },
          { label: "Eligible", value: map.readiness.eligibleUsers },
          { label: "Threshold", value: map.readiness.threshold },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl px-4 py-3 border border-white/10">
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Background jobs */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Background jobs</h3>
        <div className="space-y-1.5">
          {map.jobs.map((j) => (
            <div
              key={j.jobName}
              className="flex items-center justify-between glass rounded-lg px-3 py-2 border border-white/10"
            >
              <span className="text-sm text-foreground">{j.jobName}</span>
              <span
                className={`flex items-center gap-1.5 text-xs ${
                  j.stale ? "text-[hsl(40_90%_65%)]" : "text-[hsl(150_60%_65%)]"
                }`}
              >
                {j.stale ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {j.lastSuccessAt ? new Date(j.lastSuccessAt).toLocaleString() : "never"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Signal registry */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">Signal registry</h3>
        <div className="space-y-2">
          {map.signals.map((s) => (
            <div key={s.id} className="glass rounded-xl px-4 py-3 border border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-foreground">{s.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.describe}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    default {(s.defaultWeight * 100).toFixed(1)}% · effective {(s.effectiveWeight * 100).toFixed(1)}% · confidence {s.confidence}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => curate(s.id, "good")}
                    disabled={busyId === s.id}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                      s.curation?.verdict === "good"
                        ? "bg-[hsl(150_60%_45%/0.2)] text-[hsl(150_60%_65%)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    aria-label="Mark good"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => curate(s.id, "bad")}
                    disabled={busyId === s.id}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                      s.curation?.verdict === "bad"
                        ? "bg-[hsl(0_70%_50%/0.2)] text-[hsl(0_70%_70%)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    aria-label="Mark bad"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pool + proposals */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Matching pool</h3>
          {map.pool.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pool members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {map.pool.map((p) => (
                <div key={p.status} className="flex justify-between glass rounded-lg px-3 py-2 border border-white/10 text-sm">
                  <span className="text-muted-foreground">{p.status}</span>
                  <span className="text-foreground font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">Proposals</h3>
          {map.proposals.length === 0 ? (
            <p className="text-xs text-muted-foreground">No proposals yet.</p>
          ) : (
            <div className="space-y-1.5">
              {map.proposals.map((p) => (
                <div key={p.status} className="flex justify-between glass rounded-lg px-3 py-2 border border-white/10 text-sm">
                  <span className="text-muted-foreground">{p.status}</span>
                  <span className="text-foreground font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Matching Review Panels ────────────────────────────────────────── */

function ProposalsQueuePanel({ founderKey, refreshKey }: { founderKey: string; refreshKey: number }) {
  const [items, setItems] = useState<MatchingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setErr(null);
  getMatchingQueue(founderKey)
.then((res) => {
  if (cancelled) return;
  setItems(res.items);
  })
.catch((e) => {
  if (cancelled) return;
  setErr(e instanceof Error ? e.message : "Failed to load queue");
  })
.finally(() => {
  if (!cancelled) setLoading(false);
  });
  return () => {
  cancelled = true;
  };
  }, [founderKey, refreshKey, reloadKey]);

  const onStatus = async (id: string, status: "reviewed" | "sent" | "dismissed") => {
  if (busyId) return;
  setBusyId(id);
  try {
  await setMatchingProposalStatus(founderKey, id, status);
  toast({
  title: "Proposal updated",
  description: `Marked as ${status}.`,
  });
  setReloadKey((k) => k + 1);
  } catch (e) {
  toast({
  title: "Update failed",
  description: e instanceof Error ? e.message : "Could not update proposal",
  variant: "destructive",
  });
  } finally {
  setBusyId(null);
  }
  };

  const onNote = async (id: string) => {
  const note = (notes[id] ?? "").trim();
  if (!note || busyId) return;
  setBusyId(id);
  try {
  await addMatchingProposalNote(founderKey, id, note);
  toast({
  title: "Note saved",
  description: "Founder note appended to proposal.",
  });
  setNotes((prev) => ({...prev, [id]: "" }));
  setReloadKey((k) => k + 1);
  } catch (e) {
  toast({
  title: "Save failed",
  description: e instanceof Error ? e.message : "Could not save note",
  variant: "destructive",
  });
  } finally {
  setBusyId(null);
  }
  };

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="proposals-queue-panel">
  <div className="flex items-center justify-between flex-wrap gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Proposals Queue
  </p>
  <p className="text-base font-semibold text-foreground">
  Pending external reads and concierge proposals
  </p>
  <p className="text-xs text-muted-foreground/80 mt-1">
  New rows from /matching land here. Review, send an intro, or dismiss.
  </p>
  </div>
  <button
  type="button"
  onClick={() => setReloadKey((k) => k + 1)}
  disabled={loading}
  data-testid="button-refresh-proposals"
  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors disabled:opacity-60"
  >
  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
  Refresh
  </button>
  </div>

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="proposals-queue-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>Could not load queue: {err}</span>
  </div>
  )}

  {!loading && !err && items.length === 0 && (
  <div className="rounded-xl p-6 border border-white/10 bg-white/[0.02] text-sm text-muted-foreground text-center" data-testid="proposals-queue-empty">
  No proposed rows right now. New pastes and concierge opt-ins will show up here.
  </div>
  )}

  <div className="space-y-3">
  {items.map((item) => {
  const created = new Date(item.createdAt);
  return (
  <div
  key={item.id}
  className="rounded-xl p-4 border border-white/10 bg-white/[0.03] space-y-3"
  data-testid={`proposal-card-${item.id}`}
  >
  <div className="flex items-start justify-between flex-wrap gap-2">
  <div className="min-w-0">
  <p className="text-sm font-semibold text-foreground">
  {item.user.firstName || item.user.email || item.userId}
  </p>
  <p className="text-xs text-muted-foreground/80">
  {item.user.email ?? "no email on file"} · score {item.compatibilityScore} · source {item.source}
  </p>
  <p className="text-xs text-muted-foreground/60">
  Pool: {item.pool.status ?? "off"}{item.pool.tier ? ` · ${item.pool.tier}` : ""} · {created.toLocaleString()}
  </p>
  </div>
  <span className="text-xs px-2 py-1 rounded-md bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_72%)]" data-testid={`proposal-status-${item.id}`}>
  {item.status}
  </span>
  </div>

  {item.rawText && (
  <details className="rounded-lg border border-white/10 bg-black/20">
  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground" data-testid={`proposal-raw-toggle-${item.id}`}>
  View pasted profile ({item.rawText.length} chars)
  </summary>
  <pre className="px-3 py-2 text-xs whitespace-pre-wrap text-muted-foreground/90 max-h-64 overflow-auto" data-testid={`proposal-raw-${item.id}`}>{item.rawText}</pre>
  </details>
  )}

  {item.summary && (
  <p className="text-xs text-muted-foreground whitespace-pre-wrap" data-testid={`proposal-summary-${item.id}`}>
  {item.summary}
  </p>
  )}

  <div className="flex flex-wrap items-center gap-2">
  <button
  type="button"
  onClick={() => onStatus(item.id, "reviewed")}
  disabled={busyId === item.id}
  data-testid={`button-mark-reviewed-${item.id}`}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-foreground hover:bg-white/10 transition-colors disabled:opacity-60"
  >
  <CheckCircle2 className="w-3.5 h-3.5" />
  Mark reviewed
  </button>
  <button
  type="button"
  onClick={() => onStatus(item.id, "sent")}
  disabled={busyId === item.id}
  data-testid={`button-mark-sent-${item.id}`}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(142_55%_50%/0.15)] text-[hsl(142_55%_70%)] hover:bg-[hsl(142_55%_50%/0.25)] transition-colors disabled:opacity-60"
  >
  <Send className="w-3.5 h-3.5" />
  Sent intro
  </button>
  <button
  type="button"
  onClick={() => onStatus(item.id, "dismissed")}
  disabled={busyId === item.id}
  data-testid={`button-dismiss-${item.id}`}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(348_55%_58%/0.15)] text-[hsl(348_55%_78%)] hover:bg-[hsl(348_55%_58%/0.25)] transition-colors disabled:opacity-60"
  >
  <XCircle className="w-3.5 h-3.5" />
  Dismiss
  </button>
  </div>

  <div className="flex items-center gap-2">
  <input
  type="text"
  value={notes[item.id] ?? ""}
  onChange={(e) => setNotes((prev) => ({...prev, [item.id]: e.target.value }))}
  placeholder="Add founder note..."
  data-testid={`input-note-${item.id}`}
  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-foreground text-xs outline-none focus:border-[hsl(248_62%_52%/0.5)] transition-colors"
  />
  <button
  type="button"
  onClick={() => onNote(item.id)}
  disabled={busyId === item.id || !(notes[item.id] ?? "").trim()}
  data-testid={`button-save-note-${item.id}`}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(248_62%_52%/0.2)] text-[hsl(248_62%_72%)] hover:bg-[hsl(248_62%_52%/0.3)] transition-colors disabled:opacity-60"
  >
  Save note
  </button>
  </div>
  </div>
  );
  })}
  </div>
  </div>
  );
}

function PoolReadyPanel({ founderKey, refreshKey }: { founderKey: string; refreshKey: number }) {
  const [items, setItems] = useState<MatchingPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setErr(null);
  getMatchingPool(founderKey)
.then((res) => {
  if (cancelled) return;
  setItems(res.items);
  })
.catch((e) => {
  if (cancelled) return;
  setErr(e instanceof Error ? e.message : "Failed to load pool");
  })
.finally(() => {
  if (!cancelled) setLoading(false);
  });
  return () => {
  cancelled = true;
  };
  }, [founderKey, refreshKey, reloadKey]);

  return (
  <div className="glass rounded-2xl p-6 space-y-4" data-testid="pool-ready-panel">
  <div className="flex items-center justify-between flex-wrap gap-3">
  <div>
  <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-semibold">
  Pool Members
  </p>
  <p className="text-base font-semibold text-foreground">
  Ready and concierge-only members
  </p>
  <p className="text-xs text-muted-foreground/80 mt-1">
  Wingman concierge opt-ins and ready pool members with their stated preferences.
  </p>
  </div>
  <button
  type="button"
  onClick={() => setReloadKey((k) => k + 1)}
  disabled={loading}
  data-testid="button-refresh-pool"
  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors disabled:opacity-60"
  >
  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
  Refresh
  </button>
  </div>

  {err && (
  <div
  className="rounded-xl p-3 border flex items-start gap-2 text-sm"
  style={{
  background: "hsl(348 55% 58% / 0.10)",
  borderColor: "hsl(348 55% 58% / 0.40)",
  color: "hsl(348 55% 78%)",
  }}
  data-testid="pool-ready-error"
  >
  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
  <span>Could not load pool: {err}</span>
  </div>
  )}

  {!loading && !err && items.length === 0 && (
  <div className="rounded-xl p-6 border border-white/10 bg-white/[0.02] text-sm text-muted-foreground text-center" data-testid="pool-ready-empty">
  No members in the ready or concierge-only pool yet.
  </div>
  )}

  <div className="space-y-2">
  {items.map((item) => {
  const ageRange = item.preferences.ageMin || item.preferences.ageMax
  ? `${item.preferences.ageMin ?? "?"} to ${item.preferences.ageMax ?? "?"}`
  : "any age";
  return (
  <div
  key={item.userId}
  className="rounded-xl p-3 border border-white/10 bg-white/[0.03] flex items-start justify-between gap-3 flex-wrap"
  data-testid={`pool-card-${item.userId}`}
  >
  <div className="min-w-0">
  <p className="text-sm font-semibold text-foreground">
  {item.user.email ?? item.userId}
  </p>
  <p className="text-xs text-muted-foreground/80 flex items-center gap-2 flex-wrap">
  <span className="inline-flex items-center gap-1">
  <MapPin className="w-3 h-3" />
  {item.preferences.cityHint ?? "no city"}
  </span>
  <span>· {ageRange}</span>
  {item.preferences.genderPreference && <span>· {item.preferences.genderPreference}</span>}
  </p>
  <p className="text-xs text-muted-foreground/60">
  Ready: {item.readyAt ? new Date(item.readyAt).toLocaleString() : "not set"}
  </p>
  </div>
  <div className="flex flex-col items-end gap-1">
  <span
  className={`text-xs px-2 py-1 rounded-md ${
  item.status === "concierge_only"
  ? "bg-[hsl(326_100%_55%/0.2)] text-[hsl(326_100%_75%)]"
  : "bg-[hsl(142_55%_50%/0.2)] text-[hsl(142_55%_70%)]"
  }`}
  data-testid={`pool-status-${item.userId}`}
  >
  {item.status}
  </span>
  {item.user.tier && (
  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
  {item.user.tier}
  </span>
  )}
  </div>
  </div>
  );
  })}
  </div>
  </div>
  );
}

/* ─── Referrals Panel ───────────────────────────────────────────────── */

function ReferralsPanel({ founderKey, refreshKey }: { founderKey: string; refreshKey: number }) {
  const { data, isLoading, isError, refetch } = useGetFounderReferrals(
  { key: founderKey },
  );

  useEffect(() => {
  void refetch();
  }, [refreshKey, refetch]);

  if (isLoading) {
  return (
  <div className="glass rounded-2xl p-8 flex items-center gap-3 text-sm text-muted-foreground">
  <Loader2 className="w-4 h-4 animate-spin" />
  Loading referral data...
  </div>
  );
  }

  if (isError || !data) {
  return (
  <div className="glass rounded-2xl p-8 text-sm text-muted-foreground">
  Could not load referral data. Check the founder key and try again.
  </div>
  );
  }

  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

  return (
  <div className="space-y-6" data-testid="referrals-panel">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <StatCard
  label="Total referrals"
  value={data.totalReferrals}
  icon={Share2}
  color="hsl(248 62% 62%)"
  />
  <StatCard
  label="Unique inviters"
  value={data.uniqueInviters}
  icon={Users}
  color="hsl(190 55% 52%)"
  />
  <StatCard
  label="Overall conversion"
  value={pct(data.overallConversionRate)}
  icon={CheckCircle2}
  color="hsl(142 55% 50%)"
  />
  </div>

  <div className="glass rounded-2xl p-6 space-y-3">
  <div>
  <h2 className="font-semibold text-foreground">Top inviters</h2>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  Ranked by how many signups they brought in. Conversion is the share of those signups with a paid purchase.
  </p>
  </div>
  {data.topInviters.length === 0 ? (
  <p className="text-sm text-muted-foreground/60 italic py-6 text-center">
  No one has referred a signup yet. Share links will show up here once a friend lands and signs up.
  </p>
  ) : (
  <TableShell
  headers={["#", "Inviter", "Email", "Invited", "Paid", "Conversion"]}
  rows={data.topInviters.map((r, i) => [
  i + 1,
  r.inviterDisplayName ?? "(no name)",
  r.inviterEmail || "(no email)",
  r.invitedCount,
  r.paidCount,
  pct(r.conversionRate),
  ])}
  />
  )}
  </div>

  <div className="glass rounded-2xl p-6 space-y-3">
  <div>
  <h2 className="font-semibold text-foreground">Surface breakdown</h2>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  Where the share link was clicked from. Rows tagged "(unknown)" came from a link with no surface set.
  </p>
  </div>
  {data.surfaceBreakdown.length === 0 ? (
  <p className="text-sm text-muted-foreground/60 italic py-6 text-center">
  No referral surfaces tracked yet.
  </p>
  ) : (
  <TableShell
  headers={["Surface", "Count", "Paid", "Conversion"]}
  rows={data.surfaceBreakdown.map((r) => [
  r.surface,
  r.count,
  r.paidCount,
  pct(r.conversionRate),
  ])}
  />
  )}
  </div>

  <div className="glass rounded-2xl p-6 space-y-3">
  <div>
  <h2 className="font-semibold text-foreground">Recent referrals</h2>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  The last 50 referral rows, newest first. The Paid badge means the invitee has a paid purchase on file.
  </p>
  </div>
  {data.recentReferrals.length === 0 ? (
  <p className="text-sm text-muted-foreground/60 italic py-6 text-center">
  No referral activity yet. Once someone lands via a share link and signs up, the row will appear here.
  </p>
  ) : (
  <div className="overflow-x-auto rounded-xl border border-white/8">
  <table className="w-full text-sm">
  <thead>
  <tr className="border-b border-white/8 bg-white/3">
  {["When", "Inviter", "Invitee", "Surface", "Invited at", "Status"].map((h) => (
  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
  {h}
  </th>
  ))}
  </tr>
  </thead>
  <tbody>
  {data.recentReferrals.map((r, i) => (
  <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</td>
  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.inviterEmail || "(no email)"}</td>
  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.inviteeEmail || "(no email)"}</td>
  <td className="px-4 py-3 text-muted-foreground">
  {r.surface ?? <span className="text-muted-foreground/40 italic">(unknown)</span>}
  </td>
  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
  {r.invitedAt ? fmtDate(r.invitedAt) : <span className="text-muted-foreground/30 italic">none</span>}
  </td>
  <td className="px-4 py-3">
  {r.invitedConverted ? (
  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
  style={{ color: "hsl(142 55% 50%)", borderColor: "hsl(142 55% 50% / 0.35)", background: "hsl(142 55% 50% / 0.12)" }}>
  Paid
  </span>
  ) : (
  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
  style={{ color: "hsl(220 10% 70%)", borderColor: "hsl(220 10% 70% / 0.25)", background: "hsl(220 10% 70% / 0.08)" }}>
  Pending
  </span>
  )}
  </td>
  </tr>
  ))}
  </tbody>
  </table>
  </div>
  )}
  </div>
  </div>
  );
}

/* ─── Email Templates Panel ─────────────────────────────────────────── */

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
  name: "Signal Check Result Follow-Up",
  subject: "Your Signal Check result, one thing to try this week",
  body: `Hi [First name],

You ran a Signal Check with MatchLab Club recently. I wanted to follow up with one practical thing based on what tends to make the biggest difference.

The most common issue we see isn't a bad profile, it's a profile that's technically fine but gives someone no specific reason to reach out. If that sounds familiar, try this: swap one generic phrase for a specific detail. "Love to travel" → the place. "Foodie" → the dish. One swap is enough to test it.

If you want a full breakdown with rewrites and a specific action plan, your report is waiting at [link].

Talk soon,
[Founder name]
MatchLab Club`,
  },
  {
  name: "Day-After Profile Tip",
  subject: "One thing that'll make your profile 10× more specific",
  body: `Hi [First name],

Quick one, you joined MatchLab Club yesterday and I wanted to send one actionable tip rather than wait for you to come back.

Read your profile out loud. Anything that sounds stiff, written, or like it could apply to 80% of people on the app, rewrite it in your actual speaking voice.

That's it. One pass, out loud, today.

If you want help with the rewrite, the Profile Blueprint tool walks you through it: [link], [Founder name]`,
  },
  {
  name: "Before & After Example Email",
  subject: "What a 3-minute rewrite actually looks like",
  body: `Hi [First name],

Here's a real before-and-after from our Gallery (all fictional, all based on patterns we see constantly).

BEFORE: "Engineer. Love to travel and try new restaurants. Here for something real. DM me 😊"

AFTER: "I'm a structural engineer who once convinced my entire team to spend a Friday afternoon testing whether a bridge could handle a spontaneous dance-off (it could). Currently three countries into a slow tour of every country with a really good national dish."

The difference isn't talent. It's specificity. The second one was written in about 10 minutes.

Your profile has the same potential. Here's where to start: [link], [Founder name]`,
  },
  {
  name: "Dating Reset Offer Email",
  subject: "The Founder Reviewed Dating Reset, what's included",
  body: `Hi [First name],

I wanted to tell you about something we're offering to a small group of early users.

The Founder Reviewed Dating Reset is a hands-on package:
- Full AI profile audit with your score and breakdown
- A personal note from me on the 1-2 highest-impact things to fix
- Complete bio rewrite + prompt rewrites
- A tailored 7-day action plan

It's $97 right now for early users. I'm reviewing these personally, limited spots.

If you're serious about making real progress before summer, this is the most direct path.

Claim your spot here: [link], [Founder name]
MatchLab Club`,
  },
  {
  name: "Wingman Membership Invite",
  subject: "You're invited. Wingman Studio early access",
  body: `Hi [First name],

You've been using MatchLab Club for a bit and I wanted to give you early access to something we're opening up.

Wingman Studio is the ongoing coaching layer, it includes:
- Help Me Reply: guided reply drafting for any situation
- Improve My Profile: ongoing rewrite sessions
- Weekly Growth Plan: a new focus every week
- Flirt Coach: message drafts for any moment

Early access is $19/month (regular price will be $29). You can cancel anytime.

Join here: [link], [Founder name]`,
  },
  {
  name: "Beta Feedback Request",
  subject: "One question from the founder, would mean a lot",
  body: `Hi [First name],

I'm the founder of MatchLab Club and I built this because I needed it myself. I tested every tool on my own old profiles and patterns before anyone else saw it.

We're still early and your feedback shapes what we build next.

One question: Did the output you got feel specific to you, or more generic?

Hit reply and tell me, even one sentence helps. Or if you're willing to leave a short quote on what worked (or didn't), I'd be grateful.

Thank you for being here early., [Founder name]`,
  },
  {
  name: "First 10 Beta. DM Outreach",
  subject: "(DM), for direct message, no subject line",
  body: `Hey [First name]. I built something I think you'd actually find useful. It's a dating profile coaching tool, free Signal Check in about 3 minutes, tells you exactly what's working and what isn't about how you're showing up.

I tested it on my own old profiles first, then a few people I trust. The feedback has been really good.

Would you be willing to try it and tell me what you think? [link]

No sign-up needed to see your free result.`,
  },
  {
  name: "Profile Feedback Invite",
  subject: "Would you try this and tell me what you think?",
  body: `Hi [First name],

I've been working on something for a while and I'd love a real opinion from someone I trust.

It's a free dating profile audit, takes 3 minutes, gives you a Signal Score and specific feedback on your bio, photos, and messaging approach. No account, no credit card.

If you try it and tell me: (1) Did it feel accurate? (2) Was anything confusing?, that would genuinely help me.

Here's the link: [link]

If you end up finding it useful, I'd love to know what worked. And if not, I want to know that too., [Founder name]`,
  },
  {
  name: "Partner Visitor Follow-Up (Shebangs)",
  subject: "Welcome from MatchLab Club, your free profile check",
  body: `Hi [First name],

Thanks for visiting through Shebangs. You're getting early access to something we don't have open publicly yet.

Your free Signal Check is available at [link], takes 3 minutes, no account needed. It gives you:
- A Signal Score (0–100) across 8 dimensions
- A bio critique, honest and specific
- Your top 3 action items

As a Shebangs member, you also get 20% off the full Dating Reset using code SHEBANGS20 at checkout.

Let me know if you have any questions. I read every reply., [Founder name]
MatchLab Club`,
  },
  {
  name: "Sample Report Viewer Follow-Up",
  subject: "The report you saw, here's how to get yours",
  body: `Hi [First name],

You looked at Jordan's sample Dating Reset report. That's the exact format we'd produce for your actual profile.

The free Signal Check takes 3 minutes and gives you your own score and breakdown (no account needed): [link]

If you want the full report, bio rewrite, message strategy, 7-day plan, plus a founder review note during the beta, the Dating Reset is $97: [link]

Any questions, just reply to this., [Founder name]`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
  navigator.clipboard.writeText(text).then(() => {
  setCopied(true);
  setTimeout(() => setCopied(false), 1800);
  }).catch(() => {});
  };
  return (
  <button
  onClick={copy}
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
  >
  {copied ? <CheckCircle2 className="w-3 h-3 text-[hsl(142_55%_60%)]" /> : <Copy className="w-3 h-3" />}
  {copied ? "Copied" : "Copy"}
  </button>
  );
}

function EmailTemplatesPanel() {
  return (
  <div className="space-y-5">
  <div>
  <h2 className="font-semibold text-foreground mb-1">Email Follow-Up Templates</h2>
  <p className="text-sm text-muted-foreground/60 leading-relaxed">
  Copy-ready templates for nurturing early users. Replace <code className="text-xs bg-white/5 px-1 rounded">[placeholders]</code> before sending.
  No sending infrastructure, this is a copy tool only.
  </p>
  </div>
  {EMAIL_TEMPLATES.map((t, i) => (
  <div key={i} className="glass border border-white/8 rounded-2xl overflow-hidden">
  <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3">
  <div>
  <p className="font-semibold text-foreground text-sm">{t.name}</p>
  <p className="text-xs text-muted-foreground/60 mt-0.5">
  <span className="font-mono">Subject: </span>{t.subject}
  </p>
  </div>
  <CopyButton text={`Subject: ${t.subject}\n\n${t.body}`} />
  </div>
  <pre className="p-4 text-xs text-muted-foreground/70 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-52 overflow-y-auto">
  {t.body}
  </pre>
  </div>
  ))}
  </div>
  );
}

/* ─── Testing Checklist Panel ───────────────────────────────────────── */

interface TestFlow {
  id: string;
  area: string;
  flow: string;
  steps: string[];
}

const TEST_FLOWS: TestFlow[] = [
  {
  id: "tf1", area: "Onboarding",
  flow: "First-user journey (anonymous)",
  steps: [
  "Land on /, hero loads, no errors",
  "Click 'Start Your Audit' → /start wizard opens",
  "Complete all 5 wizard steps",
  "Submit → redirects to /dashboard with signal score",
  "Signal Check ring shows a score (not 0 or NaN)",
  ],
  },
  {
  id: "tf2", area: "Onboarding",
  flow: "Shebangs partner visitor journey",
  steps: [
  "Navigate to /partners/shebangs",
  "Page loads with partner branding",
  "CTA links to /start or /signal-check",
  "Returning to /dashboard shows demo data if unauthenticated",
  ],
  },
  {
  id: "tf3", area: "Core Tools",
  flow: "Signal Check end-to-end",
  steps: [
  "Go to /signal-check",
  "Fill out form with sample bio text",
  "Submit → score ring animates",
  "Strengths + Growth Areas show specific (not generic) content",
  "AI confidence label visible (Strong read / Needs more context / Based on limited input)",
  "Fallback mode still shows polished output if AI is unavailable",
  ],
  },
  {
  id: "tf4", area: "Core Tools",
  flow: "Quiz + Archetype",
  steps: [
  "Go to /quiz → answers load",
  "Complete quiz → archetype result shows",
  "Go to /archetype → description and share button present",
  ],
  },
  {
  id: "tf5", area: "Core Tools",
  flow: "Blueprint generation",
  steps: [
  "Go to /blueprint",
  "Fill all 4 fields",
  "Generate → output shows insight + rewrite",
  "Copy button copies the output",
  "Fallback shows polished deterministic result",
  ],
  },
  {
  id: "tf6", area: "Core Tools",
  flow: "Next Message",
  steps: [
  "Go to /next-message",
  "Enter match name, context, last message",
  "Generate → 3 reply options show (Playful / Direct / Warm)",
  "Each has rationale",
  "Copy works on each",
  ],
  },
  {
  id: "tf7", area: "Core Tools",
  flow: "Glow-Up Studio",
  steps: [
  "Go to /glow-up",
  "Paste a bio",
  "Generate → rewritten bio appears",
  "Output is specific, not generic",
  ],
  },
  {
  id: "tf8", area: "Wingman Studio",
  flow: "Help Me Reply workflow",
  steps: [
  "Go to /copilot → hub shows quick moments",
  "Click 'Help Me Reply' → /copilot/reply",
  "Enter scenario → guided reply output shows",
  ],
  },
  {
  id: "tf9", area: "Wingman Studio",
  flow: "Flirt Coach",
  steps: [
  "Go to /copilot/flirt",
  "Enter context → 3 flirt message options",
  "Options feel distinct (not variations of the same thing)",
  ],
  },
  {
  id: "tf10", area: "Data & Trust",
  flow: "Connection Center",
  steps: [
  "Go to /connections → empty state shows (if no matches)",
  "Manual add flow works",
  "Privacy notice visible",
  ],
  },
  {
  id: "tf11", area: "Data & Trust",
  flow: "Data Vault, export + delete",
  steps: [
  "Go to /vault",
  "Export button → triggers download or shows copy-ready data",
  "Delete button → confirmation shown, data cleared",
  ],
  },
  {
  id: "tf12", area: "Data & Trust",
  flow: "Wellness Center",
  steps: [
  "Go to /wellness",
  "8 dimensions visible",
  "Reflection or check-in prompt shows",
  ],
  },
  {
  id: "tf13", area: "Conversion",
  flow: "Offer / checkout flow",
  steps: [
  "Go to /pricing, 3 tiers render",
  "Click a paid tier → /checkout/:product",
  "Checkout page shows correct product + price",
  "Cancel → /checkout/cancel with graceful message",
  ],
  },
  {
  id: "tf14", area: "Mobile",
  flow: "Mobile pass at 375px",
  steps: [
  "Resize browser to 375px wide",
  "Dashboard: action groups readable, no horizontal overflow",
  "Wizard: all steps tappable",
  "Gallery: before/after cards stack vertically",
  "Copy buttons accessible with thumb",
  ],
  },
  {
  id: "tf15", area: "AI Health",
  flow: "AI + fallback status check",
  steps: [
  "Go to /founder → Overview tab",
  "AI Status panel shows Live or Fallback clearly",
  "AI Reliability panel shows per-tool success stats",
  "Test prompt textarea works and shows output",
  "Disconnect API key → all tools still produce polished fallback output",
  ],
  },
  {
  id: "tf16", area: "Launch",
  flow: "New pages. What Changed, Feedback, Sample Report",
  steps: [
  "Go to /copilot/what-changed → form loads, save works, localStorage persists",
  "Go to /feedback → form loads, all fields work, submit shows thank-you state",
  "Go to /sample-report → full report renders, CTAs link correctly",
  "Copilot hub → Quick Moments shows 'What Changed?' as 5th item",
  ],
  },
  {
  id: "tf17", area: "Launch",
  flow: "Privacy & terms links",
  steps: [
  "Go to /privacy → content loads, no 404",
  "Go to /terms → content loads, no 404",
  "Footer or nav links to both pages work",
  "Privacy statement mentions data deletion and export",
  ],
  },
  {
  id: "tf18", area: "Launch",
  flow: "Tone controls + confidence labels",
  steps: [
  "Go to /blueprint → fill form → generate → 'Your blueprint' label shows confidence badge",
  "Tone adjustment pills appear after result, click 'Warmer' → new result generates",
  "Go to /next-message → same confidence label and tone controls visible after result",
  "Go to /glow-up → paste bio → generate → 'Your rewrites' label shows confidence badge",
  ],
  },
  {
  id: "tf19", area: "Launch",
  flow: "Founder dashboard status labels",
  steps: [
  "Go to /founder → Leads tab",
  "Each lead card shows status dropdown, default 'New'",
  "Change status → persists after tab switch and page refresh",
  "Export CSV button downloads a usable file",
  "Email Templates tab shows all 9 templates with copy buttons",
  ],
  },
  {
  id: "tf20", area: "Launch",
  flow: "Revenue path. Pricing + offer",
  steps: [
  "Go to /pricing, 'What Happens After You Pay' section visible",
  "Founding Beta / First 25 offer block visible with CTA",
  "Sample Report link leads to /sample-report with full content",
  "All 3 pricing tier CTAs work (Signal Check free, Dating Reset $97, Wingman $197)",
  "Promo code PODCAST40 mentioned correctly",
  ],
  },
];

const AREA_COLORS: Record<string, string> = {
  "Onboarding": "hsl(var(--brand-indigo))",
  "Core Tools": "hsl(190 55% 60%)",
  "Wingman Studio": "hsl(var(--brand-rose))",
  "Data & Trust": "hsl(var(--brand-green))",
  "Conversion": "hsl(var(--brand-gold))",
  "Mobile": "hsl(228 40% 65%)",
  "AI Health": "hsl(15 80% 60%)",
};

interface WellnessStats {
  totalAnswers: number;
  totalTags: number;
  usersWithAnswers: number;
  usersApprovedMatching: number;
  dimensionsAnswered: number;
  topDimensions: { dimension: string; count: number }[];
}

async function getWellnessStats(key: string): Promise<WellnessStats> {
  const res = await fetch("/api/founder/wellness-stats", {
  headers: { "x-founder-key": key },
  });
  if (!res.ok) throw new Error("Failed to load wellness stats");
  return res.json() as Promise<WellnessStats>;
}

function WellnessCompletionPanel({ founderKey }: { founderKey: string }) {
  const [stats, setStats] = useState<WellnessStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  setLoading(true);
  getWellnessStats(founderKey).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [founderKey]);

  const TOTAL_DIMENSIONS = 18;
  const pct = stats ? Math.round(((stats.dimensionsAnswered ?? 0) / TOTAL_DIMENSIONS) * 100) : 0;

  return (
  <div className="glass border border-white/8 rounded-2xl p-6 space-y-5">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <h2 className="font-semibold text-foreground mb-1">Compatibility Profile Adoption</h2>
  <p className="text-sm text-muted-foreground/60 leading-relaxed">
  Wellness answers &amp; insight tags across your user base.
  </p>
  </div>
  {loading && <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin flex-shrink-0 mt-1" />}
  </div>

  {stats && (
  <>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {[
  { label: "Total answers", value: stats.totalAnswers ?? 0, color: "hsl(var(--brand-indigo))" },
  { label: "Insight tags", value: stats.totalTags ?? 0, color: "hsl(var(--brand-gold))" },
  { label: "Users with profile",value: stats.usersWithAnswers ?? 0, color: "hsl(190 55% 60%)" },
  { label: "Approved matching", value: stats.usersApprovedMatching ?? 0, color: "hsl(var(--brand-green))" },
  ].map(s => (
  <div key={s.label} className="rounded-xl bg-white/3 border border-white/5 p-3 text-center">
  <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{s.label}</p>
  </div>
  ))}
  </div>

  <div>
  <div className="flex items-center justify-between mb-1.5">
  <p className="text-xs text-muted-foreground/50">Dimensions answered across all users</p>
  <p className="text-xs font-bold tabular-nums text-[hsl(248_62%_52%)]">{stats.dimensionsAnswered ?? 0}/{TOTAL_DIMENSIONS}</p>
  </div>
  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
  <div
  className="h-full rounded-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(190_55%_60%)] transition-all duration-500"
  style={{ width: `${pct}%` }}
  />
  </div>
  </div>

  {(stats.topDimensions ?? []).length > 0 && (
  <div>
  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">Most-answered dimensions</p>
  <div className="space-y-1.5">
  {(stats.topDimensions ?? []).map(d => {
  const max = (stats.topDimensions ?? [])[0]?.count ?? 1;
  return (
  <div key={d.dimension} className="flex items-center gap-3">
  <p className="text-xs text-muted-foreground/60 w-36 flex-shrink-0 truncate capitalize">{d.dimension}</p>
  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
  <div
  className="h-full rounded-full bg-[hsl(248_62%_52%/0.6)]"
  style={{ width: `${Math.round((d.count / max) * 100)}%` }}
  />
  </div>
  <p className="text-[10px] tabular-nums text-muted-foreground/40 w-5 text-right">{d.count}</p>
  </div>
  );
  })}
  </div>
  </div>
  )}
  </>
  )}
  </div>
  );
}

function TestingChecklistPanel() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
  setChecked(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const doneCount = checked.size;
  const totalCount = TEST_FLOWS.length;
  return (
  <div className="space-y-5">
  <div className="flex items-start justify-between gap-4 flex-wrap">
  <div>
  <h2 className="font-semibold text-foreground mb-1">Manual Testing Checklist</h2>
  <p className="text-sm text-muted-foreground/60 leading-relaxed">
  Critical paths to run before any major launch or user push. Check off as you go, state resets on page refresh.
  </p>
  </div>
  <div className="text-right flex-shrink-0">
  <p className="text-2xl font-bold text-foreground">{doneCount}/{totalCount}</p>
  <p className="text-xs text-muted-foreground/50">flows verified</p>
  </div>
  </div>
  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
  <div
  className="h-full rounded-full bg-gradient-to-r from-[hsl(248_62%_52%)] to-[hsl(142_55%_60%)] transition-all duration-500"
  style={{ width: `${(doneCount / totalCount) * 100}%` }}
  />
  </div>
  <div className="space-y-3">
  {TEST_FLOWS.map(flow => {
  const done = checked.has(flow.id);
  const color = AREA_COLORS[flow.area] ?? "hsl(var(--brand-indigo))";
  return (
  <div key={flow.id}
  className={`glass border rounded-2xl overflow-hidden transition-all ${done ? "border-[hsl(142_55%_60%/0.3)] opacity-60" : "border-white/8"}`}
  >
  <div className="p-4 flex items-start gap-3">
  <button onClick={() => toggle(flow.id)} className="flex-shrink-0 mt-0.5">
  {done
  ? <CheckCircle2 className="w-5 h-5 text-[hsl(142_55%_60%)]" />
  : <Circle className="w-5 h-5 text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors" />
  }
  </button>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
  style={{ color, borderColor: withAlpha(color, 0.3), background: withAlpha(color, 0.1) }}>
  {flow.area}
  </span>
  <span className={`text-sm font-semibold ${done ? "line-through text-muted-foreground/40" : "text-foreground"}`}>
  {flow.flow}
  </span>
  </div>
  <ul className="space-y-1">
  {flow.steps.map((step, j) => (
  <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground/55">
  <span className="text-muted-foreground/25 flex-shrink-0 mt-0.5">·</span>
  {step}
  </li>
  ))}
  </ul>
  </div>
  </div>
  </div>
  );
  })}
  </div>
  </div>
  );
}

export default function Founder() {
  useMeta("Founder Dashboard", "MatchLab Club Founder Dashboard, live app data.");

  const params = new URLSearchParams(
  typeof window !== "undefined" ? window.location.search : ""
  );
  const keyParam = params.get("key");

  const [authenticated, setAuthenticated] = useState(() => {
  if (keyParam === FOUNDER_KEY) return true;
  try {
  return localStorage.getItem(FOUNDER_KEY_STORAGE_KEY) === FOUNDER_KEY;
  } catch {
  return false;
  }
  });

  const handleAuth = (key: string) => {
  try {
  localStorage.setItem(FOUNDER_KEY_STORAGE_KEY, key);
  } catch {
  }
  setAuthenticated(true);
  };

  const handleSignOut = () => {
  try {
  localStorage.removeItem(FOUNDER_KEY_STORAGE_KEY);
  } catch {
  }
  setAuthenticated(false);
  };

  if (!authenticated) {
  return (
  <AppLayout>
  <LockedView onSubmit={handleAuth} />
  </AppLayout>
  );
  }

  return (
  <AppLayout>
  <Dashboard onSignOut={handleSignOut} />
  </AppLayout>
  );
}