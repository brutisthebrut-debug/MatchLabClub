import { describe, it, expect } from "vitest";
import {
  generateRehearsalTurn,
  REHEARSAL_SCENARIOS,
  type RehearsalTurnInput,
} from "./aiEngine";

function turn(scenario: string, transcript: RehearsalTurnInput["transcript"]) {
  return generateRehearsalTurn({ scenario, transcript });
}

describe("generateRehearsalTurn (deterministic baseline)", () => {
  it("opens the scene when there are no user turns yet", () => {
    const out = turn("define_the_relationship", []);
    expect(REHEARSAL_SCENARIOS.define_the_relationship!.opening).toContain(out.reply);
    expect(out.tone).toBe("opening the door");
    expect(out.note.length).toBeGreaterThan(0);
  });

  it("falls back to a known scenario for an unknown id", () => {
    const out = turn("not_a_real_scenario", []);
    expect(REHEARSAL_SCENARIOS.define_the_relationship!.opening).toContain(out.reply);
  });

  it("reacts guarded to harsh or absolute messages", () => {
    const harsh = turn("repair_after_misstep", [
      { role: "them", text: "what happened earlier didn't sit right with me." },
      { role: "you", text: "whatever, you always make everything my fault" },
    ]);
    expect(harsh.tone).toBe("guarded, a little defensive");
    expect(REHEARSAL_SCENARIOS.repair_after_misstep!.guarded).toContain(harsh.reply);
    expect(harsh.note.toLowerCase()).toContain("sharp");
  });

  it("softens after a clean apology", () => {
    const out = turn("repair_after_misstep", [
      { role: "them", text: "I'm honestly still a little hurt about earlier." },
      { role: "you", text: "I'm sorry. That was my fault and I should have handled it better." },
    ]);
    expect(out.tone).toBe("softening");
    expect(REHEARSAL_SCENARIOS.repair_after_misstep!.warm).toContain(out.reply);
    expect(out.note.toLowerCase()).toContain("apology");
  });

  it("calls out hedging language in the coach note", () => {
    const out = turn("express_a_need", [
      { role: "them", text: "You can tell me what you need from me." },
      { role: "you", text: "I guess maybe I kind of want more time together, I don't know" },
    ]);
    expect(out.note.toLowerCase()).toContain("hedged");
    expect(out.tone).toBe("engaged and listening");
  });

  it("is deterministic for the same input", () => {
    const input: RehearsalTurnInput = {
      scenario: "set_a_boundary",
      transcript: [
        { role: "them", text: "You wanted to bring something up?" },
        { role: "you", text: "I need us to text less during my work hours." },
      ],
    };
    const a = generateRehearsalTurn(input);
    const b = generateRehearsalTurn(input);
    expect(a).toEqual(b);
  });

  it("always returns non-empty reply, note, and tone for every scenario", () => {
    for (const id of Object.keys(REHEARSAL_SCENARIOS)) {
      const out = turn(id, [
        { role: "them", text: "opening" },
        { role: "you", text: "here is what I want to say." },
      ]);
      expect(out.reply.length).toBeGreaterThan(0);
      expect(out.note.length).toBeGreaterThan(0);
      expect(out.tone.length).toBeGreaterThan(0);
    }
  });

  it("contains no em dashes in any scenario copy (voice rule)", () => {
    for (const def of Object.values(REHEARSAL_SCENARIOS)) {
      const all = [
        def.label,
        def.note,
        ...def.opening,
        ...def.engaged,
        ...def.guarded,
        ...def.warm,
      ].join(" ");
      expect(all).not.toContain("\u2014");
    }
  });
});
