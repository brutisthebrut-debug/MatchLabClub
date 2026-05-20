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
  alert: boolean;
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
  alerts: { toolName: string; recentTotal: number; recentFirstTrySuccessRate: number }[];
}

export const getAiMetrics = () =>
  get<AiMetricsResponse>("/founder/ai-metrics");

export const getLeads = () =>
  get<Lead[]>("/leads");

export const getPurchaseInterestList = () =>
  get<PurchaseInterest[]>("/purchase-interest");
