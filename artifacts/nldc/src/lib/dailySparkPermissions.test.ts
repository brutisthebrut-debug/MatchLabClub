import { afterEach, describe, expect, it, vi } from "vitest";
import { updateDailySparkPermissions } from "./dailySparkPermissions";

afterEach(() => vi.unstubAllGlobals());

describe("Daily Spark permissions client", () => {
  it("updates only the named owned answer through the authenticated API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await updateDailySparkPermissions("repair / pace", { matchingUse: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/daily-spark/repair%20%2F%20pace/permissions",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ matchingUse: true }),
      }),
    );
  });

  it("fails closed and surfaces the server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Answer not found" }) }));
    await expect(updateDailySparkPermissions("private", { echoUse: true })).rejects.toThrow("Answer not found");
  });
});
