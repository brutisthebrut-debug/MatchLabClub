import { describe, it, expect } from "vitest";
import { rollupMatches } from "./imports";

describe("rollupMatches (schema-validated Hinge parsing)", () => {
  it("returns zeros when records is not an array", () => {
    expect(rollupMatches({ not: "an array" })).toEqual({
      matches: 0,
      conversations: 0,
      messagesSent: 0,
      oldestMs: null,
      newestMs: null,
      topConversationLength: 0,
    });
  });

  it("returns zeros for null/undefined input", () => {
    expect(rollupMatches(null).matches).toBe(0);
    expect(rollupMatches(undefined).matches).toBe(0);
  });

  it("rolls up a well-formed export", () => {
    const records = [
      {
        match: [{ timestamp: "2026-01-01T00:00:00.000Z" }],
        chats: [
          { timestamp: "2026-01-02T00:00:00.000Z" },
          { timestamp: "2026-01-03T00:00:00.000Z" },
        ],
      },
      { match: [{ timestamp: "2026-02-01T00:00:00.000Z" }] },
    ];
    const out = rollupMatches(records);
    expect(out.matches).toBe(2);
    expect(out.conversations).toBe(1);
    expect(out.messagesSent).toBe(2);
    expect(out.topConversationLength).toBe(2);
    expect(out.oldestMs).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(out.newestMs).toBe(Date.parse("2026-02-01T00:00:00.000Z"));
  });

  it("drops malformed entries without zeroing the valid ones", () => {
    const records = [
      { match: [{ timestamp: "2026-01-01T00:00:00.000Z" }] },
      "not an object",
      42,
      null,
      { match: "wrong shape, should be an array" },
      { chats: [{ timestamp: "2026-01-05T00:00:00.000Z" }] },
    ];
    const out = rollupMatches(records);
    // First valid match record + the valid chats record survive; the broken
    // entries are skipped rather than throwing or collapsing to zero.
    expect(out.matches).toBe(1);
    expect(out.conversations).toBe(1);
    expect(out.messagesSent).toBe(1);
  });

  it("tolerates unknown extra keys (forward-compatible Hinge shapes)", () => {
    const records = [
      {
        match: [{ timestamp: "2026-01-01T00:00:00.000Z", newFutureField: 1 }],
        somethingHingeAddedLater: { nested: true },
      },
    ];
    expect(rollupMatches(records).matches).toBe(1);
  });

  it("ignores entries with unparseable timestamps for the date range", () => {
    const records = [
      { match: [{ timestamp: "not-a-date" }] },
      { match: [{ timestamp: "2026-03-01T00:00:00.000Z" }] },
    ];
    const out = rollupMatches(records);
    expect(out.matches).toBe(2);
    expect(out.oldestMs).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
    expect(out.newestMs).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
  });
});
