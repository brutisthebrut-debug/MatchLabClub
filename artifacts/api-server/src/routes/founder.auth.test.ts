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
  "/api/founder/brain/controls",
  "/api/founder/brain/map",
  "/api/founder/brain/reweighting/nobody@example.com",
  "/api/founder/curation",
  "/api/founder/funnel",
];

const PROTECTED_POST_ROUTES = [
  "/api/founder/geoip/refresh",
  "/api/founder/brain/controls/reset",
  "/api/founder/curation",
];

const PROTECTED_PUT_ROUTES = ["/api/founder/brain/controls"];

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

    it("returns 401 with a query-param key (no longer accepted)", async () => {
      const res = await request(app).get(`${route}?key=${VALID_KEY}`);
      expect(res.status).toBe(401);
    });

    it("passes auth with a valid header key", async () => {
      const res = await request(app)
        .get(route)
        .set("x-founder-key", VALID_KEY);
      expect(res.status).not.toBe(401);
    });
  });

  describe.each(PROTECTED_POST_ROUTES)("%s", (route) => {
    it("returns 401 with no key", async () => {
      const res = await request(app).post(route);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    });

    it("returns 401 with a wrong key", async () => {
      const res = await request(app)
        .post(route)
        .set("x-founder-key", "not-the-right-key");
      expect(res.status).toBe(401);
    });

    it("passes auth with a valid header key", async () => {
      const res = await request(app)
        .post(route)
        .set("x-founder-key", VALID_KEY);
      expect(res.status).not.toBe(401);
    });
  });

  describe.each(PROTECTED_PUT_ROUTES)("%s", (route) => {
    it("returns 401 with no key", async () => {
      const res = await request(app).put(route).send({});
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    });

    it("returns 401 with a wrong key", async () => {
      const res = await request(app)
        .put(route)
        .set("x-founder-key", "not-the-right-key")
        .send({});
      expect(res.status).toBe(401);
    });

    it("passes auth with a valid header key", async () => {
      const res = await request(app)
        .put(route)
        .set("x-founder-key", VALID_KEY)
        .send({});
      expect(res.status).not.toBe(401);
    });
  });
});
