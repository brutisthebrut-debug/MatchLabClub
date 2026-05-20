const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

export interface LeadInput {
  firstName?: string | null;
  email: string;
  source: string;
  interest?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PurchaseInterestInput {
  firstName?: string | null;
  email: string;
  product: string;
  amountCents: number;
  source?: string | null;
}

export interface FounderStats {
  leads: number;
  purchaseInterest: number;
  audits: number;
  waitlist: number;
  messages: number;
  followUpSnoozeCount: number;
  followUpDismissCount: number;
}

export interface Lead {
  id: number;
  firstName: string | null;
  email: string;
  source: string;
  interest: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PurchaseInterest {
  id: number;
  firstName: string | null;
  email: string;
  product: string;
  amountCents: number;
  source: string | null;
  status: string;
  createdAt: string;
}

export const captureLead = (data: LeadInput) =>
  post<Lead>("/leads", data);

export const capturePurchaseInterest = (data: PurchaseInterestInput) =>
  post<PurchaseInterest>("/purchase-interest", data);

export const getFounderStats = (founderKey: string) =>
  get<FounderStats>("/founder/stats", { headers: { "x-founder-key": founderKey } });

export interface AiToolMetric {
  toolName: string;
  total: number;
  firstTryOk: number;
  retriedOk: number;
  fallbacks: number;
  validationFailures: number;
  firstTrySuccessRate: number;
  overallSuccessRate: number;
  avgAttempts: number;
  avgDurationMs: number;
  recent: {
    windowSize: number;
    total: number;
    firstTryOk: number;
    fallbacks: number;
    firstTrySuccessRate: number;
  };
  last24h: {
    total: number;
    fallbacks: number;
    fallbackRate: number;
  };
  last7d: {
    total: number;
    fallbacks: number;
    fallbackRate: number;
  };
  effectiveThreshold: {
    windowSize: number;
    minSample: number;
    firstTrySuccessRate: number;
    isOverride: boolean;
  };
  alert: boolean;
  inCooldown: boolean;
  cooldownEndsAt: string | null;
  cooldownRemainingMs: number | null;
}
export interface AiThresholdConfig {
  windowSize: number;
  minSample: number;
  firstTrySuccessRate: number;
}
export interface AiPerToolThreshold extends AiThresholdConfig {
  toolName: string;
}
export interface AiThresholdsResponse {
  global: AiThresholdConfig;
  perTool: AiPerToolThreshold[];
  defaults: AiThresholdConfig;
}
export interface AiToolCooldownState {
  toolName: string;
  inCooldown: boolean;
  lastClearedAt: string;
  cooldownEndsAt: string;
  cooldownRemainingMs: number;
  rebreachedDuringCooldown: boolean;
}

export interface AiMetricsResponse {
  overall: {
    total: number;
    firstTryOk: number;
    retriedOk: number;
    fallbacks: number;
    firstTrySuccessRate: number;
    overallSuccessRate: number;
    avgAttempts: number;
    avgDurationMs: number;
  };
  perTool: AiToolMetric[];
  alertThreshold: {
    windowSize: number;
    minSample: number;
    firstTrySuccessRate: number;
  };
  perToolOverrides: AiPerToolThreshold[];
  cooldownStates: AiToolCooldownState[];
  mailerHealth: {
    toolName: string;
    consecutiveSendFailures: number;
    lastSendFailureAt: string | null;
    lastSendFailureMessage: string | null;
  }[];
  alerts: {
    toolName: string;
    recentTotal: number;
    recentFirstTrySuccessRate: number;
    reason: string;
    suppressedByCooldown: boolean;
  }[];
}

export const getAiMetrics = (founderKey: string) =>
  get<AiMetricsResponse>("/founder/ai-metrics", { headers: { "x-founder-key": founderKey } });

export interface RollupHeartbeatResponse {
  lastSuccessAt: string | null;
  ageMs: number | null;
  staleThresholdMs: number;
  stale: boolean;
}

export const getRollupHeartbeat = (founderKey: string) =>
  get<RollupHeartbeatResponse>("/founder/rollup-heartbeat", { headers: { "x-founder-key": founderKey } });

export interface BackgroundJobStatus {
  jobName: string;
  lastSuccessAt: string | null;
  ageMs: number | null;
  staleThresholdMs: number;
  stale: boolean;
}

export interface BackgroundJobsResponse {
  jobs: BackgroundJobStatus[];
}

export const getBackgroundJobs = (founderKey: string) =>
  get<BackgroundJobsResponse>("/founder/background-jobs", { headers: { "x-founder-key": founderKey } });

export interface AiMetricsTrendPoint {
  day: string;
  toolName: string;
  total: number;
  firstTryOk: number;
  retriedOk: number;
  fallbacks: number;
  validationFailures: number;
  firstTrySuccessRate: number;
  overallSuccessRate: number;
  fallbackRate: number;
  avgAttempts: number;
  avgDurationMs: number;
}
export interface AiMetricsTrendsResponse {
  days: number;
  since: string;
  series: AiMetricsTrendPoint[];
}

export const getAiMetricsTrends = (founderKey: string, days: number) =>
  get<AiMetricsTrendsResponse>(`/founder/ai-metrics/trends?days=${encodeURIComponent(String(days))}`, { headers: { "x-founder-key": founderKey } });

export const getAiThresholds = (founderKey: string) =>
  fetch(`${BASE}/founder/ai-thresholds`, {
    headers: { "x-founder-key": founderKey },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`GET /founder/ai-thresholds failed (${res.status})`);
    return res.json() as Promise<AiThresholdsResponse>;
  });

export interface AiThresholdsUpdate {
  global?: AiThresholdConfig;
  perTool?: AiPerToolThreshold[];
  resetGlobal?: boolean;
  removeToolNames?: string[];
}

export const updateAiThresholds = (founderKey: string, body: AiThresholdsUpdate) =>
  fetch(`${BASE}/founder/ai-thresholds`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-founder-key": founderKey,
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT /founder/ai-thresholds failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<{ global: AiThresholdConfig; perTool: AiPerToolThreshold[] }>;
  });

