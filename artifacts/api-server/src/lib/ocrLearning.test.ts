import { describe, it, expect } from "vitest";
import { aggregateOcrCorrections, buildLearnedRules } from "./ocrLearning";
import { parseProfileText } from "./profileParser";
import type { OcrCorrectionsRecord } from "@workspace/db";

function rec(c: OcrCorrectionsRecord): { corrections: OcrCorrectionsRecord } {
  return { corrections: c };
}

describe("aggregateOcrCorrections", () => {
  it("promotes a name substitution seen at least twice", () => {
    const out = aggregateOcrCorrections([
      rec({ firstName: { raw: "Moo", corrected: "Moe" } }),
      rec({ firstName: { raw: "moo", corrected: "Moe" } }),
      rec({ firstName: { raw: "Sara", corrected: "Sarah" } }),
    ]);

    const name = out.find((r) => r.kind === "nameSubstitution");
    expect(name).toBeDefined();
    expect(name?.pattern).toBe("moo");
    expect(name?.replacement).toBe("Moe");
    expect(name?.occurrences).toBe(2);

    // Sara->Sarah only appeared once, so no rule.
    expect(out.find((r) => r.pattern === "sara")).toBeUndefined();
  });

  it("promotes a sourceApp override only when consistently corrected", () => {
    const out = aggregateOcrCorrections([
      rec({ sourceApp: { raw: "Hinge", corrected: "Bumble" } }),
      rec({ sourceApp: { raw: "hinge", corrected: "bumble" } }),
    ]);

    const sa = out.find((r) => r.kind === "sourceAppOverride");
    expect(sa).toBeDefined();
    expect(sa?.pattern).toBe("Hinge");
    expect(sa?.replacement).toBe("Bumble");
    expect(sa?.occurrences).toBe(2);
  });

  it("learns a new prompt phrase when it shows up in corrected but not raw", () => {
    const out = aggregateOcrCorrections([
      rec({
        prompts: {
          raw: ["typical sunday brunch and a walk"],
          corrected: [
            "typical sunday brunch and a walk",
            "my new fav coffee shop right now is",
          ],
        },
      }),
      rec({
        prompts: {
          raw: [],
          corrected: ["my new fav coffee shop right now is the corner"],
        },
      }),
    ]);

    // Both audits contain the same lowercase prefix in `corrected` only,
    // so it should be learned as a new prompt.
    const promptRule = out.find((r) => r.kind === "promptAddition");
    expect(promptRule).toBeDefined();
    expect(promptRule?.pattern.startsWith("my new fav coffee shop")).toBe(true);
    expect(promptRule?.occurrences).toBeGreaterThanOrEqual(2);
  });

  it("ignores corrections seen only once", () => {
    const out = aggregateOcrCorrections([
      rec({ firstName: { raw: "OneOff", corrected: "Oneoff" } }),
    ]);
    expect(out).toHaveLength(0);
  });
});

describe("parseProfileText with learned rules", () => {
  const rules = buildLearnedRules([
    {
      id: "nameSubstitution::moo",
      kind: "nameSubstitution",
      pattern: "moo",
      replacement: "Moe",
      scope: null,
      occurrences: 3,
      learnedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "sourceAppOverride::Hinge",
      kind: "sourceAppOverride",
      pattern: "Hinge",
      replacement: "Bumble",
      scope: null,
      occurrences: 3,
      learnedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "promptAddition::my new fav coffee shop is",
      kind: "promptAddition",
      pattern: "my new fav coffee shop is",
      replacement: "My new fav coffee shop is",
      scope: null,
      occurrences: 3,
      learnedAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  it("applies the name substitution to fix an OCR'd name", () => {
    const text = ["Moo", "29", "Hinge", "I love hiking"].join("\n");
    const parsed = parseProfileText(text, rules);
    expect(parsed.firstName).toBe("Moe");
  });

  it("applies the sourceApp override", () => {
    const text = ["Anna", "27", "Hinge", "Send a like", "Some bio about me here"].join("\n");
    const parsed = parseProfileText(text, rules);
    expect(parsed.sourceApp).toBe("Bumble");
  });

  it("treats a learned prompt phrase as a prompt question", () => {
    const text = [
      "Riley",
      "30",
      "Bumble",
      "Just moved here from Austin",
      "My new fav coffee shop is",
      "the little place on 4th",
    ].join("\n");
    const parsed = parseProfileText(text, rules);
    const hasPrompt = parsed.prompts.some((p) =>
      p.toLowerCase().includes("my new fav coffee shop is"),
    );
    expect(hasPrompt).toBe(true);
  });

  it("is a no-op when no rules are provided", () => {
    const text = ["Moo", "29", "Hinge", "I love hiking"].join("\n");
    const parsed = parseProfileText(text);
    expect(parsed.firstName).toBe("Moo");
    expect(parsed.sourceApp).toBe("Hinge");
  });
});
