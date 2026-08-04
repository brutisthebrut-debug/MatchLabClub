import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { pool, db, userReportsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import founderRouter from "./founder";

const FOUNDER_USER = "founder-reports-route-test";
function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: FOUNDER_USER, email: null, firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  app.use("/api", founderRouter);
  return app;
}

let app: Express;
const createdIds: number[] = [];

beforeAll(async () => {
  await db.insert(usersTable).values({ id: FOUNDER_USER, role: "founder" }).onConflictDoNothing();
  app = makeTestApp();
});

afterAll(async () => {
  for (const id of createdIds) {
    await db.delete(userReportsTable).where(eq(userReportsTable.id, id));
  }
  await db.delete(usersTable).where(eq(usersTable.id, FOUNDER_USER));
  await pool.end();
});

describe("PATCH /founder/reports/:id/status", () => {
  it("returns the full report shape including off-platform fields", async () => {
    const reporterUserId = `founder-report-test-${crypto.randomUUID()}`;
    const [row] = await db
      .insert(userReportsTable)
      .values({
        reporterUserId,
        reportedUserId: null,
        subjectType: "off_platform",
        externalApp: "Hinge",
        externalLabel: "Alex",
        reason: "scam",
        context: "conversation",
      })
      .returning();
    expect(row).toBeDefined();
    createdIds.push(row!.id);

    const res = await request(app)
      .patch(`/api/founder/reports/${row!.id}/status`)
      
      .send({ status: "reviewed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: row!.id,
      reporterUserId,
      reportedUserId: null,
      subjectType: "off_platform",
      externalApp: "Hinge",
      externalLabel: "Alex",
      reason: "scam",
      status: "reviewed",
    });
    expect(typeof res.body.reviewedAt).toBe("string");
  });

  it("defaults member reports to subjectType member in the response", async () => {
    const reporterUserId = `founder-report-test-${crypto.randomUUID()}`;
    const reportedUserId = `founder-report-target-${crypto.randomUUID()}`;
    const [row] = await db
      .insert(userReportsTable)
      .values({
        reporterUserId,
        reportedUserId,
        subjectType: "member",
        reason: "harassment",
        context: "match",
      })
      .returning();
    expect(row).toBeDefined();
    createdIds.push(row!.id);

    const res = await request(app)
      .patch(`/api/founder/reports/${row!.id}/status`)
      
      .send({ status: "dismissed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: row!.id,
      reportedUserId,
      subjectType: "member",
      externalApp: null,
      externalLabel: null,
      status: "dismissed",
    });
  });
});