export interface AiThresholdChange {
  id: number;
  toolName: string;
  action: string;
  oldWindowSize: number | null;
  oldMinSample: number | null;
  oldFirstTrySuccessRate: number | null;
  newWindowSize: number | null;
  newMinSample: number | null;
  newFirstTrySuccessRate: number | null;
  createdAt: string;
}
export interface AiThresholdChangesResponse {
  changes: AiThresholdChange[];
}

export const getAiThresholdChanges = (founderKey: string, limit = 10) =>
  fetch(`${BASE}/founder/ai-threshold-changes?limit=${encodeURIComponent(String(limit))}`, {
    headers: { "x-founder-key": founderKey },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`GET /founder/ai-threshold-changes failed (${res.status})`);
    return res.json() as Promise<AiThresholdChangesResponse>;
  });

export interface UndoAiThresholdChangeResponse {
  undoneId: number;
  undoAction: "create" | "update" | "remove" | "reset";
  global: AiThresholdConfig;
  perTool: AiPerToolThreshold[];
}

export const undoAiThresholdChange = (founderKey: string, id: number) =>
  fetch(`${BASE}/founder/ai-threshold-changes/${encodeURIComponent(String(id))}/undo`, {
    method: "POST",
    headers: { "x-founder-key": founderKey },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`POST /founder/ai-threshold-changes/${id}/undo failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<UndoAiThresholdChangeResponse>;
  });

export type OcrCorrectionFieldName = "firstName" | "age" | "sourceApp" | "bio" | "prompts";
export type OcrMismatchesWindow = 7 | 30 | 90 | null;
export type OcrMismatchesSort = "total" | "top";

export interface OcrPerFieldEntry {
  field: OcrCorrectionFieldName;
  correctionsCount: number;
  topDiffCount: number;
  topDiffs: { example: string; count: number }[];
}
export interface OcrRecentEntry {
  auditId: number;
  field: OcrCorrectionFieldName;
  raw: string;
  corrected: string;
  createdAt: string;
}
export interface OcrMismatchesResponse {
  summary: {
    totalScreenshotAudits: number;
    auditsWithRawOcr: number;
    auditsWithCorrections: number;
    sampleSize: number;
    windowDays: number | null;
    since: string | null;
    sort: OcrMismatchesSort;
  };
  perField: OcrPerFieldEntry[];
  recent: OcrRecentEntry[];
}

export const getOcrMismatches = (
  founderKey: string,
  params: { window?: OcrMismatchesWindow; sort?: OcrMismatchesSort } = {},
) => {
  const search = new URLSearchParams();
  if (params.window) search.set("window", String(params.window));
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return get<OcrMismatchesResponse>(
    `/founder/ocr-mismatches${qs ? `?${qs}` : ""}`,
    { headers: { "x-founder-key": founderKey } },
  );
};

export interface OcrLearnedRule {
  id: string;
  kind: string;
  pattern: string;
  replacement: string;
  scope: string | null;
  occurrences: number;
  status: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  learnedAt: string;
  updatedAt: string;
}

export interface OcrLearnedRulesResponse {
  rules: OcrLearnedRule[];
}

export interface OcrLearnResult {
  scannedAudits: number;
  candidates: number;
  persisted: number;
}

export interface OcrRuleReviewLogEntry {
  id: number;
  ruleId: string;
  action: string;
  reviewedBy: string;
  reviewedAt: string;
  kind: string;
  pattern: string;
  replacement: string;
}

export interface OcrRuleReviewLogResponse {
  log: OcrRuleReviewLogEntry[];
}

export const getOcrLearnedRules = (founderKey: string) =>
  get<OcrLearnedRulesResponse>("/founder/ocr-rules", {
    headers: { "x-founder-key": founderKey },
  });

export const getOcrPendingRules = (founderKey: string) =>
  get<OcrLearnedRulesResponse>("/founder/ocr-pending-rules", {
    headers: { "x-founder-key": founderKey },
  });

export const approveOcrRule = async (founderKey: string, id: string): Promise<{ rule: OcrLearnedRule }> => {
  const res = await fetch(`${BASE}/founder/ocr-pending-rules/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /founder/ocr-pending-rules/${id}/approve failed (${res.status}): ${text}`);
  }
  return res.json();
};

export const rejectOcrRule = async (founderKey: string, id: string): Promise<{ rule: OcrLearnedRule }> => {
  const res = await fetch(`${BASE}/founder/ocr-pending-rules/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /founder/ocr-pending-rules/${id}/reject failed (${res.status}): ${text}`);
  }
  return res.json();
};

export const getOcrRuleReviewLog = (founderKey: string, limit = 50) =>
  get<OcrRuleReviewLogResponse>(
    `/founder/ocr-rule-review-log?limit=${encodeURIComponent(String(limit))}`,
    { headers: { "x-founder-key": founderKey } },
  );

export const runOcrLearn = async (founderKey: string): Promise<OcrLearnResult> => {
  const res = await fetch(`${BASE}/founder/ocr-learn`, {
    method: "POST",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /founder/ocr-learn failed (${res.status}): ${text}`);
  }
  return res.json();
};

