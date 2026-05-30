import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockSetLocation = vi.hoisted(() => vi.fn<(location: string) => void>());

// Mock the auth hook so we can flip from anonymous -> authenticated mid-test.
let authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string | null } | null;
} = { isAuthenticated: false, isLoading: false, user: null };

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => authState,
}));

// Spy on toast so the replay test can assert on the 'already_used' branch.
// Mocking the module keeps ToastAction from needing a real shadcn Toaster
// context in jsdom.
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  ToastAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["", mockSetLocation],
}));

// IMPORTANT: import AFTER the mock is registered.
import {
  useCreateAudit,
  useListAudits,
  useListInsights,
  useCreateInsight,
  useRecordCoachFollowUp,
  type Audit,
  type EmailInsight,
} from "@workspace/api-client-react";
import { useClaimAnonymousOnLogin } from "@/hooks/useClaimAnonymousOnLogin";
import {
  rememberAnonymousId,
  readAnonymousIds,
  hasAnyAnonymousIds,
} from "@/lib/anonymousIds";
import {
  buildHandoffShareUrl,
  encodePendingHandoffParam,
} from "@/lib/handoffLink";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Fetch mock: simulates the server side of the claim flow.
// ---------------------------------------------------------------------------

interface StoredAudit {
  audit: Audit;
  userId: string | null;
  anonToken: string | null;
}

interface StoredFollowUp {
  id: number;
  userId: string | null;
  answer: string;
  anonToken: string | null;
}

interface StoredInsight {
  insight: EmailInsight;
  userId: string | null;
  anonToken: string | null;
}

interface ServerState {
  audits: StoredAudit[];
  followUps: StoredFollowUp[];
  insights: StoredInsight[];
  nextId: number;
  nextFollowUpId: number;
  nextInsightId: number;
  claimCalls: number;
  lastClaimBody: Record<string, unknown> | null;
  redeemCalls: number;
  lastRedeemBody: Record<string, unknown> | null;
  lastClaimResponse: {
    claimed: {
      audits: number;
      profiles: number;
      messages: number;
      insights: number;
      followUps: number;
    };
  } | null;
  lastRedeemResponse: {
    claimed: {
      audits: number;
      profiles: number;
      messages: number;
      insights: number;
      followUps: number;
    };
  } | null;
  usedHandoffTokens: Set<string>;
}

const server: ServerState = {
  audits: [],
  followUps: [],
  insights: [],
  nextId: 1,
  nextFollowUpId: 1,
  nextInsightId: 1,
  claimCalls: 0,
  lastClaimBody: null,
  redeemCalls: 0,
  lastRedeemBody: null,
  lastClaimResponse: null,
  lastRedeemResponse: null,
  usedHandoffTokens: new Set(),
};

// Simulates the value of the browser's `anon_claim` cookie. The real server
// reads this from a cookie header; our fetch mock has no cookies, so we model
// "which anonymous browser is calling" as a test-controlled variable. Set to
// null when the active browser has never been tagged as anonymous (e.g. a
// fresh second device opening a handoff link).
let currentAnonToken: string | null = null;

const HANDOFF_PREFIX = "mockhandoff";

