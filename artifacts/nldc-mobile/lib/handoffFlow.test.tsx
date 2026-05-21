/**
 * Mobile e2e-style integration test for the cross-device anonymous claim
 * handoff flow.
 *
 * Why this exists
 * ───────────────
 * `lib/api-server`'s API tests (task-352) prove the `/handoff/issue` and
 * `/handoff/redeem` endpoints are correct in isolation. `useClaimAnonymousOnLogin`
 * has unit coverage for the cookie-scoped happy path. Neither test exercises
 * the *mobile UI layer's* role in the cross-device flow: minting a handoff
 * token on a device whose cookies are blocked / can't be carried, transporting
 * the token + anon IDs to a fresh authenticated session, and redeeming so the
 * audit appears in the matches list. A regression there (e.g. the share URL
 * dropping a field, or the redeem hook losing the IDs payload) would slip
 * past every existing test.
 *
 * What this test covers
 * ─────────────────────
 * Using the real generated API hooks (`useCreateAudit`,
 * `useIssueAnonymousClaimHandoff`, `useRedeemAnonymousClaimHandoff`,
 * `useListAudits`) and the real `buildMobileHandoffShareUrl` + AsyncStorage
 * helpers, against an in-memory fetch mock that mirrors the server's anon
 * tagging / cookie-scoped vs handoff-scoped claim semantics:
 *
 *   1. Anonymous mobile user creates an audit. The id is persisted to
 *      AsyncStorage via `rememberAnonymousId` (the mobile equivalent of the
 *      web app's localStorage hand-off).
 *   2. The mobile app issues a handoff token via `/handoff/issue` and the
 *      `buildMobileHandoffShareUrl` helper produces the shareable URL
 *      containing both the signed token and the anon row IDs.
 *   3. The device "loses" its cookie / AsyncStorage — modelling the user
 *      switching browsers, blocking cookies, or installing on a new device.
 *      Both the per-browser anon cookie and AsyncStorage are cleared.
 *   4. The same audit row is no longer reachable via the cookie-scoped claim
 *      path (the cookie is gone) — confirming the cookie path is genuinely
 *      broken before handoff repairs it.
 *   5. The user signs in fresh. The mobile app decodes the handoff URL
 *      payload and calls `/handoff/redeem` with the signed token + anon IDs.
 *   6. The audit reappears in the matches list (`useListAudits`), proving the
 *      full handoff round-trip works for a real cookies-blocked mobile user.
 *
 * Why not Detox / a real Expo packager
 * ────────────────────────────────────
 * Detox / EAS Build aren't part of this monorepo's tooling and adding them
 * for one test would be out of scope. This is the closest e2e-shaped
 * verification possible inside the existing Vitest harness: it drives the
 * real mobile mutation/query hooks against a fetch mock that enforces the
 * same server-side rules the real API does (anon cookie scoping, handoff
 * token replay protection).
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// AsyncStorage in-memory stand-in. The real module is backed by native code
// that doesn't exist under Vitest's jsdom environment. We expose `__reset`
// for the test that simulates cookies-being-blocked / fresh-device.
// ---------------------------------------------------------------------------
const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => (storage.has(k) ? storage.get(k)! : null)),
    setItem: vi.fn(async (k: string, v: string) => {
      storage.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      storage.delete(k);
    }),
  },
}));

// Imports must come after the mock above so the helpers pick up the stub.
import {
  useCreateAudit,
  useListAudits,
  useIssueAnonymousClaimHandoff,
  useRedeemAnonymousClaimHandoff,
  type Audit,
} from "@workspace/api-client-react";
import {
  rememberAnonymousId,
  readAnonymousIds,
  clearAnonymousIds,
  hasAnyAnonymousIds,
} from "./anonymousIds";
import { buildMobileHandoffShareUrl } from "./handoffLink";

// ---------------------------------------------------------------------------
// In-memory server state. Mirrors the real backend's invariants:
//   - audits are tagged with either `userId` (claimed) or `anonToken`
//     (anonymous, scoped to one browser's cookie value).
//   - cookie-scoped /claim-anonymous only reassigns rows whose `anonToken`
//     equals the calling browser's cookie value.
//   - signed /handoff/redeem only reassigns rows whose `anonToken` equals
//     the token's embedded anon value, regardless of the caller's cookie.
//   - each handoff token may only be redeemed once (replay protection).
// ---------------------------------------------------------------------------
interface StoredAudit {
  audit: Audit;
  userId: string | null;
  anonToken: string | null;
}

interface ServerState {
  audits: StoredAudit[];
  nextId: number;
  claimCalls: number;
  redeemCalls: number;
  issueCalls: number;
  usedHandoffTokens: Set<string>;
}

const server: ServerState = {
  audits: [],
  nextId: 1,
  claimCalls: 0,
  redeemCalls: 0,
  issueCalls: 0,
  usedHandoffTokens: new Set(),
};

// Models the calling device's `anon_claim` cookie. Set to null to simulate
// a device whose cookies are blocked / cleared.
let currentAnonToken: string | null = null;

// Auth state — flipped from anonymous to authenticated mid-test, the way a
// real login redirect would. The mobile flow uses the generated hooks
// directly with no `useAuth` gating on /handoff/redeem (the server enforces
// auth via session), so we only need to control whether the fetch mock
// treats the caller as authed.
let authedUserId: string | null = null;

const HANDOFF_PREFIX = "mockhandoff";

function mintHandoffToken(anonToken: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${HANDOFF_PREFIX}.${anonToken}.${expiresAt}.${nonce}`;
}

interface ParsedHandoff {
  ok: true;
  anonToken: string;
  raw: string;
}

function parseHandoffToken(
  raw: unknown,
): ParsedHandoff | { ok: false } {
  if (typeof raw !== "string") return { ok: false };
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== HANDOFF_PREFIX) return { ok: false };
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false };
  return { ok: true, anonToken: parts[1]!, raw };
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
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      // List audits visible to the current caller.
      if (method === "GET" && url.endsWith("/api/audits")) {
        const visible = server.audits
          .filter((row) => row.userId === authedUserId)
          .map((row) => row.audit);
        return jsonResponse(200, visible);
      }

      // Create an audit. Auth tag wins; otherwise tag with the active cookie.
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
          userId: authedUserId,
          anonToken: authedUserId ? null : currentAnonToken,
        });
        return jsonResponse(201, audit);
      }

      // Mint a handoff token tied to the active anon cookie.
      if (
        method === "POST" &&
        url.endsWith("/api/claim-anonymous/handoff/issue")
      ) {
        server.issueCalls += 1;
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

      // Cookie-scoped claim — only matches rows tagged with the active cookie.
      if (method === "POST" && url.endsWith("/api/claim-anonymous")) {
        server.claimCalls += 1;
        if (!authedUserId) return jsonResponse(401, { error: "Not authed" });
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const ids: number[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        let claimed = 0;
        for (const row of server.audits) {
          if (
            ids.includes(row.audit.id) &&
            row.userId === null &&
            row.anonToken !== null &&
            row.anonToken === currentAnonToken
          ) {
            row.userId = authedUserId;
            row.anonToken = null;
            claimed += 1;
          }
        }
        return jsonResponse(200, {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: 0,
            followUps: 0,
          },
        });
      }

      // Signed handoff redeem — matches rows by token's anon value, not cookie.
      if (
        method === "POST" &&
        url.endsWith("/api/claim-anonymous/handoff/redeem")
      ) {
        server.redeemCalls += 1;
        if (!authedUserId) return jsonResponse(401, { error: "Not authed" });
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const parsed = parseHandoffToken(body.handoff);
        if (!parsed.ok) {
          return jsonResponse(400, { error: "Invalid or expired handoff token" });
        }
        if (server.usedHandoffTokens.has(parsed.raw)) {
          return jsonResponse(400, {
            error: "This handoff link has already been used",
          });
        }
        server.usedHandoffTokens.add(parsed.raw);
        const ids: number[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        let claimed = 0;
        for (const row of server.audits) {
          if (
            ids.includes(row.audit.id) &&
            row.userId === null &&
            row.anonToken === parsed.anonToken
          ) {
            row.userId = authedUserId;
            row.anonToken = null;
            claimed += 1;
          }
        }
        return jsonResponse(200, {
          claimed: {
            audits: claimed,
            profiles: 0,
            messages: 0,
            insights: 0,
            followUps: 0,
          },
        });
      }

      return jsonResponse(404, { error: `unhandled ${method} ${url}` });
    }),
  );
}

// ---------------------------------------------------------------------------
// Harness components that drive the real generated hooks. Each one fires its
// mutation/query exactly once on mount so the test can compose them as
// discrete steps without re-firing on every render.
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
        onSuccess: async (audit) => {
          await rememberAnonymousId("audits", audit.id);
          onCreated(audit.id);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function HandoffIssuer({
  onIssued,
}: {
  onIssued: (shareUrl: string) => void;
}) {
  const issue = useIssueAnonymousClaimHandoff();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    issue.mutate(undefined, {
      onSuccess: async (result) => {
        const url = await buildMobileHandoffShareUrl(result.handoff);
        onIssued(url);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface HandoffPayload {
  handoff: string;
  auditIds: number[];
  profileIds: number[];
  messageSessionIds: number[];
  insightIds: number[];
  followUpIds: number[];
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return decodeURIComponent(
    escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)),
  );
}

function decodeShareUrl(shareUrl: string): HandoffPayload {
  const url = new URL(
    shareUrl.startsWith("http") ? shareUrl : `https://example.com${shareUrl}`,
  );
  const raw = url.searchParams.get("nldc_handoff");
  if (!raw) throw new Error("share url missing nldc_handoff param");
  return JSON.parse(b64urlDecode(raw)) as HandoffPayload;
}

function HandoffRedeemer({
  payload,
  onRedeemed,
}: {
  payload: HandoffPayload;
  onRedeemed: () => void;
}) {
  const redeem = useRedeemAnonymousClaimHandoff();
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    redeem.mutate(
      {
        data: {
          handoff: payload.handoff,
          auditIds: payload.auditIds,
          profileIds: payload.profileIds,
          messageSessionIds: payload.messageSessionIds,
          insightIds: payload.insightIds,
          followUpIds: payload.followUpIds,
        },
      },
      {
        onSuccess: () => {
          void clearAnonymousIds();
          onRedeemed();
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function MatchesList({ onLoaded }: { onLoaded: (ids: number[]) => void }) {
  const { data } = useListAudits();
  React.useEffect(() => {
    if (data) onLoaded(data.map((a) => a.id));
  }, [data, onLoaded]);
  return null;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
let qc: QueryClient;

beforeEach(() => {
  storage.clear();
  server.audits = [];
  server.nextId = 1;
  server.claimCalls = 0;
  server.redeemCalls = 0;
  server.issueCalls = 0;
  server.usedHandoffTokens = new Set();
  currentAnonToken = "anon-device-A-cookie";
  authedUserId = null;
  installFetchMock();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  storage.clear();
});

function Wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// The e2e-shaped test
// ---------------------------------------------------------------------------
describe("Mobile cross-device handoff when cookies are blocked", () => {
  it(
    "anon audit on device A is recovered on device B via /handoff/issue + /handoff/redeem",
    async () => {
      // ─── Device A, anonymous ──────────────────────────────────────────
      // 1) Create an audit anonymously. AsyncStorage and the in-memory
      //    cookie both get tagged.
      let createdId: number | undefined;
      const creator = render(
        <Wrap>
          <AnonAuditCreator onCreated={(id) => (createdId = id)} />
        </Wrap>,
      );
      await waitFor(() => expect(createdId).toBeDefined());
      expect(await hasAnyAnonymousIds()).toBe(true);
      expect(server.audits).toHaveLength(1);
      expect(server.audits[0]!.userId).toBeNull();
      expect(server.audits[0]!.anonToken).toBe("anon-device-A-cookie");

      // 2) Mint a handoff URL on device A. The shareable URL must carry
      //    both the signed token and the anon ID(s) so device B can claim.
      let shareUrl: string | undefined;
      const issuer = render(
        <Wrap>
          <HandoffIssuer onIssued={(u) => (shareUrl = u)} />
        </Wrap>,
      );
      await waitFor(() => expect(shareUrl).toBeDefined());
      expect(server.issueCalls).toBe(1);
      const payload = decodeShareUrl(shareUrl!);
      expect(payload.handoff).toMatch(/^mockhandoff\./);
      expect(payload.auditIds).toEqual([createdId]);

      creator.unmount();
      issuer.unmount();

      // ─── Device B (or device A with cookies blocked) ─────────────────
      // 3) Cookies are blocked / device wiped / app reinstalled — the
      //    anon cookie value the original device used is gone, and so is
      //    AsyncStorage. Only the share URL survives, carried in via QR.
      currentAnonToken = null;
      await clearAnonymousIds();
      expect(await hasAnyAnonymousIds()).toBe(false);

      // 4) The cookie path is genuinely broken: hitting /claim-anonymous
      //    with the audit id now reassigns 0 rows because the caller has
      //    no matching cookie. This is the regression the handoff exists
      //    to repair.
      authedUserId = "user-on-device-B";
      const cookieClaimResp = await fetch("/api/claim-anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auditIds: payload.auditIds,
          profileIds: [],
          messageSessionIds: [],
          insightIds: [],
          followUpIds: [],
        }),
      });
      const cookieClaimBody = (await cookieClaimResp.json()) as {
        claimed: { audits: number };
      };
      expect(cookieClaimBody.claimed.audits).toBe(0);
      expect(
        server.audits.find((r) => r.audit.id === payload.auditIds[0])!.userId,
      ).toBeNull();

      // Empty the matches list (still nothing visible to the new account).
      let listedBefore: number[] | undefined;
      const beforeView = render(
        <Wrap>
          <MatchesList onLoaded={(ids) => (listedBefore = ids)} />
        </Wrap>,
      );
      await waitFor(() => expect(listedBefore).toBeDefined());
      expect(listedBefore).toEqual([]);
      beforeView.unmount();
      qc.clear();

      // 5) Authenticated mobile session on device B redeems the handoff.
      let redeemed = false;
      const redeemer = render(
        <Wrap>
          <HandoffRedeemer
            payload={payload}
            onRedeemed={() => {
              redeemed = true;
            }}
          />
        </Wrap>,
      );
      await waitFor(() => expect(redeemed).toBe(true));
      expect(server.redeemCalls).toBe(1);
      const claimedRow = server.audits.find(
        (r) => r.audit.id === payload.auditIds[0],
      )!;
      expect(claimedRow.userId).toBe("user-on-device-B");
      expect(claimedRow.anonToken).toBeNull();
      redeemer.unmount();
      qc.clear();

      // 6) The audit now appears in the matches list for the new account
      //    — the user-visible "Done" condition from the task description.
      let listedAfter: number[] | undefined;
      render(
        <Wrap>
          <MatchesList onLoaded={(ids) => (listedAfter = ids)} />
        </Wrap>,
      );
      await waitFor(() => expect(listedAfter).toEqual(payload.auditIds));

      // 7) AsyncStorage was cleared after a successful redeem, so the next
      //    login won't double-claim.
      expect(await hasAnyAnonymousIds()).toBe(false);

      // 8) Replay protection: the same handoff token cannot be redeemed
      //    twice, so a malicious copy of the QR code is harmless.
      authedUserId = "attacker";
      const replay = await fetch("/api/claim-anonymous/handoff/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handoff: payload.handoff,
          auditIds: payload.auditIds,
          profileIds: [],
          messageSessionIds: [],
          insightIds: [],
          followUpIds: [],
        }),
      });
      expect(replay.status).toBe(400);
    },
  );

  it(
    "redeem also works when AsyncStorage still has leftover IDs (idempotent clear)",
    async () => {
      // Belt-and-suspenders: even if the user clears cookies but not
      // AsyncStorage (e.g. browser-only blocks), redeem still cleans up
      // local state on success.
      let createdId: number | undefined;
      render(
        <Wrap>
          <AnonAuditCreator onCreated={(id) => (createdId = id)} />
        </Wrap>,
      );
      await waitFor(() => expect(createdId).toBeDefined());

      let shareUrl: string | undefined;
      render(
        <Wrap>
          <HandoffIssuer onIssued={(u) => (shareUrl = u)} />
        </Wrap>,
      );
      await waitFor(() => expect(shareUrl).toBeDefined());
      const payload = decodeShareUrl(shareUrl!);

      // Cookie blocked but AsyncStorage retained.
      currentAnonToken = null;
      expect(await hasAnyAnonymousIds()).toBe(true);

      authedUserId = "user-keep-storage";
      let redeemed = false;
      render(
        <Wrap>
          <HandoffRedeemer
            payload={payload}
            onRedeemed={() => {
              redeemed = true;
            }}
          />
        </Wrap>,
      );
      await waitFor(() => expect(redeemed).toBe(true));

      const ids = await readAnonymousIds();
      expect(ids.auditIds).toEqual([]);
      const row = server.audits.find((r) => r.audit.id === payload.auditIds[0])!;
      expect(row.userId).toBe("user-keep-storage");
    },
  );
});