export interface OcrAuditDetail {
  id: number;
  createdAt: string;
  source: string;
  status: string;
  readinessScore: number | null;
  rawOcrText: string | null;
  ocrCorrections: Partial<Record<OcrCorrectionFieldName, { raw: unknown; corrected: unknown }>> | null;
  profile: {
    firstName: string;
    age: number;
    gender: string;
    orientation: string | null;
    datingGoal: string;
    currentApps: string[];
    sourceApp: string | null;
    bio: string;
    prompts: string | null;
  };
}

export const getOcrAuditDetail = (founderKey: string, auditId: number) =>
  get<OcrAuditDetail>(`/founder/ocr-mismatches/${auditId}`, {
    headers: { "x-founder-key": founderKey },
  });

export const deleteOcrRule = async (founderKey: string, id: string): Promise<void> => {
  const res = await fetch(`${BASE}/founder/ocr-rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE /founder/ocr-rules/:id failed (${res.status}): ${text}`);
  }
};

export const patchOcrRule = async (
  founderKey: string,
  id: string,
): Promise<{ rule: OcrLearnedRule }> => {
  const res = await fetch(`${BASE}/founder/ocr-rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PATCH /founder/ocr-rules/:id failed (${res.status}): ${text}`);
  }
  return res.json();
};

export const clearOcrLearnedRules = async (
  founderKey: string,
): Promise<{ deleted: number; preserved: number }> => {
  const res = await fetch(`${BASE}/founder/ocr-rules`, {
    method: "DELETE",
    headers: { "x-founder-key": founderKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE /founder/ocr-rules failed (${res.status}): ${text}`);
  }
  return res.json();
};

export interface OcrMismatchTrendEntry {
  day: string;
  firstName: number;
  age: number;
  sourceApp: number;
  bio: number;
  prompts: number;
  total: number;
}

export interface OcrMismatchesTrendsResponse {
  days: number;
  since: string;
  series: OcrMismatchTrendEntry[];
}

export const getOcrMismatchesTrends = (
  founderKey: string,
  params: { days?: number } = {},
) => {
  const search = new URLSearchParams();
  if (params.days) search.set("days", String(params.days));
  const qs = search.toString();
  return get<OcrMismatchesTrendsResponse>(
    `/founder/ocr-mismatches/trends${qs ? `?${qs}` : ""}`,
    { headers: { "x-founder-key": founderKey } },
  );
};

export const getLeads = () =>
  get<Lead[]>("/leads");

export const getPurchaseInterestList = () =>
  get<PurchaseInterest[]>("/purchase-interest");

export type OcrCorrectionField = OcrCorrectionFieldName;

export interface AlertSettingsResponse {
  rebreachCooldownMinutes: number;
  envMinutes: number;
  defaultMinutes: number;
  isOverridden: boolean;
  updatedAt: string | null;
}

export const getAlertSettings = (founderKey: string) =>
  fetch(`${BASE}/founder/alert-settings`, {
    headers: { "x-founder-key": founderKey },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`GET /founder/alert-settings failed (${res.status})`);
    return res.json() as Promise<AlertSettingsResponse>;
  });

export const updateAlertSettings = (founderKey: string, rebreachCooldownMinutes: number) =>
  fetch(`${BASE}/founder/alert-settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-founder-key": founderKey,
    },
    body: JSON.stringify({ rebreachCooldownMinutes }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`PUT /founder/alert-settings failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<AlertSettingsResponse>;
  });

export const resetAlertSettings = (founderKey: string) =>
  fetch(`${BASE}/founder/alert-settings/rebreach-cooldown`, {
    method: "DELETE",
    headers: { "x-founder-key": founderKey },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DELETE /founder/alert-settings/rebreach-cooldown failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<AlertSettingsResponse>;
  });
