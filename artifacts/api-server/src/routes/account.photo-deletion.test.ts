import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";

const storageMocks = vi.hoisted(() => ({
  deleteObjectEntity: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    deleteObjectEntity = storageMocks.deleteObjectEntity;
  },
}));

import {
  db,
  pool,
  profilePhotosTable,
  usersTable,
} from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";
import accountRouter from "./account";

const USER_IDS = [
  "account-photo-delete-success",
  "account-photo-delete-retry",
] as const;

async function cleanup(): Promise<void> {
  await db
    .delete(profilePhotosTable)
    .where(inArray(profilePhotosTable.userId, [...USER_IDS]));
  await db.delete(usersTable).where(inArray(usersTable.id, [...USER_IDS]));
}

function appFor(userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const user: AuthUser = {
      id: userId,
      email: `${userId}@example.com`,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };
    req.user = user;
    const noop = () => undefined;
    // @ts-expect-error -- compact pino stub for route tests
    req.log = { info: noop, warn: noop, error: noop, debug: noop };
    next();
  });
  app.use("/api", accountRouter);
  return app;
}

beforeEach(async () => {
  await cleanup();
  storageMocks.deleteObjectEntity.mockReset();
  storageMocks.deleteObjectEntity.mockResolvedValue(undefined);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("POST /api/me/account/delete removes stored profile photos", () => {
  it("deletes every photo object before completing account deletion", async () => {
    const userId = USER_IDS[0];
    const email = `${userId}@example.com`;
    await db.insert(usersTable).values({ id: userId, email });
    await db.insert(profilePhotosTable).values([
      {
        userId,
        objectPath: "/objects/uploads/account-photo-1",
        ordinal: 0,
      },
      {
        userId,
        objectPath: "/objects/uploads/account-photo-2",
        ordinal: 1,
      },
    ]);

    const res = await request(appFor(userId))
      .post("/api/me/account/delete")
      .send({ confirmation: email });

    expect(res.status).toBe(200);
    expect(storageMocks.deleteObjectEntity.mock.calls).toEqual([
      ["/objects/uploads/account-photo-1"],
      ["/objects/uploads/account-photo-2"],
    ]);
    await expect(
      db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, userId)),
    ).resolves.toEqual([]);
    await expect(
      db
        .select({ id: profilePhotosTable.id })
        .from(profilePhotosTable)
        .where(eq(profilePhotosTable.userId, userId)),
    ).resolves.toEqual([]);
  });

  it("keeps the account and photo rows when object deletion fails", async () => {
    const userId = USER_IDS[1];
    const email = `${userId}@example.com`;
    await db.insert(usersTable).values({ id: userId, email });
    await db.insert(profilePhotosTable).values({
      userId,
      objectPath: "/objects/uploads/account-photo-retry",
      ordinal: 0,
    });
    storageMocks.deleteObjectEntity.mockRejectedValueOnce(
      new Error("storage unavailable"),
    );

    const res = await request(appFor(userId))
      .post("/api/me/account/delete")
      .send({ confirmation: email });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/still intact/i);
    await expect(
      db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, userId)),
    ).resolves.toHaveLength(1);
    await expect(
      db
        .select({ id: profilePhotosTable.id })
        .from(profilePhotosTable)
        .where(eq(profilePhotosTable.userId, userId)),
    ).resolves.toHaveLength(1);
  });
});
