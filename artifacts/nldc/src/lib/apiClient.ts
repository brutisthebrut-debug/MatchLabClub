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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
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

export const getFounderStats = () =>
  get<FounderStats>("/founder/stats");

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
  alerts: { toolName: string; recentTotal: number; recentFirstTrySuccessRate: number }[];
}

export const getAiMetrics = () =>
  get<AiMetricsResponse>("/founder/ai-metrics");

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

export const getAiMetricsTrends = (days: number) =>
  get<AiMetricsTrendsResponse>(`/founder/ai-metrics/trends?days=${encodeURIComponent(String(days))}`);

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

export const getLeads = () =>
  get<Lead[]>("/leads");

export const getPurchaseInterestList = () =>
  get<PurchaseInterest[]>("/purchase-interest");
