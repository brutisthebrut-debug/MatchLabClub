export type EchoMemberReactionInput = {
  tone: "crossing" | "dip" | "rise";
  headline: string;
  nowSee?: string | null;
  nextMove?: {
    label: string;
    href: string;
  } | null;
};

export type EchoMemberReactionPresentation = {
  title: string;
  detail: string | null;
  action: {
    label: string;
    href: string;
  } | null;
};

export function projectEchoReactionForMember(
  reaction: EchoMemberReactionInput,
): EchoMemberReactionPresentation {
  return {
    title: reaction.headline,
    detail: reaction.nowSee ?? null,
    action:
      reaction.tone === "crossing"
        ? { label: "Review consideration", href: "/matches" }
        : reaction.nextMove
          ? {
              label: reaction.nextMove.label,
              href: reaction.nextMove.href,
            }
          : null,
  };
}

export const ECHO_MEMBER_STATUS = "Here with you across MatchLab";
