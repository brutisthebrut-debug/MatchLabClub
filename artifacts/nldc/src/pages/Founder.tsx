import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import {
  getFounderStats, getLeads, getPurchaseInterestList, getAiMetrics,
  getAiThresholds, updateAiThresholds, getAiMetricsTrends, getAiThresholdChanges, undoAiThresholdChange,
  getRollupHeartbeat, getOcrMismatches,
  getOcrLearnedRules, runOcrLearn, clearOcrLearnedRules,
  type FounderStats, type Lead, type PurchaseInterest, type AiMetricsResponse,
  type AiThresholdsResponse, type AiPerToolThreshold, type AiMetricsTrendsResponse,
  type AiThresholdChange, type RollupHeartbeatResponse,
  type OcrMismatchesResponse, type OcrMismatchesSort, type OcrMismatchesWindow,
  type OcrCorrectionField,
  type OcrLearnedRule, type OcrLearnResult
} from "@/lib/apiClient";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Bar } from "recharts";
import { useListAudits, useGetWaitlistStats } from "@workspace/api-client-react";
import { Lock, Users, ShoppingBag, BarChart3, Inbox, ListChecks, RefreshCw, Sparkles, CheckCircle2, AlertTriangle, Loader2, Send, Mail, Copy, ClipboardCheck, Circle, Moon, XCircle, Download, ScanLine } from "lucide-react";
import { buildAiContext, readSavedProgressEntries, readSavedGoals } from "@/lib/contextBuilder";

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
  live:            { label: "Live AI connected", color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.12)", border: "hsl(142 55% 60% / 0.35)", Icon: CheckCircle2 },
  fallback:        { label: "Fallback mode",     color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.12)",  border: "hsl(43 65% 65% / 0.35)",  Icon: Sparkles },
  "setup-needed":  { label: "Setup needed",      color: "hsl(348 55% 65%)", bg: "hsl(348 55% 65% / 0.12)", border: "hsl(348 55% 65% / 0.35)", Icon: AlertTriangle },
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm outline-none focus:border-[hsl(268_52%_68%/0.5)] transition-colors resize-none font-mono"
          placeholder="Type a short sample message…"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={runTest}
            disabled={testing || !sample.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{result.output || "—"}</p>
        </div>
      )}
    </div>
  );
}

function AlertThresholdEditor({
  data,
  onSaved,
}: {
  data: AiMetricsResponse;
  onSaved: () => void;
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

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const t = await getAiThresholds(FOUNDER_KEY);
      setThresholds(t);
      setGlobalWindow(t.global.windowSize);
      setGlobalMin(t.global.minSample);
      setGlobalRate(Math.round(t.global.firstTrySuccessRate * 100));
      setOverrides(t.perTool);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !thresholds) void load();
  }, [open]);

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
        o.toolName === toolName ? { ...o, [field]: value } : o,
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
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(268_52%_68%/0.5)]"
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
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(268_52%_68%/0.5)]"
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
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-foreground outline-none focus:border-[hsl(268_52%_68%/0.5)]"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Per-tool overrides
            </p>
            {overrides.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic mb-2">
                No overrides — every tool uses the global defaults.
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] hover:opacity-90 transition-opacity disabled:opacity-50"
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
    if (w === null && m === null && r === null) return "—";
    const pct = r === null ? "—" : `${Math.round(r * 100)}%`;
    return `${w ?? "—"} / ${m ?? "—"} / ${pct}`;
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
          No changes recorded yet — saved threshold edits will show up here.
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
                      ? "Already undone — refresh to apply a new undo"
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

function RollupHeartbeatPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<RollupHeartbeatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    getRollupHeartbeat()
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const stale = data?.stale ?? false;
  const thresholdHours = data ? Math.round(data.staleThresholdMs / (60 * 60 * 1000)) : 36;
  const okColor = "hsl(142 55% 60%)";
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
            background: `${color.replace(")", " / 0.10)")}`,
            borderColor: `${color.replace(")", " / 0.40)")}`,
          }}
        >
          <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold" style={{ color }}>
              {stale
                ? data.lastSuccessAt
                  ? `Stale — last ran ${formatAge(data.ageMs ?? 0)}`
                  : "Never run on this database"
                : `Healthy — last ran ${formatAge(data.ageMs ?? 0)}`}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {data.lastSuccessAt
                ? `Heartbeat at ${new Date(data.lastSuccessAt).toLocaleString()}.`
                : "No heartbeat recorded yet — the rollup job may not have completed since deploy."}
              {" "}Alerts when older than ~{thresholdHours} hours.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AiMetricsPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<AiMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    getAiMetrics()
      .then(setData)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refreshKey, bump]);

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
          {data && <AlertThresholdEditor data={data} onSaved={() => setBump((x) => x + 1)} />}
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
            {data.alerts.map((a) => (
              <li key={a.toolName} className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.toolName}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{a.reason}</p>
                </div>
                <span className="text-muted-foreground/70 shrink-0">
                  {pct(a.recentFirstTrySuccessRate)} · last {a.recentTotal}
                </span>
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
                      <div className="flex items-center gap-2">
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
                        : "—"}
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
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 ${row.alert ? "text-[hsl(348_65%_78%)] font-semibold" : "text-muted-foreground"}`}>
                      {row.recent.total > 0 ? `${pct(row.recent.firstTrySuccessRate)} (${row.recent.total})` : "—"}
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
                  {cell ?? <span className="text-muted-foreground/30 italic">—</span>}
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
  "hsl(268 52% 68%)",
  "hsl(142 55% 60%)",
  "hsl(43 65% 65%)",
  "hsl(190 55% 60%)",
  "hsl(348 55% 65%)",
  "hsl(228 40% 65%)",
  "hsl(310 50% 68%)",
  "hsl(95 45% 60%)",
];

function fmtTrendDay(day: string) {
  const d = new Date(day + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AiReliabilityTrendsPanel({ refreshKey }: { refreshKey: number }) {
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
    getAiMetricsTrends(days)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e: unknown) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, refreshKey]);

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
    const csv = [headers.join(","), ...rows].join("\n");
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
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-foreground outline-none focus:border-[hsl(268_52%_68%/0.5)] max-w-[180px]"
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
                      ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)]"
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
                    ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)]"
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
                stroke="hsl(348 55% 65%)"
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
  { value: 7,    label: "Last 7 days"  },
  { value: 30,   label: "Last 30 days" },
  { value: 90,   label: "Last 90 days" },
  { value: null, label: "All time"     },
];

const OCR_SORT_OPTIONS: { value: OcrMismatchesSort; label: string }[] = [
  { value: "total", label: "By total volume" },
  { value: "top",   label: "By top single diff" },
];

const OCR_FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  age: "Age",
  sourceApp: "Source app",
  bio: "Bio",
  prompts: "Prompts",
};

const OCR_FILTER_FIELDS: OcrCorrectionField[] = ["firstName", "age", "sourceApp", "bio", "prompts"];

function OcrMismatchesPanel({ refreshKey }: { refreshKey: number }) {
  const [windowDays, setWindowDays] = useState<OcrMismatchesWindow>(30);
  const [sort, setSort] = useState<OcrMismatchesSort>("total");
  const [data, setData] = useState<OcrMismatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OcrCorrectionField | "all">("all");

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

  const filteredRecent = data && filter !== "all"
    ? data.recent.filter((r) => r.field === filter)
    : data?.recent ?? [];

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
              setWindowDays(v === "all" ? null : (Number(v) as OcrMismatchesWindow));
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
            onChange={(e) => setSort(e.target.value as OcrMismatchesSort)}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-foreground hover:border-white/20"
          >
            {OCR_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
                      ? "border-[hsl(268_52%_68%/0.5)] bg-[hsl(268_52%_68%/0.15)] text-[hsl(268_52%_78%)]"
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
                          ? "border-[hsl(268_52%_68%/0.5)] bg-[hsl(268_52%_68%/0.15)] text-[hsl(268_52%_78%)]"
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
  const [lastRun, setLastRun] = useState<OcrLearnResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

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

  const handleRun = async () => {
    setRunning(true);
    setActionError(null);
    try {
      const result = await runOcrLearn(FOUNDER_KEY);
      setLastRun(result);
      setReloadTick((t) => t + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to run learning");
    } finally {
      setRunning(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all learned OCR rules? This cannot be undone.")) return;
    setClearing(true);
    setActionError(null);
    try {
      await clearOcrLearnedRules(FOUNDER_KEY);
      setLastRun(null);
      setReloadTick((t) => t + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to clear rules");
    } finally {
      setClearing(false);
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
          <button
            data-testid="btn-ocr-learn-run"
            onClick={handleRun}
            disabled={running || clearing}
            className="text-xs px-3 py-1.5 rounded-lg border border-[hsl(268_52%_68%/0.3)] bg-[hsl(268_52%_68%/0.15)] text-[hsl(268_52%_78%)] hover:bg-[hsl(268_52%_68%/0.25)] disabled:opacity-50 flex items-center gap-1.5"
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
                {grouped[kind].map((rule) => (
                  <div
                    key={rule.id}
                    data-testid={`ocr-rule-${rule.id}`}
                    className="glass rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap text-xs"
                  >
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
                    </span>
                  </div>
                ))}
              </div>
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
  "New":                  { color: "hsl(268 52% 68%)", bg: "hsl(268 52% 68% / 0.12)" },
  "Needs Review":         { color: "hsl(43 65% 65%)",  bg: "hsl(43 65% 65% / 0.12)"  },
  "Reviewed":             { color: "hsl(190 55% 60%)", bg: "hsl(190 55% 60% / 0.12)" },
  "Follow-Up Sent":       { color: "hsl(228 40% 65%)", bg: "hsl(228 40% 65% / 0.12)" },
  "Converted":            { color: "hsl(142 55% 60%)", bg: "hsl(142 55% 60% / 0.12)" },
  "Testimonial Requested":{ color: "hsl(348 55% 65%)", bg: "hsl(348 55% 65% / 0.12)" },
  "Archived":             { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.3)" },
};

const LEAD_STATUS_KEY = "nldc_lead_statuses";

function useLeadStatuses() {
  const [statuses, setStatuses] = useState<Record<string, LeadStatus>>(() => {
    try { return JSON.parse(localStorage.getItem(LEAD_STATUS_KEY) ?? "{}") as Record<string, LeadStatus>; }
    catch { return {}; }
  });
  const setStatus = (id: string | number, s: LeadStatus) => {
    setStatuses(prev => {
      const next = { ...prev, [String(id)]: s };
      try { localStorage.setItem(LEAD_STATUS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return { statuses, setStatus };
}

function LeadsStatusTable({ leads }: { leads: Lead[] }) {
  const { statuses, setStatus } = useLeadStatuses();
  if (!leads.length) return <p className="text-sm text-muted-foreground/60 italic py-6 text-center">No leads yet.</p>;
  return (
    <div className="space-y-2">
      {leads.map((l) => {
        const currentStatus = statuses[String(l.id)] ?? "New";
        const sc = STATUS_COLORS[currentStatus];
        return (
          <div key={l.id} className="glass border border-white/8 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{l.firstName}</span>
                {l.email && <span className="text-xs text-muted-foreground/60">{l.email}</span>}
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ml-auto sm:ml-0"
                  style={{ color: sc.color, borderColor: sc.color.replace(")", " / 0.3)"), background: sc.bg }}>
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
                className="text-xs rounded-lg border border-white/10 bg-white/5 text-muted-foreground px-2 py-1.5 outline-none focus:border-[hsl(268_52%_68%/0.4)] cursor-pointer"
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
        <div className="w-14 h-14 rounded-full bg-[hsl(268_52%_68%/0.15)] flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-[hsl(268_52%_68%)]" />
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
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm outline-none focus:border-[hsl(268_52%_68%/0.5)] transition-colors"
          />
          {error && <p className="text-xs text-red-400">Incorrect key.</p>}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Unlock Dashboard
          </button>
        </form>
        <p className="text-xs text-muted-foreground/40">
          Set <code className="font-mono">VITE_FOUNDER_KEY</code> to configure a custom key.
        </p>
      </div>
    </div>
  );
}

type Tab = "overview" | "leads" | "audits" | "purchases" | "waitlist" | "emails" | "testing" | "ocr-mismatches";


function Dashboard() {
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
      getFounderStats().then(setStats).catch(() => {}),
      getLeads().then(setLeads).catch(() => {}),
      getPurchaseInterestList().then(setPurchases).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [refreshKey]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",  label: "Overview",                              icon: BarChart3      },
    { id: "leads",     label: `Leads (${leads.length})`,               icon: Inbox          },
    { id: "audits",    label: `Audits (${audits?.length ?? 0})`,       icon: ListChecks     },
    { id: "purchases", label: `Purchase Interest (${purchases.length})`, icon: ShoppingBag  },
    { id: "waitlist",  label: `Waitlist (${waitlistStats?.totalCount ?? 0})`, icon: Users   },
    { id: "emails",    label: "Email Templates",                       icon: Mail           },
    { id: "testing",   label: "Testing Checklist",                     icon: ClipboardCheck },
    { id: "ocr-mismatches", label: "OCR Mismatches",                   icon: ScanLine       },
  ];

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live data — your app, your numbers.</p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 px-4 py-2 glass rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id
                ? "bg-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)] border border-[hsl(268_52%_68%/0.3)]"
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
          <RollupHeartbeatPanel refreshKey={refreshKey} />
          <OcrMismatchesPanel refreshKey={refreshKey} />
          <AiMetricsPanel refreshKey={refreshKey} />
          <AiReliabilityTrendsPanel refreshKey={refreshKey} />
          <OcrRulesPanel refreshKey={refreshKey} />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Leads captured" value={stats?.leads ?? "—"} icon={Inbox} color="hsl(268 52% 68%)" />
            <StatCard label="Purchase interest" value={stats?.purchaseInterest ?? "—"} icon={ShoppingBag} color="hsl(348 55% 58%)" />
            <StatCard label="Audits completed" value={stats?.audits ?? "—"} icon={ListChecks} color="hsl(142 55% 50%)" />
            <StatCard label="Waitlist signups" value={stats?.waitlist ?? "—"} icon={Users} color="hsl(43 65% 52%)" />
            <StatCard label="Message sessions" value={stats?.messages ?? "—"} icon={BarChart3} color="hsl(190 55% 52%)" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 gap-4" data-testid="card-follow-up-engagement">
            <StatCard
              label="Follow-ups snoozed"
              value={stats?.followUpSnoozeCount ?? "—"}
              icon={Moon}
              color="hsl(220 55% 65%)"
              data-testid="stat-follow-up-snoozed"
            />
            <StatCard
              label="Follow-ups dismissed"
              value={stats?.followUpDismissCount ?? "—"}
              icon={XCircle}
              color="hsl(0 55% 60%)"
              data-testid="stat-follow-up-dismissed"
            />
          </div>

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
              <p className="text-xs text-muted-foreground/50 mt-0.5">Set a status per lead — saved in browser. Export the list with the button below.</p>
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
                  style={{ color: sc.color, borderColor: sc.color.replace(")", " / 0.3)"), background: sc.bg }}>
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
              a.readinessScore ?? "—", a.status, fmtDate(a.createdAt),
            ])}
          />
        </div>
      )}

      {/* Purchase interest */}
      {tab === "purchases" && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Purchase interest ({purchases.length})</h2>
          <TableShell
            headers={["ID", "Name", "Email", "Product", "Amount", "Source", "Status", "Date"]}
            rows={purchases.map((p) => [
              p.id, p.firstName, p.email, p.product,
              p.amountCents ? `$${(p.amountCents / 100).toFixed(0)}` : "Free",
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

      <p className="text-xs text-muted-foreground/30 mt-12 text-center">
        Founder demo mode · Full auth + multi-user coming in V3
      </p>
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
    subject: "Your Signal Check result — one thing to try this week",
    body: `Hi [First name],

You ran a Signal Check with Next Level Dating Club recently. I wanted to follow up with one practical thing based on what tends to make the biggest difference.

The most common issue we see isn't a bad profile — it's a profile that's technically fine but gives someone no specific reason to reach out. If that sounds familiar, try this: swap one generic phrase for a specific detail. "Love to travel" → the place. "Foodie" → the dish. One swap is enough to test it.

If you want a full breakdown with rewrites and a specific action plan, your report is waiting at [link].

Talk soon,
[Founder name]
Next Level Dating Club`,
  },
  {
    name: "Day-After Profile Tip",
    subject: "One thing that'll make your profile 10× more specific",
    body: `Hi [First name],

Quick one — you joined Next Level Dating Club yesterday and I wanted to send one actionable tip rather than wait for you to come back.

Read your profile out loud. Anything that sounds stiff, written, or like it could apply to 80% of people on the app — rewrite it in your actual speaking voice.

That's it. One pass, out loud, today.

If you want help with the rewrite, the Profile Blueprint tool walks you through it: [link]

— [Founder name]`,
  },
  {
    name: "Before & After Example Email",
    subject: "What a 3-minute rewrite actually looks like",
    body: `Hi [First name],

Here's a real before-and-after from our Gallery (all fictional, all based on patterns we see constantly).

BEFORE: "Engineer. Love to travel and try new restaurants. Here for something real. DM me 😊"

AFTER: "I'm a structural engineer who once convinced my entire team to spend a Friday afternoon testing whether a bridge could handle a spontaneous dance-off (it could). Currently three countries into a slow tour of every country with a really good national dish."

The difference isn't talent. It's specificity. The second one was written in about 10 minutes.

Your profile has the same potential. Here's where to start: [link]

— [Founder name]`,
  },
  {
    name: "Dating Reset Offer Email",
    subject: "The Founder Reviewed Dating Reset — what's included",
    body: `Hi [First name],

I wanted to tell you about something we're offering to a small group of early users.

The Founder Reviewed Dating Reset is a hands-on package:
- Full AI profile audit with your score and breakdown
- A personal note from me on the 1-2 highest-leverage things to fix
- Complete bio rewrite + prompt rewrites
- A tailored 7-day action plan

It's $97 right now for early users. I'm reviewing these personally — limited spots.

If you're serious about making real progress before summer, this is the most direct path.

Claim your spot here: [link]

— [Founder name]
Next Level Dating Club`,
  },
  {
    name: "Wingman Membership Invite",
    subject: "You're invited — Wingman Studio early access",
    body: `Hi [First name],

You've been using Next Level Dating Club for a bit and I wanted to give you early access to something we're opening up.

Wingman Studio is the ongoing coaching layer — it includes:
- Help Me Reply: guided reply drafting for any situation
- Improve My Profile: ongoing rewrite sessions
- Weekly Growth Plan: a new focus every week
- Flirt Coach: message drafts for any moment

Early access is $19/month (regular price will be $29). You can cancel anytime.

Join here: [link]

— [Founder name]`,
  },
  {
    name: "Beta Feedback Request",
    subject: "One question from the founder — would mean a lot",
    body: `Hi [First name],

I'm the founder of Next Level Dating Club and I built this because I needed it myself. I tested every tool on my own old profiles and patterns before anyone else saw it.

We're still early and your feedback shapes what we build next.

One question: Did the output you got feel specific to you, or more generic?

Hit reply and tell me — even one sentence helps. Or if you're willing to leave a short quote on what worked (or didn't), I'd be grateful.

