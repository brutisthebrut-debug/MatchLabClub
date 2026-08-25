import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteCommunicationRecord,
  listCommunicationRecords,
  saveCommunicationRecord,
} from "./communicationRecords";

afterEach(() => vi.unstubAllGlobals());

describe("Communication record client", () => {
  it("loads only the signed-in member's durable source records", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ records: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(listCommunicationRecords()).resolves.toEqual({ records: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/communication",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("saves the complete lens result and deletes through explicit operations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lens: "connection_style" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const value = {
      input: { answers: [0, 1, 2, 3, 0, 1] },
      result: { name: "Secure Builder" },
      generatedBy: "deterministic" as const,
      confidence: 100,
    };
    await saveCommunicationRecord("connection_style", value);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/me/communication/connection_style",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(value) }),
    );
    await deleteCommunicationRecord("connection_style");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/me/communication/connection_style",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("does not substitute a local or sample result after a server failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Your saved record could not load." }),
    }));
    await expect(listCommunicationRecords()).rejects.toThrow("Your saved record could not load.");
  });
});
