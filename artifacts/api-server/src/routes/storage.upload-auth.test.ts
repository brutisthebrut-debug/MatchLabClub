import { beforeEach, describe, expect, it, vi } from "vitest";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import type { AuthUser } from "@workspace/api-zod";

const storageMocks = vi.hoisted(() => ({
  getObjectEntityUploadURL: vi.fn(),
  normalizeObjectEntityPath: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class extends Error {},
  ObjectStorageService: class {
    getObjectEntityUploadURL = storageMocks.getObjectEntityUploadURL;
    normalizeObjectEntityPath = storageMocks.normalizeObjectEntityPath;
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
  };
});

import storageRouter from "./storage";

const validUploadRequest = {
  name: "profile.jpg",
  size: 128_000,
  contentType: "image/jpeg",
};

function appFor(userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (userId) {
      const user: AuthUser = {
        id: userId,
        email: `${userId}@example.com`,
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
  app.use("/api", storageRouter);
  return app;
}

beforeEach(() => {
  storageMocks.getObjectEntityUploadURL.mockReset();
  storageMocks.normalizeObjectEntityPath.mockReset();
  storageMocks.getObjectEntityUploadURL.mockResolvedValue(
    "https://storage.example/upload",
  );
  storageMocks.normalizeObjectEntityPath.mockReturnValue(
    "/objects/uploads/profile-123",
  );
});

describe("POST /api/storage/uploads/request-url", () => {
  it("rejects an anonymous caller before minting a signed URL", async () => {
    const res = await request(appFor(null))
      .post("/api/storage/uploads/request-url")
      .send(validUploadRequest);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
    expect(storageMocks.getObjectEntityUploadURL).not.toHaveBeenCalled();
  });

  it("returns a signed upload URL to an authenticated member", async () => {
    const res = await request(appFor("upload-member"))
      .post("/api/storage/uploads/request-url")
      .send(validUploadRequest);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uploadURL: "https://storage.example/upload",
      objectPath: "/objects/uploads/profile-123",
      metadata: validUploadRequest,
    });
    expect(storageMocks.getObjectEntityUploadURL).toHaveBeenCalledOnce();
  });
});
