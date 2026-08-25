import { afterEach, describe, expect, it, vi } from "vitest";
import { getJourneyRecord, saveDateDebrief, saveReflection } from "./journeyRecord";

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

  it("creates and edits reflections through the durable journal API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 7 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = { prompt: "What changed?", body: "I stayed curious.", tags: ["growth"], mood: 4 };
    await saveReflection(input);
    await saveReflection(input, 7);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/journal", expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/journal/7", expect.objectContaining({ method: "PATCH", credentials: "include", body: JSON.stringify(input) }));
  });

  it("creates and edits date debriefs through the durable notes API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 8 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = { dateAt: null, personLabel: "Sam", platform: "Hinge", summary: "It felt mutual.", whatWentWell: "We listened.", whatDidnt: "", followUpPlanned: true, outcome: "another_date" as const };
    await saveDateDebrief(input);
    await saveDateDebrief(input, 8);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/post-date-notes", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/post-date-notes/8", expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }));
  });

  it("surfaces mutation errors instead of pretending a save worked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Entry not found" }) }));
    await expect(saveReflection({ prompt: null, body: "Still here", tags: [], mood: null }, 99)).rejects.toThrow("Entry not found");
  });
});
