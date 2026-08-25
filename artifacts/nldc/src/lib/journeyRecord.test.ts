import { afterEach, describe, expect, it, vi } from "vitest";
import { getJourneyRecord, removeJourneyItem, restoreJourneyItem, saveDateDebrief, saveReflection, saveWin, type JourneyRecordItem } from "./journeyRecord";

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

  it("loads recoverable trash only when explicitly requested", async () => {
    const record = { summary: { total: 0, reflections: 0, dates: 0, headline: "Nothing to restore." }, records: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => record });
    vi.stubGlobal("fetch", fetchMock);
    await getJourneyRecord("trash");
    expect(fetchMock).toHaveBeenCalledWith("/api/me/journey/record?view=trash", { credentials: "include" });
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

  it("creates and edits wins through the durable wins API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 9 }) });
    vi.stubGlobal("fetch", fetchMock);
    const input = { category: "personal-win" as const, body: "I asked clearly." };
    await saveWin(input);
    await saveWin(input, 9);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/me/dating-wins", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/me/dating-wins/9", expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }));
  });

  it("surfaces mutation errors instead of pretending a save worked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Entry not found" }) }));
    await expect(saveReflection({ prompt: null, body: "Still here", tags: [], mood: null }, 99)).rejects.toThrow("Entry not found");
  });

  it("soft-removes and restores the exact durable source record", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const item = { source: { type: "post_date_note", id: 12, label: "Date debrief" } } as JourneyRecordItem;
    await removeJourneyItem(item);
    await restoreJourneyItem(item);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/post-date-notes/12", { method: "DELETE", credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/post-date-notes/12/restore", { method: "POST", credentials: "include" });
  });

  it("targets the win source for remove and restore", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const item = { source: { type: "dating_win", id: 14, label: "Win" } } as JourneyRecordItem;
    await removeJourneyItem(item);
    await restoreJourneyItem(item);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/me/dating-wins/14", { method: "DELETE", credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/me/dating-wins/14/restore", { method: "POST", credentials: "include" });
  });
});
