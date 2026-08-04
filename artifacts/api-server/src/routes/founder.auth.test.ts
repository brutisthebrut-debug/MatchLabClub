import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { db, pool, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import founderRouter from "./founder";
import { requireFounder } from "../middlewares/founderAuth";
const FOUNDER = "founder-role-test", MEMBER = "member-role-test";
function appFor(userId: string | null, routerOnly = false): Express {
  const app = express(); app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) req.user = { id: userId, email: null, firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  if (routerOnly) app.use("/api", founderRouter);
  else app.get("/protected", requireFounder, (_req, res) => res.json({ ok: true }));
  return app;
}
beforeAll(async () => { await db.insert(usersTable).values([{ id: FOUNDER, role: "founder" }, { id: MEMBER, role: "member" }]); });
afterAll(async () => { await db.delete(usersTable).where(inArray(usersTable.id, [FOUNDER, MEMBER])); await pool.end(); });
describe("founder authorization", () => {
  it("allows a founder without a browser secret", async () => { expect((await request(appFor(FOUNDER)).get("/protected")).status).toBe(200); });
  it("rejects a member with a legacy key", async () => { expect((await request(appFor(MEMBER)).get("/protected").set("x-founder-key","legacy")).status).toBe(403); });
  it("rejects anonymous legacy-key access", async () => { expect((await request(appFor(null)).get("/protected").set("x-founder-key","legacy")).status).toBe(401); });
  it("keeps founder routes closed anonymously", async () => { expect((await request(appFor(null,true)).get("/api/founder/stats")).status).toBe(401); });
});
