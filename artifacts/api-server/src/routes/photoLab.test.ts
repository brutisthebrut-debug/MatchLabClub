import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import crypto from "crypto";
import {
  db,
  pool,
  photoLabRunsTable,
  profilePhotosTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";
import { RankPhotoLabResponse } from "@workspace/api-zod";
import photoLabRouter from "./photoLab";

interface TestApp {
  app: Express;
  setUser: (user: { id: string } | null) => void;
}

function makeTestApp(): TestApp {
  const app = express();
  app.use(express.json({ limit: "12mb" }));
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
  app.use("/api", photoLabRouter);
  return {
    app,
    setUser: (user) => {
      currentUser = user;
    },
  };
}

let testApp: TestApp;
const TEST_USER_ID = `test-photolab-${crypto.randomBytes(6).toString("hex")}`;
const OTHER_USER_ID = `${TEST_USER_ID}-other`;
let sourcePhotoIds: number[] = [];

beforeAll(async () => {
  testApp = makeTestApp();
  const rows = await db
    .insert(profilePhotosTable)
    .values([
      {
        userId: TEST_USER_ID,
        objectPath: "/objects/uploads/photo-lab-test-one",
        ordinal: 0,
      },
      {
        userId: TEST_USER_ID,
        objectPath: "/objects/uploads/photo-lab-test-two",
        ordinal: 1,
      },
    ])
    .returning({ id: profilePhotosTable.id });
  sourcePhotoIds = rows.map((row) => row.id);
});

afterAll(async () => {
  await db
    .delete(photoLabRunsTable)
    .where(eq(photoLabRunsTable.userId, TEST_USER_ID));
  await db
    .delete(profilePhotosTable)
    .where(eq(profilePhotosTable.userId, TEST_USER_ID));
  await pool.end();
});

describe("POST /api/photo-lab/rank", () => {
  it("rejects an empty photo list", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/photo-lab/rank")
      .send({ photos: [] });
    expect(res.status).toBe(400);
  });

  it("ranks deterministically for an anonymous caller with no Mirror handoff", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/photo-lab/rank")
      .send({
        photos: [
          { id: "p-group", shotType: "group", wellLit: true },
          {
            id: "p-solo",
            shotType: "solo_face",
            wellLit: true,
            genuineExpression: true,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(() => RankPhotoLabResponse.parse(res.body)).not.toThrow();
    // The solo shot must beat the group shot for the lead slot.
    expect(res.body.leadShotId).toBe("p-solo");
    expect(res.body.ranked[0].id).toBe("p-solo");
    expect(res.body.ranked[0].isLead).toBe(true);
    const group = res.body.ranked.find(
      (r: { id: string }) => r.id === "p-group",
    );
    expect(group.isLead).toBe(false);
    // Anonymous callers get no Mirror tie-in or next signal.
    expect(res.body.mirror).toBeNull();
    expect(res.body.nextSignal).toBeNull();
    // No images supplied, so vision was never requested.
    expect(res.body.visionMode).toBe("fallback");
  });

  it("never ranks a group shot as the lead over a solo shot", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app)
      .post("/api/photo-lab/rank")
      .send({
        photos: [
          {
            id: "g",
            shotType: "group",
            wellLit: true,
            genuineExpression: true,
          },
          { id: "s", shotType: "solo_face", wellLit: false },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.leadShotId).toBe("s");
  });

  it("gives a signed-in caller the Mirror handoff and next signal", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    const res = await request(testApp.app)
      .post("/api/photo-lab/rank")
      .send({
        photos: [{ id: "only", shotType: "solo_face", wellLit: true }],
      });
    expect(res.status).toBe(200);
    expect(() => RankPhotoLabResponse.parse(res.body)).not.toThrow();
    expect(res.body.mirror).not.toBeNull();
    expect(res.body.mirror.href).toBe("/your-mirror");
    expect(res.body.nextSignal).not.toBeNull();
  });

  it("falls back to the checklist when the deep AI lane is off, never throwing", async () => {
    // A signed-in user with no stored consent. The vision pass must fail closed
    // with a fallback reason and the request must still succeed.
    testApp.setUser({ id: TEST_USER_ID });
    const res = await request(testApp.app)
      .post("/api/photo-lab/rank")
      .send({
        photos: [
          {
            id: "withimg",
            shotType: "solo_face",
            wellLit: true,
            imageBase64:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            imageMediaType: "image/png",
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.visionMode).toBe("fallback");
    expect(res.body.visionFallbackReason).toBe("consent_required");
    expect(res.body.visionAnalysis).toBeNull();
    // Deterministic ranking still present.
    expect(res.body.leadShotId).toBe("withimg");
  });
});


describe("durable /api/me/photo-lab-runs", () => {
  it("requires authentication", async () => {
    testApp.setUser(null);
    const res = await request(testApp.app).get("/api/me/photo-lab-runs");
    expect(res.status).toBe(401);
  });

  it("creates an immutable owner-scoped run without persisting image bytes", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    const res = await request(testApp.app)
      .post("/api/me/photo-lab-runs")
      .send({
        photos: [
          {
            id: `profile-photo-${sourcePhotoIds[0]}`,
            shotType: "solo_face",
            wellLit: true,
            genuineExpression: true,
            imageBase64:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            imageMediaType: "image/png",
          },
          {
            id: `profile-photo-${sourcePhotoIds[1]}`,
            shotType: "activity",
            wellLit: true,
          },
        ],
        sourceApp: "Hinge",
      });

    expect(res.status).toBe(201);
    expect(res.body.sourcePhotoIds).toEqual(sourcePhotoIds);
    expect(res.body.inputSnapshot.photos).toHaveLength(2);
    expect(JSON.stringify(res.body.inputSnapshot)).not.toContain("imageBase64");
    expect(JSON.stringify(res.body.inputSnapshot)).not.toContain("image/png");
    expect(res.body.result.leadShotId).toBe(
      `profile-photo-${sourcePhotoIds[0]}`,
    );
    expect(res.body.createdAt).toEqual(expect.any(String));

    const list = await request(testApp.app).get("/api/me/photo-lab-runs");
    expect(list.status).toBe(200);
    expect(list.body.runs.map((run: { id: number }) => run.id)).toContain(
      res.body.id,
    );

    testApp.setUser({ id: OTHER_USER_ID });
    const hidden = await request(testApp.app).get(
      `/api/me/photo-lab-runs/${res.body.id}`,
    );
    expect(hidden.status).toBe(404);
    const cannotDelete = await request(testApp.app).delete(
      `/api/me/photo-lab-runs/${res.body.id}`,
    );
    expect(cannotDelete.status).toBe(404);

    testApp.setUser({ id: TEST_USER_ID });
    const reopened = await request(testApp.app).get(
      `/api/me/photo-lab-runs/${res.body.id}`,
    );
    expect(reopened.status).toBe(200);
    expect(reopened.body.result).toEqual(res.body.result);

    const deleted = await request(testApp.app).delete(
      `/api/me/photo-lab-runs/${res.body.id}`,
    );
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ deleted: true, id: res.body.id });
  });

  it("rejects arbitrary, duplicated, and unowned source ids", async () => {
    testApp.setUser({ id: TEST_USER_ID });
    const arbitrary = await request(testApp.app)
      .post("/api/me/photo-lab-runs")
      .send({ photos: [{ id: "temporary", shotType: "solo_face" }] });
    expect(arbitrary.status).toBe(400);

    const duplicated = await request(testApp.app)
      .post("/api/me/photo-lab-runs")
      .send({
        photos: [
          { id: `profile-photo-${sourcePhotoIds[0]}`, shotType: "solo_face" },
          { id: `profile-photo-${sourcePhotoIds[0]}`, shotType: "activity" },
        ],
      });
    expect(duplicated.status).toBe(400);

    testApp.setUser({ id: OTHER_USER_ID });
    const unowned = await request(testApp.app)
      .post("/api/me/photo-lab-runs")
      .send({
        photos: [
          { id: `profile-photo-${sourcePhotoIds[0]}`, shotType: "solo_face" },
        ],
      });
    expect(unowned.status).toBe(400);
  });
});