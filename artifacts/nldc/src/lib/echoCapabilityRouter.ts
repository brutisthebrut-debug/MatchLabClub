import { PLAY_QUIZ_CATALOG_HREF } from "@/lib/playRoutes";

export type EchoCapabilityId =
  | "today"
  | "matches"
  | "my_matchlab"
  | "journey"
  | "play"
  | "quiz_lab"
  | "trust_data";

export type EchoCapabilityAction = {
  id: EchoCapabilityId;
  label: string;
  detail: string;
  href: string;
};

type ServerNextMove = {
  label: string;
  detail: string;
  href: string;
} | null;

const CAPABILITIES: Record<EchoCapabilityId, EchoCapabilityAction> = {
  today: {
    id: "today",
    label: "Go to Today",
    detail: "Start with the one thing that matters most right now.",
    href: "/today",
  },
  matches: {
    id: "matches",
    label: "Open Matches",
    detail: "Review the active connection, proposal, or next relationship step.",
    href: "/matches",
  },
  my_matchlab: {
    id: "my_matchlab",
    label: "Open My MatchLab",
    detail: "Work on the profile, Mirror, or learning Echo is referring to.",
    href: "/my-matchlab",
  },
  journey: {
    id: "journey",
    label: "Open Journey",
    detail: "Look at the pattern over time and choose what to carry forward.",
    href: "/journey",
  },
  play: {
    id: "play",
    label: "Open Play",
    detail: "Use a short activity to give Echo more useful context.",
    href: "/play",
  },
  quiz_lab: {
    id: "quiz_lab",
    label: "Find a quiz",
    detail: "Choose a Quiz Lab activity that fits what you are exploring.",
    href: PLAY_QUIZ_CATALOG_HREF,
  },
  trust_data: {
    id: "trust_data",
    label: "Open Trust & Data",
    detail: "Review safety, consent, privacy, or how your information is used.",
    href: "/trust-data",
  },
};

const ROUTE_ALIASES: Record<string, EchoCapabilityId> = {
  "/today": "today",
  "/matches": "matches",
  "/matching": "matches",
  "/my-matchlab": "my_matchlab",
  "/journey": "journey",
  "/play": "play",
  "/trust-data": "trust_data",
};

function actionForServerMove(move: ServerNextMove): EchoCapabilityAction | null {
  if (!move) return null;
  const path = move.href.split("?")[0] ?? move.href;
  const id = ROUTE_ALIASES[path];
  if (!id) return null;

  const canonical = CAPABILITIES[id];
  return {
    ...canonical,
    label: move.label.trim() || canonical.label,
    detail: move.detail.trim() || canonical.detail,
  };
}

/**
 * Maps a member's words to one safe, canonical MatchLab capability. This layer
 * proposes navigation only. It never writes member data, changes consent, sends
 * a message, or starts matching.
 */
export function resolveEchoCapabilityAction(input: {
  message: string;
  serverNextMove?: ServerNextMove;
}): EchoCapabilityAction | null {
  const message = input.message.trim().toLowerCase();
  if (!message) return actionForServerMove(input.serverNextMove ?? null);

  // Safety and control always win over broader relationship or profile intent.
  if (
    /\b(safety|unsafe|scam|harass|abuse|block|report|privacy|consent|delete my|export my|my data)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.trust_data;
  }

  if (
    /\b(quiz|assessment|love language|attachment style|personality test|compatibility test)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.quiz_lab;
  }

  if (
    /\b(match|matches|proposal|connection|date|dating|reveal|message them|reply to them)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.matches;
  }

  if (
    /\b(profile|bio|prompt|photo|mirror|about me|what do you know about me|learning about me)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.my_matchlab;
  }

  if (
    /\b(journey|progress|pattern|history|timeline|experiment|follow[- ]?up|what changed)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.journey;
  }

  if (/\b(play|game|activity|something fun|exercise)\b/.test(message)) {
    return CAPABILITIES.play;
  }

  if (
    /\b(today|right now|overwhelmed|where do i start|what should i do first)\b/.test(
      message,
    )
  ) {
    return CAPABILITIES.today;
  }

  return actionForServerMove(input.serverNextMove ?? null);
}
