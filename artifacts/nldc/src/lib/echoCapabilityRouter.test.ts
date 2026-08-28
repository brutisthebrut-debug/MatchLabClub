import { describe, expect, it } from "vitest";
import { resolveEchoCapabilityAction } from "./echoCapabilityRouter";

describe("Echo capability routing", () => {
  it("routes quiz intent into the canonical Quiz Lab experience", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "Could we do a quiz about my attachment style?",
      }),
    ).toMatchObject({
      id: "quiz_lab",
      href: "/play?section=quizzes",
    });
  });

  it("routes profile and pattern conversations to their owning destinations", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "Help me tighten my dating profile and bio",
      }),
    ).toMatchObject({ id: "my_matchlab", href: "/my-matchlab" });

    expect(
      resolveEchoCapabilityAction({
        message: "What pattern has changed over my journey?",
      }),
    ).toMatchObject({ id: "journey", href: "/journey" });
  });

  it("prioritizes safety and member control over broader dating intent", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "This match feels unsafe. I need to report them.",
      }),
    ).toMatchObject({ id: "trust_data", href: "/trust-data" });
  });

  it("uses Echo's server-owned next move when the message has no explicit capability intent", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "I do not know what to say yet.",
        serverNextMove: {
          label: "Try Daily Spark",
          detail: "A small prompt would give me useful context.",
          href: "/play",
        },
      }),
    ).toEqual({
      id: "play",
      label: "Try Daily Spark",
      detail: "A small prompt would give me useful context.",
      href: "/play",
    });
  });

  it("keeps a safe server suggestion available before the member has typed", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "   ",
        serverNextMove: {
          label: "Go to Today",
          detail: "Start with the one thing that matters now.",
          href: "/today",
        },
      }),
    ).toEqual({
      id: "today",
      label: "Go to Today",
      detail: "Start with the one thing that matters now.",
      href: "/today",
    });
  });

  it("canonicalizes the retired matching route and rejects unknown destinations", () => {
    expect(
      resolveEchoCapabilityAction({
        message: "Help me think this through.",
        serverNextMove: {
          label: "Review matching",
          detail: "There is something waiting for you.",
          href: "/matching",
        },
      }),
    ).toMatchObject({ id: "matches", href: "/matches" });

    expect(
      resolveEchoCapabilityAction({
        message: "Help me think this through.",
        serverNextMove: {
          label: "Leave MatchLab",
          detail: "An untrusted route must not become an Echo action.",
          href: "https://example.com",
        },
      }),
    ).toBeNull();
  });
});
