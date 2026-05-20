import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { pool } from "@workspace/db";
import founderRouter from "./founder";

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", founderRouter);
  return app;
}

let app: Express;

beforeAll(() => {
  app = makeTestApp();
});

afterAll(async () => {
  await pool.end();
});

const VALID_KEY = "nldc2024";

const PROTECTED_GET_ROUTES = [
  "/api/founder/stats",
  "/api/founder/ai-metrics",
  "/api/founder/ai-metrics/trends",
  "/api/founder/rollup-heartbeat",
  "/api/founder/background-jobs",
];

describe("founder route auth", () => {
  describe.each(PROTECTED_GET_ROUTES)("%s", (route) => {
    it("returns 401 with no key", async () => {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    });

    it("returns 401 with a wrong key", async () => {
      const res = await request(app)
        .get(route)
        .set("x-founder-key", "not-the-right-key");
      expect(res.status).toBe(401);
    });

    it("returns 401 with a wrong query key", async () => {
      const res = await request(app).get(`${route}?key=wrongkey`);
      expect(res.status).toBe(401);
    });

    it("passes auth with a valid header key", async () => {
      const res = await request(app)
        .get(route)
        .set("x-founder-key", VALID_KEY);
      expect(res.status).not.toBe(401);
    });

    it("passes auth with a valid query key", async () => {
      const sep = route.includes("?") ? "&" : "?";
      const res = await request(app).get(`${route}${sep}key=${VALID_KEY}`);
      expect(res.status).not.toBe(401);
    });
  });
});
