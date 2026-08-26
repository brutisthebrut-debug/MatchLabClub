import { afterEach, describe, expect, it, vi } from "vitest";
import { updatePredictionPermissions } from "./predictionPermissions";

afterEach(() => vi.unstubAllGlobals());

describe("Prediction permissions client", () => {
  it("updates only the named owned round", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await updatePredictionPermissions("repair / pace", { matchingUse: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/predictions/repair%20%2F%20pace/permissions", expect.objectContaining({ method: "PATCH", credentials: "include", body: JSON.stringify({ matchingUse: true }) }));
  });

  it("fails closed and surfaces the server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Response not found" }) }));
    await expect(updatePredictionPermissions("private", { echoUse: true })).rejects.toThrow("Response not found");
  });
});
