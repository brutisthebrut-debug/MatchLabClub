import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the auth hook so we can flip from anonymous -> authenticated mid-test.
let authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string | null } | null;
} = { isAuthenticated: false, isLoading: false, user: null };

vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => authState,
}));

// IMPORTANT: import AFTER the mock is registered.
import {
  useCreateAudit,
  useListAudits,
  useRecordCoachFollowUp,
  type Audit,
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

interface ServerState {
  audits: StoredAudit[];
  followUps: StoredFollowUp[];
  nextId: number;
  nextFollowUpId: number;
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
  nextId: 1,
  nextFollowUpId: 1,
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
        const response = {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: 0,
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
        const response = {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: 0,
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
  server.nextId = 1;
  server.nextFollowUpId = 1;
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
});
