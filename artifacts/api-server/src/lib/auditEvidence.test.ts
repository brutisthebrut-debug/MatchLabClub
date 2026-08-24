import { describe, expect, it } from "vitest";
import { assessAuditEvidence } from "./auditEvidence";

describe("assessAuditEvidence", () => {
  it("accepts a specific adult profile source", () => {
    expect(
      assessAuditEvidence({
        age: 31,
        bio: "Ceramicist, reluctant morning person, and committed Sunday cook. I am looking for someone curious who wants to build a real relationship.",
      }),
    ).toEqual({ sufficient: true, reasons: [], fields: [] });
  });

  it.each(["", "test", "https://example.com", "Loves climbing and pottery"])(
    "rejects weak or wrong-format evidence: %s",
    (bio) => {
      const result = assessAuditEvidence({ age: 31, bio });
      expect(result.sufficient).toBe(false);
      expect(result.fields).toContain("bio");
    },
  );

  it("rejects missing, minor, and implausible ages", () => {
    const bio =
      "Ceramicist, reluctant morning person, and committed Sunday cook. Looking for a curious person who values an honest relationship.";
    for (const age of [null, 0, 17, 101]) {
      const result = assessAuditEvidence({ age, bio });
      expect(result.sufficient).toBe(false);
      expect(result.fields).toContain("age");
    }
  });

  it("rejects a direct age contradiction", () => {
    const result = assessAuditEvidence({
      age: 31,
      bio: "I'm 27 and I spend Sundays cooking for friends. I want a curious partner who values warmth, honesty, and an actual relationship.",
    });
    expect(result.sufficient).toBe(false);
    expect(result.fields).toEqual(expect.arrayContaining(["age", "bio"]));
    expect(result.reasons.join(" ")).toContain("conflicts");
  });
});