Thank you for being here early.

— [Founder name]`,
  },
  {
    name: "First 10 Beta — DM Outreach",
    subject: "(DM) — for direct message, no subject line",
    body: `Hey [First name] — I built something I think you'd actually find useful. It's a dating profile coaching tool — free Signal Check in about 3 minutes, tells you exactly what's working and what isn't about how you're showing up.

I tested it on my own old profiles first, then a few people I trust. The feedback has been really good.

Would you be willing to try it and tell me what you think? [link]

No sign-up needed to see your free result.`,
  },
  {
    name: "Profile Feedback Invite",
    subject: "Would you try this and tell me what you think?",
    body: `Hi [First name],

I've been working on something for a while and I'd love a real opinion from someone I trust.

It's a free dating profile audit — takes 3 minutes, gives you a Signal Score and specific feedback on your bio, photos, and messaging approach. No account, no credit card.

If you try it and tell me: (1) Did it feel accurate? (2) Was anything confusing? — that would genuinely help me.

Here's the link: [link]

If you end up finding it useful, I'd love to know what worked. And if not, I want to know that too.

— [Founder name]`,
  },
  {
    name: "Partner Visitor Follow-Up (Shebangs)",
    subject: "Welcome from Next Level Dating Club — your free profile check",
    body: `Hi [First name],

