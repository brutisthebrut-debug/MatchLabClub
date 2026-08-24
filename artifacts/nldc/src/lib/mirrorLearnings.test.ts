import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decideMirrorLearning,
  listMirrorLearnings,
  syncMirrorLearnings,
} from "./mirrorLearnings";

afterEach(() => vi.unstubAllGlobals());

describe("mirror learning client", () => {
  it("loads the durable record without substituting sample data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ learnings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(listMirrorLearnings()).resolves.toEqual({ learnings: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/mirror-learnings",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uses explicit sync and decision operations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ learnings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await syncMirrorLearnings();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/me/mirror-learnings/sync",
      expect.objectContaining({ method: "POST" }),
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 7, status: "confirmed" }),
    });
    await decideMirrorLearning(7, { action: "set_matching", approved: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/me/mirror-learnings/7",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "set_matching", approved: true }),
      }),
    );
  });

  it("surfaces server failure instead of returning a prior or sample result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Confirm this learning first." }),
    }));
    await expect(
      decideMirrorLearning(4, { action: "set_matching", approved: true }),
    ).rejects.toThrow("Confirm this learning first.");
  });
});