function mintHandoffToken(anonToken: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  // Random suffix so successive issues for the same anon token mint distinct
  // strings (mirrors the real server's per-issue `jti`).
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${HANDOFF_PREFIX}.${anonToken}.${expiresAt}.${nonce}`;
}

interface ParsedHandoff {
  ok: true;
  anonToken: string;
  raw: string;
}

interface ParsedHandoffError {
  ok: false;
  reason: "malformed" | "expired";
}

function parseHandoffToken(raw: unknown): ParsedHandoff | ParsedHandoffError {
  if (typeof raw !== "string") return { ok: false, reason: "malformed" };
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== HANDOFF_PREFIX) {
    return { ok: false, reason: "malformed" };
  }
  const anonToken = parts[1]!;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp)) return { ok: false, reason: "malformed" };
  if (exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, anonToken, raw };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetchMock(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

      // GET /api/audits — list visible audits for the current "user".
      if (method === "GET" && url.endsWith("/api/audits")) {
        const currentUserId = authState.isAuthenticated ? authState.user!.id : null;
        const visible = server.audits
          .filter((row) => row.userId === currentUserId)
          .map((row) => row.audit);
        return jsonResponse(200, visible);
      }

      // POST /api/audits — create an audit. Authed -> owned, anon -> userId=null.
      if (method === "POST" && url.endsWith("/api/audits")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const audit: Audit = {
          id: server.nextId++,
          firstName: body.firstName ?? "Anon",
          age: body.age ?? 30,
          gender: body.gender ?? "x",
          datingGoal: body.datingGoal ?? "find a relationship",
          currentApps: body.currentApps ?? [],
          bio: body.bio ?? "",
          prompts: body.prompts ?? null,
          source: body.source ?? null,
          status: "pending",
          readinessScore: null,
          createdAt: new Date().toISOString(),
        };
        server.audits.push({
          audit,
          userId: authState.isAuthenticated ? authState.user!.id : null,
          anonToken: authState.isAuthenticated ? null : currentAnonToken,
        });
        return jsonResponse(201, audit);
      }

      // GET /api/insights — list visible insights for the current "user".
      if (method === "GET" && url.endsWith("/api/insights")) {
        const currentUserId = authState.isAuthenticated ? authState.user!.id : null;
        const visible = server.insights
          .filter((row) => row.userId === currentUserId)
          .map((row) => row.insight);
        return jsonResponse(200, visible);
      }

      // POST /api/insights — create an insight. Authed -> owned, anon -> userId=null.
      if (method === "POST" && url.endsWith("/api/insights")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const insight: EmailInsight = {
          id: server.nextInsightId++,
          sourceLabel: body.sourceLabel ?? "My messages",
          sourceApp: body.sourceApp ?? null,
          pastedContent: body.pastedContent ?? "",
          consentGiven: body.consentGiven ?? false,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        server.insights.push({
          insight,
          userId: authState.isAuthenticated ? authState.user!.id : null,
          anonToken: authState.isAuthenticated ? null : currentAnonToken,
        });
        return jsonResponse(201, insight);
      }

      // POST /api/coach/follow-ups — record a follow-up. Authed -> owned, anon -> userId=null.
      if (method === "POST" && url.endsWith("/api/coach/follow-ups")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const followUp: StoredFollowUp = {
          id: server.nextFollowUpId++,
          userId: authState.isAuthenticated ? authState.user!.id : null,
          answer: body.answer ?? "sent",
          anonToken: authState.isAuthenticated ? null : currentAnonToken,
        };
        server.followUps.push(followUp);
        return jsonResponse(200, {
          followUpId: followUp.id,
          totalPrompts: 1,
          sentCount: followUp.answer === "sent" ? 1 : 0,
          notSentCount: followUp.answer === "not_sent" ? 1 : 0,
          snoozeCount: 0,
          dismissCount: 0,
          lastAnsweredAt: new Date().toISOString(),
          lastAnswer: followUp.answer === "sent" || followUp.answer === "not_sent"
            ? followUp.answer
            : null,
        });
      }

      // POST /api/claim-anonymous — reassign anon rows to the current user.
      if (method === "POST" && url.endsWith("/api/claim-anonymous")) {
        server.claimCalls += 1;
        if (!authState.isAuthenticated) {
          return jsonResponse(401, { error: "Not authenticated" });
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        server.lastClaimBody = body;
        const ids: number[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        const followUpIds: number[] = Array.isArray(body.followUpIds) ? body.followUpIds : [];
        // The cookie-scoped endpoint only claims rows tagged with the caller's
        // anon cookie. When `currentAnonToken` is null the caller has no
        // cookie, which matches no rows (see "no cookie" branch).
        let claimed = 0;
        for (const row of server.audits) {
          if (
            ids.includes(row.audit.id) &&
            row.userId === null &&
            row.anonToken !== null &&
            row.anonToken === currentAnonToken
          ) {
            row.userId = authState.user!.id;
            row.anonToken = null;
            claimed += 1;
          }
        }
        let claimedFollowUps = 0;
        for (const fu of server.followUps) {
          if (
            followUpIds.includes(fu.id) &&
            fu.userId === null &&
            fu.anonToken !== null &&
            fu.anonToken === currentAnonToken
          ) {
            fu.userId = authState.user!.id;
            fu.anonToken = null;
            claimedFollowUps += 1;
          }
        }
        const insightIds: number[] = Array.isArray(body.insightIds)
          ? body.insightIds
          : [];
        let claimedInsights = 0;
        for (const row of server.insights) {
          if (
            insightIds.includes(row.insight.id) &&
            row.userId === null &&
            row.anonToken !== null &&
            row.anonToken === currentAnonToken
          ) {
            row.userId = authState.user!.id;
            row.anonToken = null;
            claimedInsights += 1;
          }
        }
        const response = {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: claimedInsights,
            followUps: claimedFollowUps,
          },
        };
        server.lastClaimResponse = response;
        return jsonResponse(200, response);
      }

      // POST /api/claim-anonymous/handoff/issue — mint a signed token derived
      // from the calling browser's anon cookie. No auth required.
      if (
        method === "POST" &&
        url.endsWith("/api/claim-anonymous/handoff/issue")
      ) {
        if (!currentAnonToken) {
          return jsonResponse(400, { error: "No anonymous data to hand off" });
        }
        const ttlMs = 15 * 60 * 1000;
        const handoff = mintHandoffToken(currentAnonToken, ttlMs);
        return jsonResponse(200, {
          handoff,
          expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        });
      }

      // POST /api/claim-anonymous/handoff/redeem — claim rows using a signed
      // handoff token instead of the browser cookie. Requires auth.
      if (
        method === "POST" &&
        url.endsWith("/api/claim-anonymous/handoff/redeem")
      ) {
        server.redeemCalls += 1;
        if (!authState.isAuthenticated) {
          return jsonResponse(401, { error: "Not authenticated" });
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        server.lastRedeemBody = body;
        const parsed = parseHandoffToken(body.handoff);
        if (!parsed.ok) {
          return jsonResponse(400, {
            error: "Invalid or expired handoff token",
          });
        }
        if (server.usedHandoffTokens.has(parsed.raw)) {
          return jsonResponse(400, {
            error: "This handoff link has already been used",
          });
        }
        server.usedHandoffTokens.add(parsed.raw);
        const ids: number[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        const followUpIds: number[] = Array.isArray(body.followUpIds)
          ? body.followUpIds
          : [];
        const insightIds: number[] = Array.isArray(body.insightIds)
          ? body.insightIds
          : [];
        let claimed = 0;
        for (const row of server.audits) {
          if (
            ids.includes(row.audit.id) &&
            row.userId === null &&
            row.anonToken === parsed.anonToken
          ) {
            row.userId = authState.user!.id;
            row.anonToken = null;
            claimed += 1;
          }
        }
        let claimedFollowUps = 0;
        for (const fu of server.followUps) {
          if (
            followUpIds.includes(fu.id) &&
            fu.userId === null &&
            fu.anonToken === parsed.anonToken
          ) {
            fu.userId = authState.user!.id;
            fu.anonToken = null;
            claimedFollowUps += 1;
          }
        }
        let claimedInsights = 0;
        for (const row of server.insights) {
          if (
            insightIds.includes(row.insight.id) &&
            row.userId === null &&
            row.anonToken === parsed.anonToken
          ) {
            row.userId = authState.user!.id;
            row.anonToken = null;
            claimedInsights += 1;
          }
        }
        const response = {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: claimedInsights,
            followUps: claimedFollowUps,
          },
        };
        server.lastRedeemResponse = response;
        return jsonResponse(200, response);
      }

      return jsonResponse(404, { error: `unhandled ${method} ${url}` });
    }),
  );
}

// ---------------------------------------------------------------------------
// Tiny harness components that exercise the real generated hooks.
// ---------------------------------------------------------------------------

function AnonAuditCreator({ onCreated }: { onCreated: (id: number) => void }) {
  const create = useCreateAudit();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    create.mutate(
      {
        data: {
          firstName: "Riley",
          age: 29,
          gender: "x",
          orientation: "unspecified",
          datingGoal: "find a relationship",
          currentApps: [],
          bio: "writer + climber",
        },
      },
      {
        onSuccess: (audit) => {
          rememberAnonymousId("audits", audit.id);
          onCreated(audit.id);
        },
      },
    );
    // We deliberately omit `create` from deps — its identity changes per render
    // but firedRef prevents a re-fire loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function DashboardAuditList() {
  useClaimAnonymousOnLogin();
  const { data: audits } = useListAudits();
  return (
    <ul data-testid="audit-list">
      {(audits ?? []).map((a) => (
        <li key={a.id} data-testid={`audit-${a.id}`}>
          {a.firstName} (#{a.id})
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let qc: QueryClient;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  server.audits = [];
  server.followUps = [];
  server.insights = [];
  server.nextId = 1;
  server.nextFollowUpId = 1;
  server.nextInsightId = 1;
  server.claimCalls = 0;
  server.lastClaimBody = null;
  server.redeemCalls = 0;
  server.lastRedeemBody = null;
  server.lastClaimResponse = null;
  server.lastRedeemResponse = null;
  server.usedHandoffTokens = new Set();
  // Default to a tagged anonymous browser; cross-device tests explicitly
  // clear this via `switchToFreshBrowser()` to model an untagged second device.
  currentAnonToken = "anon-default-browser";
  authState = { isAuthenticated: false, isLoading: false, user: null };
  vi.mocked(toast).mockClear();
  mockSetLocation.mockClear();
  window.history.replaceState(null, "", "/");
  installFetchMock();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// The e2e-shaped integration test the task calls for:
//   "create an anonymous audit -> log in -> confirm the audit appears in the
//    dashboard list".
// ---------------------------------------------------------------------------

describe("Anonymous audit follows the user into their account", () => {
  it("anon-created audit shows up in the dashboard after login + claim", async () => {
    let createdId: number | undefined;

    // 1) Anonymous visitor creates an audit via the real useCreateAudit hook.
    const created = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdId).toBeDefined());
    expect(hasAnyAnonymousIds()).toBe(true);
    expect(server.audits).toHaveLength(1);
    expect(server.audits[0]!.userId).toBeNull();

    // Tear down the anonymous tree before flipping auth so the dashboard
    // mounts cleanly under the new auth state (the way a fresh page load
    // would after redirecting back from the login provider).
    created.unmount();

    // 2) The user logs in — auth context flips to authenticated.
    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-xyz", email: null },
      };
    });

    // 3) Dashboard mounts. useClaimAnonymousOnLogin fires the claim mutation,
    //    which the mock server applies to the in-memory store, then
    //    useListAudits refetches.
    render(
      <Wrap>
        <DashboardAuditList />
      </Wrap>,
    );

    // 4) The previously-anonymous audit appears in the dashboard list.
    await waitFor(() => {
      expect(screen.getByTestId(`audit-${createdId}`)).toBeTruthy();
    });

    // Claim endpoint was hit exactly once, with the id we created anonymously.
    expect(server.claimCalls).toBe(1);

    // Ownership was transferred in the store.
    const stored = server.audits.find((row) => row.audit.id === createdId);
    expect(stored?.userId).toBe("user-xyz");

    // localStorage hand-off cleared after a successful claim.
    expect(hasAnyAnonymousIds()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Anonymous coach follow-ups follow the user into their account too.
// Models the new Coach.tsx persistence path: while anonymous, the new
// follow-up's id is written to localStorage; on login the claim mutation
// hands those ids to the server and the rows are reassigned.
// ---------------------------------------------------------------------------

function AnonFollowUpRecorder({ onRecorded }: { onRecorded: (id: number) => void }) {
  const record = useRecordCoachFollowUp();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    record.mutate(
      { data: { answer: "sent", sessionId: null } },
      {
        onSuccess: (recorded) => {
          rememberAnonymousId("followUps", recorded.followUpId);
          onRecorded(recorded.followUpId);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ClaimOnly() {
  useClaimAnonymousOnLogin();
  return null;
}

function AnonInsightCreator({ onCreated }: { onCreated: (id: number) => void }) {
  const create = useCreateInsight();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    create.mutate(
      {
        data: {
          sourceLabel: "Hinge chat",
          pastedContent: "Hey! How's it going?",
          consentGiven: true,
        },
      },
      {
        onSuccess: (insight) => {
          rememberAnonymousId("insights", insight.id);
          onCreated(insight.id);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function InsightList() {
  useClaimAnonymousOnLogin();
  const { data: insights } = useListInsights();
  return (
    <ul data-testid="insight-list">
      {(insights ?? []).map((ins) => (
        <li key={ins.id} data-testid={`insight-${ins.id}`}>
          {ins.sourceLabel} (#{ins.id})
        </li>
      ))}
    </ul>
  );
}

describe("Anonymous coach follow-up follows the user into their account", () => {
  it("anon-recorded follow-up id is persisted, sent on claim, and reassigned", async () => {
    let recordedId: number | undefined;

    // 1) Anonymous visitor records a "did you send it?" answer.
    const anon = render(
      <Wrap>
        <AnonFollowUpRecorder onRecorded={(id) => (recordedId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(recordedId).toBeDefined());
    expect(server.followUps).toHaveLength(1);
    expect(server.followUps[0]!.userId).toBeNull();
    expect(readAnonymousIds().followUpIds).toEqual([recordedId!]);
    expect(hasAnyAnonymousIds()).toBe(true);

    anon.unmount();

    // 2) The user logs in.
    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-followups", email: null },
      };
    });

    // 3) Claim hook fires on mount.
    render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    await waitFor(() => expect(server.claimCalls).toBe(1));

    // Claim payload included the persisted follow-up id.
    expect(server.lastClaimBody?.followUpIds).toEqual([recordedId!]);

    // Ownership transferred on the server side.
    expect(server.followUps[0]!.userId).toBe("user-followups");

    // Server response reports at least one follow-up was claimed.
    expect(server.lastClaimResponse?.claimed.followUps).toBeGreaterThanOrEqual(1);
    expect(server.lastClaimResponse?.claimed.followUps).toBe(1);

    // localStorage hand-off cleared after a successful claim.
    await waitFor(() => expect(hasAnyAnonymousIds()).toBe(false));
  });

  it("anon follow-up rides the cross-device hand-off redeem and is reassigned on device B", async () => {
    // ===== DEVICE A — anonymous, records a follow-up =====
    currentAnonToken = "anon-token-device-A";

    let recordedId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonFollowUpRecorder onRecorded={(id) => (recordedId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(recordedId).toBeDefined());
    expect(server.followUps).toHaveLength(1);
    expect(server.followUps[0]!.userId).toBeNull();
    expect(server.followUps[0]!.anonToken).toBe("anon-token-device-A");
    expect(readAnonymousIds().followUpIds).toEqual([recordedId!]);

    // Device A mints a signed hand-off token and builds the share URL.
    // buildHandoffShareUrl reads the anon ids from localStorage, so the
    // recordedId is automatically embedded in the URL payload.
    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(issueRes.status).toBe(200);
    const issueBody = (await issueRes.json()) as { handoff: string };

    const shareUrl = buildHandoffShareUrl(issueBody.handoff);
    expect(shareUrl).toContain("nldc_handoff=");

    deviceA.unmount();

    // ===== DEVICE B — fresh browser, opens the share URL =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    // Device B has no anon cookie and never recorded any anon rows.
    expect(hasAnyAnonymousIds()).toBe(false);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-B", email: null },
      };
    });

    render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    // Hand-off redeem was hit exactly once. Cookie-scoped claim must not
    // fire — device B has no anon ids in localStorage.
    await waitFor(() => expect(server.redeemCalls).toBe(1));
    expect(server.claimCalls).toBe(0);

    // Redeem payload carried the follow-up id from the URL.
    expect(server.lastRedeemBody?.followUpIds).toEqual([recordedId!]);
    expect(server.lastRedeemBody?.handoff).toBe(issueBody.handoff);

    // Server response reports the follow-up was claimed.
    expect(server.lastRedeemResponse?.claimed.followUps).toBeGreaterThanOrEqual(
      1,
    );
    expect(server.lastRedeemResponse?.claimed.followUps).toBe(1);

    // Ownership transferred on the server: the anon follow-up now belongs
    // to device B's user, with the anon token cleared.
    expect(server.followUps[0]!.userId).toBe("user-device-B");
    expect(server.followUps[0]!.anonToken).toBeNull();

    // The hand-off token was burned (single-use).
    expect(server.usedHandoffTokens.has(issueBody.handoff)).toBe(true);

    // Pending hand-off cleared from sessionStorage after a successful redeem.
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-device hand-off — the full real-browser-shaped flow.
//
// Device A (anonymous) creates an audit, mints a signed hand-off token, and
// builds a share URL. Device B (a fresh browser with no anon cookie / no
// localStorage) opens that URL, signs in, and the previously-anonymous audit
// appears in *its* dashboard list. The same flow is verified for the
// expired/invalid token case, where the audit must stay anonymous and never
// leak to device B.
// ---------------------------------------------------------------------------

/**
 * Wipe everything that represents "the browser" — local + session storage,
 * the simulated anon cookie, the URL, and the react-query cache — so the next
 * render mounts as a genuinely different device.
 */
function switchToFreshBrowser(): void {
  localStorage.clear();
  sessionStorage.clear();
  currentAnonToken = null;
  window.history.replaceState(null, "", "/");
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Simulate opening a URL in the active browser (sets window.location). */
function openUrlInActiveBrowser(shareUrl: string): void {
  const u = new URL(shareUrl, "http://localhost/");
  window.history.replaceState(
    null,
    "",
    u.pathname + (u.search ?? "") + (u.hash ?? ""),
  );
}

describe("Cross-device hand-off claim flow", () => {
  it("device A's anonymous audit appears on device B after the hand-off link is redeemed", async () => {
    // ===== DEVICE A — anonymous, creates an audit =====
    currentAnonToken = "anon-token-device-A";

    let createdId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdId).toBeDefined());
    expect(server.audits).toHaveLength(1);
    expect(server.audits[0]!.userId).toBeNull();
    expect(server.audits[0]!.anonToken).toBe("anon-token-device-A");

    // Device A asks the server for a signed hand-off token (the same call
    // HandoffShareDialog makes), then builds the share URL using the real
    // client lib so we exercise the encoder the receiving browser will decode.
    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(issueRes.status).toBe(200);
    const issueBody = (await issueRes.json()) as { handoff: string };
    expect(typeof issueBody.handoff).toBe("string");

    const shareUrl = buildHandoffShareUrl(issueBody.handoff);
    expect(shareUrl).toContain("nldc_handoff=");

    deviceA.unmount();

    // ===== DEVICE B — fresh browser, opens the share URL =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    // Device B has no anon cookie and never created any anon rows. The
    // cookie-scoped claim path must NOT fire (no anon ids in localStorage),
    // only the hand-off redeem path should.
    expect(hasAnyAnonymousIds()).toBe(false);

    // Device B signs in. Auth flips before the dashboard mounts, the way it
    // would after returning from the OIDC redirect.
    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-B", email: null },
      };
    });

    render(
      <Wrap>
        <DashboardAuditList />
      </Wrap>,
    );

    // Device A's previously-anonymous audit shows up in device B's dashboard.
    await waitFor(() => {
      expect(screen.getByTestId(`audit-${createdId}`)).toBeTruthy();
    });

    // Hand-off redeem was hit exactly once with device A's audit id and the
    // signed token from the share URL.
    expect(server.redeemCalls).toBe(1);
    expect(server.claimCalls).toBe(0);
    expect(server.lastRedeemBody?.auditIds).toEqual([createdId!]);
    expect(server.lastRedeemBody?.handoff).toBe(issueBody.handoff);

    // Ownership transferred on the server.
    const stored = server.audits.find((r) => r.audit.id === createdId);
    expect(stored?.userId).toBe("user-device-B");
    expect(stored?.anonToken).toBeNull();

    // The handoff token was burned (single-use).
    expect(server.usedHandoffTokens.has(issueBody.handoff)).toBe(true);

    // Pending handoff cleared from sessionStorage after a successful redeem.
    expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull();

    // The query-string was stripped from the address bar so the link isn't
    // accidentally re-shared from device B.
    expect(window.location.search).toBe("");
  });

  it("an expired or tampered hand-off link does NOT claim the audit on device B", async () => {
    // ===== DEVICE A — anonymous, creates an audit =====
    currentAnonToken = "anon-token-device-A";

    let createdId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );
    await waitFor(() => expect(createdId).toBeDefined());
    expect(server.audits[0]!.anonToken).toBe("anon-token-device-A");
    deviceA.unmount();

    // ===== DEVICE B — fresh browser, opens a bogus share URL =====
    switchToFreshBrowser();

    // Construct a share URL whose embedded hand-off token is structurally
    // bogus. The server-side parser will reject it as
    // "Invalid or expired handoff token", which the client classifies as
    // `invalid_or_expired`.
    const bogusParam = encodePendingHandoffParam({
      handoff: "mockhandoff.anon-token-device-A.1.tampered",
      auditIds: [createdId!],
      profileIds: [],
      messageSessionIds: [],
      insightIds: [],
      followUpIds: [],
      journalEntryIds: [],
      postDateNoteIds: [],
    });
    openUrlInActiveBrowser(`/?nldc_handoff=${bogusParam}`);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-B", email: null },
      };
    });

    render(
      <Wrap>
        <DashboardAuditList />
      </Wrap>,
    );

    // The redeem call fires, fails with 400, and the hook clears the pending
    // handoff so we don't retry the dead token on every render.
    await waitFor(() => expect(server.redeemCalls).toBe(1));
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );

    // Audit remained anonymous and still tagged with device A's token.
    const stored = server.audits.find((r) => r.audit.id === createdId);
    expect(stored?.userId).toBeNull();
    expect(stored?.anonToken).toBe("anon-token-device-A");

    // Device B's dashboard does NOT show device A's audit (no escalation).
    expect(screen.queryByTestId(`audit-${createdId}`)).toBeNull();

    // No usable token was ever issued through this path, so nothing was
    // burned in the single-use set.
    expect(server.usedHandoffTokens.size).toBe(0);
  });

  it("replaying an already-used hand-off link shows the 'already used' toast and does NOT re-claim the audit on device C", async () => {
    // ===== DEVICE A — anonymous, creates an audit and mints a hand-off token =====
    currentAnonToken = "anon-token-device-A";

    let createdId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdId).toBeDefined());
    expect(server.audits).toHaveLength(1);
    expect(server.audits[0]!.userId).toBeNull();
    expect(server.audits[0]!.anonToken).toBe("anon-token-device-A");

    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(issueRes.status).toBe(200);
    const issueBody = (await issueRes.json()) as { handoff: string };
    const shareUrl = buildHandoffShareUrl(issueBody.handoff);

    deviceA.unmount();

    // ===== DEVICE B — first redemption (the happy path, consumes the token) =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-B", email: null },
      };
    });

    const deviceB = render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    // Wait for device B's redeem to complete and burn the token.
    await waitFor(() => expect(server.redeemCalls).toBe(1));
    expect(server.audits[0]!.userId).toBe("user-device-B");
    expect(server.usedHandoffTokens.has(issueBody.handoff)).toBe(true);

    // Pending hand-off is cleared from sessionStorage after a successful redeem.
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );

    deviceB.unmount();

    // ===== DEVICE C — fresh browser, replays the same share URL =====
    switchToFreshBrowser();
    // Device C (a third device, or device B on a second visit) opens the
    // exact same share URL whose token was already burned by device B.
    openUrlInActiveBrowser(shareUrl);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-C", email: null },
      };
    });

    render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    // The redeem call fires again — but the server rejects it as "already used".
    await waitFor(() => expect(server.redeemCalls).toBe(2));

    // The hook classifies the error as 'already_used' and shows the right toast.
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "This link was already used" }),
      ),
    );

    // The "Start fresh" CTA was included in the toast.
    const toastCall = vi.mocked(toast).mock.calls.find((args) =>
      (args[0] as { title?: string }).title === "This link was already used",
    );
    expect(toastCall).toBeDefined();
    const toastArg = toastCall![0] as { action?: React.ReactElement };
    expect(toastArg.action).toBeDefined();

    // The audit was NOT re-claimed by device C — it still belongs to device B.
    const stored = server.audits.find((r) => r.audit.id === createdId);
    expect(stored?.userId).toBe("user-device-B");
    expect(stored?.anonToken).toBeNull();

    // The single-use set still has exactly one entry (no double-burn).
    expect(server.usedHandoffTokens.size).toBe(1);

    // Pending hand-off is cleared from sessionStorage on device C too, so
    // the dead token is not retried on subsequent renders.
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );

    // The cookie-scoped claim must never have fired on any device —
    // none of them had anonymous ids in localStorage.
    expect(server.claimCalls).toBe(0);
  });

  it("clicking 'Start fresh' in the already-used toast navigates to /start", async () => {
    // ===== DEVICE A — anonymous, creates an audit and mints a hand-off token =====
    currentAnonToken = "anon-token-device-A";

    let createdId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdId).toBeDefined());

    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const issueBody = (await issueRes.json()) as { handoff: string };
    const shareUrl = buildHandoffShareUrl(issueBody.handoff);

    deviceA.unmount();

    // ===== DEVICE B — redeems and burns the token =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-B", email: null },
      };
    });

    const deviceB = render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    await waitFor(() => expect(server.redeemCalls).toBe(1));
    expect(server.usedHandoffTokens.has(issueBody.handoff)).toBe(true);
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );

    deviceB.unmount();

    // ===== DEVICE C — replays the burned link, triggering the already-used toast =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-device-C", email: null },
      };
    });

    render(
      <Wrap>
        <ClaimOnly />
      </Wrap>,
    );

    // Wait for the already-used toast to fire.
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: "This link was already used" }),
      ),
    );

    // Extract the action element from the toast call and render it in isolation.
    const toastCall = vi.mocked(toast).mock.calls.find(
      (args) =>
        (args[0] as { title?: string }).title === "This link was already used",
    );
    expect(toastCall).toBeDefined();
    const actionElement = (
      toastCall![0] as { action?: React.ReactElement }
    ).action;
    expect(actionElement).toBeDefined();

    const { getByRole } = render(<>{actionElement}</>);
    const btn = getByRole("button", { name: /start fresh/i });

    // Click the CTA.
    fireEvent.click(btn);

    // Navigation must have been directed to /start.
    expect(mockSetLocation).toHaveBeenCalledWith("/start");
  });
});

// ---------------------------------------------------------------------------
// Cross-device hand-off for Email Insights
//
// Device A (anonymous) creates an Email Insight, mints a signed hand-off
// token, and builds a share URL. Device B (a fresh browser) opens the link,
// signs in, and the insight appears in its list. Also verifies the no-op path:
// when there are no anonymous insight IDs the redeem call still succeeds and
// sends an empty insightIds array (no regression for users without insights).
// ---------------------------------------------------------------------------

describe("Anonymous Email Insight follows the user into their account on the same device", () => {
  it("anon-created insight id is persisted, sent on cookie-scoped claim, and reassigned", async () => {
    let createdInsightId: number | undefined;

    // 1) Anonymous visitor creates an insight on the default tagged browser.
    const anon = render(
      <Wrap>
        <AnonInsightCreator onCreated={(id) => (createdInsightId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdInsightId).toBeDefined());
    expect(server.insights).toHaveLength(1);
    expect(server.insights[0]!.userId).toBeNull();
    expect(server.insights[0]!.anonToken).toBe("anon-default-browser");
    expect(readAnonymousIds().insightIds).toEqual([createdInsightId!]);
    expect(hasAnyAnonymousIds()).toBe(true);

    anon.unmount();

    // 2) The user signs in on the SAME browser (anon cookie still present).
    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-same-device-insights", email: null },
      };
    });

    // 3) Mount the insight list — useClaimAnonymousOnLogin fires the
    //    cookie-scoped claim, then useListInsights refetches.
    render(
      <Wrap>
        <InsightList />
      </Wrap>,
    );

    // The previously-anonymous insight appears in the signed-in list.
    await waitFor(() => {
      expect(screen.getByTestId(`insight-${createdInsightId}`)).toBeTruthy();
    });

    // Cookie-scoped claim was hit exactly once; cross-device redeem must not fire.
    expect(server.claimCalls).toBe(1);
    expect(server.redeemCalls).toBe(0);

    // Claim payload carried the persisted insight id.
    expect(server.lastClaimBody?.insightIds).toEqual([createdInsightId!]);

    // Server response reports the insight was claimed.
    expect(server.lastClaimResponse?.claimed.insights).toBe(1);

    // Ownership transferred on the server side.
    expect(server.insights[0]!.userId).toBe("user-same-device-insights");
    expect(server.insights[0]!.anonToken).toBeNull();

    // localStorage hand-off cleared after a successful claim.
    await waitFor(() => expect(hasAnyAnonymousIds()).toBe(false));
  });
});

describe("Anonymous Email Insight follows the user into their account via cross-device hand-off", () => {
  it("device A's anonymous insight appears on device B after the hand-off link is redeemed", async () => {
    // ===== DEVICE A — anonymous, creates an insight =====
    currentAnonToken = "anon-token-insight-A";

    let createdInsightId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonInsightCreator onCreated={(id) => (createdInsightId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdInsightId).toBeDefined());
    expect(server.insights).toHaveLength(1);
    expect(server.insights[0]!.userId).toBeNull();
    expect(server.insights[0]!.anonToken).toBe("anon-token-insight-A");

    // The insight id was written to localStorage.
    expect(readAnonymousIds().insightIds).toEqual([createdInsightId!]);

    // Device A mints a hand-off token and builds the share URL.
    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(issueRes.status).toBe(200);
    const issueBody = (await issueRes.json()) as { handoff: string };

    const shareUrl = buildHandoffShareUrl(issueBody.handoff);
    expect(shareUrl).toContain("nldc_handoff=");

    deviceA.unmount();

    // ===== DEVICE B — fresh browser, opens the share URL =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    // Device B has no anon cookie and no localStorage ids.
    expect(hasAnyAnonymousIds()).toBe(false);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-insight-B", email: null },
      };
    });

    render(
      <Wrap>
        <InsightList />
      </Wrap>,
    );

    // Device A's insight appears in device B's insight list.
    await waitFor(() => {
      expect(screen.getByTestId(`insight-${createdInsightId}`)).toBeTruthy();
    });

    // Redeem was called exactly once; cookie-scoped claim must not fire.
    expect(server.redeemCalls).toBe(1);
    expect(server.claimCalls).toBe(0);

    // Redeem payload carried the insight id from the URL.
    expect(server.lastRedeemBody?.insightIds).toEqual([createdInsightId!]);
    expect(server.lastRedeemBody?.handoff).toBe(issueBody.handoff);

    // Server response reports the insight was claimed.
    expect(server.lastRedeemResponse?.claimed.insights).toBe(1);

    // The user-facing success toast mentions "email insight" so users know
    // their insight followed them onto this device.
    await waitFor(() =>
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Welcome back",
          description: expect.stringMatching(/1 email insight\b/),
        }),
      ),
    );

    // Ownership transferred on the server side.
    expect(server.insights[0]!.userId).toBe("user-insight-B");
    expect(server.insights[0]!.anonToken).toBeNull();

    // Handoff token burned (single-use).
    expect(server.usedHandoffTokens.has(issueBody.handoff)).toBe(true);

    // Pending handoff cleared from sessionStorage after a successful redeem.
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );

    // Query-string stripped from the address bar.
    expect(window.location.search).toBe("");
  });

  it("no insightIds in the redeem body when device A had no anonymous insights (no regression)", async () => {
    // ===== DEVICE A — anonymous, creates an AUDIT only (no insights) =====
    currentAnonToken = "anon-token-no-insights-A";

    let createdAuditId: number | undefined;
    const deviceA = render(
      <Wrap>
        <AnonAuditCreator onCreated={(id) => (createdAuditId = id)} />
      </Wrap>,
    );

    await waitFor(() => expect(createdAuditId).toBeDefined());

    // Confirm no insight IDs are in localStorage.
    expect(readAnonymousIds().insightIds).toEqual([]);

    const issueRes = await fetch("/api/claim-anonymous/handoff/issue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const issueBody = (await issueRes.json()) as { handoff: string };
    const shareUrl = buildHandoffShareUrl(issueBody.handoff);

    deviceA.unmount();

    // ===== DEVICE B — fresh browser, opens the share URL =====
    switchToFreshBrowser();
    openUrlInActiveBrowser(shareUrl);

    act(() => {
      authState = {
        isAuthenticated: true,
        isLoading: false,
        user: { id: "user-no-insights-B", email: null },
      };
    });

    render(
      <Wrap>
        <InsightList />
      </Wrap>,
    );

    // Wait for redeem to fire.
    await waitFor(() => expect(server.redeemCalls).toBe(1));

    // insightIds is an empty array (not omitted), which is the no-op path.
    expect(server.lastRedeemBody?.insightIds).toEqual([]);

    // Server responded with zero claimed insights — no crash, no regression.
    expect(server.lastRedeemResponse?.claimed.insights).toBe(0);

    // Pending handoff cleared.
    await waitFor(() =>
      expect(sessionStorage.getItem("nldc:pendingHandoff")).toBeNull(),
    );
  });
});
