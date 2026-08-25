import { afterEach, describe, expect, it, vi } from "vitest";
import { getMirrorTrends } from "./mirrorTrends";

afterEach(() => vi.unstubAllGlobals());

describe("Mirror trends client", () => {
  it("loads the signed-in member's source-backed change report", async () => {
    const report = {
      summary: { confirmed: 1, inReview: 1, dismissed: 0, headline: "Two changes are traceable." },
      sources: [],
      uncertainties: [],
      contradictions: [],
      changes: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => report,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMirrorTrends()).resolves.toEqual(report);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/mirror-trends",
      { credentials: "include" },
    );
  });

  it("fails closed instead of substituting demo or cached trend data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not authenticated" }),
    }));

    await expect(getMirrorTrends()).rejects.toThrow("Not authenticated");
  });
});
