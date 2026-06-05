import { describe, it, expect } from "vitest";
import {
  rollupTinder,
  rollupBumble,
  mergeRollups,
  buildSummaryFromRollup,
  type ImportRollup,
} from "./datingImports";

const ZERO: ImportRollup = {
  matches: 0,
  conversations: 0,
  messagesSent: 0,
  oldestMs: null,
  newestMs: null,
  topConversationLength: 0,
};

describe("rollupTinder", () => {
  it("returns zeros for non-object input", () => {
    expect(rollupTinder(null)).toEqual(ZERO);
    expect(rollupTinder("nope")).toEqual(ZERO);
    expect(rollupTinder(42)).toEqual(ZERO);
  });

  it("prefers Tinder's own Usage aggregates for matches and messages", () => {
    const data = {
      Usage: {
        matches: { "2026-01-01": 2, "2026-01-03": 3 },
        messages_sent: { "2026-01-02": 5, "2026-01-04": 1 },
        app_opens: { "2026-01-01": 10 },
      },
      Messages: [
        {
          messages: [
            { sent_date: "2026-01-02T00:00:00.000Z" },
            { sent_date: "2026-01-02T01:00:00.000Z" },
          ],
        },
      ],
    };
    const out = rollupTinder(data);
    expect(out.matches).toBe(5);
    expect(out.messagesSent).toBe(6);
    expect(out.conversations).toBe(1);
    expect(out.topConversationLength).toBe(2);
    expect(out.oldestMs).toBe(Date.parse("2026-01-01"));
    expect(out.newestMs).toBe(Date.parse("2026-01-04"));
  });

  it("falls back to the Messages array when Usage maps are absent", () => {
    const data = {
      Messages: [
        {
          messages: [
            { sent_date: "2026-02-01T00:00:00.000Z" },
            { sent_date: "2026-02-02T00:00:00.000Z" },
          ],
        },
        { messages: [{ sent_date: "2026-02-03T00:00:00.000Z" }] },
      ],
    };
    const out = rollupTinder(data);
    expect(out.matches).toBe(2);
    expect(out.conversations).toBe(2);
    expect(out.messagesSent).toBe(3);
    expect(out.topConversationLength).toBe(2);
    expect(out.oldestMs).toBe(Date.parse("2026-02-01T00:00:00.000Z"));
    expect(out.newestMs).toBe(Date.parse("2026-02-03T00:00:00.000Z"));
  });

  it("never reads message text and skips malformed threads", () => {
    const data = {
      Messages: [
        "not an object",
        null,
        { messages: "wrong shape" },
        { messages: [{ sent_date: "2026-03-01T00:00:00.000Z", text: "hi" }] },
      ],
    };
    const out = rollupTinder(data);
    expect(out.conversations).toBe(1);
    expect(out.messagesSent).toBe(1);
  });

  it("ignores non-positive and non-numeric Usage values", () => {
    const data = {
      Usage: {
        matches: { "2026-01-01": 0, "2026-01-02": -3, "2026-01-03": "x", "2026-01-04": 4 },
      },
    };
    expect(rollupTinder(data).matches).toBe(4);
  });
});

describe("rollupBumble", () => {
  it("returns zeros when there is no array anywhere", () => {
    expect(rollupBumble({ a: 1, b: { c: 2 } })).toEqual(ZERO);
    expect(rollupBumble(null)).toEqual(ZERO);
  });

  it("counts objects that structurally look like messages", () => {
    const data = {
      chats: [
        { body: "hey", date: "2026-01-01T00:00:00.000Z", conversation_id: "a" },
        { body: "you up", date: "2026-01-02T00:00:00.000Z", conversation_id: "a" },
        { body: "different thread", date: "2026-01-03T00:00:00.000Z", conversation_id: "b" },
      ],
    };
    const out = rollupBumble(data);
    expect(out.messagesSent).toBe(3);
    expect(out.conversations).toBe(2);
    expect(out.matches).toBe(2);
    expect(out.oldestMs).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(out.newestMs).toBe(Date.parse("2026-01-03T00:00:00.000Z"));
  });

  it("falls back to message-array count when no conversation ids exist", () => {
    const data = {
      threadOne: [{ text: "a" }, { text: "b" }],
      threadTwo: [{ text: "c" }],
    };
    const out = rollupBumble(data);
    expect(out.messagesSent).toBe(3);
    expect(out.conversations).toBe(2);
  });

  it("ignores arrays that are mostly not messages", () => {
    const data = {
      stuff: [{ id: 1 }, { id: 2 }, { foo: "bar" }, { body: "the lone message" }],
    };
    // Only 1 of 4 sampled objects looks like a message (< 50%), so the array is
    // skipped entirely.
    expect(rollupBumble(data).messagesSent).toBe(0);
  });
});

describe("mergeRollups", () => {
  it("adds counts and widens the date span", () => {
    const a: ImportRollup = {
      matches: 2,
      conversations: 1,
      messagesSent: 4,
      oldestMs: Date.parse("2026-01-10"),
      newestMs: Date.parse("2026-01-20"),
      topConversationLength: 3,
    };
    const b: ImportRollup = {
      matches: 1,
      conversations: 2,
      messagesSent: 1,
      oldestMs: Date.parse("2026-01-05"),
      newestMs: Date.parse("2026-01-25"),
      topConversationLength: 5,
    };
    const out = mergeRollups(a, b);
    expect(out.matches).toBe(3);
    expect(out.conversations).toBe(3);
    expect(out.messagesSent).toBe(5);
    expect(out.topConversationLength).toBe(5);
    expect(out.oldestMs).toBe(Date.parse("2026-01-05"));
    expect(out.newestMs).toBe(Date.parse("2026-01-25"));
  });

  it("handles null date ranges on either side", () => {
    const out = mergeRollups(ZERO, {
      ...ZERO,
      matches: 1,
      oldestMs: Date.parse("2026-01-01"),
      newestMs: Date.parse("2026-01-02"),
    });
    expect(out.oldestMs).toBe(Date.parse("2026-01-01"));
    expect(out.newestMs).toBe(Date.parse("2026-01-02"));
  });
});

describe("buildSummaryFromRollup", () => {
  it("derives the stored summary shape including the message-to-match ratio", () => {
    const rollup: ImportRollup = {
      matches: 4,
      conversations: 2,
      messagesSent: 10,
      oldestMs: Date.parse("2026-01-01T00:00:00.000Z"),
      newestMs: Date.parse("2026-02-01T00:00:00.000Z"),
      topConversationLength: 6,
    };
    const summary = buildSummaryFromRollup(rollup, 3, 7, "export.zip");
    expect(summary.counts).toEqual({
      matches: 4,
      conversations: 2,
      messagesSent: 10,
      mediaFiles: 7,
      jsonFiles: 3,
    });
    expect(summary.derivedStats.messageToMatchRatio).toBe(2.5);
    expect(summary.derivedStats.oldestMatchAt).toBe(
      new Date(Date.parse("2026-01-01T00:00:00.000Z")).toISOString(),
    );
    expect(summary.originalFilename).toBe("export.zip");
  });

  it("uses a zero ratio when there are no matches", () => {
    const summary = buildSummaryFromRollup(ZERO, 0, 0, null);
    expect(summary.derivedStats.messageToMatchRatio).toBe(0);
    expect(summary.derivedStats.oldestMatchAt).toBeNull();
    expect(summary.originalFilename).toBeNull();
  });
});
