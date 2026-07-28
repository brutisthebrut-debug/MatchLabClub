import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";

const storageMocks = vi.hoisted(() => ({
  deleteObjectEntity: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    deleteObjectEntity = storageMocks.deleteObjectEntity;
  },
}));
vi.mock("@workspace/db", async () => await import("../lib/testDb"));
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;
  const fake = await import("../lib/testDb");
  return {
    ...actual,
    eq: fake.eq,
    and: fake.and,
    asc: fake.asc,
  };
});

import { db, profilePhotosTable } from "../lib/testDb";
import type { AuthUser } from "@workspace/api-zod";

interface TestApp {
  app: Express;
  setUser: (id: string | null) => void;
}

async function makeTestApp(): Promise<TestApp> {
  const photosRouter = (await import("./photos")).default;
  const app = express();
  app.use(express.json());
  let currentUserId: string | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUserId) {
      const user: AuthUser = {
        id: currentUserId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      };
      req.user = user;
    }
    const noop = () => undefined;
    // @ts-expect-error -- compact pino stub for route tests
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", photosRouter);
  return {
    app,
    setUser(id) {
      currentUserId = id;
    },
  };
}

let testApp: TestApp;
let dbSnapshot: Map<string, Set<unknown>>;

beforeAll(async () => {
  testApp = await makeTestApp();
});

beforeEach(async () => {
  const { snapshotTestDb } = await import("../lib/testDb");
  dbSnapshot = snapshotTestDb();
  storageMocks.deleteObjectEntity.mockReset();
  storageMocks.deleteObjectEntity.mockResolvedValue(undefined);
});

afterEach(async () => {
  const { cleanupNewRows } = await import("../lib/testDb");
  cleanupNewRows(dbSnapshot);
});

async function seedPhoto(userId: string, objectPath: string): Promise<number> {
  const [photo] = await db
    .insert(profilePhotosTable)
    .values({ userId, objectPath, ordinal: 0 })
    .returning();
  return photo!.id as number;
}

describe("DELETE /api/me/photos/:id", () => {
  it("deletes the stored object before removing the owned row", async () => {
    const userId = "photo-owner";
    const objectPath = "/objects/uploads/photo-123";
    const id = await seedPhoto(userId, objectPath);
    testApp.setUser(userId);

    const res = await request(testApp.app).delete(`/api/me/photos/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(storageMocks.deleteObjectEntity).toHaveBeenCalledWith(objectPath);
    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("profile_photos")).toEqual([]);
  });

  it("keeps the row when physical deletion fails so the member can retry", async () => {
    const userId = "photo-owner-retry";
    const objectPath = "/objects/uploads/photo-retry";
    const id = await seedPhoto(userId, objectPath);
    testApp.setUser(userId);
    storageMocks.deleteObjectEntity.mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    const res = await request(testApp.app).delete(`/api/me/photos/${id}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/retry/i);
    const { dumpTable } = await import("../lib/testDb");
    expect(dumpTable("profile_photos")).toEqual([
      expect.objectContaining({ id, userId, objectPath }),
    ]);
  });

  it("does not touch another member's object", async () => {
    const id = await seedPhoto(
      "photo-owner-other",
      "/objects/uploads/private",
    );
    testApp.setUser("not-the-owner");

    const res = await request(testApp.app).delete(`/api/me/photos/${id}`);

    expect(res.status).toBe(404);
    expect(storageMocks.deleteObjectEntity).not.toHaveBeenCalled();
  });
});
