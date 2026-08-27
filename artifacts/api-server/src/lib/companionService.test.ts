import { describe, expect, it } from "vitest";
import { formatRecentConversation } from "./companionService";

describe("formatRecentConversation", () => {
  it("keeps only the most recent turns in chronological order", () => {
    const turns = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("echo" as const),
      content: `turn ${index}`,
    }));

    const result = formatRecentConversation(turns);

    expect(result).not.toContain("turn 0");
    expect(result).not.toContain("turn 1");
    expect(result.indexOf("turn 2")).toBeLessThan(result.indexOf("turn 9"));
    expect(result).toContain("Member: turn 2");
    expect(result).toContain("Echo: turn 9");
  });

  it("caps individual turns and the complete transcript", () => {
    const turns = Array.from({ length: 8 }, () => ({
      role: "user" as const,
      content: "x".repeat(2000),
    }));

    const result = formatRecentConversation(turns);

    expect(result.length).toBeLessThanOrEqual(6000);
    expect(result.split("\n").every((line) => line.length <= 808)).toBe(true);
    expect(result.startsWith("Member: ")).toBe(true);
  });

  it("returns an empty transcript when there is no history", () => {
    expect(formatRecentConversation([])).toBe("");
  });
});
