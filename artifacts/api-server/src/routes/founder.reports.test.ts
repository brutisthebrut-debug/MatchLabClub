import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { pool, db, userReportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import founderRouter from "./founder";

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", founderRouter);
  return app;
}

let app: Express;
const createdIds: number[] = [];

beforeAll(() => {
  app = makeTestApp();
});
afterAll(async () => {
  for (const id of createdIds) {
    await db.delete(userReportsTable).where(eq(userReportsTable.id, id));
  }
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
      .set("x-test-founder-role", "founder")
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
      .set("x-test-founder-role", "founder")
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
