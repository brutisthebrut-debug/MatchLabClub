import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { db, pool, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import founderRouter from "./founder";
import { requireFounder } from "../middlewares/founderAuth";

function makeTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", founderRouter);
  return app;
}

let app: Express;
const FOUNDER_USER = "founder-role-test";
const MEMBER_USER = "member-role-test";

beforeAll(async () => {
  app = makeTestApp();
  await db.insert(usersTable).values([
    { id: FOUNDER_USER, role: "founder" },
    { id: MEMBER_USER, role: "member" },
  ]);
});

afterAll(async () => {
  await db
    .delete(usersTable)
    .where(inArray(usersTable.id, [FOUNDER_USER, MEMBER_USER]));
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
  "/api/founder/brain/reweighting-impact",
  "/api/founder/curation",
  "/api/founder/funnel",
  "/api/founder/events",
];

const PROTECTED_POST_ROUTES = [
  "/api/founder/geoip/refresh",
  "/api/founder/brain/controls/reset",
  "/api/founder/curation",
];

const PROTECTED_PUT_ROUTES = ["/api/founder/brain/controls"];

describe("founder route auth", () => {
  describe("server-authoritative roles", () => {
    function roleApp(userId: string | null): Express {
      const roleTestApp = express();
      roleTestApp.use(
        (req: Request, _res: Response, next: NextFunction) => {
          if (userId) {
            req.user = {
              id: userId,
              email: null,
              firstName: null,
              lastName: null,
              profileImageUrl: null,
            };
          }
          next();
        },
      );
      roleTestApp.get("/protected", requireFounder, (_req, res) => {
        res.json({ ok: true });
      });
      return roleTestApp;
    }

    it("allows a signed-in founder without any browser key", async () => {
      const res = await request(roleApp(FOUNDER_USER)).get("/protected");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("rejects a signed-in member even if they invent a founder key", async () => {
      const res = await request(roleApp(MEMBER_USER))
        .get("/protected")
        .set("x-founder-key", "anything-a-member-wants");
      expect(res.status).toBe(403);
    });

    it("requires a signed-in account", async () => {
      const res = await request(roleApp(null)).get("/protected");
      expect(res.status).toBe(401);
    });
  });

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
