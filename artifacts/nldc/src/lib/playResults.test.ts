import { afterEach, describe, expect, it, vi } from "vitest";
import { getDurableQuizResults } from "./playResults";

afterEach(() => vi.unstubAllGlobals());

describe("Play quiz result history", () => {
  it("loads the signed-in member's durable results without local substitution", async () => {
    const results = [{ id: 1, slug: "love-pace", archetypeKey: "steady", archetypeName: "Steady", dimensions: ["intimacy.pace"], learningConfirmed: false, echoUseAllowed: false, matchingUseAllowed: false, takenAt: "2026-08-25T00:00:00.000Z", uploadedAt: "2026-08-25T00:00:00.000Z" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getDurableQuizResults()).resolves.toEqual(results);
    expect(fetchMock).toHaveBeenCalledWith("/api/me/quiz-results", { credentials: "include" });
  });

  it("fails closed when account history cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Authentication required" }) }));
    await expect(getDurableQuizResults()).rejects.toThrow("Authentication required");
  });
});
