import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db, founderActionLogsTable, pool, usersTable } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import { requireFounder } from "../middlewares/founderAuth";

const FOUNDER_ID = "founder-auth-test-founder";
const MEMBER_ID = "founder-auth-test-member";

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
    next();
  });
  app.all("/api/founder-test", requireFounder, (_req, res) => {
    res.status(204).end();
  });
  return app;
}

let app: Express;

beforeAll(async () => {
  app = makeTestApp();
  await db
    .delete(founderActionLogsTable)
    .where(
      inArray(founderActionLogsTable.actorUserId, [FOUNDER_ID, MEMBER_ID]),
    );
  await db
    .delete(usersTable)
    .where(inArray(usersTable.id, [FOUNDER_ID, MEMBER_ID]));
  await db.insert(usersTable).values([
    { id: FOUNDER_ID, email: `${FOUNDER_ID}@example.com`, role: "founder" },
    { id: MEMBER_ID, email: `${MEMBER_ID}@example.com`, role: "member" },
  ]);
});

afterAll(async () => {
  await db
    .delete(founderActionLogsTable)
    .where(
      inArray(founderActionLogsTable.actorUserId, [FOUNDER_ID, MEMBER_ID]),
    );
  await db
    .delete(usersTable)
    .where(inArray(usersTable.id, [FOUNDER_ID, MEMBER_ID]));
  await pool.end();
});

describe("founder role authorization", () => {
  it("returns 401 for an unauthenticated request", async () => {
    const res = await request(app).get("/api/founder-test");
    expect(res.status).toBe(401);
  });

  it("does not accept the retired browser founder key", async () => {
    const res = await request(app)
      .get("/api/founder-test")
      .set("x-founder-key", "nldc2024");
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated member even with the retired key", async () => {
    const res = await request(app)
      .get("/api/founder-test")
      .set("x-test-user-id", MEMBER_ID)
      .set("x-founder-key", "nldc2024");
    expect(res.status).toBe(403);
  });

  it("allows a persisted founder role and appends an actor log", async () => {
    const res = await request(app)
      .post("/api/founder-test?memberSearch=private-text")
      .set("x-test-user-id", FOUNDER_ID)
      .set("user-agent", "founder-auth-test");
    expect(res.status).toBe(204);

    // The audit insert is scheduled from the response finish event.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const rows = await db
      .select()
      .from(founderActionLogsTable)
      .where(eq(founderActionLogsTable.actorUserId, FOUNDER_ID));
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "POST",
          path: "/founder-test",
          statusCode: 204,
          userAgent: "founder-auth-test",
        }),
      ]),
    );
    expect(rows.some((row) => row.path.includes("private-text"))).toBe(false);
  });
});
