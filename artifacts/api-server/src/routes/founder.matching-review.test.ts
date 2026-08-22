import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, matchProposalsTable, pool } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import founderRouter from "./founder";
import matchingRouter from "./matching";

const suffix = crypto.randomBytes(6).toString("hex");
const MEMBER_ID = `review-member-${suffix}`;
const TARGET_ID = `review-target-${suffix}`;
const FOUNDER_ID = `review-founder-${suffix}`;

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const id = req.header("x-test-user-id");
    if (id) {
      const user: AuthUser = {
        id,
        email: `${id}@example.com`,
        firstName: "Test",
        lastName: "Actor",
        profileImageUrl: null,
      };
      req.user = user;
    }
    const noop = () => undefined;
    // @ts-expect-error -- focused route-test logger stub
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", founderRouter);
  app.use("/api", matchingRouter);
  return app;
}

let app: Express;

async function cleanup(): Promise<void> {
  await db
    .delete(matchProposalsTable)
    .where(eq(matchProposalsTable.userId, MEMBER_ID));
}

beforeAll(() => {
  app = makeTestApp();
});

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("founder matching review state", () => {
  it("keeps internal candidates and founder notes private until introduction", async () => {
    const [proposal] = await db
      .insert(matchProposalsTable)
      .values({
        userId: MEMBER_ID,
        proposedToUserId: TARGET_ID,
        source: "internal",
        compatibilityScore: 87,
        summary: "Member-safe compatibility summary.",
      })
      .returning();
    expect(proposal).toBeDefined();

    const hidden = await request(app)
      .get("/api/me/matching/proposals")
      .set("x-test-user-id", MEMBER_ID);
    expect(hidden.status).toBe(200);
    expect(hidden.body).toEqual([]);

    const note = await request(app)
      .post(`/api/founder/matching/proposals/${proposal!.id}/note`)
      .set("x-test-founder-role", "founder")
      .set("x-test-user-id", FOUNDER_ID)
      .send({ note: "Confirm timing before the introduction." });
    expect(note.status).toBe(200);
    expect(note.body.note).toContain("Confirm timing before the introduction.");

    const reviewed = await request(app)
      .post(`/api/founder/matching/proposals/${proposal!.id}/status`)
      .set("x-test-founder-role", "founder")
      .set("x-test-user-id", FOUNDER_ID)
      .send({ status: "reviewed" });
    expect(reviewed.status).toBe(200);

    const [afterReview] = await db
      .select()
      .from(matchProposalsTable)
      .where(eq(matchProposalsTable.id, proposal!.id));
    expect(afterReview).toMatchObject({
      status: "proposed",
      founderReviewStatus: "reviewed",
      summary: "Member-safe compatibility summary.",
    });
    expect(afterReview?.introducedAt).toBeNull();
    expect(afterReview?.founderReviewNote).toContain(
      "Confirm timing before the introduction.",
    );

    const sent = await request(app)
      .post(`/api/founder/matching/proposals/${proposal!.id}/status`)
      .set("x-test-founder-role", "founder")
      .set("x-test-user-id", FOUNDER_ID)
      .send({ status: "sent" });
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe("sent");

    const visible = await request(app)
      .get("/api/me/matching/proposals")
      .set("x-test-user-id", MEMBER_ID);
    expect(visible.status).toBe(200);
    expect(visible.body).toHaveLength(1);
    expect(visible.body[0]).toMatchObject({
      id: proposal!.id,
      status: "proposed",
      summary: "Member-safe compatibility summary.",
    });
    expect(visible.body[0]).not.toHaveProperty("founderReviewStatus");
    expect(visible.body[0]).not.toHaveProperty("founderReviewNote");
    expect(visible.body[0]).not.toHaveProperty("founderReviewedBy");
  });
});