Thanks for visiting through Shebangs. You're getting early access to something we don't have open publicly yet.

Your free Signal Check is available at [link] — takes 3 minutes, no account needed. It gives you:
- A Signal Score (0–100) across 8 dimensions
- A bio critique — honest and specific
- Your top 3 action items

As a Shebangs member, you also get 20% off the full Dating Reset using code SHEBANGS20 at checkout.

Let me know if you have any questions — I read every reply.

— [Founder name]
Next Level Dating Club`,
  },
  {
    name: "Sample Report Viewer Follow-Up",
    subject: "The report you saw — here's how to get yours",
    body: `Hi [First name],

You looked at Jordan's sample Dating Reset report. That's the exact format we'd produce for your actual profile.

The free Signal Check takes 3 minutes and gives you your own score and breakdown (no account needed): [link]

If you want the full report — bio rewrite, message strategy, 7-day plan, plus a founder review note during the beta — the Dating Reset is $97: [link]

Any questions, just reply to this.

— [Founder name]`,
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
          No sending infrastructure — this is a copy tool only.
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
      "Land on / — hero loads, no errors",
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
    flow: "Data Vault — export + delete",
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
      "Go to /pricing — 3 tiers render",
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
    flow: "New pages — What Changed, Feedback, Sample Report",
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
      "Tone adjustment pills appear after result — click 'Warmer' → new result generates",
      "Go to /next-message → same confidence label and tone controls visible after result",
      "Go to /glow-up → paste bio → generate → 'Your rewrites' label shows confidence badge",
    ],
  },
  {
    id: "tf19", area: "Launch",
    flow: "Founder dashboard status labels",
    steps: [
      "Go to /founder → Leads tab",
      "Each lead card shows status dropdown — default 'New'",
      "Change status → persists after tab switch and page refresh",
      "Export CSV button downloads a usable file",
      "Email Templates tab shows all 9 templates with copy buttons",
    ],
  },
  {
    id: "tf20", area: "Launch",
    flow: "Revenue path — Pricing + offer",
    steps: [
      "Go to /pricing — 'What Happens After You Pay' section visible",
      "Founding Beta / First 25 offer block visible with CTA",
      "Sample Report link leads to /sample-report with full content",
      "All 3 pricing tier CTAs work (Signal Check free, Dating Reset $97, Wingman $197)",
      "Promo code PODCAST40 mentioned correctly",
    ],
  },
];

const AREA_COLORS: Record<string, string> = {
  "Onboarding":      "hsl(268 52% 68%)",
  "Core Tools":      "hsl(190 55% 60%)",
  "Wingman Studio":  "hsl(348 55% 65%)",
  "Data & Trust":    "hsl(142 55% 60%)",
  "Conversion":      "hsl(43 65% 65%)",
  "Mobile":          "hsl(228 40% 65%)",
  "AI Health":       "hsl(15 80% 60%)",
};

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
            Critical paths to run before any major launch or user push. Check off as you go — state resets on page refresh.
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-foreground">{doneCount}/{totalCount}</p>
          <p className="text-xs text-muted-foreground/50">flows verified</p>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(142_55%_60%)] transition-all duration-500"
          style={{ width: `${(doneCount / totalCount) * 100}%` }}
        />
      </div>
      <div className="space-y-3">
        {TEST_FLOWS.map(flow => {
          const done = checked.has(flow.id);
          const color = AREA_COLORS[flow.area] ?? "hsl(268 52% 68%)";
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
                      style={{ color, borderColor: color.replace(")", " / 0.3)"), background: color.replace(")", " / 0.1)") }}>
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
  useMeta("Founder Dashboard", "NLDC Founder Dashboard — live app data.");

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const keyParam = params.get("key");
  const [authenticated, setAuthenticated] = useState(keyParam === FOUNDER_KEY);

  if (!authenticated) {
    return (
      <AppLayout>
        <LockedView onSubmit={() => setAuthenticated(true)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}
