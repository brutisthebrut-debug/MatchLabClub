import { afterEach, describe, expect, it, vi } from "vitest";
import { updateTimeCapsulePermissions } from "./timeCapsulePermissions";

afterEach(() => vi.unstubAllGlobals());

describe("Time Capsule permissions client", () => {
  it("updates only the named owned note", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await updateTimeCapsulePermissions(42, { matchingUse: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/time-capsules/42/permissions", expect.objectContaining({ method: "PATCH", credentials: "include", body: JSON.stringify({ matchingUse: true }) }));
  });

  it("fails closed and surfaces the server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Capsule not found" }) }));
    await expect(updateTimeCapsulePermissions(7, { echoUse: true })).rejects.toThrow("Capsule not found");
  });
});
