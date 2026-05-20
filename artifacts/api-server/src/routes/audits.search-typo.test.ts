/**
 * End-to-end test for the typo-tolerant matches search.
 *
 * The GET /api/audits handler in audits.ts switched from plain ILIKE to a
 * combination of pg_trgm operators (`%`, `word_similarity`) plus a relevance
 * order by `GREATEST(similarity(first_name, q), word_similarity(q, bio))`.
 * This is intentionally NOT testable against the in-memory testDb — pg_trgm
 * is a Postgres-side extension. So this test runs against the real
 * `@workspace/db` connection and exercises pg_trgm directly.
 *
 * It seeds a handful of audits under a unique userId (so it can't collide
 * with other tests or dev data), then verifies:
 *
 *   1. A typo'd query (e.g. "Catherne") still returns the closest match
 *      ("Catherine") even though no ILIKE substring would match.
 *   2. An exact-substring query still returns the audit it would have
 *      matched under the old ILIKE behavior.
 *   3. Results come back ordered by best similarity first when several
 *      audits could plausibly match the query.
 *
 * If pg_trgm gets misconfigured (extension missing, threshold raised, the
 * GREATEST ordering dropped, etc.), this test will catch it.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";

import { db, auditsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";
import auditsRouter from "./audits";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
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

const USER_ID = `search-typo-${crypto.randomBytes(8).toString("hex")}`;

interface SeedRow {
  firstName: string;
  bio: string;
}

async function seed(rows: SeedRow[]): Promise<void> {
  for (const r of rows) {
    await db.insert(auditsTable).values({
      firstName: r.firstName,
      age: 30,
      gender: "f",
      orientation: "straight",
      datingGoal: "find a relationship",
      currentApps: ["Hinge"],
      bio: r.bio,
      prompts: null,
      status: "complete",
      source: "screenshot",
      readinessScore: 70,
      userId: USER_ID,
      anonymousClaimToken: null,
    });
  }
}

async function clearSeed(): Promise<void> {
  await db.delete(auditsTable).where(eq(auditsTable.userId, USER_ID));
}

let testApp: TestApp;

beforeAll(() => {
  testApp = makeTestApp();
  testApp.setUser({ id: USER_ID });
});

beforeEach(async () => {
  await clearSeed();
});

afterAll(async () => {
  await clearSeed();
});

function namesOf(body: unknown): string[] {
  return (body as Array<{ firstName: string }>).map((a) => a.firstName);
}

async function search(q: string): Promise<{ status: number; names: string[] }> {
  const res = await request(testApp.app).get(
    `/api/audits?source=screenshot&q=${encodeURIComponent(q)}&limit=50`,
  );
  return {
    status: res.status,
    names: res.status === 200 ? namesOf(res.body) : [],
  };
}

describe("GET /api/audits — typo-tolerant search (pg_trgm)", () => {
  it("returns the closest-matching audit even when the query has a typo", async () => {
    await seed([
      { firstName: "Catherine", bio: "Loves trail running and pottery." },
      { firstName: "Marcus", bio: "Software engineer, climbs on weekends." },
      { firstName: "Priya", bio: "Lawyer who reads sci-fi at coffee shops." },
    ]);

    // "Catherne" — Catherine missing the 'i'. No ILIKE substring would match,
    // but pg_trgm similarity ≈ 0.58 (well above the default 0.3 threshold)
    // for first_name. If pg_trgm is wired up correctly, Catherine appears.
    const typo = await search("Catherne");
    expect(typo.status).toBe(200);
    expect(typo.names).toContain("Catherine");
    // The closest match should be at the top of the list.
    expect(typo.names[0]).toBe("Catherine");
    // Audits that have no trigram overlap with the query must not appear.
    expect(typo.names).not.toContain("Marcus");
    expect(typo.names).not.toContain("Priya");
  });

  it("still returns exact-substring matches (ILIKE path)", async () => {
    await seed([
      { firstName: "Catherine", bio: "Loves trail running." },
      { firstName: "Marcus", bio: "Software engineer." },
      { firstName: "Priya", bio: "Reads sci-fi at coffee shops every Sunday." },
    ]);

    // "sci-fi" is a literal substring of Priya's bio.
    const exact = await search("sci-fi");
    expect(exact.status).toBe(200);
    expect(exact.names).toContain("Priya");
    expect(exact.names[0]).toBe("Priya");

    // Exact first-name substring still works too.
    const byName = await search("Marc");
    expect(byName.status).toBe(200);
    expect(byName.names).toContain("Marcus");
    expect(byName.names[0]).toBe("Marcus");
  });

  it("single- and two-character queries behave as exact substring search (no fuzzy fan-out)", async () => {
    // "Niko" and its bio contain zero occurrences of the letters 'a'/'A' or
    // the bigram "al"/"Al", so it must never surface for those short queries.
    await seed([
      { firstName: "Al", bio: "Short two-letter first name." },
      { firstName: "Alexander", bio: "Longer first name with the prefix." },
      { firstName: "Niko", bio: "Crossfit every morning." },
    ]);

    // Single-character query "A": ILIKE `%A%` (case-insensitive) matches "Al"
    // and "Alexander" by firstName. "Niko" / "Crossfit every morning." contain
    // no 'a', so they must not appear — even if pg_trgm would fuzzily match
    // a single-bigram query against short strings.
    const single = await search("A");
    expect(single.status).toBe(200);
    expect(single.names).toContain("Al");
    expect(single.names).toContain("Alexander");
    expect(single.names).not.toContain("Niko");

    // Two-character query "Al": exact substring of "Al" and "Alexander";
    // absent from "Niko" and its bio — must not appear.
    const twoChar = await search("Al");
    expect(twoChar.status).toBe(200);
    expect(twoChar.names).toContain("Al");
    expect(twoChar.names).toContain("Alexander");
    expect(twoChar.names).not.toContain("Niko");

    // Sanity-check: a two-character query that matches nothing must return
    // an empty list, not a fuzzy fan-out of semi-related rows.
    const noMatch = await search("Zz");
    expect(noMatch.status).toBe(200);
    expect(noMatch.names).toHaveLength(0);
  });

  it("orders results by best-match-first when multiple audits could match", async () => {
    // Three audits with first names that differ in how close they are to
    // the query "Jonathan":
    //   - "Jonathan"  — exact match (similarity = 1.0)
    //   - "Jonathon"  — one letter off (similarity ≈ 0.6)
    //   - "Jon"       — short common prefix (similarity ≈ 0.3)
    // Ordering must reflect this descending similarity.
    await seed([
      { firstName: "Jon", bio: "Casual hiker." },
      { firstName: "Jonathon", bio: "Photographer and dog dad." },
      { firstName: "Jonathan", bio: "Architect, loves jazz." },
    ]);

    const ordered = await search("Jonathan");
    expect(ordered.status).toBe(200);
    // Strongest match comes first.
    expect(ordered.names[0]).toBe("Jonathan");
    // The typo'd variant outranks the loose-prefix one.
    const jonathonIdx = ordered.names.indexOf("Jonathon");
    const jonIdx = ordered.names.indexOf("Jon");
    expect(jonathonIdx).toBeGreaterThanOrEqual(0);
    // "Jon" is a much weaker trigram match — it may or may not clear the
    // threshold depending on pg_trgm config, but if it does appear it must
    // sit AFTER the closer variants.
    if (jonIdx >= 0) {
      expect(jonIdx).toBeGreaterThan(jonathonIdx);
    }
    expect(jonathonIdx).toBeGreaterThan(ordered.names.indexOf("Jonathan"));
  });
});
