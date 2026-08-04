import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Storage } from "@google-cloud/storage";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "./objectStorage";

function fakeStorage() {
  const getSignedUrl = vi.fn();
  const deleteFile = vi.fn();
  const file = vi.fn(() => ({
    getSignedUrl,
    delete: deleteFile,
  }));
  const bucket = vi.fn(() => ({ file }));
  return {
    client: { bucket } as unknown as Storage,
    bucket,
    file,
    getSignedUrl,
    deleteFile,
  };
}

describe("ObjectStorageService direct GCS behavior", () => {
  const previousPrivateDir = process.env.PRIVATE_OBJECT_DIR;

  beforeEach(() => {
    process.env.PRIVATE_OBJECT_DIR = "/matchlab-private/member-media";
  });

  afterEach(() => {
    if (previousPrivateDir === undefined) {
      delete process.env.PRIVATE_OBJECT_DIR;
    } else {
      process.env.PRIVATE_OBJECT_DIR = previousPrivateDir;
    }
  });

  it("creates a v4 GCS write URL without a Replit signer", async () => {
    const fake = fakeStorage();
    fake.getSignedUrl.mockResolvedValue(["https://storage.example/upload"]);
    const service = new ObjectStorageService(fake.client);

    await expect(service.getObjectEntityUploadURL()).resolves.toBe(
      "https://storage.example/upload",
    );

    expect(fake.bucket).toHaveBeenCalledWith("matchlab-private");
    expect(fake.file).toHaveBeenCalledWith(
      expect.stringMatching(/^member-media\/uploads\/[0-9a-f-]{36}$/),
    );
    expect(fake.getSignedUrl).toHaveBeenCalledWith({
      version: "v4",
      action: "write",
      expires: expect.any(Number),
    });
  });

  it("deletes the physical private object and treats a missing object as success", async () => {
    const fake = fakeStorage();
    fake.deleteFile.mockResolvedValue(undefined);
    const service = new ObjectStorageService(fake.client);

    await service.deleteObjectEntity("/objects/uploads/photo-123");

    expect(fake.bucket).toHaveBeenCalledWith("matchlab-private");
    expect(fake.file).toHaveBeenCalledWith(
      "member-media/uploads/photo-123",
    );
    expect(fake.deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("rejects a non-entity path before touching storage", async () => {
    const fake = fakeStorage();
    const service = new ObjectStorageService(fake.client);

    await expect(
      service.deleteObjectEntity("/public-assets/photo-123"),
    ).rejects.toBeInstanceOf(ObjectNotFoundError);
    expect(fake.bucket).not.toHaveBeenCalled();
  });
});
