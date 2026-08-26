import { describe, expect, it } from "vitest";
import {
  ECHO_MEMBER_STATUS,
  projectEchoReactionForMember,
} from "./echoMemberPresentation";

describe("Echo member presentation", () => {
  it("turns an internal threshold event into honest consideration copy", () => {
    const presentation = projectEchoReactionForMember({
      tone: "crossing",
      headline: "There may be enough context for consideration.",
      nowSee: "You can review the controlled-pilot boundary.",
      nextMove: { label: "Ignored internal action", href: "/matching" },
    });

    expect(presentation).toEqual({
      title: "There may be enough context for consideration.",
      detail: "You can review the controlled-pilot boundary.",
      action: { label: "Review consideration", href: "/matches" },
    });
  });

  it("keeps the next honest action without points or scoring fields", () => {
    const presentation = projectEchoReactionForMember({
      tone: "rise",
      headline: "That added useful context.",
      nowSee: null,
      nextMove: { label: "Review My MatchLab", href: "/my-matchlab" },
    });

    expect(presentation.action).toEqual({
      label: "Review My MatchLab",
      href: "/my-matchlab",
    });
    expect(Object.keys(presentation)).toEqual(["title", "detail", "action"]);
    expect(ECHO_MEMBER_STATUS).not.toMatch(/score|readiness|threshold|points/i);
  });
});
