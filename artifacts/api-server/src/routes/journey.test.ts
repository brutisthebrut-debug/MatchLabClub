import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import type { AuthUser } from "@workspace/api-zod";

vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<string, unknown>;
  const fake = await import("../lib/testDb");
  return { ...actual, eq: fake.eq, and: fake.and, isNull: fake.isNull, desc: fake.desc };
});
vi.mock("../lib/journeyEvents", () => ({
  summarizeUserJourney: vi.fn(async () => ({
    signalsFedThisWeek: 0,
    readinessGainedThisWeek: 0,
    toolsCompletedThisWeek: 0,
    hasHistory: false,
  })),
}));

let app: Express;
let currentUser: { id: string } | null = null;
let snapshot: Map<string, Set<unknown>>;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) req.user = {
      id: currentUser.id,
      email: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    } satisfies AuthUser;
    next();
  });
  app.use("/api", (await import("./journey")).default);
});
beforeEach(async () => {
  currentUser = null;
  snapshot = (await import("../lib/testDb")).snapshotTestDb();
});
afterEach(async () => (await import("../lib/testDb")).cleanupNewRows(snapshot));

describe("Journey record", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/me/journey/record")).status).toBe(401);
  });

  it("combines only the member's active reflections and date notes", async () => {
    const { db, journalEntriesTable, postDateNotesTable } = await import("../lib/testDb");
    currentUser = { id: "journey-owner" };
    await db.insert(journalEntriesTable).values([
      { userId: "journey-owner", prompt: "What changed?", body: "I named what I needed.", tags: ["reflection"], mood: 4, deletedAt: null },
      { userId: "journey-owner", prompt: null, body: "Deleted thought", tags: [], mood: null, deletedAt: new Date() },
      { userId: "somebody-else", prompt: null, body: "Private other-member entry", tags: [], mood: null, deletedAt: null },
    ]);
    await db.insert(postDateNotesTable).values({
      userId: "journey-owner",
      personLabel: "Sam",
      summary: "Conversation felt mutual.",
      whatWentWell: "We stayed curious.",
      whatDidnt: "",
      followUpPlanned: true,
      outcome: "another_date",
      deletedAt: null,
      updatedAt: new Date(),
    });

    const response = await request(app).get("/api/me/journey/record");
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ total: 2, reflections: 1, dates: 1 });
    expect(response.body.records.map((row: { kind: string }) => row.kind).sort()).toEqual(["date", "reflection"]);
    expect(JSON.stringify(response.body)).not.toContain("Deleted thought");
    expect(JSON.stringify(response.body)).not.toContain("Private other-member entry");
    expect(response.body.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: { type: "journal_entry", id: expect.any(Number), label: "Journal" } }),
      expect.objectContaining({ title: "Date with Sam", href: expect.stringMatching(/^\/mirror\/dates/) }),
    ]));
  });
});
