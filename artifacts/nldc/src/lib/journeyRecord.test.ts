import { afterEach, describe, expect, it, vi } from "vitest";
import { getJourneyRecord } from "./journeyRecord";

afterEach(() => vi.unstubAllGlobals());

describe("Journey record client", () => {
  it("loads the authenticated record without demo substitution", async () => {
    const record = { summary: { total: 0, reflections: 0, dates: 0, headline: "Start here." }, records: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => record });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getJourneyRecord()).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith("/api/me/journey/record", { credentials: "include" });
  });

  it("fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Not authenticated" }) }));
    await expect(getJourneyRecord()).rejects.toThrow("Not authenticated");
  });
});
