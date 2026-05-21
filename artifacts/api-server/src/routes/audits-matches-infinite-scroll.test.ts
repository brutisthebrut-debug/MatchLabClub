/**
 * End-to-end-style test for the mobile Matches tab's infinite scroll.
 *
 * The mobile Matches tab (artifacts/nldc-mobile/app/(tabs)/matches.tsx) uses
 * @tanstack/react-query's useInfiniteQuery to page through audits. It always
 * passes `source: "screenshot"` and PAGE_SIZE = 50, and changing any filter
 * (q / sort / scoreRange) changes the React Query key, which forces the
 * infinite query to reset back to offset=0.
 *
 * This test exercises the exact same API contract — the same series of HTTP
 * calls the mobile screen makes — against the real Express handlers (with the
 * in-memory testDb fake). A regression that breaks pagination, the
 * `source=screenshot` filter, or any of the q/sort/scoreRange filters would
 * cause this test to fail and would re-hide older matches from heavy users.
 *
 * Why this lives in api-server and not the mobile package:
 * - The mobile package has no test runner configured.
 * - matches.tsx's infinite-scroll logic is a thin wrapper over the
 *   /api/audits limit + offset contract. The only non-React-Query behavior is
 *   the onScroll handler firing fetchNextPage when the user is within 400px of
 *   the bottom — useInfiniteQuery's filter-key reset and offset paging are
 *   library-tested behaviors. The interesting failure modes all live in the
 *   API contract this test covers.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
  const fake = await import("../lib/testDb");
  return {
    ...actual,
    eq: fake.eq,
    and: fake.and,
    or: fake.or,
    isNull: fake.isNull,
    isNotNull: fake.isNotNull,
    gte: fake.gte,
    lt: fake.lt,
    ilike: fake.ilike,
    inArray: fake.inArray,
    desc: fake.desc,
    asc: fake.asc,
    sql: fake.sql,
  };
});

import { ListAuditsResponse } from "@workspace/api-zod";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const auditsRouter = (await import("./audits")).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  let currentUser: { id: string } | null = null;

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      const user: AuthUser = {
        id: currentUser.id,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
      req.user = user;
    }
    const noop = () => undefined;
    // @ts-expect-error — test stub for pino logger
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });

  app.use("/api", auditsRouter);

  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;

beforeAll(async () => {
  testApp = await makeTestApp();
});

// Scoped cleanup: snapshot row ids before each test, then in afterEach
// delete only the rows this test inserted. See `TESTING.md`.
let dbSnapshot: Map<string, Set<unknown>>;
beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
});
afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

const USER_ID = `matches-infinite-${crypto.randomBytes(6).toString("hex")}`;

// Matches.tsx hard-codes these values; keep them in lockstep with the screen.
const PAGE_SIZE = 50;
const SOURCE = "screenshot";

const SEED_COUNT = 75; // > PAGE_SIZE, so pagination is exercised.

interface SeedRow {
  firstName: string;
  bio: string;
  readinessScore: number | null;
  source?: "manual" | "screenshot";
  createdAt?: Date;
}

async function seedAudits(rows: SeedRow[]): Promise<number[]> {
  const { db: testDb, auditsTable: tbl, dumpTable } = await import(
    "../lib/testDb"
  );
  const ids: number[] = [];
  for (const r of rows) {
    const [{ id }] = await testDb
      .insert(tbl)
      .values({
        firstName: r.firstName,
        age: 30,
        gender: "x",
        orientation: "straight",
        datingGoal: "find a relationship",
        currentApps: ["Hinge"],
        bio: r.bio,
        prompts: null,
        status: r.readinessScore === null ? "pending" : "complete",
        source: r.source ?? SOURCE,
        readinessScore: r.readinessScore,
        userId: USER_ID,
        anonymousClaimToken: null,
      })
      .returning({ id: tbl.id });
    ids.push(id as number);
  }
  // Force deterministic createdAt so newest-sort produces a stable order:
  // index 0 is the OLDEST (created Jan 1), index N-1 is the NEWEST.
  const stored = dumpTable("audits");
  for (let i = 0; i < rows.length; i++) {
    const target = stored.find((row) => row.id === ids[i]);
    if (target) {
      target.createdAt = rows[i].createdAt ?? new Date(2025, 0, 1, 0, i);
    }
  }
  return ids;
}

/**
 * Build the same 75 screenshot audits the test plan calls for:
 * - Even index → score 80 (high bucket).
 * - Odd  index → score 40 (low bucket).
 * - firstName = "M-001" .. "M-075"; createdAt strictly increasing, so newest
 *   sort returns M-075 first, M-001 last.
 */
function buildSeed(): SeedRow[] {
  return Array.from({ length: SEED_COUNT }, (_, i) => {
    const n = i + 1;
    const label = `M-${String(n).padStart(3, "0")}`;
    return {
      firstName: label,
      bio: `bio for ${label}`,
      readinessScore: n % 2 === 0 ? 80 : 40,
      source: SOURCE,
      createdAt: new Date(2025, 0, 1, 0, n), // M-001 oldest, M-075 newest.
    } satisfies SeedRow;
  });
}

function namesOf(body: unknown): string[] {
  return (body as Array<{ firstName: string }>).map((a) => a.firstName);
}

/**
 * Mirror exactly what matches.tsx's useInfiniteQuery does:
 *   queryFn: ({ pageParam }) =>
 *     listAudits({ source: 'screenshot', sort, [q], [scoreRange],
 *                  limit: PAGE_SIZE, offset: pageParam })
 *
 * `pageParam` starts at 0 and getNextPageParam returns the running total
 * length unless the last page was short. So a "page" is one HTTP call here.
 */
async function listPage(opts: {
  offset: number;
  sort?: "newest" | "topScore";
  q?: string;
  scoreRange?: "all" | "low" | "medium" | "high";
}): Promise<{ status: number; names: string[]; bodyLength: number }> {
  const params = new URLSearchParams();
  params.set("source", SOURCE);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(opts.offset));
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.q && opts.q.length > 0) params.set("q", opts.q);
  if (opts.scoreRange && opts.scoreRange !== "all") {
    params.set("scoreRange", opts.scoreRange);
  }
  const res = await request(testApp.app).get(`/api/audits?${params}`);
  return {
    status: res.status,
    names: res.status === 200 ? namesOf(res.body) : [],
    bodyLength: Array.isArray(res.body) ? res.body.length : 0,
  };
}

describe("Mobile Matches tab — infinite scroll e2e contract", () => {
  it(
    "pages through > 50 screenshot audits in newest-first order and stops when exhausted",
    async () => {
      await seedAudits(buildSeed());
      testApp.setUser({ id: USER_ID });

      // Sanity-check the full response shape on the first call — this is the
      // only point in the flow where a schema regression could cause matches.tsx
      // to reject the whole page.
      const firstRes = await request(testApp.app).get(
        `/api/audits?source=${SOURCE}&limit=${PAGE_SIZE}&offset=0&sort=newest`,
      );
      expect(firstRes.status).toBe(200);
      expect(() => ListAuditsResponse.parse(firstRes.body)).not.toThrow();

      // Page 1: 50 newest. M-075 first (newest), M-026 last.
      const page1 = await listPage({ offset: 0, sort: "newest" });
      expect(page1.status).toBe(200);
      expect(page1.bodyLength).toBe(PAGE_SIZE);
      expect(page1.names[0]).toBe("M-075");
      expect(page1.names[page1.names.length - 1]).toBe("M-026");
      // The older 25 are NOT in page 1 yet — this is the property a user
      // would see as "older matches hidden" if pagination broke.
      expect(page1.names).not.toContain("M-001");
      expect(page1.names).not.toContain("M-025");

      // useInfiniteQuery would next set pageParam = allPages length = 50.
      const page2 = await listPage({ offset: PAGE_SIZE, sort: "newest" });
      expect(page2.status).toBe(200);
      expect(page2.bodyLength).toBe(SEED_COUNT - PAGE_SIZE); // 25 remaining.
      // The older audits are now visible — this is the assertion the task
      // calls out: "scroll to the bottom and assert older audits become
      // visible".
      expect(page2.names[0]).toBe("M-025");
      expect(page2.names[page2.names.length - 1]).toBe("M-001");
      expect(page2.names).toContain("M-001");
      expect(page2.names).toContain("M-025");

      // The combined infinite-query data (page1 ++ page2) is the full set,
      // in newest-first order, with no duplicates.
      const combined = [...page1.names, ...page2.names];
      expect(combined.length).toBe(SEED_COUNT);
      expect(new Set(combined).size).toBe(SEED_COUNT);
      expect(combined[0]).toBe("M-075");
      expect(combined[combined.length - 1]).toBe("M-001");

      // Page 2 returned < PAGE_SIZE, so getNextPageParam returns undefined
      // and the mobile screen stops calling. We mirror that here.
      expect(page2.bodyLength).toBeLessThan(PAGE_SIZE);
    },
  );

  it(
    "search filter resets to page 1: typing in the search box only returns matching audits, starting from offset 0",
    async () => {
      await seedAudits(buildSeed());
      testApp.setUser({ id: USER_ID });

      // Pre-condition: page 2 of the unfiltered list does NOT include M-073
      // (it would, since M-073 has score 40 and is mid-page-1, but the user
      // doesn't know that — we just want to prove that changing the query
      // key collapses results down to a single page).
      const beforeFilter = await listPage({ offset: PAGE_SIZE, sort: "newest" });
      expect(beforeFilter.bodyLength).toBe(SEED_COUNT - PAGE_SIZE);

      // Mobile sets debouncedQuery → React Query key changes → useInfiniteQuery
      // resets to initialPageParam = 0. We replay the very first call only.
      const filtered = await listPage({
        offset: 0,
        sort: "newest",
        q: "M-073",
      });
      expect(filtered.status).toBe(200);
      expect(filtered.names).toEqual(["M-073"]);
      // List has reset to page 1: older / newer audits no longer leak through.
      expect(filtered.names).not.toContain("M-001");
      expect(filtered.names).not.toContain("M-075");
      // The next-page check returns < PAGE_SIZE, so onScroll won't trigger a
      // second fetch.
      expect(filtered.bodyLength).toBeLessThan(PAGE_SIZE);
    },
  );

  it(
    "score-range filter (High 75+) resets to page 1 and only returns high-bucket audits",
    async () => {
      await seedAudits(buildSeed());
      testApp.setUser({ id: USER_ID });

      // Even-numbered audits have score 80 → 37 high-bucket rows
      // (M-002, M-004, ..., M-074). > 1 page would imply >= PAGE_SIZE, so a
      // single page covers everything.
      const high = await listPage({
        offset: 0,
        sort: "newest",
        scoreRange: "high",
      });
      expect(high.status).toBe(200);
      const evens = Array.from({ length: 37 }, (_, i) =>
        `M-${String((i + 1) * 2).padStart(3, "0")}`,
      );
      expect(high.bodyLength).toBe(evens.length);
      // Top of the list is the newest high-score: M-074.
      expect(high.names[0]).toBe("M-074");
      expect(high.names[high.names.length - 1]).toBe("M-002");
      // Low-bucket audits (M-001, M-003, ...) are gone — the filter reset
      // worked.
      expect(high.names).not.toContain("M-001");
      expect(high.names).not.toContain("M-003");
      expect(high.names).not.toContain("M-075");
      // Every returned firstName is an even-numbered match.
      for (const name of high.names) {
        const n = Number(name.replace("M-", ""));
        expect(n % 2).toBe(0);
      }
    },
  );

  it(
    "sort filter (Top score) resets to page 1 and ordering is score-desc, not date-desc",
    async () => {
      // Build a seed where newest-sort and top-score-sort produce DIFFERENT
      // orderings. M-001 is newest but has the lowest score; M-002 is oldest
      // but has the highest score.
      const rows: SeedRow[] = [
        { firstName: "M-001", bio: "x", readinessScore: 10, source: SOURCE, createdAt: new Date(2025, 5, 1) },
        { firstName: "M-002", bio: "x", readinessScore: 99, source: SOURCE, createdAt: new Date(2025, 0, 1) },
        { firstName: "M-003", bio: "x", readinessScore: 55, source: SOURCE, createdAt: new Date(2025, 2, 1) },
      ];
      // Pad to over PAGE_SIZE so pagination is in play.
      for (let i = 4; i <= 60; i++) {
        rows.push({
          firstName: `M-${String(i).padStart(3, "0")}`,
          bio: "x",
          readinessScore: 70,
          source: SOURCE,
          createdAt: new Date(2025, 3, i),
        });
      }
      await seedAudits(rows);
      testApp.setUser({ id: USER_ID });

      const topScore = await listPage({ offset: 0, sort: "topScore" });
      expect(topScore.status).toBe(200);
      expect(topScore.bodyLength).toBe(PAGE_SIZE);
      // M-002 (score 99) must be first under topScore sort, despite being the
      // oldest. Under newest-sort the first row would be M-060, so this is
      // the assertion that proves the filter reset + sort change both apply.
      expect(topScore.names[0]).toBe("M-002");

      // M-003 (score 55) and M-001 (score 10) sit at the bottom of the
      // score-desc order. With 60 rows and PAGE_SIZE=50, both fall onto
      // page 2 (offset=50). Page 2 must end with M-001 (lowest score).
      const page2 = await listPage({ offset: PAGE_SIZE, sort: "topScore" });
      expect(page2.status).toBe(200);
      expect(page2.bodyLength).toBe(60 - PAGE_SIZE);
      expect(page2.names).toContain("M-003");
      expect(page2.names).toContain("M-001");
      expect(page2.names[page2.names.length - 1]).toBe("M-001");
    },
  );

  it(
    "source=screenshot filter excludes manual audits even when limit+offset are in play",
    async () => {
      // Mobile Matches tab ONLY ever requests source=screenshot. If the
      // server stopped honoring the filter, the user would see manual audits
      // bleeding into their screenshot list.
      const seed = buildSeed();
      // Replace 10 entries with manual audits — they must not appear.
      for (let i = 0; i < 10; i++) {
        seed[i] = { ...seed[i], firstName: `MANUAL-${i}`, source: "manual" };
      }
      await seedAudits(seed);
      testApp.setUser({ id: USER_ID });

      const page1 = await listPage({ offset: 0, sort: "newest" });
      const page2 = await listPage({ offset: PAGE_SIZE, sort: "newest" });
      const all = [...page1.names, ...page2.names];

      expect(all.length).toBe(SEED_COUNT - 10);
      for (const name of all) {
        expect(name.startsWith("MANUAL-")).toBe(false);
      }
    },
  );

  it(
    "applying a filter after scrolling collapses the result down — the equivalent of resetting to page 1",
    async () => {
      // This is the holistic "filter resets back to page 1" assertion from
      // the task. We:
      //   1. Fetch page 1 + page 2 of the unfiltered query (simulating a
      //      user who scrolled to the bottom and loaded all 75 audits).
      //   2. Apply a search filter.
      //   3. Confirm the new result set is small and contains ONLY the
      //      matching audits — i.e. the previously-loaded older audits are
      //      not stuck in the response.
      await seedAudits(buildSeed());
      testApp.setUser({ id: USER_ID });

      const p1 = await listPage({ offset: 0, sort: "newest" });
      const p2 = await listPage({ offset: PAGE_SIZE, sort: "newest" });
      expect(p1.bodyLength + p2.bodyLength).toBe(SEED_COUNT);

      // User now types "M-00" — matches M-001..M-009 (9 entries).
      // useInfiniteQuery key changes, mobile screen fires offset=0 only.
      const filtered = await listPage({
        offset: 0,
        sort: "newest",
        q: "M-00",
      });
      expect(filtered.status).toBe(200);
      // 9 matching audits, all single-page (< PAGE_SIZE) → no scroll-to-load
      // possible. Older audits like M-025, M-050, M-075 must be gone.
      expect(filtered.bodyLength).toBe(9);
      for (const name of filtered.names) {
        expect(name.startsWith("M-00")).toBe(true);
      }
      expect(filtered.names).not.toContain("M-010");
      expect(filtered.names).not.toContain("M-050");
      expect(filtered.names).not.toContain("M-075");
    },
  );
});
